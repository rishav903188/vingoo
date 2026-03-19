import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      default: "" // optional for google auth
    },

    mobile: {
      type: String,
      default: "",
      match: /^([0-9]{10})?$/ // optional but must be 10 digits if provided
    },

    role: {
      type: String,
      enum: ["user", "owner", "deliveryBoy"],
      default: "user"
    },

    resetOtp: {
      type: String,
      default: null
    },

    isOtpVerified: {
      type: Boolean,
      default: false
    },

    otpExpires: {
      type: Date,
      default: null
    },

    socketId: {
      type: String,
      default: null
    },

    isOnline: {
      type: Boolean,
      default: false
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  },
  { timestamps: true }
);

// GEO INDEX
userSchema.index({ location: "2dsphere" });

const User = mongoose.model("User", userSchema);

export default User;