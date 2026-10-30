import { Router } from 'express';
import {
  createComplaint,
  getComplaints,
  getMyComplaints,
  getComplaintById,
  getComplaintHistory,
  updateComplaintStatus,
  assignComplaint,
  updateComplaintPriority
} from '../controllers/complaintsController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { uploadSingleImage } from '../middleware/uploadMiddleware';

const router = Router();

// Citizen submission with optional image upload
router.post('/', requireAuth, uploadSingleImage, createComplaint);

// Complaint retrieval
router.get('/', requireAuth, getComplaints);
router.get('/my', requireAuth, getMyComplaints);
router.get('/:id', requireAuth, getComplaintById);
router.get('/:id/history', requireAuth, getComplaintHistory);

// Administrative & Department Officer updates
router.patch('/:id/status', requireAuth, requireRole(['Administrator', 'Department_Officer']), updateComplaintStatus);
router.patch('/:id/assign', requireAuth, requireRole(['Administrator', 'Department_Officer']), assignComplaint);
router.patch('/:id/priority', requireAuth, requireRole(['Administrator', 'Department_Officer']), updateComplaintPriority);

export default router;
