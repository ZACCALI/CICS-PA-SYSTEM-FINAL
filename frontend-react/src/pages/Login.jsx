import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);

  // Form State
  const [username, setUsername] = useState(''); // Serves as email for signup too
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // For signup
  
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Check if credentials are saved for auto-fill
    const savedUsername = localStorage.getItem('pa_username');
    if (savedUsername && isLoginMode) {
      setUsername(savedUsername);
      setRemember(true);
    }
  }, [isLoginMode]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!username || !password || (!isLoginMode && !name)) {
      showError('Please fill in all fields');
      return;
    }
    
    if (!validateEmail(username)) {
      showError('Please enter a valid email address');
      return;
    }
    
    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isLoginMode) {
         const user = await login(username.trim(), password.trim(), remember);
         setSuccess(true);
         setTimeout(() => navigate(user.redirect), 1000);
      } else {
         // Signup Flow
         const user = await signup({ email: username, password, name });
         // Auto-login after signup? Or message to login? 
         // Let's auto-login for better UX or switch mode.
         // Let's switch to login mode with success message
         setIsLoginMode(true);
         setSuccess(true);
         setTimeout(() => {
             setSuccess(false);
             showError(''); // Clear success style visual
             // Actually, keep them on page to log in, or auto login?
             // Context usually updates session on login, signup just registers.
             // Let's auto login 
             login(username, password, false).then((u) => {
                  navigate(u.redirect);
             });
         }, 1000);
      }
    } catch (err) {
      showError(err.toString());
    } finally {
        if (!success) setLoading(false);
    }
  };

  const showError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const toggleMode = () => {
      setIsLoginMode(!isLoginMode);
      setError('');
      setSuccess(false);
      // Clear fields if desired, or keep email
  };

  return (
    <div className="flex min-h-screen font-sans flex-col md:flex-row">
      {/* Left Section */}
      <div className="flex-1 bg-gradient-to-br from-primary to-primary-dark flex flex-col justify-center items-center p-10 text-center text-white">
        <div className="bg-white w-[100px] h-[100px] rounded-full flex items-center justify-center mb-8">
          <i className="material-icons text-[50px] text-primary">campaign</i>
        </div>
        <h1 className="text-[2rem] mb-4 font-bold font-sans">CICS PA SYSTEM</h1>
        <p className="max-w-[400px] leading-relaxed opacity-90 font-normal">
          Welcome to the Public Address System. Manage announcements and notifications with ease across your campus.
        </p>
      </div>

      {/* Right Section */}
      <div className="flex-1 flex justify-center items-center p-10 bg-white md:rounded-none rounded-t-[30px] -mt-[30px] md:mt-0 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] md:shadow-none">
        <div className="w-full max-w-[380px]">
          <h2 className="text-[1.8rem] mb-8 text-primary font-bold font-sans">
              {isLoginMode ? 'Welcome Back!' : 'Create Account'}
          </h2>
          
          <form onSubmit={handleSubmit} className={shake ? 'animate-shake' : ''}>
            
            {/* Full Name for Signup */}
            {!isLoginMode && (
                <div className="mb-6 relative animation-fade-in">
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLoginMode}
                    placeholder="Full Name"
                    className="w-full p-4 border border-slate-200 rounded-lg text-base transition-all duration-300 font-sans bg-slate-50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                />
                </div>
            )}

            <div className="mb-6 relative">
              <input 
                type="email" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                placeholder="Email Address"
                className="w-full p-4 border border-slate-200 rounded-lg text-base transition-all duration-300 font-sans bg-slate-50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
              />
            </div>

            <div className="mb-6 relative flex items-center">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="Password"
                className="w-full p-4 pr-12 border border-slate-200 rounded-lg text-base transition-all duration-300 font-sans bg-slate-50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              >
                <i className="material-icons">{showPassword ? 'visibility' : 'visibility_off'}</i>
              </button>
            </div>

            {error && (
              <div className="flex items-center p-3 bg-red-50 text-red-700 rounded-lg mb-5 font-semibold animate-shake">
                <i className="material-icons mr-2 text-xl">error_outline</i>
                <span>{error}</span>
              </div>
            )}

            {isLoginMode && (
                <div className="flex items-center mb-6">
                <label className="flex items-center cursor-pointer relative pl-8 select-none font-medium text-gray-700 hover:text-gray-900 group">
                    <input 
                    type="checkbox" 
                    checked={remember} 
                    onChange={(e) => setRemember(e.target.checked)}
                    className="absolute opacity-0 cursor-pointer h-0 w-0 peer"
                    />
                    <span className="absolute left-0 top-0 h-5 w-5 bg-white border border-gray-300 rounded peer-checked:bg-primary peer-checked:border-primary transition-all group-hover:bg-gray-50"></span>
                    <span className="absolute left-[7px] top-[3px] w-[5px] h-[10px] border-solid border-white border-r-2 border-b-2 rotate-45 hidden peer-checked:block"></span>
                    Remember me
                </label>
                </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full p-4 text-white rounded-lg text-base font-semibold cursor-pointer transition-all duration-300 flex items-center justify-center shadow-lg shadow-primary/30 tracking-wide 
                ${success ? 'bg-green-500 hover:bg-green-600' : 'bg-primary hover:bg-primary-dark hover:-translate-y-0.5 shadow-xl'} 
                ${loading && !success ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
            >
              {loading ? (
                <>
                  <i className="material-icons mr-2 animate-spin">hourglass_empty</i> {isLoginMode ? 'AUTHENTICATING...' : 'CREATING ACCOUNT...'}
                </>
              ) : success ? (
                <>
                  <i className="material-icons mr-2">check</i> SUCCESS!
                </>
              ) : (
                <>
                  <i className="material-icons mr-2">{isLoginMode ? 'login' : 'person_add'}</i> {isLoginMode ? 'LOG IN' : 'SIGN UP'}
                </>
              )}
            </button>

            <div className="text-center mt-6">
                <button 
                  type="button" 
                  onClick={toggleMode}
                  className="text-primary hover:text-primary-dark font-medium hover:underline focus:outline-none"
                >
                    {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                </button>
            </div>

            <div className="text-center mt-8 pt-5 border-t border-gray-100 text-gray-500 text-sm">
              <p>© 2025 CICS Public Address System</p>
              <p>v2.5.0</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
