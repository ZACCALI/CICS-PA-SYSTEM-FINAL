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
    const emergencyRef = doc(db, "emergency", "status");
    const unsubEmergency = onSnapshot(emergencyRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setEmergencyActive(data.active);
            setEmergencyHistory(data.history || []);
            
            // REACTIVE INTERRUPTION:
            if (data.active) {
                // Emergency just turned on (or is on).
                // Force stop all other audio.
                // We can't call stopAllAudio directly if it's defined below?
                // It is defined below. We need to move stopAllAudio up or use a ref/effect.
                // Better: Use a separate useEffect to watch 'emergencyActive' state change.
            }
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

    // 3. Activity Logs Listener (Real-time, Last 50) - Optimized from Polling
    const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => {
             const data = doc.data();
             // Handle Firestore Timestamp or string
             let dateObj = new Date();
             if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                 dateObj = data.timestamp.toDate();
             } else if (data.time) {
                 dateObj = new Date(data.time);
             }
             
             return {
                 id: doc.id,
                 ...data,
                 time: dateObj.toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                 })
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

  // 4. Reactive Priority Enforcement
  useEffect(() => {
    if (emergencyActive) {
        // Emergency Override: Stop everything else.
        stopAllAudio();
    }
  }, [emergencyActive]);

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
  const addSchedule = async (schedule, user = 'Admin') => {
      try {
          // Remove audio blob from payload if present (complex to send via JSON)
          // We'd upload it first, get URL, then save.
          // For this demo 'connection', we stick to text metadata or ignore blob in backend save.
          const { audio, ...payload } = schedule; 
          // Include user in payload for logging
          const data = { ...payload, user };
          
          const res = await api.post('/scheduled/', data);
          // Real-time listener will handle the update
          return res.data;
      } catch (e) {
          console.error("Add schedule failed", e);
      }
  };

  const updateSchedule = async (id, updatedData, user = 'Admin') => {
       try {
          const { audio, ...payload } = updatedData;
          const data = { ...payload, user };
          await api.put(`/scheduled/${id}`, data);
          setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
       } catch (e) {
           console.error("Update schedule failed", e);
       }
  };

  const deleteSchedule = async (id, user = 'Admin') => {
      try {
          await api.delete(`/scheduled/${id}?user=${encodeURIComponent(user)}`);
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

  const clearEmergencyHistory = async (user) => {
      // Optimistic update: Remove immediately from UI
      setEmergencyHistory(prev => user ? prev.filter(h => h.user !== user) : []);
      
      try {
          const url = user ? `/emergency/history?user=${encodeURIComponent(user)}` : '/emergency/history';
          await api.delete(url);
      } catch (e) {
          console.error("Failed to clear emergency history", e);
          // Optional: we could revert here if needed, but snapshot listener often corrects state
      }
  };

  const logActivity = async (user, action, type, details) => {
      // Optimistic local
      const tempId = Date.now() + Math.random();
      const newLog = {
          id: tempId,
          user: user || 'Unknown',
          action, 
          type, 
          details,
          time: new Date().toLocaleString()
      };
      setActivityLogs(prev => [newLog, ...prev]);
      
      // Send to backend
      try {
          const res = await api.post('/realtime/log', {
              user: user || 'Unknown',
              type,
              action,
              details
          });
          // Update local ID with real ID if needed, 
          // or ideally we just refetch logs occasionally.
          // For session logging, we need the REAL ID to update it.
          if (res.data.id) {
              return res.data.id;
          }
      } catch (e) {
          console.error("Log failed", e);
          if (e.response && e.response.status === 409) {
              return { error: 'CONFLICT' };
          }
      }
      return null;
  };

  const updateLog = async (id, updateData) => {
      if (!id) return;
      
      // Optimistic update
      setActivityLogs(prev => prev.map(log => 
          log.id === id ? { ...log, ...updateData } : log
      ));

      try {
          await api.put(`/realtime/log/${id}`, updateData);
      } catch(e) {
          console.error("Update log failed", e);
      }
  };

  const deleteLog = async (id, user = 'Admin') => {
      try {
          await api.delete(`/realtime/log/${id}?user=${encodeURIComponent(user)}`);
          setActivityLogs(prev => prev.filter(log => log.id !== id));
      } catch (e) {
          console.error("Delete log failed", e);
      }
  };

  const deleteLogs = async (ids, user = 'Admin') => {
      try {
          // Parallel delete
          await Promise.all(ids.map(id => api.delete(`/realtime/log/${id}?user=${encodeURIComponent(user)}`)));
          setActivityLogs(prev => prev.filter(log => !ids.includes(log.id)));
      } catch (e) {
          console.error("Bulk delete failed", e);
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

  const stopAllAudio = () => {
      // 1. Stop Broadcast / Mic
      stopBroadcast();
      
      // 2. Stop Text-to-Speech
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
      }

      // 3. Stop any file audio (if managed globally, currently local)
      
      // 4. Force Emergency silence? 
      // Emergency sound is managed by Emergency.jsx effect. When that unmounts, it stops.
      // But if we want to be safe:
      // We can't easily reach into Emergency.jsx state from here.
      // However, we can simply rely on the fact that 'resetState' will clear data?
      // No, data comes from Firestore.
  };

  const resetState = (userName = 'System') => {
      stopAllAudio();
      
      // Force Deactivate Emergency if active
      if (emergencyActive) {
          toggleEmergency(userName, 'DEACTIVATED');
      }

      setSchedules([]);
      setActivityLogs([]);
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
      clearEmergencyHistory, // Exported
      activityLogs, // Exported for UI

      logActivity,
      updateLog, // New export
      deleteLog,
      deleteLogs, // New export
      broadcastActive,
      startBroadcast,
      stopBroadcast,
      broadcastStream,
      zones,
      setZones,
      
      stopAllAudio, // New
      resetState    // New
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

