import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies
    if (req.cookies.token) {
      token = req.cookies.token;
    }
    // Check for token in Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'User no longer exists',
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User account is inactive',
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};




