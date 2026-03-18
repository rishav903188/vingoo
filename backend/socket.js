import User from "./models/user.model.js";

export const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("CONNECTED:", socket.id);

    // ✅ identity (optional but good)
    socket.on("identity", async ({ userId }) => {
      if (!userId || userId === "null" || userId === "undefined") return;

      try {
        await User.findByIdAndUpdate(userId, {
          socketId: socket.id,
          isOnline: true,
        });
      } catch (error) {
        console.log("identity error");
      }
    });

    // 📍 LOCATION UPDATE
    socket.on("updateLocation", async ({ latitude, longitude, userId }) => {
      if (!userId) return;

      try {
        const user = await User.findByIdAndUpdate(userId, {
          location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          isOnline: true,
          socketId: socket.id,
        });

        if (user) {
          io.emit("updateDeliveryLocation", {
            deliveryBoyId: userId,
            latitude,
            longitude,
          });
        }
      } catch (error) {
        console.log("updateLocation error");
      }
    });

    // ❌ DISCONNECT
    socket.on("disconnect", async () => {
      try {
        await User.findOneAndUpdate(
          { socketId: socket.id },
          {
            socketId: null,
            isOnline: false,
          }
        );
      } catch (error) {
        console.log("disconnect error");
      }
    });
  });
};