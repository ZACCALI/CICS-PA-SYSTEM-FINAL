from fastapi import APIRouter, HTTPException
from api.firebaseConfig import db
from pydantic import BaseModel
import datetime
from firebase_admin import firestore
from api.services.pa_controller import pa_system

emergency_route = APIRouter(prefix="/emergency", tags=["emergency"])

class EmergencyAction(BaseModel):
    user: str
    action: str # ACTIVATED / DEACTIVATED

@emergency_route.get("/")
def get_emergency_status():
    try:
        doc = db.collection("emergency").document("status").get()
        if doc.exists:
            return doc.to_dict()
        return {"active": False, "history": []}
    except Exception as e:
         return {"active": False, "history": [], "error": str(e)}

@emergency_route.post("/toggle")
def toggle_emergency(action_data: EmergencyAction):
    try:
        ref = db.collection("emergency").document("status")
        doc = ref.get()
        data = doc.to_dict() if doc.exists else {"active": False, "history": []}
        
        user = action_data.user
        action_type = action_data.action # ACTIVATED or DEACTIVATED
        should_activate = (action_type == "ACTIVATED")
        
        # 1. Update PA Controller State
        if should_activate:
            pa_system.activate_emergency(user)
        else:
            pa_system.deactivate_emergency()
            
        # 2. Update Firestore persist state
        current_history = data.get("history", [])
        
        if should_activate:
            # Add new history entry
            new_entry = {
                "id": datetime.datetime.now().isoformat(),
                "action": "ACTIVATED",
                "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                "user": user
            }
            new_history = [new_entry] + current_history
        else:
            # Add Deactivated entry
            new_entry = {
                "id": datetime.datetime.now().isoformat(),
                "action": "DEACTIVATED",
                "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                "user": user
            }
            new_history = [new_entry] + current_history

        ref.set({
            "active": should_activate,
            "history": new_history,
            "triggeredBy": user if should_activate else None,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        # 3. Log to Global Logs
        log_action = "Activated" if should_activate else "Deactivated"
        db.collection("logs").add({
            "user": user,
            "action": f"Emergency {log_action}",
            "type": "Emergency",
            "details": f"Emergency alert {log_action.lower()}",
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return {"status": "success", "active": should_activate, "history": new_history}

    except Exception as e:
        print(f"Emergency Toggle Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@emergency_route.delete("/history")
def clear_emergency_history(user: str = None):
    try:
        ref = db.collection("emergency").document("status")
        doc = ref.get()
        if doc.exists:
            current_history = doc.to_dict().get("history", [])
            if user:
                # Keep logs that are NOT from this user
                new_history = [h for h in current_history if h.get("user") != user]
                ref.update({"history": new_history})
            else:
                ref.update({"history": []})
        
        return {"message": "Emergency history cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
