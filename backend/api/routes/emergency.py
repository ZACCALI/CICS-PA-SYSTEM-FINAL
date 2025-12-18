from fastapi import APIRouter, HTTPException
from api.firebaseConfig import db
from pydantic import BaseModel
import datetime

emergency_route = APIRouter(prefix="/emergency", tags=["emergency"])

class EmergencyAction(BaseModel):
    user: str
    action: str # ACTIVATED / DEACTIVATED

@emergency_route.get("/")
def get_emergency_status():
    try:
        doc = db.collection("system_state").document("emergency").get()
        if doc.exists:
            return doc.to_dict()
        return {"active": False, "history": []}
    except Exception as e:
         return {"active": False, "history": [], "error": str(e)}

@emergency_route.post("/toggle")
def toggle_emergency(action: EmergencyAction):
    try:
        ref = db.collection("system_state").document("emergency")
        doc = ref.get()
        data = doc.to_dict() if doc.exists else {"active": False, "history": []}
        
        # Use explicit action
        should_activate = action.action == "ACTIVATED"
        current_state = data.get("active", False)
        
        # If state is already what we want, just return (idempotency), 
        # BUT we might want to log it if it's a re-issue? 
        # Let's simple apply the new state.
        
        new_state = should_activate
        
        history_entry = {
            "id": datetime.datetime.now().isoformat(),
            "action": "ACTIVATED" if new_state else "DEACTIVATED",
            "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
            "user": action.user
        }
        
        # Prepend to history
        history = [history_entry] + data.get("history", [])
        
        ref.set({
            "active": new_state,
            "history": history
        })
        
        return {"active": new_state, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle emergency: {str(e)}")
