from fastapi import APIRouter, HTTPException
from api.firebaseConfig import db
from pydantic import BaseModel
import datetime
from firebase_admin import firestore

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
def toggle_emergency(action: EmergencyAction):
    try:
        ref = db.collection("emergency").document("status")
        doc = ref.get()
        data = doc.to_dict() if doc.exists else {"active": False, "history": []}
        
        # Use explicit action
        should_activate = action.action == "ACTIVATED"
        current_state = data.get("active", False)
        
        # If state is already what we want, just return (idempotency), 
        # BUT we might want to log it if it's a re-issue? 
        # Let's simple apply the new state.
        
        new_state = should_activate
        
        if new_state:
            # ACTIVATED: Prepend new history entry
            history_entry = {
                "id": datetime.datetime.now().isoformat(),
                "action": "ACTIVATED",
                "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                "user": action.user
            }
            history = [history_entry] + data.get("history", [])

            # Log to Unified History
            _, doc_ref = db.collection("logs").add({
                "user": action.user,
                "action": "ACTIVATED Emergency",
                "type": "Emergency",
                "details": "Emergency Signal Broadcasting...", # Initial state
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            
            # Save the log ID to the system state so we can close it later
            ref.set({
                "active": new_state,
                "history": history,
                "current_log_id": doc_ref.id
            })
        else:
             # DEACTIVATED: Update the existing log AND history entry
             current_log_id = data.get("current_log_id")
             current_history = data.get("history", [])
             
             # Update History List (Sidebar)
             # Logic: If the top item is 'ACTIVATED', we merge.
             if current_history and current_history[0].get('action') == 'ACTIVATED':
                 # Update top item
                 start_time = current_history[0].get('time', 'Unknown')
                 end_time = datetime.datetime.now().strftime("%I:%M %p")
                 
                 # Parse start time to get just time part if it has date? 
                 # The format stored is "%Y-%m-%d %I:%M %p". Let's use it as is or simplify?
                 # User wants simple log. Let's keep the date in the start but maybe just show times?
                 # Actually, usually sidebar just shows "Time". 
                 # Let's change action to "Emergency Session" and append end time to the time field?
                 # Or better, just update the 'time' field to be the range?
                 # And 'action' to 'Emergency Session'.
                 
                 # Simplification: "Emergency Session"
                 # Time: "Start - End" (Time string)
                 
                 # We need to be careful about not making the string too long if UI expects short.
                 # Let's try: action="Emergency Session", time="... - ..."
                 
                 # Extract time part from existing string if possible, or just use current time range.
                 # Implementation:
                 current_history[0]['action'] = "Emergency Session"
                 # current_history[0]['time'] already has date. 
                 # Let's append end time.
                 current_history[0]['time'] = f"{current_history[0]['time']} - {end_time}"
                 
                 history = current_history
             else:
                 # Orphan deactivate or history missing? Fallback to add new
                 history_entry = {
                    "id": datetime.datetime.now().isoformat(),
                    "action": "DEACTIVATED",
                    "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                    "user": action.user
                }
                 history = [history_entry] + current_history

             # Still update state/history first
             ref.set({
                "active": new_state,
                "history": history,
                "current_log_id": None # Clear it
             })
             
             if current_log_id:
                 # Fetch the log to get the start time
                 try:
                     log_ref = db.collection("logs").document(current_log_id)
                     log_snap = log_ref.get()
                     start_time_str = "Unknown"
                     
                     if log_snap.exists:
                         log_data = log_snap.to_dict()
                         # timestamp is a datetime (with tz info usually, or naive UTC if server_timestamp)
                         # We want to display in System Local Time to match "now()"
                         start_ts = log_data.get("timestamp")
                         if start_ts:
                             # Convert to local time
                             # If it has tzinfo, astimezone(None) converts to local.
                             # If it is naive (UTC from firestore sometimes), we might need to verify.
                             # Usually firestore returns datetime with timezone.
                             try:
                                local_ts = start_ts.astimezone()
                                start_time_str = local_ts.strftime("%I:%M %p")
                             except:
                                # Fallback if naive
                                start_time_str = start_ts.strftime("%I:%M %p")
                     
                     end_time_str = datetime.datetime.now().strftime("%I:%M %p")
                     
                     # Update log with full details
                     log_ref.update({
                         "action": "Emergency Session",
                         "details": f"Emergency Session (Start: {start_time_str} - End: {end_time_str})"
                     })
                 except Exception as e:
                     print(f"Error updating emergency log details: {e}")
                     # Fallback update
                     db.collection("logs").document(current_log_id).update({
                         "action": "Emergency Session",
                         "details": f"Emergency mode ended. (Deactivated by {action.user})"
                     })
             else:
                 # Fallback if no ID found
                 db.collection("logs").add({
                    "user": action.user,
                    "action": "DEACTIVATED Emergency",
                    "type": "Emergency",
                    "details": "Emergency mode was deactivated (Session ID lost)",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

        return {"active": new_state, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle emergency: {str(e)}")
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
                # Clear all (Admin fallback or if no user specified?)
                # Safety: If no user, maybe don't clear? Or clear all? 
                # Let's assume standard behavior is clear all if no user, but frontend will send user.
                ref.update({"history": []})
        
        return {"message": "Emergency history cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")
