import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RealTime from '../components/dashboard/RealTime';
import Schedule from '../components/dashboard/Schedule';
import Emergency from '../components/dashboard/Emergency';
import Upload from '../components/dashboard/Upload';
import ManageAccount from '../components/dashboard/ManageAccount';
import HistoryLogs from '../components/dashboard/HistoryLogs';
import { useApp } from '../context/AppContext';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('realtime');
  const [user, setUser] = useState(null);
  const { schedules } = useApp();

  useEffect(() => {
    const userStr = sessionStorage.getItem('current_user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }

    const handleNavChange = (e) => {
        if (e.detail) setActiveSection(e.detail);
    };

    window.addEventListener('nav-change', handleNavChange);
    return () => window.removeEventListener('nav-change', handleNavChange);
  }, []);

  const totalAnnouncements = schedules.length;
  const pendingAnnouncements = schedules.filter(s => s.status === 'Pending').length;

  const renderContent = () => {
    switch(activeSection) {
      case 'realtime': return <RealTime />;
      case 'schedule': return <Schedule />;
      case 'emergency': return <Emergency />;
      case 'history': return <HistoryLogs />;
      case 'upload': return <Upload />;
      case 'manage-account': return <ManageAccount />;
      default: return <RealTime />;
    }
  };

  return (
    <DashboardLayout 
      activeSection={activeSection} 
      setActiveSection={setActiveSection} 
      user={user}
    >
      <div className="max-w-7xl mx-auto animation-fade-in pb-12">


        {/* Stats Grid: Request was for "total and upcoming is in one line and the system and devices is in one line".
            This implies a 2-column layout on most screens, rows:
            Row 1: Total | Upcoming
            Row 2: System | Devices
        */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          
          {/* Row 1 */}
          <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100 flex items-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mr-5">
              <i className="material-icons text-primary text-3xl">campaign</i>
            </div>
            <div>
              <p className="text-secondary text-sm font-medium">Total Announcements</p>
              <h3 className="text-3xl font-bold text-gray-800">{totalAnnouncements}</h3>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100 flex items-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mr-5">
               <i className="material-icons text-purple-600 text-3xl">schedule</i>
            </div>
            <div>
              <p className="text-secondary text-sm font-medium">Upcoming Schedule</p>
              <h3 className="text-3xl font-bold text-gray-800">{pendingAnnouncements}</h3>
            </div>
          </div>

          {/* Row 2 */}
          <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100 flex items-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mr-5">
               <i className="material-icons text-green-600 text-3xl">check_circle</i>
            </div>
            <div>
              <p className="text-secondary text-sm font-medium">Device Status</p>
              <h3 className="text-2xl font-bold text-green-600">Online</h3>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="transition-all duration-300">
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
