import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Announcements
  const [schedules, setSchedules] = useState(() => {
      const saved = localStorage.getItem('pa_schedules');
      return saved ? JSON.parse(saved) : [];
  });

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
  const [activityLogs, setActivityLogs] = useState(() => {
      const saved = localStorage.getItem('pa_logs');
      return saved ? JSON.parse(saved) : [];
  });

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

  // Sync across tabs
  useEffect(() => {
      const handleStorage = (e) => {
          if (e.key === 'pa_schedules') {
              setSchedules(JSON.parse(e.newValue || '[]'));
          } else if (e.key === 'pa_emergency_active') {
              setEmergencyActive(JSON.parse(e.newValue || 'false'));
          } else if (e.key === 'pa_logs') {
              setActivityLogs(JSON.parse(e.newValue || '[]'));
          } else if (e.key === 'pa_files') {
              setFiles(JSON.parse(e.newValue || '[]'));
          }
      };

      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Persist Data (with Error Handling for Quota)
  useEffect(() => {
      try {
          localStorage.setItem('pa_schedules', JSON.stringify(schedules));
      } catch (e) {
          console.error("Failed to save schedules:", e);
      }
  }, [schedules]);

  useEffect(() => {
      try {
          localStorage.setItem('pa_files', JSON.stringify(files));
      } catch (e) {
          console.error("Failed to save files (Quota Exceeded?):", e);
          // Optional: Notify user via state/toast if needed, but for now prevent crash
      }
  }, [files]);

  useEffect(() => {
      localStorage.setItem('pa_logs', JSON.stringify(activityLogs));
  }, [activityLogs]);

  // Methods
  const addSchedule = (schedule) => {
      const newSchedule = { ...schedule, id: Date.now(), status: schedule.status || 'Pending'  };
      setSchedules(prev => [newSchedule, ...prev]);
  };

  const updateSchedule = (id, updatedData) => {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
  };

  const deleteSchedule = (id) => {
      setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const addFile = (fileDetails) => {
      setFiles(prev => [fileDetails, ...prev]);
  };

  const deleteFile = (id) => {
      setFiles(prev => prev.filter(f => f.id !== id));
  };

  const toggleEmergency = (user = 'Admin') => {
      const newState = !emergencyActive;
      setEmergencyActive(newState);
      if (newState) {
          setEmergencyHistory(prev => [{
              id: Date.now(),
              action: 'ACTIVATED',
              time: new Date().toLocaleString(),
              user: user 
          }, ...prev]);
      } else {
          setEmergencyHistory(prev => [{
              id: Date.now(),
              action: 'DEACTIVATED',
              time: new Date().toLocaleString(),
              user: user 
          }, ...prev]);
      }
  };

  const clearEmergencyHistory = () => {
      setEmergencyHistory([]);
  };

  const logActivity = (user, action, type, details) => {
      const newLog = {
          id: Date.now() + Math.random(),
          user: user || 'Unknown',
          action, // "Created Schedule", "Activated Emergency", "Broadcasted"
          type, // "Voice", "Text", "System"
          details,
          time: new Date().toLocaleString()
      };
      setActivityLogs(prev => [newLog, ...prev]);
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

          // Audio Context for potential global processing (optional, mainly for cleanup)
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          
          // Connect stream to destination to "hear" it (monitoring)
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(audioCtx.destination);

          setBroadcastActive(true);
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
      activityLogs,

      logActivity,
      broadcastActive,
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
