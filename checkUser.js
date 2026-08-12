import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'admin@example.com' }).select('+password');
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (user) {
      console.log('User details:');
      console.log('Name:', user.name);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Active:', user.isActive);
      console.log('Password hash exists:', !!user.password);
      
      // Test password comparison
      const isMatch = await user.comparePassword('admin123');
      console.log('Password comparison result:', isMatch);
    }

  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

checkUser();
