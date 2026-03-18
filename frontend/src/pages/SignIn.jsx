import React, { useState } from 'react';
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import { serverUrl } from '../App';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase';
import { ClipLoader } from 'react-spinners';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';

function SignIn() {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();

    // 🔥 SIGN IN
    const handleSignIn = async () => {
        setLoading(true);
        try {
            const result = await axios.post(
                `${serverUrl}/api/auth/signin`,
                { email, password },
                { withCredentials: true }
            );

            dispatch(setUserData(result.data));

            // ✅ MOST IMPORTANT FIX
            localStorage.setItem("userId", result.data._id);

            setErr("");
            setLoading(false);

            navigate("/"); // optional redirect
        } catch (error) {
            setErr(error?.response?.data?.message || "Login failed");
            setLoading(false);
        }
    };

    // 🔥 GOOGLE AUTH
    const handleGoogleAuth = async () => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        try {
        const { data } = await axios.post(
                `${serverUrl}/api/auth/google-auth`,
                {
                    fullName: result.user.displayName,
                    email: result.user.email,
                },
                { withCredentials: true }
            );

            dispatch(setUserData(data));

            // ✅ IMPORTANT
            localStorage.setItem("userId", data._id);

            navigate("/");
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className='min-h-screen w-full flex items-center justify-center p-4 bg-[#fff9f6]'>

            <div className='bg-white rounded-xl shadow-lg w-full max-w-md p-8 border'>

                <h1 className='text-3xl font-bold mb-2 text-[#ff4d2d]'>Vingo</h1>
                <p className='text-gray-600 mb-8'>
                    Sign In to your account
                </p>

                {/* EMAIL */}
                <div className='mb-4'>
                    <label className='block text-gray-700 mb-1'>Email</label>
                    <input
                        type="email"
                        className='w-full border rounded-lg px-3 py-2'
                        placeholder='Enter email'
                        onChange={(e) => setEmail(e.target.value)}
                        value={email}
                    />
                </div>

                {/* PASSWORD */}
                <div className='mb-4'>
                    <label className='block text-gray-700 mb-1'>Password</label>

                    <div className='relative'>
                        <input
                            type={showPassword ? "text" : "password"}
                            className='w-full border rounded-lg px-3 py-2 pr-10'
                            placeholder='Enter password'
                            onChange={(e) => setPassword(e.target.value)}
                            value={password}
                        />

                        <button
                            className='absolute right-3 top-3 text-gray-500'
                            onClick={() => setShowPassword(prev => !prev)}
                            type="button"
                        >
                            {showPassword ? <FaRegEyeSlash /> : <FaRegEye />}
                        </button>
                    </div>
                </div>

                {/* FORGOT */}
                <div
                    className='text-right mb-4 text-[#ff4d2d] cursor-pointer'
                    onClick={() => navigate("/forgot-password")}
                >
                    Forgot Password
                </div>

                {/* LOGIN BUTTON */}
                <button
                    className='w-full bg-[#ff4d2d] text-white py-2 rounded-lg'
                    onClick={handleSignIn}
                    disabled={loading}
                >
                    {loading ? <ClipLoader size={20} color='white' /> : "Sign In"}
                </button>

                {err && <p className='text-red-500 text-center mt-2'>*{err}</p>}

                {/* GOOGLE */}
                <button
                    className='w-full mt-4 flex items-center justify-center gap-2 border rounded-lg py-2'
                    onClick={handleGoogleAuth}
                >
                    <FcGoogle />
                    Sign In with Google
                </button>

                <p className='text-center mt-6 cursor-pointer' onClick={() => navigate("/signup")}>
                    Create account? <span className='text-[#ff4d2d]'>Sign Up</span>
                </p>

            </div>
        </div>
    );
}

export default SignIn;