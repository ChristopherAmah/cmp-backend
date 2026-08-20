import express from 'express';
import { register, login, logout, getMe, completePasswordSetup } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { auditLogMiddleware } from '../middleware/auditLog.js';

const router = express.Router();

router.post(
  '/register',
  register,
  auditLogMiddleware({
    action: 'USER_REGISTERED',
    resourceType: 'Auth',
    severity: 'high',
    getResourceId: (req, res) =>
      res.locals.responseData?.data?._id || null,
    getResourceName: (req, res) =>
      res.locals.responseData?.data?.email || req.body.email,
  })
);

router.post(
  '/login',
  login,
  auditLogMiddleware({
    action: 'USER_LOGGED_IN',
    resourceType: 'Auth',
    severity: 'medium',
  })
);

router.post('/password-setup', completePasswordSetup);

router.post(
  '/logout',
  protect,
  logout,
  auditLogMiddleware({
    action: 'USER_LOGGED_OUT',
    resourceType: 'Auth',
    severity: 'low',
  })
);

router.get(
  '/me',
  protect,
  getMe,
  auditLogMiddleware({
    action: 'AUTH_ME_VIEWED',
    resourceType: 'Auth',
    severity: 'low',
  })
);

export default router;




