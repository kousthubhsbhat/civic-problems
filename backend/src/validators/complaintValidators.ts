import { z } from 'zod';

export const createComplaintSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters long').max(200),
  description: z.string().min(5, 'Description must be at least 5 characters long'),
  category: z.string().min(2, 'Category is required'),
  address: z.string().min(3, 'Address is required'),
  latitude: z.union([z.number(), z.string()]).optional().transform((v) => v ? parseFloat(String(v)) : undefined),
  longitude: z.union([z.number(), z.string()]).optional().transform((v) => v ? parseFloat(String(v)) : undefined)
});

export const updateStatusSchema = z.object({
  status: z.enum(['Submitted', 'Under_Review', 'In_Progress', 'Resolved', 'Rejected']),
  remarks: z.string().min(1, 'Official remarks explaining this status transition are required')
});

export const assignDepartmentSchema = z.object({
  assignedDepartmentId: z.string().uuid('Valid department UUID required'),
  remarks: z.string().optional()
});

export const updatePrioritySchema = z.object({
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  remarks: z.string().optional()
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AssignDepartmentInput = z.infer<typeof assignDepartmentSchema>;
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
