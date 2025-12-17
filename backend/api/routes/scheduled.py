from fastapi import APIRouter, HTTPException, Depends
from api.firebaseConfig import db
from pydantic import BaseModel, Field
from typing import Optional, Dict

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
        # We accept a dict directly to avoid strict validation on custom fields for now
        # Store in Firestore
        if "id" in schedule:
            del schedule["id"] # Let Firestore gen ID or use provided? 
            # Context uses Date.now(), we can use that if we want, but Firestore auto-ID is better.
            
        _, doc_ref = db.collection("schedules").add(schedule)
        return {"id": doc_ref.id, "message": "Schedule created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {str(e)}")

@scheduled_announcements_router.put("/{id}")
def update_schedule(id: str, schedule: dict):
    try:
        db.collection("schedules").document(id).set(schedule, merge=True)
        return {"message": "Schedule updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")

@scheduled_announcements_router.delete("/{id}")
def delete_schedule(id: str):
    try:
        db.collection("schedules").document(id).delete()
        return {"message": "Schedule deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")
