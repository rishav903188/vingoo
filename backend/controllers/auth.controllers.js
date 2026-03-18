import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import genToken from "../utils/token.js";
import { sendOtpMail } from "../utils/mail.js";

// SIGN UP
export const signUp = async (req, res) => {
    try {
        const { fullName, email, password, mobile, role } = req.body;

        if (!fullName || !email || !password || !mobile) {
            return res.status(400).json({ message: "all fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "password must be at least 6 characters"
            });
        }

        if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
            return res.status(400).json({
                message: "mobile must be exactly 10 digits"
            });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "user already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        user = await User.create({
            fullName,
            email,
            role,
            mobile,
            password: hashedPassword
        });

        const token = await genToken(user._id);

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: false // production me true
        });

        return res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            mobile: user.mobile,
            role: user.role
        });

    } catch (error) {
        return res.status(500).json({
            message: `sign up error ${error.message}`
        });
    }
};

// SIGN IN
export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "user does not exist" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "incorrect password" });
        }

        const token = await genToken(user._id);

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: false
        });

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            mobile: user.mobile,
            role: user.role
        });

    } catch (error) {
        return res.status(500).json({
            message: `sign in error ${error.message}`
        });
    }
};

// SIGN OUT
export const signOut = async (req, res) => {
    try {
        res.clearCookie("token");
        return res.status(200).json({ message: "logged out successfully" });
    } catch (error) {
        return res.status(500).json({
            message: `sign out error ${error.message}`
        });
    }
};

// SEND OTP
export const sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "user not found" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        user.resetOtp = otp;
        user.otpExpires = Date.now() + 5 * 60 * 1000;
        user.isOtpVerified = false;

        await user.save();
        await sendOtpMail(email, otp);

        return res.status(200).json({ message: "otp sent" });

    } catch (error) {
        return res.status(500).json({
            message: `send otp error ${error.message}`
        });
    }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (
            !user ||
            user.resetOtp !== otp ||
            !user.otpExpires ||
            user.otpExpires < Date.now()
        ) {
            return res.status(400).json({ message: "invalid or expired otp" });
        }

        user.isOtpVerified = true;
        user.resetOtp = undefined;
        user.otpExpires = undefined;

        await user.save();

        return res.status(200).json({ message: "otp verified" });

    } catch (error) {
        return res.status(500).json({
            message: `verify otp error ${error.message}`
        });
    }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const user = await User.findOne({ email });

        if (!user || !user.isOtpVerified) {
            return res.status(400).json({
                message: "otp verification required"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.isOtpVerified = false;

        await user.save();

        return res.status(200).json({
            message: "password reset successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: `reset password error ${error.message}`
        });
    }
};

// GOOGLE AUTH
export const googleAuth = async (req, res) => {
    try {
        const { fullName, email, mobile, role } = req.body;

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                fullName,
                email,
                mobile,
                role
            });
        }

        const token = await genToken(user._id);

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: false
        });

        return res.status(200).json(user);

    } catch (error) {
        return res.status(500).json({
            message: `google auth error ${error.message}`
        });
    }
};