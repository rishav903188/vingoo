import mongoose from "mongoose";

const deliveryAssignmentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true
    },

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true
    },

    shopOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    broadcastedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
      }
    ],

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    status: {
      type: String,
      enum: ["broadcasted", "assigned", "completed"],
      default: "broadcasted",
      index: true
    },

    acceptedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// 🔥 COMPOUND INDEX (important for performance)
deliveryAssignmentSchema.index({
  status: 1,
  assignedTo: 1
});

const DeliveryAssignment = mongoose.model(
  "DeliveryAssignment",
  deliveryAssignmentSchema
);

export default DeliveryAssignment;