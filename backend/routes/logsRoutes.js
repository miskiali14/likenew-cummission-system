import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAdminStats,
  getAllLogs,
  getWashingLogs,
  getIroningLogs,
  createLog,
  updateLogDuration,
  deleteLog,
  getStaffSummary,
  getMyLogs
} from '../controllers/logsController.js';

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

// ==================== PERSONAL LOGS (FOR STAFF) ====================
router.get('/my-logs', verifyToken, getMyLogs);


// ==================== ADMIN & REPORTS ROUTES ====================

// Stats Cards (ADMIN only)
router.get('/stats', verifyToken, requireRole(['ADMIN']), getAdminStats);

// 1. All Logs, filterable (ADMIN only)
router.get('/all', verifyToken, requireRole(['ADMIN']), getAllLogs);

// 2. Staff Summary Report (Admin, Sales, iyo QC)
router.get('/staff-summary', verifyToken, requireRole(['ADMIN', 'SALES', 'QUALITY_CONTROL']), getStaffSummary);


// ==================== STAFF ROUTES ====================

// Sales and Admin can view Washing
router.get('/washing', verifyToken, requireRole(['ADMIN', 'SALES']), getWashingLogs);

// QC and Admin can view Ironing
router.get('/ironing', verifyToken, requireRole(['ADMIN', 'QUALITY_CONTROL']), getIroningLogs);


// ==================== ACTIONS ====================

// Register a new log
router.post('/', verifyToken, requireRole(['ADMIN', 'SALES', 'QUALITY_CONTROL']), createLog);

// Update Duration only (uses ID, placed below so it doesn't shadow the other routes)
router.patch('/:id', verifyToken, requireRole(['ADMIN', 'SALES', 'QUALITY_CONTROL']), updateLogDuration);

// Tirtirida Log qalad ah — Admin oo kaliya
router.delete('/:id', verifyToken, requireRole(['ADMIN']), deleteLog);

export default router;