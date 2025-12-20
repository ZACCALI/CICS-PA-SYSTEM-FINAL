from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes.auth import auth_router
from api.routes.realtime import real_time_announcements_router 
from api.routes.scheduled import scheduled_announcements_router

from api.routes.account import manage_account_router
from api.routes.emergency import emergency_route

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}


app.include_router(auth_router)
app.include_router(real_time_announcements_router)
app.include_router(scheduled_announcements_router)
app.include_router(manage_account_router)
app.include_router(emergency_route)
# app.include_router(audio_router) # Commented out as it was not in the original import list or might be optional
