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

@real_time_announcements_router.get("/logs")
def get_logs():
    try:
        from firebase_admin import firestore
        # Order by timestamp desc
        docs = db.collection("logs").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(50).stream()
        logs = []
        for doc in docs:
            data = doc.to_dict()
            # Convert timestamp to str
            if "timestamp" in data and data["timestamp"]:
                data["timestamp"] = str(data["timestamp"])
            logs.append(data)
        return logs
    except Exception as e:
        print(f"Fetch logs failed: {e}")
        return []

def firestore_server_timestamp():
    from firebase_admin import firestore
    return firestore.SERVER_TIMESTAMP
