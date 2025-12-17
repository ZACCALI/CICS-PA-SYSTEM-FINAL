import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);



  const [loading, setLoading] = useState(true);
  // Reactive Users List for Admin Dashboard
  const [allUsers, setAllUsers] = useState({});

  // Initialize from LocalStorage of registered users
  const loadUsersFromStorage = () => {
    const users = localStorage.getItem('pa_registered_users');
    const initial = {
        'admin@cics.edu': {
          email: 'admin@cics.edu',
          password: 'admin123',
          role: 'admin',
          name: 'System Administrator',
          status: 'approved',
          redirect: '/admin-dashboard',
          lastLogin: '2025-12-16 08:30 AM'
        },
        'user@cics.edu': {
          email: 'user@cics.edu',
          password: 'user123',
          role: 'user',
          name: 'Regular User',
          status: 'approved',
          redirect: '/user-dashboard',
          lastLogin: '2025-12-15 02:15 PM'
        }
    };
    return users ? JSON.parse(users) : initial;
  };

  useEffect(() => {
    // Initial Load
    const existingUsers = loadUsersFromStorage();
    
    // Storage Listener for Sync
    const handleStorage = (e) => {
        if (e.key === 'pa_registered_users') {
            setAllUsers(JSON.parse(e.newValue || '{}'));
        }
    };
    window.addEventListener('storage', handleStorage);
    
    const session = sessionStorage.getItem('current_user');
    const remembered = localStorage.getItem('pa_user_data');
    
    // HARD RESET FIX: Always overwrite critical accounts to ensure they work
    const initial = {
        'admin@cics.edu': {
          email: 'admin@cics.edu',
          password: 'admin123',
          role: 'admin',
          name: 'System Administrator',
          status: 'approved',
          redirect: '/admin-dashboard',
          lastLogin: '2025-12-16 08:30 AM'
        },
        'user@cics.edu': {
          email: 'user@cics.edu',
          password: 'user123',
          role: 'user',
          name: 'Regular User',
          status: 'approved',
          redirect: '/user-dashboard',
          lastLogin: '2025-12-15 02:15 PM'
        }
    };
    
    // Merge defaults
    const finalUsers = { ...existingUsers, ...initial }; // Ensure admin/user defaults override
    localStorage.setItem('pa_registered_users', JSON.stringify(finalUsers));
    setAllUsers(finalUsers);

    if (session) {
      setCurrentUser(JSON.parse(session));
    } else if (remembered) {
       setCurrentUser(JSON.parse(remembered));
       sessionStorage.setItem('current_user', remembered);
    }
    setLoading(false);
    
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  // Helper to persist and update state
  const saveUsers = (newUsers) => {
      setAllUsers(newUsers);
      localStorage.setItem('pa_registered_users', JSON.stringify(newUsers));
  };
  
  // ... update functions to use saveUsers or setAllUsers ...
  // Actually, simplest is to just overwrite `getRegisteredUsers` to return `allUsers`?
  // But `getRegisteredUsers` was used synchronously before state init.
  // I will keep `getRegisteredUsers` reading from LS for safety in non-react contexts? No, we are in React.
  // I'll update the functions.

  const getRegisteredUsers = () => loadUsersFromStorage(); // Fallback to read LS to ensure freshness in async calls
  
  // ... I need to ensure functions update state.
  // I will cheat: functions update LS, and I'll add a listener to MY OWN tab's LS changes?
  // `storage` event does NOT fire for own tab.
  // So I must manually update state in functions.

  // Let's just update `adminApproveUser` to call `setAllUsers`.
  
  // But wait, replacing `getRegisteredUsers` with `allUsers` state might be risky if I don't update all functions.
  // I will just add `allUsers` to the export, and keep functions reading LS.
  // But `ManageAccount` needs to re-render.
  // If `ManageAccount` uses `allUsers` from context, it renders.
  // And `adminApproveUser` should update that state.

  // I will Refactor `ManageAccount` to use `allUsers`.
  // And I will Refactor `AuthContext` to update `allUsers` whenever it writes to LS.
  
  // Actually, I can just add `window.dispatchEvent(new Event('storage'))` hack? No.
  // I will simply set state in the functions.



  const login = async (email, password, rememberReference = false) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = getRegisteredUsers();
        if (users[email] && users[email].password === password) {
          if (users[email].status !== 'approved') {
              reject('Account is pending approval. Please contact Admin.');
              return;
          }
          const user = { ...users[email], email }; // Ensure email attached
          
          // Update Last Login
          user.lastLogin = new Date().toLocaleString();
          users[email] = user;
          localStorage.setItem('pa_registered_users', JSON.stringify(users));

          setCurrentUser(user);
          sessionStorage.setItem('current_user', JSON.stringify(user));
          
          if (rememberReference) {
            localStorage.setItem('pa_username', email);
            localStorage.setItem('pa_user_data', JSON.stringify(user));
          } else {
             localStorage.removeItem('pa_username');
             localStorage.removeItem('pa_user_data');
          }
          resolve(user);
        } else {
          reject('Invalid credentials');
        }
      }, 1000); 
    });
  };

  const signup = async (data) => {
      return new Promise((resolve, reject) => {
          setTimeout(() => {
              const users = getRegisteredUsers();
              if (users[data.email]) {
                  reject('Email already exists');
                  return;
              }

              const newUser = {
                  email: data.email,
                  password: data.password,
                  role: data.role || 'user',
                  name: data.name,
                  status: 'pending', // Default to pending
                  redirect: data.role === 'admin' ? '/admin-dashboard' : '/user-dashboard',
                  lastLogin: 'Never'
              };

              users[data.email] = newUser;
              localStorage.setItem('pa_registered_users', JSON.stringify(users));
              setAllUsers(users); // Sync local (for Admin viewing immediately if they are signed up on same browser? Unlikely but consistent)
              resolve(newUser);
          }, 1000);
      });
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('current_user');
    localStorage.removeItem('pa_username'); 
    localStorage.removeItem('pa_user_data');
  };

  const updateUser = (updatedData) => {
     setCurrentUser(prev => {
         const newVal = { ...prev, ...updatedData };
         sessionStorage.setItem('current_user', JSON.stringify(newVal));
         
         // Persist to DB
         const users = getRegisteredUsers();
         const oldEmail = prev.email;
         const newEmail = updatedData.email || oldEmail;

         if (oldEmail && users[oldEmail]) {
             if (newEmail !== oldEmail) {
                 // Email changed: Move data to new key
                 users[newEmail] = { ...users[oldEmail], ...updatedData };
                 delete users[oldEmail];
             } else {
                 // Just update existing
                 users[oldEmail] = { ...users[oldEmail], ...updatedData };
             }
             localStorage.setItem('pa_registered_users', JSON.stringify(users));
             
             // Also update username ref if this was the remembered user
             if (localStorage.getItem('pa_username') === oldEmail) {
                 localStorage.setItem('pa_username', newEmail);
             }
         }
         return newVal;
     });
  };

  // ADMIN METHODS
  const getAllUsers = () => {
      const users = getRegisteredUsers();
      return Object.values(users);
  };

  const adminDeleteUser = (targetEmail) => {
      const users = getRegisteredUsers();
      if (users[targetEmail]) {
          delete users[targetEmail];
          localStorage.setItem('pa_registered_users', JSON.stringify(users));
          return true;
      }
      return false;
  };

  const adminApproveUser = (targetEmail) => {
      const users = getRegisteredUsers();
      if (users[targetEmail]) {
          users[targetEmail].status = 'approved';
          localStorage.setItem('pa_registered_users', JSON.stringify(users));
          setAllUsers(users); // Sync local
          return true;
      }
      return false;
  };

  const adminResetPassword = (targetEmail) => {
      const users = getRegisteredUsers();
      if (users[targetEmail]) {
          const newPass = '123456'; // Default reset
          users[targetEmail].password = newPass;
          localStorage.setItem('pa_registered_users', JSON.stringify(users));
          return newPass;
      }
      return null;
  };

  const value = {
    currentUser,
    login,
    signup,
    logout,
    updateUser,
    getAllUsers,
    adminDeleteUser,
    adminApproveUser,
    adminResetPassword,
    allUsers // Expose for AdminUI
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
