import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

const Schedule = () => {
  const { schedules, addSchedule, updateSchedule, deleteSchedule, logActivity, emergencyActive, broadcastActive } = useApp();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  
  // Modals
  const [showModal, setShowModal] = useState(false); // Form Modal
  const [showInfoModal, setShowInfoModal] = useState(false); // Alert Replacement
  const [infoMessage, setInfoMessage] = useState('');
  
  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  // Form State
  const [editId, setEditId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const [interimText, setInterimText] = useState('');
  
  const [formData, setFormData] = useState({
      message: '',
      date: '',
      time: '',
      repeat: 'once',
      zones: {
        'All Zones': false,
        'Admin Office': false,
        'Main Hall': false,
        'Library': false,
        'Classrooms': false
      }
  });

  // Init Speech Recognition
  useEffect(() => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          
          
          recognitionRef.current.onresult = (event) => {
              let interim = '';
              let final = '';

              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      final += event.results[i][0].transcript;
                  } else {
                      interim += event.results[i][0].transcript;
                  }
              }
              
              if (final) {
                  setFormData(prev => ({
                      ...prev, 
                      message: (prev.message + ' ' + final).replace(/\s+/g, ' ').trim()
                  }));
                  setInterimText(''); 
              } else {
                  setInterimText(interim);
              }
          };
      }
      return () => {
          if (recognitionRef.current) {
              recognitionRef.current.abort();
          }
      };
  }, []);

  // Priority Enforcement: Stop playback if Emergency or Broadcast starts
  useEffect(() => {
    if (emergencyActive || broadcastActive) {
        // Stop any audio previews or recording
        if (isRecording) {
            // Cancel recording
             if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
            setInfoMessage("Action interrupted by higher priority broadcast.");
            setShowInfoModal(true);
        }
        
        // Note: Actual scheduled "playback" (if simulated by frontend audio) would be stopped here too.
        // Currently Schedule.jsx mainly handles CREATION. 
        // If there is an audio player for previewing uploaded files (audioBlob), we should stop it.
        // (Assuming simple browser audio player might be used elsewhere, or just the recording preview?)
    }
  }, [emergencyActive, broadcastActive, isRecording]);

  const handleZoneChange = (zone) => {
    if (zone === 'All Zones') {
        const newValue = !formData.zones['All Zones'];
        const newZones = {};
        Object.keys(formData.zones).forEach(k => newZones[k] = newValue);
        setFormData(prev => ({ ...prev, zones: newZones }));
    } else {
        setFormData(prev => ({
            ...prev, 
            zones: { ...prev.zones, [zone]: !prev.zones[zone] }
        }));
    }
  };

  const startRecording = async () => {
      try {
          // 1. Audio Recording
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          const chunks = [];

          mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
          mediaRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'audio/webm' });
              setAudioBlob(blob);
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();

          // 2. Speech Recognition (Transcription)
          if (recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.warn("Recognition already started");
              }
          }

          setIsRecording(true);
      } catch (err) {
          console.error("Error accessing microphone:", err);
          setInfoMessage("Could not access microphone. Please ensure permissions are granted.");
          setShowInfoModal(true);
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
          recognitionRef.current.stop();
      }
      setIsRecording(false);
      setInterimText('');
  };

  const resetRecording = () => {
      setAudioBlob(null);
      // We do NOT plain clear text message, as user might want to keep the transcript
  };

  const startEdit = (schedule) => {
      setEditId(schedule.id);
      
      // Parse zones string back to object
      const zonesMap = {
          'All Zones': false,
          'Admin Office': false,
          'Main Hall': false,
          'Library': false,
          'Classrooms': false
      };
      
      if (schedule.zones) {
          schedule.zones.split(', ').forEach(z => {
              if (zonesMap.hasOwnProperty(z)) zonesMap[z] = true;
          });
      }

      setFormData({
          message: schedule.message,
          date: schedule.date,
          time: schedule.time,
          repeat: schedule.repeat || 'once',
          zones: zonesMap
      });
      setAudioBlob(schedule.audio || null);
      setShowModal(true);
  };

  const confirmDelete = (id) => {
      setScheduleToDelete(id);
      setShowDeleteModal(true);
  };

  const handleDelete = () => {
      if (scheduleToDelete) {
          deleteSchedule(scheduleToDelete, currentUser?.name);
          setShowDeleteModal(false);
          setScheduleToDelete(null);
      }
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.date) {
          setInfoMessage("Please select a date.");
          setShowInfoModal(true);
          return;
      }

      if (!formData.time) {
          setInfoMessage("Please select a time.");
          setShowInfoModal(true);
          return;
      }

      const activeZones = Object.keys(formData.zones).filter(z => formData.zones[z] && z !== 'All Zones');
      
      if (!activeZones.length) {
          setInfoMessage("Select at least one zone");
          setShowInfoModal(true);
          return;
      }
      
      if (!formData.message && !audioBlob) {
           setInfoMessage("Please enter a message or record audio");
           setShowInfoModal(true);
           return;
      }

      const scheduleData = {
          message: formData.message, 
          date: formData.date,
          time: formData.time,
          repeat: formData.repeat,
          zones: activeZones.join(', '),
          status: 'Pending',
          type: audioBlob ? 'voice' : 'text',
          audio: audioBlob 
      };

      if (editId) {
          updateSchedule(editId, scheduleData, currentUser?.name);
      } else {
          addSchedule(scheduleData, currentUser?.name);
      }
      
      setShowModal(false);
      resetForm();
  };
  
  const resetForm = () => {
      setEditId(null);
      setFormData({
          message: '',
          date: '',
          time: '',
          repeat: 'once',
          zones: {
              'All Zones': false,
              'Admin Office': false,
              'Main Hall': false,
              'Library': false,
              'Classrooms': false
          }
      });
      setAudioBlob(null);
      setIsRecording(false);
  };

  const filteredSchedules = schedules.filter(s => {
      // 1. Strict Ownership Filter (Both Admin and User see ONLY their own)
      if (s.user !== currentUser?.name) {
          return false;
      }
      // 2. Status/Tab Filter
      return activeTab === 'pending' ? s.status === 'Pending' : (s.status === 'Completed' || s.status === 'History');
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <i className="material-icons mr-3 text-primary">schedule</i> Scheduled Announcements
      </h2>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
         <div className="flex space-x-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pending' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Pending Announcements
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              History
            </button>
         </div>
         
         <button 
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow font-medium text-sm transition-all w-full sm:w-auto justify-center"
         >
           <i className="material-icons text-sm mr-2">add</i> Add Schedule
         </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header - Hidden on Mobile */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 font-semibold text-gray-600 text-sm">
          <div className="col-span-1">No.</div>
          <div className="col-span-4">Message</div>
          <div className="col-span-2">Date & Time</div>
          <div className="col-span-2">Zones</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-center">Actions</div>
        </div>

        {/* List */}
        {filteredSchedules.length > 0 ? (
            <div className="divide-y divide-gray-100">
                {filteredSchedules.map((schedule, index) => (
                    <div key={schedule.id || index} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 items-start md:items-center hover:bg-gray-50 transition-colors text-sm text-gray-700">
                        {/* Mobile: Card Layout, Desktop: Table Row */}
                        <div className="md:col-span-1 font-mono text-gray-400 hidden md:block">#{index + 1}</div>
                        
                        <div className="md:col-span-4 font-medium flex items-center">
                            <span className="md:hidden font-bold text-gray-500 mr-2">Message:</span>
                            {schedule.type === 'voice' && <i className="material-icons text-primary mr-2 text-sm">mic</i>}
                            {schedule.message}
                        </div>
                        
                        <div className="md:col-span-2 text-gray-500 flex md:block">
                            <span className="md:hidden font-bold text-gray-500 mr-2 w-20">When:</span>
                            <span>{schedule.date} <span className="text-xs ml-1 md:ml-0 md:block">{schedule.time}</span></span>
                        </div>
                        
                        <div className="md:col-span-2">
                             <div className="flex md:block items-center">
                                <span className="md:hidden font-bold text-gray-500 mr-2 w-20">Zones:</span>
                                <span className="truncate text-xs bg-primary/10 text-primary px-2 py-1 rounded w-fit inline-block max-w-full">
                                    {schedule.zones}
                                </span>
                             </div>
                        </div>
                        
                        <div className="md:col-span-1 flex md:block items-center">
                             <span className="md:hidden font-bold text-gray-500 mr-2 w-20">Status:</span>
                             <span className={`px-2 py-1 rounded-full text-xs font-semibold ${schedule.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                {schedule.status}
                             </span>
                        </div>
                        
                        <div className="md:col-span-2 flex justify-end md:justify-center space-x-2 mt-2 md:mt-0 border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                             <button 
                                onClick={() => startEdit(schedule)}
                                className="p-1 px-3 md:px-1 text-primary hover:bg-primary/10 rounded flex items-center md:inline-flex bg-primary/10 md:bg-transparent"
                             >
                                 <i className="material-icons text-sm mr-1 md:mr-0">edit</i> <span className="md:hidden text-xs">Edit</span>
                             </button>
                             <button 
                                onClick={() => confirmDelete(schedule.id)}
                                className="p-1 px-3 md:px-1 text-red-600 hover:bg-red-50 rounded flex items-center md:inline-flex bg-red-50 md:bg-transparent"
                             >
                                 <i className="material-icons text-sm mr-1 md:mr-0">delete</i> <span className="md:hidden text-xs">Delete</span>
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <i className="material-icons text-5xl mb-4 text-gray-300">event_note</i>
            <p>No {activeTab} announcements found.</p>
            </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? "Edit Schedule" : "Schedule Announcement"}
        footer={
           <>
               <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
               >
                   Cancel
               </button>
               <button 
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium shadow-sm"
               >
                   {editId ? "Update Schedule" : "Confirm Schedule"}
               </button>
           </>
        }
      >
        <form className="space-y-4 max-h-[60vh] md:max-h-[70vh] overflow-y-auto px-1">
            
            {/* Unified Input Section */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message & Audio</label>
                
                <div className="relative">
                    <textarea 
                        required
                        value={formData.message + (interimText ? ' ' + interimText : '')}
                        onChange={e => setFormData({...formData, message: e.target.value})}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary min-h-[100px] pr-12"
                        placeholder="Type message here or use microphone to speak..."
                    ></textarea>
                    
                    {/* Floating Mic Button inside textarea */}
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`absolute bottom-3 right-3 p-2 rounded-full shadow-sm transition-all ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary'}`}
                        title={isRecording ? "Stop Recording" : "Start Recording"}
                    >
                        <i className="material-icons text-xl">{isRecording ? 'stop' : 'mic'}</i>
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {isRecording ? 'Listening... Speak clearly to transcribe.' : 'Click mic to record & transcribe automatically.'}
                </p>

                {/* Audio Blob Indicator */}
                {audioBlob && (
                    <div className="mt-3 flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className="flex items-center text-green-700">
                            <i className="material-icons mr-2">check_circle</i>
                            <span className="text-sm font-medium">Audio Recorded Successfully</span>
                        </div>
                        <div className="flex items-center space-x-2">
                             <audio src={audioBlob instanceof Blob ? URL.createObjectURL(audioBlob) : ''} controls className="h-8 w-32" />
                             <button type="button" onClick={resetRecording} className="text-red-500 hover:bg-red-50 p-1 rounded-full"><i className="material-icons text-sm">delete</i></button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input 
                        type="date" 
                        required
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input 
                        type="time" 
                        required
                        value={formData.time}
                        onChange={e => setFormData({...formData, time: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                <select 
                    value={formData.repeat}
                    onChange={e => setFormData({...formData, repeat: e.target.value})}
                    className="w-full p-2 border border-gray-200 rounded-lg bg-white"
                >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Zones</label>
                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                    {Object.keys(formData.zones).map((zone) => (
                        <label key={zone} className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.zones[zone]}
                                onChange={() => handleZoneChange(zone)}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span>{zone}</span>
                        </label>
                    ))}
                </div>
            </div>
        </form>
      </Modal>

      {/* Info/Alert Modal */}
      <Modal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Notice"
        footer={
           <button 
              onClick={() => setShowInfoModal(false)}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium shadow-sm"
           >
               OK
           </button>
        }
      >
        <p className="text-gray-600">{infoMessage}</p>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Schedule"
          type="danger"
          footer={
             <>
                <button 
                   onClick={() => setShowDeleteModal(false)}
                   className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 bg-white"
                >
                    Cancel
                </button>
                <button 
                   onClick={handleDelete}
                   className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg"
                >
                    Delete
                </button>
             </>
          }
      >
          <p className="text-gray-600">Are you sure you want to delete this schedule? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default Schedule;
