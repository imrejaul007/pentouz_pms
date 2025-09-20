/**
 * Async handler middleware to wrap async/await functions and catch errors
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
