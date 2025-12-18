import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from '../firebase';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Announcements
  const { currentUser } = useAuth();
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
    // Only listen if user is logged in
    if (!currentUser) {
        setEmergencyActive(false); 
        setSchedules([]);
        setActivityLogs([]);
        setBroadcastActive(false);
        return;
    }

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
        setSchedules(list);
    }, (error) => {
        console.error("Schedules sync error:", error);
    });

    // 3. Activity Logs Listener (Real-time, Last 50)
    const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => {
            const data = doc.data();
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
  }, [currentUser]);

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

  // Emergency Audio Refs
  const emergencyAudioRef = useRef(null);
  const emergencyOscillatorRef = useRef(null);
  const emergencyIntervalRef = useRef(null);

    // Emergency Audio Logic
    useEffect(() => {
        if (emergencyActive) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            emergencyAudioRef.current = audioCtx;
            
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            emergencyOscillatorRef.current = oscillator;

            oscillator.type = 'sawtooth';
            oscillator.frequency.value = 800; // Start freq
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();

            // Handle Autoplay Policy
            if (audioCtx.state === 'suspended') {
                const resumeAudio = () => {
                    audioCtx.resume();
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('keydown', resumeAudio);
                };
                document.addEventListener('click', resumeAudio);
                document.addEventListener('keydown', resumeAudio);
            }
            
            // Siren effect
            let isHigh = false;
            emergencyIntervalRef.current = setInterval(() => {
                if (audioCtx && audioCtx.state === 'running') {
                     const now = audioCtx.currentTime;
                     const freq = isHigh ? 800 : 1200;
                     oscillator.frequency.setValueAtTime(freq, now);
                     isHigh = !isHigh;
                }
            }, 600);
        } else {
            // Stop emergency audio
             if (emergencyOscillatorRef.current) { 
                try { emergencyOscillatorRef.current.stop(); } catch(e){} 
                emergencyOscillatorRef.current = null;
            }
            if (emergencyAudioRef.current) {
                emergencyAudioRef.current.close(); 
                emergencyAudioRef.current = null;
            }
            if (emergencyIntervalRef.current) {
                clearInterval(emergencyIntervalRef.current);
                emergencyIntervalRef.current = null;
            }
        }

        return () => {
            // Cleanup on unmount (app close)
             if (emergencyOscillatorRef.current) { 
                try { emergencyOscillatorRef.current.stop(); } catch(e){} 
            }
            if (emergencyAudioRef.current) {
                try { emergencyAudioRef.current.close(); } catch(e){}
            }
            if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
        };
    }, [emergencyActive]);


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



  // Master Audio Stop (for Logout)
  const stopAllAudio = () => {
      stopBroadcast();
      
      // Stop emergency audio explicity
      if (emergencyOscillatorRef.current) { 
          try { emergencyOscillatorRef.current.stop(); } catch(e){} 
          emergencyOscillatorRef.current = null;
      }
      if (emergencyAudioRef.current) {
          try { emergencyAudioRef.current.close(); } catch(e){}
          emergencyAudioRef.current = null;
      }
      if (emergencyIntervalRef.current) {
          clearInterval(emergencyIntervalRef.current);
          emergencyIntervalRef.current = null;
      }
  };

  // Stop audio on logout
  useEffect(() => {
        if (!currentUser) {
            stopAllAudio();
        }
  }, [currentUser]);

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
      stopAllAudio, // Exposed
      zones,
      setZones
  };
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

