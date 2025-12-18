import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from '../firebase';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Announcements
  const [schedules, setSchedules] = useState([]);

  const [notifications, setNotifications] = useState([
     { id: 1, title: 'System Update Available', message: 'New version 2.3.1 is ready.', time: '2 hours ago', unread: true, type: 'info' },
     { id: 2, title: 'Library Speaker Offline', message: 'Disconnected for 45 minutes.', time: 'Yesterday', unread: true, type: 'warning' }
  ]);

  // Files
  const [files, setFiles] = useState(() => {
      const saved = localStorage.getItem('pa_files');
      return saved ? JSON.parse(saved) : [];
  });

  // Emergency State
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyHistory, setEmergencyHistory] = useState([]);

  // Global Activity Logs
  const [activityLogs, setActivityLogs] = useState([]);

  // Global Broadcast State (Persistent across navigation)
  const [broadcastActive, setBroadcastActive] = useState(false);
  // Global Zones (Persistent)
  const [zones, setZones] = useState({
    'All Zones': false,
    'Admin Office': false,
    'Main Hall': false,
    'Library': false,
    'Classrooms': false
  });

  // Initial Fetch & Listeners
  useEffect(() => {
    // 1. Emergency System Listener
    const emergencyRef = doc(db, "system_state", "emergency");
    const unsubEmergency = onSnapshot(emergencyRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setEmergencyActive(data.active);
            setEmergencyHistory(data.history || []);
        } else {
            setEmergencyActive(false);
            setEmergencyHistory([]);
        }
    });

    // 2. Schedules Listener (Real-time)
    const schedulesQuery = query(collection(db, "schedules"));
    const unsubSchedules = onSnapshot(schedulesQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Optional: Sort by date/time if not sorted by query
        // For now, accept default or client-side sort if needed
        setSchedules(list);
    }, (error) => {
        console.error("Schedules sync error:", error);
    });

    // 3. Activity Logs Listener (Real-time, Last 50)
    const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => {
            const data = doc.data();
            // Handle timestamp object from Firestore
            return { 
                ...data, 
                id: doc.id,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp 
            };
        });
        setActivityLogs(list);
    }, (error) => {
        console.error("Logs sync error:", error);
    });

    return () => {
        unsubEmergency();
        unsubSchedules();
        unsubLogs();
    };
  }, []);

  // Removed manual fetchSchedules as it is now real-time

  // Persist Files locally
  useEffect(() => {
      try {
          localStorage.setItem('pa_files', JSON.stringify(files));
      } catch (e) {
          console.error("Failed to save files:", e);
      }
  }, [files]);


  // Methods
  const addSchedule = async (schedule) => {
      try {
          // Remove audio blob from payload if present (complex to send via JSON)
          // We'd upload it first, get URL, then save.
          // For this demo 'connection', we stick to text metadata or ignore blob in backend save.
          const { audio, ...payload } = schedule; 
          // If type is voice, we might want to flag it.
          const res = await api.post('/scheduled/', payload);
          // Real-time listener will handle the update
          return res.data;
      } catch (e) {
          console.error("Add schedule failed", e);
      }
  };

  const updateSchedule = async (id, updatedData) => {
       try {
          const { audio, ...payload } = updatedData;
          await api.put(`/scheduled/${id}`, payload);
          setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
       } catch (e) {
           console.error("Update schedule failed", e);
       }
  };

  const deleteSchedule = async (id) => {
      try {
          await api.delete(`/scheduled/${id}`);
          setSchedules(prev => prev.filter(s => s.id !== id));
      } catch (e) {
          console.error("Delete schedule failed", e);
      }
  };

  const addFile = (fileDetails) => {
      setFiles(prev => [fileDetails, ...prev]);
  };

  const deleteFile = (id) => {
      setFiles(prev => prev.filter(f => f.id !== id));
  };

  const toggleEmergency = async (user = 'Admin', action = 'TOGGLE') => {
      try {
          // If action is TOGGLE, we should ideally know the current state to flip it. 
          // But since we want to be explicit, let's assume the caller passes explicit 'ACTIVATED' or 'DEACTIVATED'.
          // If they pass 'TOGGLE', valid backend will handle it as before (if we kept that logic, but we changed it).
          // So we should enforce explicit action from caller.
          
          const res = await api.post('/emergency/toggle', { user, action });
          setEmergencyActive(res.data.active);
          setEmergencyHistory(res.data.history);
      } catch (e) {
          console.error("Emergency toggle failed", e);
      }
  };

  const clearEmergencyHistory = () => {
      // Backend doesn't support clearing history yet, implement if needed
      setEmergencyHistory([]);
  };

  const logActivity = async (user, action, type, details) => {
      // Optimistic local
      const newLog = {
          id: Date.now() + Math.random(),
          user: user || 'Unknown',
          action, 
          type, 
          details,
          time: new Date().toLocaleString()
      };
      setActivityLogs(prev => [newLog, ...prev]);
      
      // Send to backend
      try {
          await api.post('/realtime/log', {
              user: user || 'Unknown',
              type,
              action,
              details
          });
      } catch (e) {
          console.error("Log failed", e);
      }
  };

  // Broadcast Refs
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const [broadcastStream, setBroadcastStream] = useState(null);

  const startBroadcast = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          setBroadcastStream(stream);

          // Audio Context for monitoring
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(audioCtx.destination);

          setBroadcastActive(true);
          
          // Log start
          // Assuming 'currentUser' is available here? No. 
          // We rely on caller to logActivity, OR we log here.
          // Caller (RealTime.jsx) calls logActivity.
          
          return true;
      } catch (err) {
          console.error("Mic Error:", err);
          return false;
      }
  };

  const stopBroadcast = () => {
      if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
      setBroadcastStream(null);
      setBroadcastActive(false);
  };

  const markAllAsRead = () => {
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const clearAllNotifications = () => {
      setNotifications([]);
  };

  const value = {
      schedules,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      notifications,
      markAllAsRead, 
      clearAllNotifications,
      files,
      addFile,
      deleteFile,
      emergencyActive,
      toggleEmergency,
      emergencyHistory,
      activityLogs, // Exported for UI

      logActivity,
      broadcastActive,
      startBroadcast,
      stopBroadcast,
      broadcastStream,
      zones,
      setZones
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

