from fastapi import APIRouter, HTTPException, Depends
from api.firebaseConfig import db
from pydantic import BaseModel, Field
from typing import Optional, Dict
from firebase_admin import firestore

scheduled_announcements_router = APIRouter(prefix="/scheduled", tags=["scheduled"])

class ScheduleItem(BaseModel):
    message: str
    date: str
    time: str
    repeat: str
    zones: str
    status: str
    type: str
    # audio field handling is complex (blob), for now assuming it's handled separately or skipped in JSON validation if not strict.
    # Actually, we should allow dict or something.
    # We will ignore audio blob upload to backend for now in this JSON model and handle it as separate upload if needed.
    # Frontend stores blob in memory/indexedDB mostly. 
    # Let's just store metadata.

@scheduled_announcements_router.get("/")
def get_schedules():
    try:
        docs = db.collection("schedules").stream()
        schedules = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            schedules.append(data)
        # Sort by date/time desc (optional)
        return schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schedules: {str(e)}")

@scheduled_announcements_router.post("/")
def create_schedule(schedule: dict):
    try:
        # Validate required fields
        # Validate required fields
        required_fields = ["message", "date", "time", "repeat", "zones"]
        for field in required_fields:
            if field not in schedule or not schedule[field]:
                 raise HTTPException(status_code=400, detail=f"Missing field: {field}")

        # Store in Firestore
        if "id" in schedule:
            del schedule["id"] 
            
        _, doc_ref = db.collection("schedules").add(schedule)
        
        # Log 
        user_name = schedule.get("user", "Admin") # Use passed user or default
        db.collection("logs").add({
            "user": user_name,
            "action": "Schedule Created",
            "type": "Schedule",
            "details": f"Scheduled: {schedule.get('message', 'No message')}",
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return {"id": doc_ref.id, "message": "Schedule created"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {str(e)}")

@scheduled_announcements_router.put("/{id}")
def update_schedule(id: str, schedule: dict):
    try:
        db.collection("schedules").document(id).set(schedule, merge=True)
        
        # Log
        user_name = schedule.get("user", "Admin")
        db.collection("logs").add({
            "user": user_name,
            "action": "Schedule Updated",
            "type": "Schedule",
            "details": f"Updated schedule ID: {id}",
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return {"message": "Schedule updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")

@scheduled_announcements_router.delete("/{id}")
def delete_schedule(id: str, user: str = "Admin"):
    try:
        db.collection("schedules").document(id).delete()

        # Log
        db.collection("logs").add({
            "user": user,
            "action": "Schedule Deleted",
            "type": "Schedule",
            "details": f"Deleted schedule ID: {id}",
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return {"message": "Schedule deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")
