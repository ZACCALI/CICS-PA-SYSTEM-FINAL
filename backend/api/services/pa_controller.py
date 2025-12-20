import threading
import time
from typing import List, Optional, Dict
from datetime import datetime

class PAController:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(PAController, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        # State
        self.emergency_active: bool = False
        self.realtime_active: bool = False
        self.scheduled_queue: List[Dict] = [] # List of schedule objects
        self.current_scheduled: Optional[Dict] = None # Currently playing scheduled item
        
        self.playback_status: Dict = {
            "type": "Idle",  # Emergency, Realtime, Scheduled, Audio, Idle
            "details": None,
            "status": "Ready"
        }
        
        self._initialized = True
        self._evaluate_state()

    # --- PUBLIC API ---

    def activate_emergency(self, user: str):
        """
        Activates Emergency Mode.
        Interrupts everything.
        """
        with self._lock:
            self.emergency_active = True
            
            # Interruption Logic
            self._handle_interruption("Emergency")
            
            self._update_status("Emergency", f"Emergency triggered by {user}", "Active")
            print(f"[PA] EMERGENCY ACTIVATED by {user}")

    def deactivate_emergency(self):
        """
        Deactivates Emergency Mode.
        Resumes lower priorities.
        """
        with self._lock:
            self.emergency_active = False
            print("[PA] Emergency Deactivated")
            self._evaluate_state()

    def start_realtime(self, user: str, details: str):
        """
        Starts Realtime Announcement.
        Returns False if blocked by Emergency.
        """
        with self._lock:
            if self.emergency_active:
                print(f"[PA] Realtime blocked by Emergency")
                return False
            
            self.realtime_active = True
            self._handle_interruption("Realtime")
            
            self._update_status("Realtime", details, "Broadcasting")
            print(f"[PA] Realtime Started: {details}")
            return True

    def stop_realtime(self):
        """
        Stops Realtime Announcement.
        """
        with self._lock:
            if not self.realtime_active:
                return

            self.realtime_active = False
            print("[PA] Realtime Stopped")
            self._evaluate_state()

    def add_schedule(self, schedule: Dict):
        """
        Adds a schedule to the queue.
        schedule dict must have: id, message, duration (est), etc.
        """
        with self._lock:
            # Add to queue
            # Logic: In a real system, we might sort by desired time.
            # For this 'Queue Based' requirement, we just append or insert based on time.
            # Simple assumption: Input is already "ready to play" or we check time elsewhere.
            # Assuming this queue is for "Pending Execution".
            
            # Simple Priority Queue: Sort by date/time
            self.scheduled_queue.append(schedule)
            self.scheduled_queue.sort(key=lambda x: (x.get('date'), x.get('time')))
            
            print(f"[PA] Schedule Added: {schedule.get('id')} - {schedule.get('message')}")
            self._evaluate_state()

    def get_status(self):
        return self.playback_status

    # --- INTERNAL LOGIC ---

    def _handle_interruption(self, interrupter_type: str):
        """
        Handles interruption of lower priority tasks.
        """
        # If interrupting Scheduled
        if self.current_scheduled:
            print(f"[PA] Scheduled Item '{self.current_scheduled.get('id')}' interrupted by {interrupter_type}")
            # Re-queue at the front
            self.scheduled_queue.insert(0, self.current_scheduled)
            self.current_scheduled = None
        
        # If interrupting Audio (conceptually)
        # We don't track audio object explicitly here detailedly, but state updates handle it.

    def _update_status(self, type_: str, details: str, status: str):
        self.playback_status = {
            "type": type_,
            "details": details,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }

    def _evaluate_state(self):
        """
        The Brain. Determines what should be playing right now.
        Priority: Emergency > Realtime > Scheduled Queue > Audio
        """
        # 1. Emergency
        if self.emergency_active:
            # Status already set in activate
            return

        # 2. Realtime
        if self.realtime_active:
            # Status already set in start
            return

        # 3. Scheduled
        if self.scheduled_queue:
            next_item = self.scheduled_queue.pop(0)
            self.current_scheduled = next_item
            
            msg = next_item.get('message') or "Scheduled Audio"
            self._update_status("Scheduled", msg, "Playing")
            print(f"[PA] Playing Scheduled: {msg}")
            
            # In a real system, we'd trigger the hardware here.
            # And we'd need a callback when it finishes to call _evaluate_state again.
            # For this logic controller, we assume 'play' starts. 
            # NOTE: We need a way to finish scheduled items! 
            # Ideally, the playback service calls back 'finish_schedule'. 
            # I will add a 'finish_current_schedule' method for simulation/flow.
            return

        # 4. Background / Idle
        self._update_status("Audio", "Background Music", "Playing" if self._is_audio_system_on() else "Idle")
        print("[PA] System Idle / Background Audio")

    def finish_current_schedule(self):
        """
        Call this when a scheduled item finishes playing naturally.
        """
        with self._lock:
            if self.current_scheduled:
                print(f"[PA] Scheduled Finished: {self.current_scheduled.get('id')}")
                # Mark as complete in DB? (Controller just manages memory state)
                self.current_scheduled = None
                self._evaluate_state()
    
    def _is_audio_system_on(self):
        # Placeholder for hardware check
        return True

# Global Instance
pa_system = PAController()
