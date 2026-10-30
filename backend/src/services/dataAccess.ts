import crypto from 'crypto';
import { prisma } from '../config/database';
import { dbStore } from './dbStore';
import { logger } from '../utils/logger';

export const dataAccess = {
  findUserByEmail: async (email: string) => {
    try {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { department: true }
      });
    } catch (err: any) {
      logger.warn(`Prisma unavailable (${err.message}). Using persistent local store.`);
      return dbStore.findUserByEmail(email);
    }
  },

  findUserById: async (id: string) => {
    try {
      return await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, departmentId: true, createdAt: true, department: true }
      });
    } catch (err: any) {
      return dbStore.findUserById(id);
    }
  },

  createUser: async (data: { name: string; email: string; passwordHash: string; role: any; departmentId?: string | null }) => {
    try {
      return await prisma.user.create({
        data,
        select: { id: true, name: true, email: true, role: true, departmentId: true, createdAt: true }
      });
    } catch (err: any) {
      logger.warn(`Prisma unavailable (${err.message}). Persisting user to local store.`);
      const newUser = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        departmentId: data.departmentId || null,
        createdAt: new Date().toISOString()
      };
      dbStore.createUser(newUser);
      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        departmentId: newUser.departmentId,
        createdAt: newUser.createdAt
      };
    }
  },

  createComplaint: async (data: any) => {
    try {
      return await prisma.complaint.create({
        data,
        include: {
          department: true,
          user: { select: { id: true, name: true, email: true } }
        }
      });
    } catch (err: any) {
      logger.warn(`Prisma unavailable (${err.message}). Persisting complaint to local store.`);
      const newC = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      dbStore.createComplaint(newC);
      return newC;
    }
  },

  getComplaints: async (where: any, skip: number, take: number) => {
    try {
      const [total, complaints] = await Promise.all([
        prisma.complaint.count({ where }),
        prisma.complaint.findMany({
          where,
          include: {
            department: true,
            user: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        })
      ]);
      return { total, complaints };
    } catch (err: any) {
      let all = dbStore.getComplaints();
      if (where.userId) all = all.filter(c => c.userId === where.userId);
      if (where.category) all = all.filter(c => c.category === where.category);
      if (where.priority) all = all.filter(c => c.priority === where.priority);
      if (where.status) all = all.filter(c => c.status === where.status);
      if (where.assignedDepartmentId) all = all.filter(c => c.assignedDepartmentId === where.assignedDepartmentId);

      const total = all.length;
      const sliced = all.slice(skip, skip + take);
      return { total, complaints: sliced };
    }
  },

  getMyComplaints: async (userId: string) => {
    try {
      return await prisma.complaint.findMany({
        where: { userId },
        include: { department: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (err: any) {
      return dbStore.getComplaints(c => c.userId === userId);
    }
  },

  findComplaintById: async (id: string) => {
    try {
      return await prisma.complaint.findUnique({
        where: { id },
        include: {
          department: true,
          user: { select: { id: true, name: true, email: true } },
          history: {
            include: { user: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: 'asc' }
          },
          originalDuplicates: { include: { duplicateComplaint: true } },
          secondaryDuplicates: { include: { originalComplaint: true } }
        }
      });
    } catch (err: any) {
      const complaint = dbStore.findComplaintById(id);
      if (!complaint) return null;
      const history = dbStore.getHistory(id);
      const duplicates = dbStore.getDuplicates(id);
      return {
        ...complaint,
        history,
        originalDuplicates: duplicates
      };
    }
  },

  updateComplaint: async (id: string, data: any) => {
    try {
      return await prisma.complaint.update({
        where: { id },
        data,
        include: { department: true }
      });
    } catch (err: any) {
      return dbStore.updateComplaint(id, data);
    }
  },

  createHistory: async (data: any) => {
    try {
      return await prisma.complaintHistory.create({ data });
    } catch (err: any) {
      const h = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      return dbStore.createHistory(h);
    }
  },

  getHistory: async (complaintId: string) => {
    try {
      return await prisma.complaintHistory.findMany({
        where: { complaintId },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      });
    } catch (err: any) {
      return dbStore.getHistory(complaintId);
    }
  },

  createDuplicate: async (data: any) => {
    try {
      return await prisma.complaintDuplicate.create({ data });
    } catch (err: any) {
      const d = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      return dbStore.createDuplicate(d);
    }
  },

  getDepartments: async () => {
    try {
      return await prisma.department.findMany({ orderBy: { departmentName: 'asc' } });
    } catch (err: any) {
      return dbStore.getDepartments();
    }
  },

  createDepartment: async (data: any) => {
    try {
      return await prisma.department.create({ data });
    } catch (err: any) {
      const dept = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      return dbStore.createDepartment(dept);
    }
  },

  getInsights: async () => {
    try {
      return await prisma.aIInsight.findMany({ orderBy: { createdAt: 'desc' } });
    } catch (err: any) {
      return dbStore.getInsights();
    }
  },

  createInsight: async (data: any) => {
    try {
      return await prisma.aIInsight.create({ data });
    } catch (err: any) {
      const ins = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      return dbStore.createInsight(ins);
    }
  },

  getRecentComplaintsForDuplicates: async (currentId: string) => {
    try {
      return await prisma.complaint.findMany({
        where: { id: { not: currentId } },
        select: { id: true, title: true, description: true, category: true, latitude: true, longitude: true },
        orderBy: { createdAt: 'desc' },
        take: 40
      });
    } catch (err: any) {
      return dbStore.getComplaints(c => c.id !== currentId).slice(0, 40);
    }
  },

  getGeocodedComplaints: async () => {
    try {
      return await prisma.complaint.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          status: { notIn: ['Resolved', 'Rejected'] }
        },
        select: {
          id: true,
          title: true,
          category: true,
          latitude: true,
          longitude: true,
          priority: true,
          createdAt: true
        }
      });
    } catch (err: any) {
      return dbStore.getComplaints(c => c.latitude != null && c.longitude != null && c.status !== 'Resolved' && c.status !== 'Rejected');
    }
  },

  getOverviewStats: async (where: any) => {
    try {
      const [totalComplaints, complaints, duplicateCount, insightCount] = await Promise.all([
        prisma.complaint.count({ where }),
        prisma.complaint.findMany({
          where,
          select: { status: true, priority: true, priorityScore: true, category: true, createdAt: true, updatedAt: true }
        }),
        prisma.complaintDuplicate.count(),
        prisma.aIInsight.count()
      ]);
      return { totalComplaints, complaints, duplicateCount, insightCount };
    } catch (err: any) {
      let complaints = dbStore.getComplaints();
      if (where.userId) complaints = complaints.filter(c => c.userId === where.userId);
      return {
        totalComplaints: complaints.length,
        complaints,
        duplicateCount: 0,
        insightCount: dbStore.getInsights().length
      };
    }
  }
};
