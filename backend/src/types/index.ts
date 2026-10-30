import { Request } from 'express';

export type UserRole = 'Citizen' | 'Administrator' | 'Department_Officer';

export type ComplaintStatusType = 
  | 'Submitted' 
  | 'Under_Review' 
  | 'In_Progress' 
  | 'Resolved' 
  | 'Rejected';

export type ComplaintPriorityType = 
  | 'Low' 
  | 'Medium' 
  | 'High' 
  | 'Critical';

export interface TokenUserPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenUserPayload;
  token?: string;
  file?: Express.Multer.File;
}
