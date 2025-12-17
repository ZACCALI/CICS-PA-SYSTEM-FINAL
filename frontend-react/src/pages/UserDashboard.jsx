import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RealTime from '../components/dashboard/RealTime';
import Schedule from '../components/dashboard/Schedule';
import Emergency from '../components/dashboard/Emergency';
import Upload from '../components/dashboard/Upload';
import ManageAccount from '../components/dashboard/ManageAccount';

const UserDashboard = () => {
  const [activeSection, setActiveSection] = useState('realtime');
  const [user, setUser] = useState(null);

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

  const renderContent = () => {
    switch(activeSection) {
      case 'realtime': return <RealTime />;
      case 'schedule': return <Schedule />;
      case 'emergency': return <Emergency />; // Users might see emergency but not trigger it? Logic says 'regular user'.
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
      <div className="max-w-7xl mx-auto">

        
        {/* Content Area */}
        <div>
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserDashboard;
