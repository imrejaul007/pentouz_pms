// Role middleware stub
const roleMiddleware = (roles = []) => {
  return (req, res, next) => {
    // Add role checking logic if needed
    next();
  };
};

export default roleMiddleware;
