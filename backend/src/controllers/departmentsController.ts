import { Request, Response } from 'express';
import { dataAccess } from '../services/dataAccess';
import { AuthenticatedRequest } from '../types';

export const listDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await dataAccess.getDepartments();

    res.status(200).json({
      success: true,
      departments
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { departmentName, description } = req.body;

    if (!departmentName || !String(departmentName).trim()) {
      res.status(400).json({ success: false, error: 'Department name is required.' });
      return;
    }

    const dept = await dataAccess.createDepartment({
      departmentName: String(departmentName).trim(),
      description: description ? String(description).trim() : null
    });

    res.status(201).json({
      success: true,
      department: dept
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
