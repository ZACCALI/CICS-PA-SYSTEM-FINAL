import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../common/Modal';

const Upload = () => {
  const { files, addFile, deleteFile } = useApp();
  const fileInputRef = useRef(null);
  
  // Audio Playback
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(new Audio());
  
  // Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);

  const handleFileChange = (e) => {
      const selectedFiles = Array.from(e.target.files);
      
      selectedFiles.forEach(file => {
          // CHECK DUPLICATION
          if (files.some(f => f.name === file.name)) {
              setErrorMessage(`File "${file.name}" already exists.`);
              setShowErrorModal(true);
              return;
          }

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
  };

  const playSound = (id) => {
      const fileToPlay = files.find(f => f.id === id);
      if (!fileToPlay) return;

      if (playingId === id) {
          // Is currently playing this one, so pause
          audioRef.current.pause();
          setPlayingId(null);
      } else {
          // Play new one
          if (!audioRef.current.paused) {
               audioRef.current.pause();
          }
           
           // Set src to stored base64 content
           if (fileToPlay.content) {
               audioRef.current.src = fileToPlay.content;
           } else {
               // Fallback if no content (old mock data?)
               console.warn("No audio content found for file");
               return; 
           }
           
           // Play
           audioRef.current.play().then(() => {
               setPlayingId(id);
               // Removed timeout auto-stop to allow full song play as requested
           }).catch(e => console.error(e));
           
           // Handle end event
           audioRef.current.onended = () => setPlayingId(null);
      }
  };

  const confirmDelete = (file) => {
      setFileToDelete(file);
      setShowDeleteModal(true);
  };
  
  const handleDelete = () => {
      if (fileToDelete) {
          deleteFile(fileToDelete.id);
          // If playing deleted file, stop
          if (playingId === fileToDelete.id) {
              audioRef.current.pause();
              setPlayingId(null);
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
         <h3 className="text-lg font-semibold text-gray-700 mb-4">Uploaded Files ({files.length})</h3>
         
         {files.length > 0 ? (
             <div className="divide-y divide-gray-100">
                 {files.map((file) => (
                     <div key={file.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                         <div className="flex items-center overflow-hidden">
                             <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-500 mr-3 flex-shrink-0">
                                 <i className="material-icons">{playingId === file.id ? 'volume_up' : 'audiotrack'}</i>
                             </div>
                             <div className="min-w-0">
                                 <h4 className={`font-medium truncate text-sm ${playingId === file.id ? 'text-primary' : 'text-gray-800'}`}>{file.name}</h4>
                                 <p className="text-xs text-gray-500">{file.size} • {file.date}</p>
                             </div>
                         </div>
                         <div className="flex items-center space-x-2">
                             <button 
                                title={playingId === file.id ? 'Stop' : 'Play'}
                                onClick={() => playSound(file.id)}
                                className={`p-1.5 rounded-full transition-colors ${playingId === file.id ? 'text-primary bg-primary/10' : 'text-gray-400 hover:text-primary hover:bg-primary/10'}`}
                             >
                                 <i className="material-icons text-lg">{playingId === file.id ? 'stop' : 'play_arrow'}</i>
                             </button>
                             <button 
                                title="Delete"
                                onClick={() => confirmDelete(file)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                             >
                                 <i className="material-icons text-lg">delete</i>
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
         ) : (
             <div className="text-center text-gray-500 py-8">
               No files uploaded yet.
             </div>
         )}
       </div>

       {/* Delete Modal */}
       <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete File"
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
                     Delete
                 </button>
             </>
          }
       >
           <p className="text-gray-600">Are you sure you want to delete <span className="font-bold">{fileToDelete?.name}</span>? This action cannot be undone.</p>
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
