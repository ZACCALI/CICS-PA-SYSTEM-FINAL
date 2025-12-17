import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

const ManageAccount = () => {
  const { currentUser, updateUser, getAllUsers, adminDeleteUser, adminResetPassword, adminApproveUser } = useAuth();
  
  const [formData, setFormData] = useState({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      avatar: currentUser?.avatar || ''
  });

  const [message, setMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  
  // Toggles
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  // ADMIN STATE
  // ADMIN STATE
  const [userList, setUserList] = useState([]);

  useEffect(() => {
      if (currentUser?.role === 'admin') {
          loadUsers();
      }
  }, [currentUser]);

  const loadUsers = async () => {
      try {
          const users = await getAllUsers();
          setUserList(users);
      } catch (error) {
          console.error("Failed to load users", error);
      }
  };
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetResult, setResetResult] = useState('');

  // userList is now derived from context, no effect needed.

  // Actions
  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, avatar: reader.result }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleUpdate = async (e) => {
      e.preventDefault();
      try {
        await updateUser({ 
            name: formData.name, 
            email: formData.email,
            avatar: formData.avatar 
        });
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        alert("Failed to update profile: " + error.message);
      }
  };

  const handlePasswordChange = async (e) => {
      e.preventDefault();
      if (passForm.new !== passForm.confirm) {
          alert("New passwords do not match"); 
          return;
      }
      try {
        await updateUser({ password: passForm.new }); 
        setShowPasswordModal(false);
        setMessage('Password changed successfully!');
        setTimeout(() => setMessage(''), 3000);
        setPassForm({ current: '', new: '', confirm: '' });
      } catch (error) {
        alert("Failed to change password: " + error.message);
      }
  };

  // ADMIN ACTIONS
  const handleAdminReset = async (email) => {
      const newPass = await adminResetPassword(email);
      if (newPass) {
          setResetResult(`Password reset for ${email}. New Password: ${newPass}`);
          setShowResetModal(true);
      }
  };

  const handleApprove = async (email) => {
      await adminApproveUser(email);
      loadUsers();
  };

  const handleDeleteClick = (user) => {
      setSelectedUser(user);
      setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
      if (selectedUser) {
          if (selectedUser.email === currentUser.email) {
              alert("You cannot delete your own admin account.");
              setShowDeleteModal(false);
              return;
          }
          const success = await adminDeleteUser(selectedUser.uid || selectedUser.email); // Ensure UID is used if available
          if (success) {
              loadUsers();
              setShowDeleteModal(false);
              setSelectedUser(null);
          }
      }
  };

  const viewLogs = (user) => {
      setSelectedUser(user);
      setShowLogModal(true);
  };

  const toggleVisibility = (field) => {
      setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Profile Section */}
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <i className="material-icons mr-3 text-primary">admin_panel_settings</i> Manage Account
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Profile Card */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-1 h-fit">
            <div className="flex flex-col items-center">
               <div className="relative group w-24 h-24 mb-4">
                   <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 relative shadow-md">
                        <img 
                            src={formData.avatar || `https://ui-avatars.com/api/?name=${currentUser?.name}&background=2563EB&color=fff`} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full" 
                        />
                   </div>
                   <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                       <i className="material-icons text-white">camera_alt</i>
                       <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                   </label>
               </div>
               <h3 className="text-xl font-bold text-gray-800 text-center">{currentUser?.name}</h3>
               <p className="text-gray-500 text-center break-all">{currentUser?.email}</p>
               <div className="mt-4 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold uppercase">
                 {currentUser?.role} Active
               </div>
            </div>
         </div>

         {/* Account Form */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-100">Account Details</h3>
            {message && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium flex items-center animate-pulse">
                    <i className="material-icons mr-2 text-sm">check_circle</i> {message}
                </div>
            )}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="pt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 border-t border-gray-100 mt-6">
                 <button type="button" onClick={() => setShowPasswordModal(true)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors">Change Password</button>
                 <button type="submit" className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-md hover:shadow-lg transition-all font-medium">Save Changes</button>
              </div>
            </form>
         </div>
      </div>

      {/* 2. ADMIN SECTION: User Management */}
      {currentUser?.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <i className="material-icons mr-2 text-primary">people</i> User Management
                </h3>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Last Login</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {userList.map(u => (
                            <tr key={u.email} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mr-3">
                                            {u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{u.name}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-primary/10 text-primary'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${u.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {u.status || 'approved'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono">
                                    {u.lastLogin || 'Never'}
                                </td>
                                <td className="px-6 py-4 text-center space-x-2 flex justify-center">
                                    {u.status === 'pending' && (
                                        <button 
                                            onClick={() => handleApprove(u.email)}
                                            className="text-green-600 hover:text-green-800 text-xs font-medium hover:underline flex items-center"
                                        >
                                            <i className="material-icons text-sm mr-1">check_circle</i> Approve
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => viewLogs(u)}
                                        className="text-primary hover:text-primary-dark text-xs font-medium hover:underline"
                                    >
                                        Logs
                                    </button>
                                    <button 
                                        onClick={() => handleAdminReset(u.email)}
                                        className="text-orange-600 hover:text-orange-800 text-xs font-medium hover:underline"
                                    >
                                        Reset
                                    </button>
                                    {u.email !== currentUser.email && (
                                        <button 
                                            onClick={() => handleDeleteClick(u)}
                                            className="text-red-600 hover:text-red-800 text-xs font-medium hover:underline"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password" 
        footer={
           <>
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handlePasswordChange} className="px-6 py-2 bg-primary text-white rounded-lg">Update</button>
           </>
        }
      >
        <div className="space-y-4">
             <div className="relative">
                 <input type={showPass.current ? "text" : "password"} placeholder="Current Password" value={passForm.current} onChange={e => setPassForm({...passForm, current: e.target.value})} className="w-full p-2 border rounded-lg" />
                 <i onClick={() => toggleVisibility('current')} className="material-icons absolute right-3 top-3 text-gray-400 cursor-pointer text-sm">{showPass.current ? 'visibility' : 'visibility_off'}</i>
             </div>
             <div className="relative">
                 <input type={showPass.new ? "text" : "password"} placeholder="New Password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} className="w-full p-2 border rounded-lg" />
                 <i onClick={() => toggleVisibility('new')} className="material-icons absolute right-3 top-3 text-gray-400 cursor-pointer text-sm">{showPass.new ? 'visibility' : 'visibility_off'}</i>
             </div>
             <div className="relative">
                <input type={showPass.confirm ? "text" : "password"} placeholder="Confirm Password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} className="w-full p-2 border rounded-lg" />
                <i onClick={() => toggleVisibility('confirm')} className="material-icons absolute right-3 top-3 text-gray-400 cursor-pointer text-sm">{showPass.confirm ? 'visibility' : 'visibility_off'}</i>
             </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete User" type="danger"
        footer={
            <>
               <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
               <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Confirm Delete</button>
            </>
        }
      >
          <p>Are you sure you want to delete user <strong>{selectedUser?.name}</strong>? This cannot be undone.</p>
      </Modal>

      {/* Reset Result Modal */}
      <Modal isOpen={showResetModal} onClose={() => setShowResetModal(false)} title="Reset Successful" type="info"
        footer={<button onClick={() => setShowResetModal(false)} className="px-6 py-2 bg-primary text-white rounded-lg">OK</button>}
      >
          <p className="text-gray-600 font-medium">{resetResult}</p>
      </Modal>

      {/* View Logs Modal */}
      <Modal isOpen={showLogModal} onClose={() => setShowLogModal(false)} title={`Activity Logs: ${selectedUser?.name}`}
         footer={<button onClick={() => setShowLogModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Close</button>}
      >
          <div className="max-h-[300px] overflow-y-auto space-y-3">
              <div className="flex justify-between text-xs font-bold text-gray-500 border-b pb-2">
                  <span>Action</span>
                  <span>Date/Time</span>
              </div>
              {/* Mock Logs - Simulating 3 random events for demo */}
              {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between text-sm text-gray-700 py-2 border-b border-gray-50">
                      <span>{['Login', 'Logout', 'Profile Update'][i % 3]}</span>
                      <span className="text-gray-500 text-xs">2025-12-{(10+i)} 09:3{i} AM</span>
                  </div>
              ))}
              <p className="text-xs text-center text-gray-400 mt-4">End of records (Simulated).</p>
          </div>
      </Modal>
    </div>
  );
};

export default ManageAccount;
