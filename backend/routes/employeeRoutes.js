import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../controllers/employeeController.js';

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
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this' });
    }
    next();
  };
};

// All roles can view employees (branch-scoped for non-admin, enforced in controller)
router.get('/', verifyToken, requireRole(['ADMIN', 'SALES', 'QUALITY_CONTROL']), getEmployees);

// Only Admin can manage employees
router.post('/', verifyToken, requireRole(['ADMIN']), createEmployee);
router.patch('/:id', verifyToken, requireRole(['ADMIN']), updateEmployee);
router.delete('/:id', verifyToken, requireRole(['ADMIN']), deleteEmployee);

export default router;
