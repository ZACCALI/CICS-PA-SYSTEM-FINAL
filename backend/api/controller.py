import threading
import time
import uuid
from enum import IntEnum
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from firebase_admin import firestore
from api.firebaseConfig import db

# --- 1. Constants & Enums ---
class Priority(IntEnum):
    IDLE = 0
    BACKGROUND = 10
    SCHEDULE = 20
    REALTIME = 30
    EMERGENCY = 100

class State(IntEnum):
    PENDING = 1
    PLAYING = 2
    INTERRUPTED = 3
    COMPLETED = 4

class TaskType:
    VOICE = 'voice'
    TEXT = 'text'
    EMERGENCY = 'emergency'
    SCHEDULE = 'schedule'
    BACKGROUND = 'background'

# --- 2. Data Structures ---
class Task:
    def __init__(self, 
                 type: str, 
                 priority: int, 
                 data: dict, 
                 id: str = None, 
                 status: State = State.PENDING, 
                 created_at: datetime = None,
                 scheduled_time: datetime = None):
        self.id = id if id else str(uuid.uuid4())
        self.type = type
        self.priority = priority
        self.data = data
        self.status = status
        self.created_at = created_at if created_at else datetime.now()
        self.scheduled_time = scheduled_time if scheduled_time else datetime.now()

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'priority': int(self.priority),
            'data': self.data,
            'status': int(self.status),
            'created_at': self.created_at.isoformat(),
            'scheduled_time': self.scheduled_time.isoformat()
        }

# --- 3. The Controller ---
class PAController:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PAController, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self._lock = threading.Lock()  # THE MUTEX
        self.current_task: Optional[Task] = None
        self.queue: List[Task] = []    # Priority Queue for Schedules
        self.emergency_mode = False
        self._running = True
        
        # Track interruption duration to shift queue
        self.pause_start_time: Optional[datetime] = None
        
        # Reset Logic on init to ensure clean state
        self._reset_state()
        
        # Start Scheduler Thread
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        
        self._initialized = True
        print("PA Controller Initialized")

    def _reset_state(self):
        """Resets Firestore state to Idle on startup"""
        try:
            db.collection('system').document('state').set({
                'active_task': None,
                'priority': 0,
                'mode': 'IDLE',
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            print(f"Failed to reset state: {e}")

    # --- MAIN ENTRY POINT ---
    def request_playback(self, new_task: Task) -> bool:
        with self._lock:  # Critical Section
            print(f"[Controller] Request: {new_task.type} (Pri: {new_task.priority})")

            # 1. Emergency Check (Invincible)
            if self.emergency_mode and new_task.priority < Priority.EMERGENCY:
                print(f"[Controller] Denied: Emergency Active")
                return False

            # 2. Schedule Check (Always Queue first)
            if new_task.type == TaskType.SCHEDULE:
                 # Standard Schedule submission (queued)
                 print(f"[Controller] Queued Schedule: {new_task.id}")
                 self._add_to_queue(new_task)
                 return True 

            # 3. Priority Check
            current_pri = self.current_task.priority if self.current_task else Priority.IDLE
            
            # Allow replacing Background with Background (e.g. Track Switch)
            is_background_swap = (new_task.priority == current_pri == Priority.BACKGROUND)

            if new_task.priority > current_pri or is_background_swap:
                # PREEMPTION (Higher Priority Wins or Background Swap)
                self._preempt_current_task(new_task.priority)
                self._start_task(new_task)
                return True
            
            else:
                # Lower/Equal priority -> Busy
                print(f"[Controller] Denied: Busy (Current Pri: {current_pri})")
                return False

    def stop_task(self, task_id: str, task_type: str = None):
        """Called to manually stop a task (e.g., Stop Broadcast, Clear Emergency)"""
        with self._lock:
            if not self.current_task:
                return

            # If requesting to stop specific task, check ID
            if task_id and self.current_task.id != task_id:
                print(f"[Controller] Denied Stop: ID Mismatch ({task_id} vs {self.current_task.id})")
                return

            # Anti-Zombie: Require ID for Realtime Tasks to prevent race conditions
            # (e.g. Frontend "Stop" from previous session killing new session)
            if not task_id and (self.current_task.type == TaskType.VOICE or self.current_task.type == TaskType.TEXT):
                print(f"[Controller] Denied Stop: Missing Task ID for Realtime Task")
                return

            print(f"[Controller] Stopping Task: {self.current_task.id}")
            
            if self.current_task.priority == Priority.EMERGENCY:
                self.emergency_mode = False
            
            self.current_task = None
            self._update_firestore_state(None, Priority.IDLE, 'IDLE')
            
            # Application of Time Shift (System became IDLE)
            self._apply_queue_shift()

    def get_queue(self):
        return self.queue
        
    def remove_from_queue(self, schedule_id: str):
        with self._lock:
             self.queue = [t for t in self.queue if t.id != schedule_id]

    def get_active_emergency_user(self) -> Optional[str]:
        with self._lock:
            if self.current_task and self.current_task.priority == Priority.EMERGENCY:
                 return self.current_task.data.get('user')
            return None

    # --- INTERNAL LOGIC ---
    def _add_to_queue(self, task: Task):
        self.queue.append(task)
        # Sort by scheduled_time
        self.queue.sort(key=lambda x: x.scheduled_time)

    def _preempt_current_task(self, new_priority):
        if not self.current_task:
            return

        print(f"[Controller] Preempting: {self.current_task.type}")

        # Specific Logic per Type
        if self.current_task.type == TaskType.SCHEDULE:
            # Soft Stop: Re-queue at HEAD
            print(f"  -> Re-queueing Schedule {self.current_task.id}")
            self.current_task.status = State.INTERRUPTED
            # Push to front of queue
            self.queue.insert(0, self.current_task) 
        
        elif self.current_task.type == TaskType.VOICE or self.current_task.type == TaskType.TEXT:
            # Hard Stop: Kill completely
            print(f"  -> Killing Realtime {self.current_task.id}")
            self.current_task.status = State.COMPLETED
        
        self.current_task = None

    def _start_task(self, task: Task):
        self.current_task = task
        self.current_task.status = State.PLAYING
        
        # Start Time Shift Tracking if High Priority
        if task.priority >= Priority.REALTIME:
            if self.pause_start_time is None:
                self.pause_start_time = datetime.now()
                print(f"[Controller] Time Shift Started at {self.pause_start_time}")

        if task.priority == Priority.EMERGENCY:
            self.emergency_mode = True
        
        mode = 'BROADCAST'
        if task.type == TaskType.EMERGENCY: mode = 'EMERGENCY'
        elif task.type == TaskType.SCHEDULE: mode = 'SCHEDULE'
        elif task.type == TaskType.BACKGROUND: mode = 'BACKGROUND'

        print(f"[Controller] Starting: {task.type} (Mode: {mode})")
        self._update_firestore_state(task, task.priority, mode)

    def _apply_queue_shift(self):
        """Shifts all queued items by the duration of the High Priority Interruption"""
        if self.pause_start_time:
            now = datetime.now()
            duration = now - self.pause_start_time
            print(f"[Controller] Applying Time Shift: +{duration}")
            
            batch = db.batch()
            updated_count = 0

            for task in self.queue:
                task.scheduled_time += duration
                
                # Update Firestore so UI reflects new time
                try:
                     ref = db.collection('schedules').document(task.id)
                     new_date = task.scheduled_time.strftime("%Y-%m-%d")
                     new_time = task.scheduled_time.strftime("%H:%M")
                     batch.update(ref, {'date': new_date, 'time': new_time})
                     updated_count += 1
                except ValueError:
                    pass # Skip if invalid ID/Doc

            # Sort again just in case (though relative order shouldn't change)
            self.queue.sort(key=lambda x: x.scheduled_time)
            
            if updated_count > 0:
                try:
                    batch.commit()
                    print(f"[Controller] Persisted shift for {updated_count} schedules")
                except Exception as e:
                    print(f"[Controller] Batch update failed: {e}")

            self.pause_start_time = None

    def _update_firestore_state(self, task, priority, mode):
        try:
            data = {
                'active_task': task.to_dict() if task else None,
                'priority': int(priority),
                'mode': mode,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            db.collection('system').document('state').set(data)
        except Exception as e:
            print(f"[Controller] DB Error: {e}")

    # --- SCHEDULER LOOP ---
    def _scheduler_loop(self):
        while self._running:
            time.sleep(1) # Tiick every 1s
            
            with self._lock:
                if self.current_task:
                    continue # Busy
                
                # System is IDLE. Check Queue.
                now = datetime.now()
                
                # Filter for due items
                # Note: We take the first one that is due
                candidates = [t for t in self.queue if t.scheduled_time <= now]
                
                if candidates:
                    next_task = candidates[0]
                    self.queue.remove(next_task)
                    
                    next_task.priority = Priority.SCHEDULE
                    print(f"[Scheduler] Promoting Schedule {next_task.id}")
                    
                    # Mark as Completed in DB
                    try:
                        db.collection('schedules').document(next_task.id).update({'status': 'Completed'})
                    except Exception as e:
                        print(f"[Scheduler] Failed to mark completed: {e}")

                    self._start_task(next_task)

# Global Instance
controller = PAController()

