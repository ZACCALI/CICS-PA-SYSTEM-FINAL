from fastapi import APIRouter


audio_router = APIRouter(prefix="/audio", tags=["audio"])

@audio_router.get("/")
def audio_router_root():
    return {"message": "at audio route"}