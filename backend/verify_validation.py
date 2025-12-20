
import requests

BASE_URL = "http://localhost:8000"

def test_validation():
    print("Testing Schedule Validation...")
    
    # 1. Missing Zones
    print("\n1. Testing Missing Zones...")
    data = {
        "message": "Test Message",
        "date": "2025-01-01",
        "time": "10:00",
        "repeat": "once",
        "zones": "" # Empty
    }
    res = requests.post(f"{BASE_URL}/scheduled/", json=data)
    if res.status_code == 400:
        print(f"   -> [PASS] Rejected as expected: {res.json()['detail']}")
    else:
        print(f"   -> [FAIL] Accepted or wrong error: {res.status_code} {res.text}")

    # 2. Missing Repeat
    print("\n2. Testing Missing Repeat...")
    data = {
        "message": "Test Message",
        "date": "2025-01-01",
        "time": "10:00",
        "repeat": "", # Empty
        "zones": "Admin Office"
    }
    res = requests.post(f"{BASE_URL}/scheduled/", json=data)
    if res.status_code == 400:
        print(f"   -> [PASS] Rejected as expected: {res.json()['detail']}")
    else:
        print(f"   -> [FAIL] Accepted or wrong error: {res.status_code} {res.text}")

    # 3. Success Case
    print("\n3. Testing Valid Schedule...")
    data = {
        "message": "Valid Message",
        "date": "2025-01-01",
        "time": "10:00",
        "repeat": "once",
        "zones": "Admin Office"
    }
    res = requests.post(f"{BASE_URL}/scheduled/", json=data)
    if res.status_code == 200:
        sch_id = res.json().get("id")
        print(f"   -> [PASS] Created successfully (ID: {sch_id})")
        # Cleanup
        requests.delete(f"{BASE_URL}/scheduled/{sch_id}")
    else:
        print(f"   -> [FAIL] Failed to create: {res.text}")

if __name__ == "__main__":
    test_validation()
