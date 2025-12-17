from fastapi import APIRouter, HTTPException
from api.firebaseConfig import db
from pydantic import BaseModel

real_time_announcements_router = APIRouter(prefix="/realtime", tags=["realtime"])

class BroadcastAction(BaseModel):
    user: str
    type: str # 'voice' or 'text'
    action: str # 'START', 'STOP', 'MESSAGE'
    details: str

@real_time_announcements_router.post("/log")
def log_broadcast(action: BroadcastAction):
    try:
        # Just log to a 'logs' collection in Firestore
        log_entry = action.dict()
        log_entry["timestamp"] = firestore_server_timestamp()
        db.collection("logs").add(log_entry)
        return {"message": "Logged successfully"}
    except Exception as e:
        # Don't fail the request if logging fails, just print
        print(f"Logging failed: {e}")
        return {"message": "Logged (fallback)"}

def firestore_server_timestamp():
    from firebase_admin import firestore
    return firestore.SERVER_TIMESTAMP
