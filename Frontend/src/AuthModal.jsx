// import React, { useState, useContext } from 'react';
// import { X, User, Lock, Mail, Eye, EyeOff } from 'lucide-react';
// import { UserDataContext } from './context/UserContext';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';

// const AuthModal = ({ isOpen, onClose, onAuthSuccess, defaultTab = 'login' }) => {
//   const [activeTab, setActiveTab] = useState(defaultTab);
//   const [showPassword, setShowPassword] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState('');
//   const Navigate = useNavigate();

//   const { setUser } = useContext(UserDataContext);
  
//   // Form states
//   const [loginData, setLoginData] = useState({ email: '', password: '' });
//   const [signupData, setSignupData] = useState({ 
//     firstName: '', 
//     lastName: '',
//     email: '', 
//     password: ''
//   });

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setIsLoading(true);
//     setError('');
    
//     const userData = {
//       email: loginData.email,
//       password: loginData.password,
//     };

//     try {
//       const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/users/login`, userData);
//       console.log("Login response:", response.data);

//       if (response.status === 200 || response.status === 201) {
//         const data = response.data;
//         setUser(data.user);
//         localStorage.setItem('token', data.token);
//         Navigate('/home');
//       }
//       else if (response.data.token) {
//       localStorage.setItem("authToken", response.data.token);
//       console.log("Token stored:", localStorage.getItem("authToken"));
//     } else {
//       console.error("No token received from server");
//     }
//     } catch (error) {
//       console.error("Login error:", error);
//       setError(error.response?.data?.message || "Failed to login. Please try again.");
//     } finally {
//       setIsLoading(false);
//     }

//     setEmail('');
//     setPassword('');
//   };

//   const handleSignup = async (e) => {
//     e.preventDefault();
//     setIsLoading(true);
//     setError('');
    
//     const newUser = {
//       email: signupData.email,
//       password: signupData.password,
//       fullname: {
//         firstname: signupData.firstName,
//         lastname: signupData.lastName
//       },
//     };

//     try {
//       const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/users/register`, newUser);
//       console.log("Registration response:", response.data);

//       if (response.status === 200 || response.status === 201) {
//         const data = response.data;
//         setUser(data.user);
//         localStorage.setItem('token', data.token);
//         Navigate('/home');
//       } else {
//         setError(`Registration failed with status: ${response.status}`);
//       }
//     } catch (error) {
//       console.error("Registration error:", error);
//       setError(error.response?.data?.message || "Failed to register. Please try again.");
//     } finally {
//       setIsLoading(false);
//     }

//     setEmail("");
//     setPassword("");
//     setFirstName("");
//     setLastName("");
//   };

//   // Reset form and error when modal closes
//   const handleClose = () => {
//     setError('');
//     setLoginData({ email: '', password: '' });
//     setSignupData({ firstName: '', lastName: '', email: '', password: '' });
//     onClose();
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg w-full max-w-md relative animate-in fade-in duration-200">
//         {/* Header */}
//         <div className="flex items-center justify-between p-6 border-b">
//           <h2 className="text-xl font-semibold">
//             {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
//           </h2>
//           <button
//             onClick={handleClose}
//             className="p-1 hover:bg-gray-100 rounded-full transition-colors"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Tab Navigation */}
//         <div className="flex border-b">
//           <button
//             onClick={() => {
//               setActiveTab('login');
//               setError('');
//             }}
//             className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
//               activeTab === 'login'
//                 ? 'text-blue-600 border-b-2 border-blue-600'
//                 : 'text-gray-600 hover:text-gray-800'
//             }`}
//           >
//             Login
//           </button>
//           <button
//             onClick={() => {
//               setActiveTab('signup');
//               setError('');
//             }}
//             className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
//               activeTab === 'signup'
//                 ? 'text-blue-600 border-b-2 border-blue-600'
//                 : 'text-gray-600 hover:text-gray-800'
//             }`}
//           >
//             Sign Up
//           </button>
//         </div>

//         {/* Form Content */}
//         <div className="p-6">
//           {error && (
//             <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
//               <div className="flex">
//                 <div className="ml-3">
//                   <p className="text-sm text-red-700">{error}</p>
//                 </div>
//               </div>
//             </div>
//           )}
          
//           {activeTab === 'login' ? (
//             <form onSubmit={handleLogin} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Email address
//                 </label>
//                 <div className="relative">
//                   <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <input
//                     type="email"
//                     required
//                     value={loginData.email}
//                     onChange={(e) => setLoginData({...loginData, email: e.target.value})}
//                     className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                     placeholder="Enter your email"
//                     disabled={isLoading}
//                   />
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Password
//                 </label>
//                 <div className="relative">
//                   <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <input
//                     type={showPassword ? 'text' : 'password'}
//                     required
//                     value={loginData.password}
//                     onChange={(e) => setLoginData({...loginData, password: e.target.value})}
//                     className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                     placeholder="Enter your password"
//                     disabled={isLoading}
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
//                     disabled={isLoading}
//                   >
//                     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//                   </button>
//                 </div>
//               </div>

//               <div className="flex items-center justify-between">
//                 <div className="flex items-center">
//                   <input
//                     id="remember-me"
//                     name="remember-me"
//                     type="checkbox"
//                     className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
//                   />
//                   <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
//                     Remember me
//                   </label>
//                 </div>

//                 <div className="text-sm">
//                   <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
//                     Forgot password?
//                   </a>
//                 </div>
//               </div>

//               <button
//                 type="submit"
//                 disabled={isLoading}
//                 className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//               >
//                 {isLoading ? 'Signing in...' : 'Sign in'}
//               </button>
//             </form>
//           ) : (
//             <form onSubmit={handleSignup} className="space-y-4">
//               <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     First name
//                   </label>
//                   <div className="relative">
//                     <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                     <input
//                       type="text"
//                       required
//                       value={signupData.firstName}
//                       onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
//                       className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                       placeholder="First name"
//                       disabled={isLoading}
//                     />
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Last name
//                   </label>
//                   <div className="relative">
//                     <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                     <input
//                       type="text"
//                       required
//                       value={signupData.lastName}
//                       onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
//                       className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                       placeholder="Last name"
//                       disabled={isLoading}
//                     />
//                   </div>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Email address
//                 </label>
//                 <div className="relative">
//                   <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <input
//                     type="email"
//                     required
//                     value={signupData.email}
//                     onChange={(e) => setSignupData({...signupData, email: e.target.value})}
//                     className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                     placeholder="Enter your email"
//                     disabled={isLoading}
//                   />
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Password
//                 </label>
//                 <div className="relative">
//                   <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <input
//                     type={showPassword ? 'text' : 'password'}
//                     required
//                     value={signupData.password}
//                     onChange={(e) => setSignupData({...signupData, password: e.target.value})}
//                     className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
//                     placeholder="Create a password"
//                     disabled={isLoading}
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
//                     disabled={isLoading}
//                   >
//                     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//                   </button>
//                 </div>
//               </div>

//               <div className="flex items-center">
//                 <input
//                   id="terms"
//                   name="terms"
//                   type="checkbox"
//                   required
//                   className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
//                 />
//                 <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
//                   I agree to the{' '}
//                   <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
//                     Terms and Conditions
//                   </a>
//                 </label>
//               </div>

//               <button
//                 type="submit"
//                 disabled={isLoading}
//                 className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//               >
//                 {isLoading ? 'Creating account...' : 'Create Account'}
//               </button>
//             </form>
//           )}

//           {/* Social Login/Signup */}
//           <div className="mt-6">
//             <div className="relative">
//               <div className="absolute inset-0 flex items-center">
//                 <div className="w-full border-t border-gray-300"></div>
//               </div>
//               <div className="relative flex justify-center text-sm">
//                 <span className="px-2 bg-white text-gray-500">Or continue with</span>
//               </div>
//             </div>

//             <div className="mt-6 grid grid-cols-2 gap-3">
//               <button 
//                 type="button"
//                 className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
//                 disabled={isLoading}
//               >
//                 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
//                   <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
//                 </svg>
//               </button>
//               <button 
//                 type="button"
//                 className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
//                 disabled={isLoading}
//               >
//                 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
//                   <path d="M22,12.1c0-5.7-4.6-10.3-10.3-10.3S1.5,6.4,1.5,12.1c0,5.1,3.7,9.4,8.6,10.2v-7.2h-2.6v-3h2.6V9.9c0-2.5,1.5-3.9,3.8-3.9c1.1,0,2.2,0.2,2.2,0.2v2.5h-1.3c-1.2,0-1.6,0.8-1.6,1.6v1.9h2.8l-0.4,3h-2.3v7.2C18.3,21.5,22,17.2,22,12.1z"/>
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="px-6 pb-6 text-center text-sm text-gray-600">
//           {activeTab === 'login' ? (
//             <p>
//               Don't have an account?{' '}
//               <button
//                 onClick={() => {
//                   setActiveTab('signup');
//                   setError('');
//                 }}
//                 className="text-blue-600 hover:text-blue-700 font-medium"
//                 disabled={isLoading}
//               >
//                 Sign up
//               </button>
//             </p>
//           ) : (
//             <p>
//               Already have an account?{' '}
//               <button
//                 onClick={() => {
//                   setActiveTab('login');
//                   setError('');
//                 }}
//                 className="text-blue-600 hover:text-blue-700 font-medium"
//                 disabled={isLoading}
//               >
//                 Sign in
//               </button>
//             </p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AuthModal;   