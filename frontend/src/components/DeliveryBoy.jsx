import React, { useEffect, useState } from "react";
import Nav from "./Nav";
import { useSelector } from "react-redux";
import axios from "axios";
import { serverUrl } from "../App";
import DeliveryBoyTracking from "./DeliveryBoyTracking";
import { ClipLoader } from "react-spinners";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function DeliveryBoy() {
  const { userData, socket } = useSelector((state) => state.user);

  const [currentOrders, setCurrentOrders] = useState([]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [showOtpBox, setShowOtpBox] = useState(false);
  const [availableAssignments, setAvailableAssignments] = useState([]); // ✅ FIXED
  const [otp, setOtp] = useState("");
  const [todayDeliveries, setTodayDeliveries] = useState([]);
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 📍 LOCATION TRACKING
  useEffect(() => {
    if (!socket || userData?.role !== "deliveryBoy") return;

    let watchId;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          setDeliveryBoyLocation({ lat: latitude, lon: longitude });

          socket.emit("updateLocation", {
            latitude,
            longitude,
            userId: userData._id,
          });
        },
        (error) => {
          console.log(error);
        },
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [userData]);

  // 💰 EARNING
  const ratePerDelivery = 50;
  const totalEarning = todayDeliveries.reduce(
    (sum, d) => sum + d.count * ratePerDelivery,
    0
  );

  // 📦 GET ASSIGNMENTS
  const getAssignments = async () => {
    try {
      const result = await axios.get(
        `${serverUrl}/api/order/get-assignments`,
        { withCredentials: true }
      );

      const rawData = result.data || [];
      setAvailableAssignments(rawData);
    } catch (error) {
      console.log(error);
    }
  };

  // 📦 CURRENT ORDERS
  const getCurrentOrder = async () => {
    try {
      const result = await axios.get(
        `${serverUrl}/api/order/get-current-order`,
        { withCredentials: true }
      );
      setCurrentOrders(result.data || []);
      // Reset active index if out of bounds
      if (activeOrderIndex >= (result.data?.length || 0)) {
         setActiveOrderIndex(0);
      }
    } catch (error) {
      console.log(error);
    }
  };

  // ✅ ACCEPT ORDER
  const acceptOrder = async (orderId, shopOrderId) => {
    try {
      const result = await axios.get(
        `${serverUrl}/api/order/accept-order/${orderId}/${shopOrderId}`,
        { withCredentials: true }
      );
      alert("Order Accepted limits");
      setAvailableAssignments((prev) => prev.filter(a => a.orderId !== orderId));
      await getCurrentOrder();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Error accepting order");
    }
  };

  // ⚡ SOCKET LISTENER
  useEffect(() => {
    if (!socket) return;

    socket.on("newAssignment", (data) => {
      console.log("NEW ORDER RECEIVED:", data);
      setAvailableAssignments((prev) => [...prev, data]);
    });

    socket.on("update-status", (data) => {
      // 1. If assigned directly by the owner
      if (data.status === "assigned" && data.deliveryBoyId === userData._id) {
         getAssignments();
      }
      
      // 2. If cancelled by owner or user
      if (data.status === "cancelled") {
         setAvailableAssignments(prev => prev.filter(a => a.orderId !== data.orderId));
         
         if (data.deliveryBoyId === userData._id) {
           getCurrentOrder(); // Refresh the list from the server to drop the cancelled order
           alert("One of your order assignments has been cancelled by the user/owner.");
         }
      }
    });

    return () => {
      socket.off("newAssignment");
      socket.off("update-status");
    };
  }, [socket]);

  // 📩 ASK CUSTOMER FOR PIN
  const sendOtp = () => {
    setShowOtpBox(true);
  };

  // ✅ VERIFY OTP
  const verifyOtp = async () => {
    setMessage("");

    try {
      const activeOrder = currentOrders[activeOrderIndex];
      const result = await axios.post(
        `${serverUrl}/api/order/verify-delivery-otp`,
        {
          orderId: activeOrder._id,
          shopOrderId: activeOrder.shopOrder._id,
          otp,
        },
        { withCredentials: true }
      );

      setMessage(result.data.message);
      await getCurrentOrder();
      await handleTodayDeliveries();
      setOtp("");
      setShowOtpBox(false);
    } catch (error) {
      console.log(error);
    }
  };

  // 🗑️ DROP ASSIGNMENT
  const dropAssignment = async (orderId, shopOrderId) => {
    if (!window.confirm("Are you sure you want to drop this active delivery assignment?")) return;
    try {
      await axios.post(
        `${serverUrl}/api/order/drop-assignment/${orderId}/${shopOrderId}`,
        {},
        { withCredentials: true }
      );
      alert("Delivery dropped successfully.");
      await getCurrentOrder();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to drop assignment");
      console.log(error);
    }
  };

  // 📊 TODAY DELIVERIES
  const handleTodayDeliveries = async () => {
    try {
      const result = await axios.get(
        `${serverUrl}/api/order/get-today-deliveries`,
        { withCredentials: true }
      );

      setTodayDeliveries(result.data || []);
    } catch (error) {
      console.log(error);
    }
  };

  // 🚀 INITIAL LOAD
  useEffect(() => {
    if (!userData) return;

    getAssignments();
    getCurrentOrder();
    handleTodayDeliveries();
  }, [userData]);

  return (
    <div className="w-screen min-h-screen flex flex-col gap-5 items-center bg-[#fff9f6] overflow-y-auto">
      <Nav />

      <div className="w-full max-w-[800px] flex flex-col gap-5 items-center">
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-md p-5 w-[90%] text-center">
          <h1 className="text-xl font-bold text-[#ff4d2d]">
            Welcome, {userData?.fullName}
          </h1>
          <p className="text-[#ff4d2d]">
            {deliveryBoyLocation?.lat}, {deliveryBoyLocation?.lon}
          </p>
        </div>

        {/* AVAILABLE ORDERS */}
        <div className="bg-white rounded-2xl p-5 w-[90%] shadow-sm">
          <h1 className="font-bold mb-4 text-orange-600 border-b pb-2">🚀 Available Deliveries</h1>

          {availableAssignments.length > 0 ? (
            availableAssignments.map((a, i) => (
              <div key={i} className="border border-orange-100 bg-orange-50/30 p-4 rounded-xl mb-3 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">{a?.shopName}</p>
                  <p className="text-sm text-gray-600">{a?.deliveryAddress?.text}</p>
                </div>

                <button 
                  className="bg-orange-500 text-white px-4 py-2 font-bold rounded-lg hover:bg-orange-600 transition shadow" 
                  onClick={() => acceptOrder(a.orderId, a.shopOrderId)}
                >
                  Accept
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 font-medium">No pending orders available.</p>
          )}
        </div>

        {/* CURRENT ORDERS / TRACKING */}
        {currentOrders.length > 0 && currentOrders[activeOrderIndex] && (
          <div className="bg-white rounded-2xl p-5 shadow-md w-[90%] border border-orange-100">
            <h2 className="text-lg font-bold mb-3">📦 Your Active Deliveries</h2>
            
            {/* Multi-Order Tabs */}
            {currentOrders.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
                {currentOrders.map((order, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setActiveOrderIndex(idx); setShowOtpBox(false); }}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      idx === activeOrderIndex
                        ? "bg-orange-500 text-white border-orange-500 shadow"
                        : "bg-gray-50 text-gray-600 hover:bg-orange-50"
                    }`}
                  >
                    Order #{idx + 1} • {order.shopOrder.shop.name}
                  </button>
                ))}
              </div>
            )}
            
            <div className="border rounded-lg p-4 mb-3 bg-orange-50/50">
              <p className="font-bold text-md text-orange-900">
                {currentOrders[activeOrderIndex].shopOrder.shop.name}
              </p>
              <p className="text-sm text-gray-700 mt-1 font-medium">
                Deliver to: <span className="text-gray-500">{currentOrders[activeOrderIndex].deliveryAddress.text}</span>
              </p>
              <p className="text-xs text-orange-600 font-bold mt-2">
                {currentOrders[activeOrderIndex].shopOrder.shopOrderItems.length} items | ₹
                {currentOrders[activeOrderIndex].shopOrder.subtotal}
              </p>
            </div>

            <DeliveryBoyTracking
              key={currentOrders[activeOrderIndex]._id}
              data={{
                deliveryBoyLocation: deliveryBoyLocation || {
                  lat: userData?.location?.coordinates?.[1] || 0,
                  lon: userData?.location?.coordinates?.[0] || 0,
                },
                customerLocation: {
                  lat: currentOrders[activeOrderIndex].deliveryAddress.latitude,
                  lon: currentOrders[activeOrderIndex].deliveryAddress.longitude,
                },
              }}
            />

            {!showOtpBox ? (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:bg-green-600 active:scale-95 transition-all duration-200"
                  onClick={sendOtp}
                >
                  Mark Order #{activeOrderIndex + 1} As Delivered
                </button>
                <button
                  className="w-full bg-white text-red-500 border border-red-500 font-semibold py-2 px-4 rounded-xl shadow-sm hover:bg-red-50 active:scale-95 transition-all duration-200"
                  onClick={() => dropAssignment(currentOrders[activeOrderIndex]._id, currentOrders[activeOrderIndex].shopOrder._id)}
                >
                  Drop Assignment
                </button>
              </div>
            ) : (
              <div className="mt-4 p-4 border rounded-xl bg-gray-50">
                <p className="text-sm font-semibold mb-2">
                  Enter the Delivery PIN from the customer:{" "}
                  <span className="text-orange-500">
                    {currentOrders[activeOrderIndex].user.fullName}
                  </span>
                </p>
                <input
                  type="text"
                  className="w-full border px-3 py-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono tracking-widest text-lg text-center"
                  placeholder="6-DIGIT PIN"
                  onChange={(e) => setOtp(e.target.value)}
                  value={otp}
                />
                {message && (
                  <p className="text-center text-green-500 font-bold text-lg mb-4">
                    {message}
                  </p>
                )}

                <button
                  className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold hover:bg-orange-600 transition-all shadow"
                  onClick={verifyOtp}
                >
                  Submit OTP
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliveryBoy;