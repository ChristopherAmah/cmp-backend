import User from "../models/User.js";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Basic input validation helpers
const isValidEmail = (email) =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128;

const isValidName = (name) =>
  typeof name === "string" &&
  name.trim().length >= 2 &&
  name.trim().length <= 100;

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // Validate input
    if (
      !isValidName(name) ||
      !isValidEmail(email) ||
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid input. Please provide a valid name, email, and a password with at least 8 characters.",
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: "error",
        message: "User already exists",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: "user", // Default role
    });

    const token = generateToken(user._id);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate input early to prevent user enumeration / injection
    if (!isValidEmail(email) || !isValidPassword(password)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        status: "error",
        message: "Your account has been deactivated",
      });
    }

    const token = generateToken(user._id);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie("token", token, cookieOptions);

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};

export const getMe = async (req, res) => {
  // req.user is already fetched by the protect middleware
  const user = req.user;

  res.status(200).json({
    status: "success",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    },
  });
};
