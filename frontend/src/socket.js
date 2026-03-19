import { io } from "socket.io-client";

const serverUrl = import.meta.env.MODE === "production" 
  ? "https://vingoo-1.onrender.com" 
  : "http://localhost:8000";

const socket = io(serverUrl, {
  withCredentials: true,
  query: {
    userId: localStorage.getItem("userId"),
  },
});

export default socket;