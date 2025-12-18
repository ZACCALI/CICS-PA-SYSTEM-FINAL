from fastapi import APIRouter, Depends, HTTPException, status
from api.firebaseConfig import db, auth
from api.routes.auth import verify_admin
from pydantic import BaseModel
import datetime

manage_account_router = APIRouter(prefix="/account", tags=["account"])

@manage_account_router.get("/")
def get_users(admin_user: dict = Depends(verify_admin)):
    """
    List all users from Firestore.
    Protected: Admin only.
    """
    try:
        users = []
        # Query Firestore users collection
        docs = db.collection("users").stream()
        for doc in docs:
            user_data = doc.to_dict()
            user_data["uid"] = doc.id
            users.append(user_data)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "user"

@manage_account_router.post("/create")
def create_user(user: CreateUserRequest, admin_user: dict = Depends(verify_admin)):
    """
    Create a new user (Auth + Firestore).
    Protected: Admin only.
    """
    try:
        # 1. Create in Firebase Auth
        auth_user = auth.create_user(
            email=user.email,
            password=user.password,
            display_name=user.name
        )
        
        # 2. Create in Firestore
        new_user_doc = {
            "uid": auth_user.uid,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "status": "approved", # Admin created = auto approved
            "createdAt": datetime.datetime.now().isoformat(),
            "lastLogin": None
        }
        db.collection("users").document(auth_user.uid).set(new_user_doc)
        
        return {"message": f"User {user.email} created successfully", "uid": auth_user.uid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@manage_account_router.put("/approve/{uid}")
def approve_user(uid: str, admin_user: dict = Depends(verify_admin)):
    """
    Approve a user account by setting status to 'approved'.
    Protected: Admin only.
    """
    try:
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_ref.update({"status": "approved"})
        return {"message": f"User {uid} approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve user: {str(e)}")

@manage_account_router.post("/reset/{uid}")
def reset_user(uid: str, admin_user: dict = Depends(verify_admin)):
    """
    Reset a user account password to '12345678' and status to 'pending' (optional).
    Protected: Admin only.
    """
    try:
        # 1. Reset Password in Firebase Auth
        auth.update_user(uid, password="12345678")
        
        # 2. Update status in Firestore if needed (optional based on requirement)
        # user_ref = db.collection("users").document(uid)
        # user_ref.update({"status": "pending"}) 
        
        return {"message": f"User {uid} password reset to 12345678 successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset user: {str(e)}")

@manage_account_router.delete("/{uid}")
def delete_user(uid: str, admin_user: dict = Depends(verify_admin)):
    """
    Delete a user from both Firebase Authentication and Firestore.
    Protected: Admin only.
    """
    try:
        # 1. Delete from Firestore
        db.collection("users").document(uid).delete()
        
        # 2. Delete from Firebase Authentication
        try:
            auth.delete_user(uid)
        except auth.UserNotFoundError:
            # If user not in Auth but in Firestore, we proceed
            pass
            
        return {"message": f"User {uid} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
