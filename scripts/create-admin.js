import dotenv from "dotenv";
import connectDB from "./config/db.js";
import User from "./models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || "admin@fifthlab.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminRole = process.env.ADMIN_ROLE || "admin";

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: "Admin User",
      email: adminEmail,
      password: adminPassword,
      role: adminRole,
      isActive: true,
    });

    console.log("Admin user created successfully!");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();

