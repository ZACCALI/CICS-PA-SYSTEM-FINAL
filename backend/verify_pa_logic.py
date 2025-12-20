from api.services.pa_controller import pa_system
import time

def assert_status(expected_type, msg=""):
    status = pa_system.get_status()
    current_type = status['type']
    print(f"CHECK: {msg} | Expected: {expected_type} | Actual: {current_type} | Details: {status.get('details')}")
    if current_type != expected_type:
        print(f"FAILED: Expected {expected_type}, got {current_type}")
        return False
    return True

def run_test():
    print("--- STARTING PA LOGIC VERIFICATION ---")
    
    # 1. Initial State
    assert_status("Audio", "Initial Idle Default")
    
    # 2. Add Schedule
    print("\n[Action] Adding Schedule 1...")
    pa_system.add_schedule({"id": "SCH-1", "message": "Morning Announcement", "date": "2024-01-01", "time": "08:00"})
    assert_status("Scheduled", "After Adding Schedule")
    
    # 3. Start Realtime (Should Interrupt Schedule)
    print("\n[Action] Starting Realtime...")
    pa_system.start_realtime("User1", "Live Voice")
    assert_status("Realtime", "Realtime should active")
    
    # Check if Schedule 1 was re-queued?
    # We can't easily check internal queue from here without snooping, but let's check behavior after stop.
    
    # 4. Stop Realtime (Should Resume Schedule)
    print("\n[Action] Stopping Realtime...")
    pa_system.stop_realtime()
    # Expect Schedule 1 to resume
    assert_status("Scheduled", "Schedule should resume after Realtime")
    status = pa_system.get_status()
    if "Morning Announcement" not in str(status['details']):
        print("FAILED: Wrong schedule resumed!")
        
    # 5. Emergency (Should Interrupt Schedule)
    print("\n[Action] Activating Emergency...")
    pa_system.activate_emergency("Admin")
    assert_status("Emergency", "Emergency should override everything")
    
    # 6. Try Realtime during Emergency (Should Block)
    print("\n[Action] Trying Realtime during Emergency...")
    res = pa_system.start_realtime("User1", "Ignored Voice")
    if res == False:
        print("SUCCESS: Realtime was blocked.")
    else:
        print("FAILED: Realtime was accepted during Emergency!")
        
    # 7. Stop Emergency (Should Resume Schedule)
    print("\n[Action] Deactivating Emergency...")
    pa_system.deactivate_emergency()
    assert_status("Scheduled", "Schedule should resume after Emergency")

    # 8. Finish Schedule
    print("\n[Action] Finishing Schedule...")
    pa_system.finish_current_schedule()
    assert_status("Audio", "Should go back to idle/audio")

    print("\n--- VERIFICATION COMPLETE ---")

if __name__ == "__main__":
    run_test()
