import mongoose from "mongoose";

// ITEM INSIDE ORDER
const shopOrderItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

// SHOP ORDER
const shopOrderSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    shopOrderItems: {
      type: [shopOrderItemSchema],
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "preparing", "assigned", "pending_assignment", "out_for_delivery", "delivered", "cancelled"],
      default: "pending"
    },

    assignedDeliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    deliveryOtp: {
      type: String,
      default: null
    },

    otpExpires: {
      type: Date,
      default: null
    },

    deliveredAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// MAIN ORDER
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      required: true
    },

    deliveryAddress: {
      text: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    shopOrders: {
      type: [shopOrderSchema],
      required: true
    },

    payment: {
      type: Boolean,
      default: false
    },

    razorpayOrderId: {
      type: String,
      default: ""
    },

    razorpayPaymentId: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// 🔥 INDEXES (important)
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "shopOrders.owner": 1 });
orderSchema.index({ "shopOrders.assignedDeliveryBoy": 1 });
orderSchema.index({ "shopOrders.status": 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;