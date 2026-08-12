import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const admin = new User({
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      role: "super_admin",
      isActive: true,
    });

    await admin.save();
    console.log("Admin user created successfully");
    console.log("Email: admin@example.com");
    console.log("Password: admin123");
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdmin();
