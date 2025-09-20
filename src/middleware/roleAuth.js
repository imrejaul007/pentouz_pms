// Role auth middleware stub
export const requireRole = (role) => {
  return (req, res, next) => {
    // Add role authorization logic if needed
    next();
  };
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    // Add permission checking logic if needed
    next();
  };
};

export default {
  requireRole,
  requirePermission
};
