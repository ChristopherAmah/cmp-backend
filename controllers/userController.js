import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../config/cloudinary.js";
import { logAction } from "../middleware/auditLog.js";
import crypto from "crypto";
import { sendMail } from "../services/mailer.js";

// Get all users (admin+ only)
export const getAllUsers = async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getDevelopers = async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "support_lead"];
    const userRole = req.user?.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    const developers = await User.find({ role: "developer" })
      .select("name email role")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      data: developers,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Users can view their own profile, admins can view any
    if (
      id !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Create user (super_admin only) - support leads cannot create users
export const createUser = async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Only super_admin can create users",
      });
    }

    const { name, email, role } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        status: "error",
        message: "Name and email are required",
      });
    }

    // Prevent non-super_admin from creating super_admin
    if (role === "super_admin" && userRole !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Cannot create super_admin account",
      });
    }

    // Prevent creating admin if user is not super_admin
    if (role === "admin" && userRole !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Only super_admin can create admin accounts",
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenHash = crypto
      .createHash("sha256")
      .update(setupToken)
      .digest("hex");
    const setupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const unusablePassword = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: unusablePassword,
      role: role || "user",
      mustChangePassword: true,
      setupPasswordTokenHash: setupTokenHash,
      setupPasswordExpiresAt: setupExpiresAt,
    });

    const setupUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/set-password?token=${setupToken}`;
    void sendMail({
      to: user.email,
      subject: "Set up your Contract Management Portal account",
      html: `<p>Hello ${user.name},</p><p>Your Contract Management Portal account has been created.</p><p><a href="${setupUrl}">Set your password</a></p><p>This link expires in 24 hours and can only be used once.</p>`,
    }).catch((error) => console.error("Unable to send account setup email:", error.message));

    // Log audit action
    await logAction({
      req,
      action: "USER_CREATED",
      resourceType: "User",
      resourceId: user._id,
      resourceName: user.name,
      metadata: {
        email: user.email,
        role: user.role,
      },
      severity: "high",
    });

    res.status(201).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Users can update their own profile (except role), admins can update any
    const isOwnProfile = id === req.user.id;
    const canEditOthers =
      req.user.role === "admin" || req.user.role === "super_admin";

    if (!isOwnProfile && !canEditOthers) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    // Prevent role escalation
    if (updates.role) {
      if (req.user.role !== "super_admin") {
        return res.status(403).json({
          status: "error",
          message: "Only super_admin can change roles",
        });
      }

      const targetUser = await User.findById(id);
      if (!targetUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      // Prevent demoting super_admin
      if (targetUser.role === "super_admin" && updates.role !== "super_admin") {
        return res.status(403).json({
          status: "error",
          message: "Cannot demote super_admin",
        });
      }
    }

    // Handle password update separately
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    // Remove password from updates if not being updated
    if (!updates.password) {
      delete updates.password;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Log audit action
    const severity = updates.role ? "critical" : "high"; // Role changes are critical
    await logAction({
      req,
      action: "USER_UPDATED",
      resourceType: "User",
      resourceId: user._id,
      resourceName: user.name,
      metadata: {
        changes: Object.keys(updates).filter((k) => k !== "password"), // Don't log password
        roleChanged: !!updates.role,
        oldRole: updates.role
          ? (await User.findById(id).select("role")).role
          : undefined,
        newRole: updates.role,
      },
      severity,
    });

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const changeOwnPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        status: "error",
        message: "New password must be between 8 and 128 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        status: "error",
        message: "New password must be different from your current password.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        status: "error",
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.setupPasswordTokenHash = null;
    user.setupPasswordExpiresAt = null;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password changed successfully.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Toggle user status (activate/deactivate)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    // Prevent deactivating self
    if (id === req.user.id) {
      return res.status(400).json({
        status: "error",
        message: "Cannot deactivate your own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Prevent deactivating super_admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Cannot deactivate super_admin account",
      });
    }

    const oldStatus = user.isActive;
    user.isActive = !user.isActive;
    await user.save();

    // Log audit action
    await logAction({
      req,
      action: "USER_STATUS_TOGGLED",
      resourceType: "User",
      resourceId: user._id,
      resourceName: user.name,
      metadata: {
        oldStatus: oldStatus ? "active" : "inactive",
        newStatus: user.isActive ? "active" : "inactive",
        email: user.email,
        role: user.role,
      },
      severity: "high",
    });

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Delete user (super_admin only)
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Only super_admin can delete users",
      });
    }

    const { id } = req.params;

    // Prevent deleting self
    if (id === req.user.id) {
      return res.status(400).json({
        status: "error",
        message: "Cannot delete your own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    await User.findByIdAndDelete(id);

    // Log audit action
    await logAction({
      req,
      action: "USER_DELETED",
      resourceType: "User",
      resourceId: user._id,
      resourceName: user.name,
      metadata: {
        email: user.email,
        role: user.role,
        wasActive: user.isActive,
      },
      severity: "critical",
    });

    res.status(200).json({
      status: "success",
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Upload profile picture
export const uploadProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;

    // Users can upload their own profile picture, admins can upload for any user
    const isOwnProfile = id === req.user.id;
    const canEditOthers =
      req.user.role === "admin" || req.user.role === "super_admin";

    if (!isOwnProfile && !canEditOthers) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Delete old profile picture if exists
    if (user.profilePictureCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
      } catch (error) {
        console.error("Error deleting old profile picture:", error);
        // Continue even if deletion fails
      }
    }

    // Update user with new profile picture
    user.profilePicture = req.file.secure_url;
    user.profilePictureCloudinaryId = req.file.public_id;
    await user.save();

    const updatedUser = await User.findById(id).select("-password").lean();

    res.status(200).json({
      status: "success",
      message: "Profile picture uploaded successfully",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
