import express from 'express';
import jwt from 'jsonwebtoken';
import { getUsers, createUser, deleteUser } from '../controllers/userController.js';

const router = express.Router();

// Inline Auth Verification
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'You are not logged in (Token is missing)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token is invalid or has expired' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this' });
    }
    next();
  };
};

router.get('/', verifyToken, requireRole(['ADMIN']), getUsers);
router.post('/', verifyToken, requireRole(['ADMIN']), createUser);
router.delete('/:id', verifyToken, requireRole(['ADMIN']), deleteUser);

export default router;