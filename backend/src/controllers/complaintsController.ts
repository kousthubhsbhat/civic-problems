import { Response } from 'express';
import crypto from 'crypto';
import { dataAccess } from '../services/dataAccess';
import { aiService } from '../services/aiService';
import { resolveImageUrl } from '../services/storageService';
import {
  createComplaintSchema,
  updateStatusSchema,
  assignDepartmentSchema,
  updatePrioritySchema
} from '../validators/complaintValidators';
import { AuthenticatedRequest } from '../types';

export const createComplaint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const validated = createComplaintSchema.parse(req.body);
    const imageUrl = resolveImageUrl(req.file);

    // 1. Generate unique complaint number: CIV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    const complaintNumber = `CIV-${dateStr}-${randStr}`;

    // 2. Trigger Python AI Service processing
    const [catResult, sumResult] = await Promise.all([
      aiService.categorize(validated.title, validated.description, validated.category),
      aiService.summarize(validated.title, validated.description, validated.address)
    ]);

    const priResult = await aiService.computePriority(
      validated.title,
      validated.description,
      catResult.predicted_category,
      validated.address
    );

    // 3. Resolve department matching the category
    let assignedDeptId: string | null = null;
    const departments = await dataAccess.getDepartments();
    const matchedDept = departments.find((d: any) =>
      d.departmentName.toLowerCase().includes(catResult.predicted_category.split(' ')[0].toLowerCase())
    );
    if (matchedDept) {
      assignedDeptId = matchedDept.id;
    }

    // 4. Save complaint in database via dataAccess layer
    const newComplaint = await dataAccess.createComplaint({
      complaintNumber,
      userId: req.user.id,
      title: validated.title.trim(),
      description: validated.description.trim(),
      category: validated.category,
      imageUrl,
      address: validated.address.trim(),
      latitude: validated.latitude ?? null,
      longitude: validated.longitude ?? null,
      aiCategory: catResult.predicted_category,
      aiSummary: sumResult.summary,
      priority: priResult.priority_level as any,
      priorityScore: priResult.priority_score,
      priorityExplanation: priResult.explanation,
      status: 'Submitted',
      assignedDepartmentId: assignedDeptId
    });

    // 5. Record initial history log
    await dataAccess.createHistory({
      complaintId: newComplaint.id,
      previousStatus: null,
      newStatus: 'Submitted',
      remarks: 'Complaint registered by citizen. Initial AI categorization and triage completed.',
      updatedBy: req.user.id
    });

    // 6. Run duplicate detection against existing complaints
    try {
      const recentComplaints = await dataAccess.getRecentComplaintsForDuplicates(newComplaint.id);

      if (recentComplaints.length > 0) {
        const dupResult = await aiService.detectDuplicates(newComplaint, recentComplaints);
        if (dupResult.is_duplicate && dupResult.possible_duplicates.length > 0) {
          for (const match of dupResult.possible_duplicates) {
            await dataAccess.createDuplicate({
              originalComplaintId: match.possible_duplicate_id,
              duplicateComplaintId: newComplaint.id,
              similarityScore: match.similarity_score,
              explanation: match.explanation
            });
          }
        }
      }
    } catch (dupErr: any) {
      console.warn('Duplicate detection check error:', dupErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Complaint created and triaged successfully.',
      complaint: {
        ...newComplaint,
        image_url: newComplaint.imageUrl, // compatibility alias
        departments: matchedDept
      },
      ai: {
        categorization: catResult,
        summarization: sumResult,
        priority: priResult
      }
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getComplaints = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { page = '1', limit = '20', category, priority, status, search, departmentId } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Role-based filtering
    if (req.user.role === 'Citizen') {
      where.userId = req.user.id;
    } else if (req.user.role === 'Department_Officer' && req.user.departmentId) {
      where.assignedDepartmentId = req.user.departmentId;
    }

    // Query Filters
    if (category) where.category = String(category);
    if (priority) where.priority = String(priority);
    if (status) where.status = String(status);
    if (departmentId) where.assignedDepartmentId = String(departmentId);

    const { total, complaints } = await dataAccess.getComplaints(where, skip, limitNum);

    // Map compatibility fields (image_url, departments)
    const formatted = complaints.map((c: any) => ({
      ...c,
      image_url: c.imageUrl || c.image_url,
      departments: c.department || null
    }));

    res.status(200).json({
      success: true,
      complaints: formatted,
      data: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getMyComplaints = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const complaints = await dataAccess.getMyComplaints(req.user.id);
    const formatted = complaints.map((c: any) => ({
      ...c,
      image_url: c.imageUrl || c.image_url,
      departments: c.department || null
    }));

    res.status(200).json({
      success: true,
      complaints: formatted
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getComplaintById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;

    const complaint = await dataAccess.findComplaintById(id);

    if (!complaint) {
      res.status(404).json({ success: false, error: 'Complaint not found.' });
      return;
    }

    if (req.user.role === 'Citizen' && complaint.userId !== req.user.id) {
      res.status(403).json({ success: false, error: 'Forbidden: You cannot access this complaint.' });
      return;
    }

    res.status(200).json({
      success: true,
      complaint: {
        ...complaint,
        image_url: complaint.imageUrl || complaint.image_url,
        departments: complaint.department || null
      },
      history: complaint.history || [],
      duplicates: complaint.originalDuplicates || []
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getComplaintHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const history = await dataAccess.getHistory(id);

    res.status(200).json({
      success: true,
      history
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateComplaintStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;
    const validated = updateStatusSchema.parse(req.body);

    const current = await dataAccess.findComplaintById(id);
    if (!current) {
      res.status(404).json({ success: false, error: 'Complaint not found.' });
      return;
    }

    if (req.user.role === 'Department_Officer' && req.user.departmentId) {
      if (current.assignedDepartmentId && current.assignedDepartmentId !== req.user.departmentId) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: You can only update complaints assigned to your department.'
        });
        return;
      }
    }

    const updated = await dataAccess.updateComplaint(id, { status: validated.status });

    await dataAccess.createHistory({
      complaintId: id,
      previousStatus: current.status,
      newStatus: validated.status,
      remarks: validated.remarks,
      updatedBy: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Status updated successfully.',
      complaint: updated
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const assignComplaint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;
    const validated = assignDepartmentSchema.parse(req.body);

    const current = await dataAccess.findComplaintById(id);
    if (!current) {
      res.status(404).json({ success: false, error: 'Complaint not found.' });
      return;
    }

    const updated = await dataAccess.updateComplaint(id, { assignedDepartmentId: validated.assignedDepartmentId });

    await dataAccess.createHistory({
      complaintId: id,
      previousStatus: current.status,
      newStatus: current.status,
      remarks: validated.remarks || `Assigned to department: ${validated.assignedDepartmentId}`,
      updatedBy: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Department assigned successfully.',
      complaint: updated
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateComplaintPriority = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;
    const validated = updatePrioritySchema.parse(req.body);

    const current = await dataAccess.findComplaintById(id);
    if (!current) {
      res.status(404).json({ success: false, error: 'Complaint not found.' });
      return;
    }

    const updated = await dataAccess.updateComplaint(id, { priority: validated.priority });

    await dataAccess.createHistory({
      complaintId: id,
      previousStatus: current.status,
      newStatus: current.status,
      remarks: validated.remarks || `Priority adjusted from ${current.priority} to ${validated.priority}`,
      updatedBy: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Priority updated successfully.',
      complaint: updated
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
};
