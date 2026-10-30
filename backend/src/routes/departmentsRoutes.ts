import { Router } from 'express';
import { listDepartments, createDepartment } from '../controllers/departmentsController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.get('/', listDepartments);
router.post('/', requireAuth, requireRole(['Administrator']), createDepartment);

export default router;
