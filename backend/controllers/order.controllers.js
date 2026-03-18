import mongoose from "mongoose";
import Razorpay from "razorpay";
import Shop from "../models/shop.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import DeliveryAssignment from "../models/deliveryAssignment.model.js";
import { sendDeliveryOtpMail } from "../utils/mail.js";

let razorpay;

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are not configured");
  }
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

const normalizeStatus = (status) => {
  if (!status) return status;
  const lower = status.toLowerCase().trim();
  if (lower === "out of delivery") return "out_for_delivery";
  return lower.replace(/\s+/g, "_");
};

const buildOrderPopulate = () => [
  { path: "user", select: "fullName email mobile" },
  {
    path: "shopOrders.shop",
    select: "name address",
  },
  {
    path: "shopOrders.shopOrderItems.item",
    select: "image",
  },
  {
    path: "shopOrders.assignedDeliveryBoy",
    select: "fullName mobile location",
  },
];

const mapStatusForClient = (status) => {
  if (!status) return status;
  if (status === "out_for_delivery") return "out of delivery";
  return status;
};

const toClientOrder = (order) => {
  const obj = order.toObject ? order.toObject() : order;
  if (!obj) return obj;
  if (Array.isArray(obj.shopOrders)) {
    obj.shopOrders = obj.shopOrders.map((so) => ({
      ...so,
      status: mapStatusForClient(so.status),
    }));
  } else if (obj.shopOrders?.status) {
    obj.shopOrders.status = mapStatusForClient(obj.shopOrders.status);
  }
  return obj;
};

export const placeOrder = async (req, res) => {
  try {
    const { cartItems, paymentMethod, deliveryAddress, totalAmount } = req.body;

    if (!req.userId) {
      return res.status(401).json({ message: "unauthorized" });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "cart is empty" });
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      return res.status(400).json({ message: "invalid payment method" });
    }

    if (
      !deliveryAddress ||
      !deliveryAddress.text ||
      !deliveryAddress.latitude ||
      !deliveryAddress.longitude
    ) {
      return res.status(400).json({ message: "send complete deliveryAddress" });
    }

    const groupItemsByShop = {};

    for (const item of cartItems) {
      if (!item.shop) {
        return res.status(400).json({ message: "item.shop missing" });
      }

      let shopId = item.shop;
      if (typeof item.shop === "object" && item.shop !== null) {
        shopId = item.shop._id || item.shop.id;
      }

      if (!shopId) {
        return res.status(400).json({ message: "Invalid shop ID in cart item" });
      }

      const shopIdStr = shopId.toString();

      if (!groupItemsByShop[shopIdStr]) {
        groupItemsByShop[shopIdStr] = [];
      }

      groupItemsByShop[shopIdStr].push(item);
    }

    const shopOrders = await Promise.all(
      Object.keys(groupItemsByShop).map(async (shopId) => {
        const shop = await Shop.findById(shopId).populate("owner");

        if (!shop) {
          throw new Error("shop not found");
        }

        const items = groupItemsByShop[shopId];

        const subtotal = items.reduce(
          (sum, i) => sum + Number(i.price) * Number(i.quantity),
          0,
        );

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        return {
          shop: shop._id,
          owner: shop.owner._id,
          subtotal,
          deliveryOtp: otp,
          shopOrderItems: items.map((i) => ({
            item: i._id || i.id,
            price: i.price,
            quantity: i.quantity,
            name: i.name,
          })),
        };
      }),
    );

    const calculatedTotal = shopOrders.reduce((sum, s) => sum + s.subtotal, 0);

    if (Number(totalAmount) !== calculatedTotal) {
      return res.status(400).json({ message: "total amount mismatch" });
    }

    const newOrder = await Order.create({
      user: req.userId,
      paymentMethod,
      deliveryAddress,
      totalAmount: calculatedTotal,
      shopOrders,
    });
    const io = req.app.get("io");
    // No assignment broadcast here — assignments are created when
    // the shop owner moves status to "out_for_delivery" in updateOrderStatus.

    if (paymentMethod === "online") {
      const razorOrder = await getRazorpay().orders.create({
        amount: Number(calculatedTotal) * 100,
        currency: "INR",
        receipt: `order_${newOrder._id}`,
        payment_capture: 1,
      });

      newOrder.razorpayOrderId = razorOrder.id;
      await newOrder.save();

      return res.status(201).json({
        orderId: newOrder._id,
        razorOrder,
      });
    }

    return res.status(201).json(newOrder);
  } catch (error) {
    console.log("PLACE ORDER ERROR:", error);
    return res.status(500).json({
      message: `place order error ${error.message}`,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, orderId } = req.body;

    if (!razorpay_payment_id || !orderId) {
      return res
        .status(400)
        .json({ message: "missing payment id or order id" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    order.payment = true;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    const populated =
      await Order.findById(orderId).populate(buildOrderPopulate());
    return res.status(200).json(populated);
  } catch (error) {
    console.log("VERIFY PAYMENT ERROR:", error);
    return res.status(500).json({
      message: `verify payment error ${error.message}`,
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: "unauthorized" });
    }

    let orders;

    if (user.role === "owner") {
      orders = await Order.find({ "shopOrders.owner": user._id })
        .populate(buildOrderPopulate())
        .sort({ createdAt: -1 });

      const transformed = orders.map((order) => {
        const shopOrder = order.shopOrders.find(
          (so) => so.owner.toString() === user._id.toString(),
        );
        return {
          ...order.toObject(),
          shopOrders: shopOrder ? shopOrder : {},
        };
      });

      return res.status(200).json(transformed.map(toClientOrder));
    }

    if (user.role === "deliveryBoy") {
      orders = await Order.find({ "shopOrders.assignedDeliveryBoy": user._id })
        .populate(buildOrderPopulate())
        .sort({ createdAt: -1 });

      console.log(`[DEBUG] Found ${orders.length} raw orders for delivery boy ${user._id}`);

      const transformed = orders.map((orderDoc) => {
        const order = orderDoc.toObject();
        const shopOrder = order.shopOrders.find((so) => {
          const boyId = so.assignedDeliveryBoy?._id || so.assignedDeliveryBoy;
          return boyId?.toString() === user._id.toString();
        });

        if (!shopOrder) {
           console.log(`[DEBUG] No matching shopOrder found inside order ${order._id}`);
        }

        return {
          ...order,
          shopOrders: shopOrder ? [shopOrder] : [],
        };
      });

      // Also filter out any orders that somehow failed the shopOrder find
      const finalTransformed = transformed.filter((o) => o.shopOrders.length > 0);
      return res.status(200).json(finalTransformed.map(toClientOrder));
    }

    orders = await Order.find({ user: user._id })
      .populate(buildOrderPopulate())
      .sort({ createdAt: -1 });

    return res.status(200).json(orders.map(toClientOrder));
  } catch (error) {
    console.log("GET MY ORDERS ERROR:", error);
    return res.status(500).json({
      message: `get my orders error ${error.message}`,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
      buildOrderPopulate(),
    );
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.log("GET ORDER BY ID ERROR:", error);
    return res.status(500).json({
      message: `get order by id error ${error.message}`,
    });
  }
};

export const getDeliveryBoyAssignment = async (req, res) => {
  try {
    const assignments = await DeliveryAssignment.find({
      $or: [
        {
          status: "broadcasted",
          broadcastedTo: { $in: [req.userId] } // 🔥 THIS LINE FIX
        },
        {
          status: "assigned",
          assignedTo: req.userId
        }
      ]
    })
      .populate({ path: "order", populate: buildOrderPopulate() })
      .populate("shop");

    const payload = assignments
      .map((assignment) => {
        const order = assignment.order;
        if (!order) return null;

        const shopOrder = order.shopOrders.find(
          (so) => so._id.toString() === assignment.shopOrderId.toString()
        );

        if (!shopOrder) return null;

        return {
          assignmentId: assignment._id,
          orderId: order._id,
          shopOrderId: assignment.shopOrderId,
          shopName: assignment.shop?.name || shopOrder.shop?.name,
          deliveryAddress: order.deliveryAddress,
          subtotal: shopOrder.subtotal,
          items: shopOrder.shopOrderItems,
          status: assignment.status
        };
      })
      .filter(Boolean);

    return res.status(200).json(payload);
  } catch (error) {
    console.log("GET DELIVERY ASSIGNMENT ERROR:", error);
    return res.status(500).json({
      message: "error"
    });
  }
};

export const getCurrentOrder = async (req, res) => {
  try {
    const assignments = await DeliveryAssignment.find({
      assignedTo: req.userId,
      status: "assigned",
    })
      .populate({ path: "order", populate: buildOrderPopulate() })
      .populate("shop");

    if (!assignments || assignments.length === 0) {
      return res.status(200).json([]);
    }

    const currentOrders = [];

    for (const assignment of assignments) {
      const order = assignment.order;
      if (!order) continue;

      const shopOrder = order.shopOrders.find(
        (so) => so._id.toString() === assignment.shopOrderId.toString(),
      );
      if (!shopOrder) continue;

      currentOrders.push({
        _id: order._id,
        assignmentId: assignment._id,
        user: order.user,
        deliveryAddress: order.deliveryAddress,
        shopOrder,
      });
    }

    return res.status(200).json(currentOrders);
  } catch (error) {
    console.log("GET CURRENT ORDER ERROR:", error);
    return res.status(500).json({
      message: `get current order error ${error.message}`,
    });
  }
};

export const acceptOrder = async (req, res) => {
  try {
    const assignment = await DeliveryAssignment.findById(
      req.params.assignmentId,
    );
    if (!assignment) {
      return res.status(404).json({ message: "assignment not found" });
    }

    if (assignment.status !== "broadcasted") {
      return res.status(400).json({ message: "assignment already taken" });
    }

    assignment.assignedTo = req.userId;
    assignment.status = "assigned";
    assignment.acceptedAt = new Date();
    await assignment.save();

    const order = await Order.findById(assignment.order);
    if (order) {
      const shopOrder = order.shopOrders.find(
        (so) => so._id.toString() === assignment.shopOrderId.toString(),
      );
      if (shopOrder) {
        shopOrder.assignedDeliveryBoy = req.userId;
        shopOrder.assignment = assignment._id;
        await order.save();
      }
    }

    const populated = await Order.findById(assignment.order).populate(
      buildOrderPopulate(),
    );
    return res.status(200).json(populated);
  } catch (error) {
    console.log("ACCEPT ORDER ERROR:", error);
    return res.status(500).json({
      message: `accept order error ${error.message}`,
    });
  }
};

export const sendDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopOrderId } = req.body;

    const order = await Order.findById(orderId).populate("user");
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    const shopOrder = order.shopOrders.find(
      (so) => so._id.toString() === shopOrderId,
    );
    if (!shopOrder) {
      return res.status(404).json({ message: "shop order not found" });
    }

    if (shopOrder.assignedDeliveryBoy?.toString() !== req.userId) {
      return res.status(403).json({ message: "not authorized" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    shopOrder.deliveryOtp = otp;
    shopOrder.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await order.save();

    if (order.user) {
      try {
        await sendDeliveryOtpMail(order.user, otp);
      } catch (mailError) {
        console.warn("⚠️ Could not send OTP email (Check .env configuration). OTP is: ", otp);
      }
      
      // ✅ EMIT TO SOCKET SO USER CAN SEE IT ON SCREEN
      try {
        const customer = await User.findById(order.user._id || order.user);
        if (customer && customer.socketId) {
           const io = req.app.get("io");
           if (io) {
             io.to(customer.socketId).emit("receiveOtp", {
               orderId: order._id,
               shopName: shopOrder.shop?.name || "Shop",
               otp: otp
             });
           }
        }
      } catch (err) {
        console.error("Socket OTP emit error:", err);
      }
    }
    
    // Log OTP to terminal for easy testing when email isn't configured
    console.log(`\n============================`);
    console.log(`🔑 DEV OTP for Order: ${otp}`);
    console.log(`============================\n`);

    return res.status(200).json({ message: "otp sent" });
  } catch (error) {
    console.log("SEND DELIVERY OTP ERROR:", error);
    return res.status(500).json({
      message: `send delivery otp error ${error.message}`,
    });
  }
};

export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopOrderId, otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    const shopOrder = order.shopOrders.find(
      (so) => so._id.toString() === shopOrderId,
    );
    if (!shopOrder) {
      return res.status(404).json({ message: "shop order not found" });
    }

    if (shopOrder.assignedDeliveryBoy?.toString() !== req.userId) {
      return res.status(403).json({ message: "not authorized" });
    }

    if (!shopOrder.deliveryOtp) {
      return res.status(400).json({ message: "delivery code not generated" });
    }

    if (shopOrder.deliveryOtp !== otp) {
      return res.status(400).json({ message: "invalid delivery code" });
    }

    shopOrder.status = "delivered";
    shopOrder.deliveredAt = new Date();
    // Do not clear the OTP so the user can still see it in their history if needed, 
    // or we can clear it. Leaving it is fine since status is delivered.
    await order.save();

    await DeliveryAssignment.findOneAndUpdate(
      { order: order._id, shopOrderId: shopOrder._id },
      { status: "completed" },
    );

    const io = req.app.get("io");
    if (io) {
      io.emit("update-status", {
        orderId: order._id,
        shopId: shopOrder.shop,
        status: "delivered",
        userId: order.user,
      });
    }

    return res.status(200).json({ message: "delivery confirmed" });
  } catch (error) {
    console.log("VERIFY DELIVERY OTP ERROR:", error);
    return res.status(500).json({
      message: `verify delivery otp error ${error.message}`,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, shopId } = req.params;
    const { status } = req.body;

    const normalizedStatus = normalizeStatus(status);
    if (
      !["pending", "preparing", "out_for_delivery", "delivered", "cancelled"].includes(
        normalizedStatus,
      )
    ) {
      return res.status(400).json({ message: "invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    const shopOrder = order.shopOrders.find(
      (so) => so.shop.toString() === shopId,
    );
    if (!shopOrder) {
      return res.status(404).json({ message: "shop order not found" });
    }

    if (normalizedStatus === "cancelled") {
      // Cleanup any delivery assignments tied to this cancellation
      await DeliveryAssignment.deleteMany({ order: order._id, shopOrderId: shopOrder._id });

      order.shopOrders.pull(shopOrder._id);
      await order.save();

      if (order.shopOrders.length === 0) {
        await Order.findByIdAndDelete(order._id);
      }
    } else {
      shopOrder.status = normalizedStatus;
      await order.save();
    }

    let availableBoys = [];

    if (normalizedStatus === "out_for_delivery") {
      const deliveryBoys = await User.find({
        role: "deliveryBoy",
      });
      availableBoys = deliveryBoys.map((boy) => ({
        _id: boy._id,
        fullName: boy.fullName,
        mobile: boy.mobile,
      }));

      const assignment = await DeliveryAssignment.create({
        order: order._id,
        shop: shopOrder.shop,
        shopOrderId: shopOrder._id,
        broadcastedTo: deliveryBoys.map((b) => b._id),
      });

      shopOrder.assignment = assignment._id;

      const shop = await Shop.findById(shopOrder.shop);
      const io = req.app.get("io");
      if (io) {
        io.emit("newAssignment", {
          assignmentId: assignment._id,
          orderId: order._id,
          shopOrderId: shopOrder._id,
          shopName: shop?.name,
          deliveryAddress: order.deliveryAddress,
          subtotal: shopOrder.subtotal,
          items: shopOrder.shopOrderItems,
        });
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("update-status", {
        orderId: order._id,
        shopId: shopId,
        status: normalizedStatus,
        userId: order.user,
        deliveryBoyId: shopOrder.assignedDeliveryBoy,
      });
    }

    return res.status(200).json({ availableBoys });
  } catch (error) {
    console.log("UPDATE ORDER STATUS ERROR:", error);
    return res.status(500).json({
      message: `update order status error ${error.message}`,
    });
  }
};

export const getTodayDeliveries = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      "shopOrders.assignedDeliveryBoy": req.userId,
      "shopOrders.status": "delivered",
      "shopOrders.deliveredAt": { $gte: startOfDay, $lte: endOfDay },
    });

    const counts = {};
    orders.forEach((order) => {
      order.shopOrders.forEach((so) => {
        if (so.assignedDeliveryBoy?.toString() !== req.userId.toString())
          return;
        if (!so.deliveredAt) return;
        const hour = new Date(so.deliveredAt).getHours();
        counts[hour] = (counts[hour] || 0) + 1;
      });
    });

    const payload = Object.keys(counts)
      .map((hour) => ({ hour: Number(hour), count: counts[hour] }))
      .sort((a, b) => a.hour - b.hour);

    return res.status(200).json(payload);
  } catch (error) {
    console.log("GET TODAY DELIVERIES ERROR:", error);
    return res.status(500).json({
      message: `get today deliveries error ${error.message}`,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { orderId, shopId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "order not found" });
    
    // Auth check - user or owner
    const shop = await Shop.findById(shopId);
    const isOwner = shop && shop.owner.toString() === req.userId;
    if (order.user.toString() !== req.userId && !isOwner) {
      return res.status(403).json({ message: "not authorized" });
    }

    const shopOrder = order.shopOrders.find((so) => so.shop.toString() === shopId);
    if (!shopOrder) return res.status(404).json({ message: "shop order not found" });

    if (shopOrder.status !== "pending") {
      return res.status(400).json({ message: "Cannot cancel order after it has been accepted" });
    }

    // Cleanup orphaned assignment
    await DeliveryAssignment.deleteMany({ order: order._id, shopOrderId: shopOrder._id });

    order.shopOrders.pull(shopOrder._id);
    await order.save();
    
    if (order.shopOrders.length === 0) {
      await Order.findByIdAndDelete(order._id);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("update-status", {
        orderId: order._id,
        shopId: shopId,
        status: "cancelled",
        userId: order.user,
        deliveryBoyId: shopOrder.assignedDeliveryBoy,
      });
    }

    return res.status(200).json({ message: "order cancelled successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "internal server error" });
  }
};

export const forceAssignDeliveryBoy = async (req, res) => {
  try {
    const { orderId, shopId } = req.params;
    const { deliveryBoyId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "order not found" });

    const shopOrder = order.shopOrders.find((so) => so.shop.toString() === shopId);
    if (!shopOrder) return res.status(404).json({ message: "shop order not found" });

    const assignment = await DeliveryAssignment.findOne({
      order: order._id,
      shopOrderId: shopOrder._id,
    });

    if (!assignment) {
      return res.status(404).json({ message: "assignment not found" });
    }

    assignment.assignedTo = deliveryBoyId;
    assignment.status = "assigned";
    assignment.acceptedAt = new Date();
    await assignment.save();

    shopOrder.assignedDeliveryBoy = deliveryBoyId;
    shopOrder.assignment = assignment._id;
    await order.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("update-status", {
        orderId: order._id,
        shopId: shopId,
        status: "out_for_delivery",
        userId: order.user,
        deliveryBoyId: deliveryBoyId,
      });
    }

    return res.status(200).json({ message: "force assigned successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "internal server error" });
  }
};

export const dropAssignment = async (req, res) => {
  try {
    const assignment = await DeliveryAssignment.findById(req.params.assignmentId).populate("shop");
    if (!assignment || assignment.assignedTo?.toString() !== req.userId) {
      return res.status(403).json({ message: "not authorized or not found" });
    }

    const order = await Order.findById(assignment.order);
    if (!order) return res.status(404).json({ message: "order not found" });

    const shopOrder = order.shopOrders.find((so) => so._id.toString() === assignment.shopOrderId.toString());

    if (shopOrder) {
      shopOrder.assignedDeliveryBoy = null;
      await order.save();
    }

    assignment.assignedTo = null;
    assignment.status = "broadcasted";
    assignment.acceptedAt = null;
    assignment.broadcastedTo.pull(req.userId);
    await assignment.save();

    const io = req.app.get("io");
    if (io) {
      // Alert shop owner the boy dropped it
      if (shopOrder) {
        io.emit("update-status", {
          orderId: order._id,
          shopId: shopOrder.shop,
          status: "out_for_delivery", 
          userId: order.user,
          deliveryBoyId: null, // Signals dropped
        });
      }
      // Re-broadcast to pool natively
      io.emit("newAssignment", {
        assignmentId: assignment._id,
        orderId: order._id,
        shopOrderId: assignment.shopOrderId,
        shopName: assignment.shop?.name || shopOrder?.shop?.name,
        deliveryAddress: order.deliveryAddress,
        subtotal: shopOrder?.subtotal,
        items: shopOrder?.shopOrderItems,
        status: "broadcasted",
      });
    }

    return res.status(200).json({ message: "assignment dropped" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "internal server error" });
  }
};
