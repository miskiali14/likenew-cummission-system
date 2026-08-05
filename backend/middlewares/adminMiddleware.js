export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    return res.status(403).json({
      message: 'Forbidden: this page or action is restricted to Admins only!'
    });
  }
};