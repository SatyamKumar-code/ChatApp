import mongoose from "mongoose"


const connectDB =  async (req, res) => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("database connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

export default connectDB;