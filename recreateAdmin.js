import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const recreateAdmin = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log('Connected to MongoDB');

    // Delete existing admin
    await User.deleteOne({ email: 'admin@example.com' });
    console.log('Deleted existing admin user');

    // Create admin user using the User model
    const admin = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'super_admin',
      isActive: true
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');

    // Test the password
    const testUser = await User.findOne({ email: 'admin@example.com' }).select('+password');
    const isMatch = await testUser.comparePassword('admin123');
    console.log('Password test result:', isMatch);

  } catch (error) {
    console.error('Error recreating admin:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

recreateAdmin();
