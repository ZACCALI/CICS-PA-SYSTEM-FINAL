
from fastapi import APIRouter, HTTPException
from api.firebaseConfig import db
from pydantic import BaseModel
from api.services.pa_controller import pa_system
from firebase_admin import firestore

real_time_announcements_router = APIRouter(prefix="/realtime", tags=["realtime"])

class BroadcastLog(BaseModel):
    user: str
    type: str  # Voice, Text, Music
    action: str # Started, Stopped
    details: str

@real_time_announcements_router.post("/log")
def log_broadcast(log: BroadcastLog):
    try:
        # PA Logic Integration
        if log.action.lower() == "started":
            success = pa_system.start_realtime(log.user, log.details)
            if not success:
                # Blocked by emergency
                raise HTTPException(status_code=409, detail="System is in Emergency mode. Realtime broadcast denied.")

        elif log.action.lower() == "stopped":
            pa_system.stop_realtime()

        # Firestore Logging (Keep existing)
        new_log = {
            'user': log.user,
            'type': log.type,
            'action': log.action,
            'details': log.details,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        update_time, doc_ref = db.collection("logs").add(new_log)
        return {"message": "Logged successfully", "id": doc_ref.id}
    except Exception as e:
        # Don't fail the request if logging fails, just print
        print(f"Logging failed: {e}")
        return {"message": "Logged (fallback)", "id": None}

class LogUpdate(BaseModel):
    action: str = None
    details: str = None

@real_time_announcements_router.put("/log/{log_id}")
def update_log(log_id: str, update: LogUpdate):
    try:
        doc_ref = db.collection("logs").document(log_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Log not found")
        
        # Only update provided fields
        fields_to_update = {k: v for k, v in update.dict().items() if v is not None}
        if fields_to_update:
            doc_ref.update(fields_to_update)
            
        return {"message": "Log updated successfully"}
    except Exception as e:
         print(f"Update log failed: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@real_time_announcements_router.delete("/log/{log_id}")
def delete_log(log_id: str, user: str = "Admin"):
    try:
        # Fetch the target log first
        doc_ref = db.collection("logs").document(log_id)
        doc_snap = doc_ref.get()
        
        if not doc_snap.exists:
             raise HTTPException(status_code=404, detail="Log not found")
             
        log_data = doc_snap.to_dict()
        
        # Delete the target log
        doc_ref.delete()
        
        return {"message": "Log deleted successfully"}
    except Exception as e:
        # Re-raise HTTP exceptions directly
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to delete log: {str(e)}")

@real_time_announcements_router.get("/logs")
def get_logs():
    try:
        from firebase_admin import firestore
        # Order by timestamp desc
        docs = db.collection("logs").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(50).stream()
        logs = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            # Convert timestamp to str
            # Convert timestamp to ISO str
            if "timestamp" in data and data["timestamp"]:
                ts = data["timestamp"]
                # Firestore timestamp object usually has .isoformat() or similar if read via firebase-admin
                # But it might be a datetime object.
                if hasattr(ts, 'isoformat'):
                    data["timestamp"] = ts.isoformat()
                else:
                    data["timestamp"] = str(ts)
            logs.append(data)
        return logs
    except Exception as e:
        print(f"Fetch logs failed: {e}")
        return []

def firestore_server_timestamp():
    from firebase_admin import firestore
    return firestore.SERVER_TIMESTAMP
