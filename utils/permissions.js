// Permission constants
export const PERMISSIONS = {
  CONTRACTS: {
    VIEW: 'contracts:view',
    CREATE: 'contracts:create',
    UPDATE: 'contracts:update',
    DELETE: 'contracts:delete',
    ARCHIVE: 'contracts:archive',
  },
  PAYMENTS: {
    VIEW: 'payments:view',
    CREATE: 'payments:create',
    UPDATE: 'payments:update',
    DELETE: 'payments:delete',
  },
  DOCUMENTS: {
    VIEW: 'documents:view',
    UPLOAD: 'documents:upload',
    DELETE: 'documents:delete',
    DOWNLOAD: 'documents:download',
  },
  ORGANIZATIONS: {
    VIEW: 'organizations:view',
    CREATE: 'organizations:create',
    UPDATE: 'organizations:update',
    DELETE: 'organizations:delete',
  },
  USERS: {
    VIEW: 'users:view',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
    TOGGLE_STATUS: 'users:toggle_status',
  },
  PROFILE: {
    VIEW: 'profile:view',
    UPDATE: 'profile:update',
    UPLOAD_PICTURE: 'profile:upload_picture',
  },
  SYSTEM: {
    VIEW_LOGS: 'system:view_logs',
    MANAGE_SETTINGS: 'system:manage_settings',
  },
};

// Role hierarchy
export const ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  support_lead: 2,
  developer: 1,
  user: 1,
};

// Role permissions mapping
export const ROLE_PERMISSIONS = {
  super_admin: ['*'], // All permissions (includes SYSTEM.VIEW_LOGS)
  admin: [
    PERMISSIONS.SYSTEM.VIEW_LOGS,
    PERMISSIONS.CONTRACTS.VIEW,
    PERMISSIONS.CONTRACTS.CREATE,
    PERMISSIONS.CONTRACTS.UPDATE,
    PERMISSIONS.CONTRACTS.ARCHIVE,
    PERMISSIONS.PAYMENTS.VIEW,
    PERMISSIONS.PAYMENTS.CREATE,
    PERMISSIONS.PAYMENTS.UPDATE,
    PERMISSIONS.DOCUMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.UPLOAD,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,
    PERMISSIONS.ORGANIZATIONS.VIEW,
    PERMISSIONS.ORGANIZATIONS.CREATE,
    PERMISSIONS.ORGANIZATIONS.UPDATE,
    PERMISSIONS.USERS.VIEW,
    PERMISSIONS.USERS.UPDATE,
    PERMISSIONS.PROFILE.VIEW,
    PERMISSIONS.PROFILE.UPDATE,
    PERMISSIONS.PROFILE.UPLOAD_PICTURE,
  ],
  support_lead: [
    PERMISSIONS.CONTRACTS.VIEW,
    PERMISSIONS.CONTRACTS.CREATE,
    PERMISSIONS.CONTRACTS.UPDATE,
    PERMISSIONS.CONTRACTS.ARCHIVE,
    PERMISSIONS.PAYMENTS.VIEW,
    PERMISSIONS.PAYMENTS.CREATE,
    PERMISSIONS.PAYMENTS.UPDATE,
    PERMISSIONS.DOCUMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.UPLOAD,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,
    PERMISSIONS.ORGANIZATIONS.VIEW,
    PERMISSIONS.ORGANIZATIONS.CREATE,
    PERMISSIONS.ORGANIZATIONS.UPDATE,
    PERMISSIONS.PROFILE.VIEW,
    PERMISSIONS.PROFILE.UPDATE,
    PERMISSIONS.PROFILE.UPLOAD_PICTURE,
  ],
  developer: [
    PERMISSIONS.CONTRACTS.VIEW,
    PERMISSIONS.PAYMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,
    PERMISSIONS.ORGANIZATIONS.VIEW,
    PERMISSIONS.PROFILE.VIEW,
    PERMISSIONS.PROFILE.UPDATE,
    PERMISSIONS.PROFILE.UPLOAD_PICTURE,
  ],
  user: [
    PERMISSIONS.CONTRACTS.VIEW,
    PERMISSIONS.PAYMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.VIEW,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,
    PERMISSIONS.ORGANIZATIONS.VIEW,
    PERMISSIONS.PROFILE.VIEW,
    PERMISSIONS.PROFILE.UPDATE,
    PERMISSIONS.PROFILE.UPLOAD_PICTURE,
  ],
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role, permission) => {
  if (!role || !permission) return false;
  
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  // Super admin has all permissions
  if (permissions.includes('*')) return true;
  
  return permissions.includes(permission);
};

/**
 * Check if user role meets minimum required level
 */
export const hasMinimumRole = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles || requiredRoles.length === 0) return false;
  
  // If roles array includes the user's role, allow access
  if (requiredRoles.includes(userRole)) return true;
  
  // Otherwise check hierarchy - user must have equal or higher level
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = Math.max(
    ...requiredRoles.map(r => ROLE_HIERARCHY[r] || 0)
  );
  
  return userLevel >= requiredLevel;
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

