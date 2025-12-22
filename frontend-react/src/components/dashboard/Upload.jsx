import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';
import api from '../../api/axios';

const Upload = () => {
  const { files, addFile, deleteFile, logActivity, updateLog, emergencyActive, systemState } = useApp();
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  
  // Audio Player State
  const [playingId, setPlayingId] = useState(null);
  const [currentLogId, setCurrentLogId] = useState(null); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef(new Audio());
  const startTimeRef = useRef(null);
  const logIdRef = useRef(null);

  // Sync Log ID for callbacks
  useEffect(() => { logIdRef.current = currentLogId; }, [currentLogId]);

  // Format Helper
  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  // Player Handlers
  const handleTimeUpdate = () => {
      setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
      setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
      // Auto-Next Logic
      const currentIndex = files.findIndex(f => f.id === playingId);
      if (currentIndex !== -1 && currentIndex < files.length - 1) {
          playSound(files[currentIndex + 1].id);
      } else {
          stopPlayback();
      }
  };

  const stopPlayback = async () => {
      try {
          await api.post(`/realtime/stop?user=${encodeURIComponent(currentUser?.name || 'Admin')}&type=background`);
      } catch (e) { /* Ignore if already stopped */ }

      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
      setCurrentTime(0);
  };

  const playNext = () => {
      const currentIndex = files.findIndex(f => f.id === playingId);
      if (currentIndex !== -1 && currentIndex < files.length - 1) {
          playSound(files[currentIndex + 1].id);
      }
  };

  const playPrev = () => {
      const currentIndex = files.findIndex(f => f.id === playingId);
      if (currentIndex !== -1 && currentIndex > 0) {
          playSound(files[currentIndex - 1].id);
      }
  };

  const handleSeek = (e) => {
      const time = parseFloat(e.target.value);
      setCurrentTime(time);
      if (audioRef.current) {
          audioRef.current.currentTime = time;
      }
  };

  // Listeners
  useEffect(() => {
      const audio = audioRef.current;
      
      // These handlers are already defined above, but we need to attach them to the audio element.
      // Re-defining them here would create new functions on each render, which is not ideal.
      // Instead, we attach the top-level handlers.
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      
      const handleStopGlobal = () => stopPlayback();
      window.addEventListener('stop-all-audio', handleStopGlobal);

      return () => {
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('ended', handleEnded);
          window.removeEventListener('stop-all-audio', handleStopGlobal);
          audio.pause();
      };
  }, [files, playingId]); // Depend on files for playlist logic, playingId for auto-next logic

  // Main Play Function
  const playSound = async (id) => {
      if (emergencyActive) {
          setErrorMessage("Emergency Alert is currently active. Audio playback is disabled.");
          setShowErrorModal(true);
          return;
      }
      
      const fileToPlay = files.find(f => f.id === id);
      if (!fileToPlay) return;

      // Check Backend Lock First
      if (playingId !== id || audioRef.current.paused) {
          try {
              await api.post('/realtime/start', {
                  user: currentUser?.name || 'Admin',
                  // Background audio usually assumes local or global? PA typically global/selected.
                  // But Upload.jsx doesn't have Zone Selector. 
                  // It assumes "All/Default". 
                  // Controller doesn't enforce zones for exclusion, just existence.
                  zones: ['All Zones'], 
                  type: 'background',
                  content: fileToPlay.name
              });
          } catch (err) {
              if (err.response && err.response.status === 409) {
                  setErrorMessage("System Busy: Another broadcast or audio is playing.");
                  setShowErrorModal(true);
                  return;
              }
              console.error("Lock Request Failed:", err);
          }
      }

      if (playingId === id) {
          // Toggle Pause/Play
          if (audioRef.current.paused) {
              try {
                  await audioRef.current.play();
              } catch (err) {
                  console.error("Playback failed:", err);
                  setErrorMessage("Playback failed: " + err.message);
                  setShowErrorModal(true);
              }
          } else {
              audioRef.current.pause();
              // Optional: Release lock on pause? No, keep it.
          }
      } else {
          // Play New
          if (fileToPlay.content) {
             audioRef.current.src = fileToPlay.content;
             try {
                 await audioRef.current.play();
                 setPlayingId(id);
                 startTimeRef.current = Date.now();
                 
                 // Log activity
             try {
                 const newLogId = await logActivity(
                     currentUser?.name || 'Admin',
                     'Music Session',
                     'Music',
                     `${fileToPlay.name} (Start: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                 );
                 setCurrentLogId(newLogId);
             } catch (logErr) {
                 console.error("Logging failed", logErr);
                 // Non-fatal, proceed
             }
             } catch (err) {
                 console.error("Playback load failed:", err);
                 setErrorMessage("Could not play audio: " + err.message);
                 setShowErrorModal(true);
             }
          }
      }
  };
 
  // Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);

  const handleFileChange = (e) => {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = [];
      const batchNames = new Set(); // Track names in current batch

      selectedFiles.forEach(file => {
          // CHECK DUPLICATION (Existing + Current Batch)
          if (files.some(f => f.name === file.name) || batchNames.has(file.name)) {
              if (!errorMessage) { // Only show error for first duplicate to avoid spam
                   setErrorMessage(`File "${file.name}" already exists or was selected twice.`);
                   setShowErrorModal(true);
              }
              return;
          }

          batchNames.add(file.name);

          // Use FileReader to store actual content
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64Content = event.target.result;
              addFile({
                  id: Date.now() + Math.random(),
                  name: file.name,
                  size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                  date: new Date().toLocaleDateString(),
                  type: file.type,
                  content: base64Content // STORE CONTENT
              });
          };
          reader.readAsDataURL(file);
      });
      // Reset
      e.target.value = '';
      setErrorMessage(''); // Clear previous errors if any (though modal handles display)
  };

  const confirmDelete = (file) => {
      setFileToDelete(file);
      setShowDeleteModal(true);
  };
  
  // Bulk Selection State
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const toggleSelect = (id) => {
      const newSet = new Set(selectedFiles);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedFiles(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedFiles.size === files.length) {
          setSelectedFiles(new Set());
      } else {
          setSelectedFiles(new Set(files.map(f => f.id)));
      }
  };

  const confirmBulkDelete = () => {
      setIsBulkDelete(true);
      setShowDeleteModal(true);
  };

  const handleDelete = () => {
      if (isBulkDelete) {
          // Bulk Delete
          selectedFiles.forEach(id => {
              deleteFile(id);
              if (playingId === id) {
                  stopPlayback();
                  // Log if needed
              }
          });
          setSelectedFiles(new Set());
          setIsBulkDelete(false);
          setShowDeleteModal(false);
      } else if (fileToDelete) {
          // Single Delete
          deleteFile(fileToDelete.id);
          // If playing deleted file, stop
          if (playingId === fileToDelete.id) {
              stopPlayback();
              if (currentLogId) {
                  const endTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  updateLog(currentLogId, {
                      action: 'Music Session',
                      details: `${fileToDelete.name} (Start: ${startTimeStrRef.current} - End: ${endTimeStr})`
                  });
                  setCurrentLogId(null);
              }
          }
          setShowDeleteModal(false);
          setFileToDelete(null);
      }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <i className="material-icons mr-3 text-primary">upload</i> Upload Audio
      </h2>

      {emergencyActive && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm flex items-center animate-pulse">
              <i className="material-icons text-2xl mr-3">warning</i>
              <div>
                   <p className="font-bold">Emergency Alert Active</p>
                   <p className="text-sm">Audio playback is temporarily disabled.</p>
               </div>
           </div>
       )}

       {systemState?.active_task && systemState.active_task.data?.user !== (currentUser?.name || 'Admin') && (
           <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 rounded shadow-sm flex items-center animate-fade-in">
               <i className="material-icons text-2xl mr-3">lock</i>
               <div>
                   <p className="font-bold">System Busy</p>
                   <p className="text-sm">
                        <span className="font-semibold">{systemState.active_task.data?.user}</span> is using the system ({systemState.mode}).
                   </p>
               </div>
           </div>
       )}

      <div 
        onClick={() => fileInputRef.current.click()}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center border-dashed border-2 border-gray-300 hover:border-primary transition-colors cursor-pointer group"
      >
         <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
           <i className="material-icons text-primary text-4xl">cloud_upload</i>
         </div>
         <h3 className="text-lg font-semibold text-gray-700">Upload Audio Files</h3>
         <p className="text-gray-500 mt-2">Drag & drop files here or click to browse</p>
         <input 
            type="file" 
            multiple 
            accept="audio/*"
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
         />
         <button className="mt-4 px-6 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors">
           Browse Files
         </button>
      </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
         
         {/* PLAYER BAR - Moved to Top */}
         {playingId && (
            <div className="mb-6 pb-6 border-b border-gray-100 animate-fade-in">
                <div className="flex flex-col space-y-3">
                    <div className="text-center mb-2">
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
                            Now Playing
                        </span>
                        <p className="text-sm text-gray-700 font-medium mt-1 truncate">
                            {files.find(f => f.id === playingId)?.name || 'Unknown Track'}
                        </p>
                    </div>

                    {/* Time & Scrubber */}
                    <div className="flex items-center space-x-3 text-xs text-gray-500 font-mono">
                        <span className="w-10 text-right">{formatTime(currentTime)}</span>
                        <input 
                            type="range" 
                            min="0" 
                            max={duration || 0} 
                            value={currentTime} 
                            onChange={handleSeek}
                            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="w-10">{formatTime(duration)}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center space-x-6">
                        <button onClick={playPrev} className="text-gray-400 hover:text-primary transition-colors">
                            <i className="material-icons text-2xl">skip_previous</i>
                        </button>
                        
                        <button onClick={() => playSound(playingId)} className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-all transform hover:scale-105 active:scale-95">
                            <i className="material-icons text-2xl">{audioRef.current && !audioRef.current.paused ? 'pause' : 'play_arrow'}</i>
                        </button>
                        
                        <button onClick={stopPlayback} className="text-gray-400 hover:text-red-500 transition-colors" title="Stop">
                            <i className="material-icons text-2xl">stop</i>
                        </button>

                        <button onClick={playNext} className="text-gray-400 hover:text-primary transition-colors">
                            <i className="material-icons text-2xl">skip_next</i>
                        </button>
                    </div>
                </div>
            </div>
         )}

         {/* Header & Bulk Actions */}
         <div className="flex items-center justify-between mb-4">
             <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-700">Uploaded Files ({files.length})</h3>
                {files.length > 0 && (
                    <div className="flex items-center space-x-2 ml-4 px-3 py-1 bg-gray-50 rounded-lg">
                        <input 
                            type="checkbox"
                            checked={selectedFiles.size === files.length && files.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                        />
                        <span className="text-xs text-gray-500 font-medium">Select All</span>
                    </div>
                )}
             </div>

             {selectedFiles.size > 0 && (
                 <button 
                    onClick={confirmBulkDelete}
                    className="flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                 >
                     <i className="material-icons text-base mr-1">delete</i>
                     Delete ({selectedFiles.size})
                 </button>
             )}
         </div>
         
         {files.length > 0 ? (
             <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4 pr-1">
                  {files.map((file) => {
                      const isLocked = systemState?.active_task && systemState.active_task.data?.user !== (currentUser?.name || 'Admin');
                      return (
                      <div 
                         key={file.id} 
                         className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${isLocked ? 'cursor-not-allowed opacity-60 bg-gray-50' : 'cursor-pointer'} ${playingId === file.id ? 'bg-primary/5 border border-primary/20' : (!isLocked && 'hover:bg-gray-50 border border-transparent')} ${selectedFiles.has(file.id) ? 'bg-blue-50/50' : ''}`}
                         onClick={() => !isLocked && playSound(file.id)}
                      >
                          <div className="flex items-center overflow-hidden flex-1">
                              {/* Checkbox */}
                              <div 
                                 onClick={(e) => { e.stopPropagation(); !isLocked && toggleSelect(file.id); }}
                                 className={`mr-3 flex items-center justify-center p-1 rounded-full ${!isLocked && 'hover:bg-black/5 cursor-pointer'} z-10`}
                              >
                                 <input 
                                    type="checkbox"
                                    checked={selectedFiles.has(file.id)}
                                    onChange={() => {}} // Handled by div click
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary pointer-events-none"
                                 />
                             </div>

                             <div className={`w-10 h-10 rounded flex items-center justify-center mr-3 flex-shrink-0 ${playingId === file.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                 <i className="material-icons">{playingId === file.id ? 'equalizer' : 'audiotrack'}</i>
                             </div>
                             <div className="min-w-0">
                                 <h4 className={`font-medium truncate text-sm ${playingId === file.id ? 'text-primary' : 'text-gray-800'}`}>{file.name}</h4>
                                 <p className="text-xs text-gray-500">{file.size} • {file.date}</p>
                             </div>
                         </div>
                         <div className="flex items-center space-x-2 pl-2">
                             <button 
                                onClick={(e) => { e.stopPropagation(); confirmDelete(file); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                             >
                                 <i className="material-icons text-lg">delete</i>
                             </button>
                     </div>
                     </div>
                 );
                 })}
             </div>
         ) : (
             <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-100 rounded-lg">
               No files uploaded yet.
             </div>
         )}
       </div>

       {/* Delete Modal */}
       <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title={isBulkDelete ? "Delete Multiple Files" : "Delete File"}
          type="danger"
          footer={
             <>
                 <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                 >
                     Cancel
                 </button>
                 <button 
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-md"
                 >
                     Delete {isBulkDelete && `(${selectedFiles.size})`}
                 </button>
             </>
          }
       >
           <p className="text-gray-600">
               {isBulkDelete 
                   ? `Are you sure you want to delete ${selectedFiles.size} selected files? This action cannot be undone.`
                   : <>Are you sure you want to delete <span className="font-bold">{fileToDelete?.name}</span>? This action cannot be undone.</>
               }
           </p>
       </Modal>

       {/* Error Modal */}
       <Modal
            isOpen={showErrorModal}
            onClose={() => setShowErrorModal(false)}
            title="Upload Error"
            type="info"
            footer={<button onClick={() => setShowErrorModal(false)} className="px-6 py-2 bg-primary text-white rounded-lg">OK</button>}
       >
           <p className="text-gray-600">{errorMessage}</p>
       </Modal>
    </div>
  );
};

export default Upload;
