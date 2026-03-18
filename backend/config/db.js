import mongoose from "mongoose";

const connectDb = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URL);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);

        // exit app if DB fails
        process.exit(1);
    }
};
export default connectDb;