import { Response } from 'express';
import { dataAccess } from '../services/dataAccess';
import { aiService } from '../services/aiService';
import { AuthenticatedRequest } from '../types';

export const getOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const where: any = {};

    if (userRole === 'Citizen' && req.user) {
      where.userId = req.user.id;
    } else if (userRole === 'Department_Officer' && req.user?.departmentId) {
      where.assignedDepartmentId = req.user.departmentId;
    }

    const { totalComplaints, complaints, duplicateCount, insightCount } = await dataAccess.getOverviewStats(where);

    const statusCounts: Record<string, number> = {
      Submitted: 0,
      Under_Review: 0,
      In_Progress: 0,
      Resolved: 0,
      Rejected: 0
    };

    const priorityCounts: Record<string, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };

    const categoryCounts: Record<string, number> = {};

    let totalScore = 0;
    let resolvedCount = 0;
    let totalResolutionHours = 0;

    complaints.forEach((c: any) => {
      const st = String(c.status).replace(' ', '_');
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      if (priorityCounts[c.priority] !== undefined) priorityCounts[c.priority]++;
      if (c.category) categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;

      if (c.priorityScore) totalScore += Number(c.priorityScore);

      if (c.status === 'Resolved' && c.createdAt && c.updatedAt) {
        const diffHours = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
        if (diffHours > 0) {
          totalResolutionHours += diffHours;
          resolvedCount++;
        }
      }
    });

    const averagePriorityScore = totalComplaints > 0 ? parseFloat((totalScore / totalComplaints).toFixed(1)) : 0;
    const averageResolutionTimeHours = resolvedCount > 0 ? parseFloat((totalResolutionHours / resolvedCount).toFixed(1)) : null;

    res.status(200).json({
      success: true,
      stats: {
        totalComplaints,
        pendingReview: statusCounts.Submitted + statusCounts.Under_Review,
        inProgress: statusCounts.In_Progress,
        resolved: statusCounts.Resolved,
        rejected: statusCounts.Rejected,
        criticalUrgent: priorityCounts.Critical,
        averagePriorityScore,
        averageResolutionTimeHours,
        statusCounts: {
          'Submitted': statusCounts.Submitted,
          'Under Review': statusCounts.Under_Review,
          'In Progress': statusCounts.In_Progress,
          'Resolved': statusCounts.Resolved,
          'Rejected': statusCounts.Rejected
        },
        priorityCounts,
        categoryCounts,
        duplicatePairsDetected: duplicateCount,
        activeAiInsightsCount: insightCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCategoryAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { complaints } = await dataAccess.getComplaints({}, 0, 1000);
    const catMap: Record<string, number> = {};
    complaints.forEach((c: any) => {
      if (c.category) catMap[c.category] = (catMap[c.category] || 0) + 1;
    });

    const categories = Object.entries(catMap).map(([category, count]) => ({ category, count }));

    res.status(200).json({
      success: true,
      categories
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getPriorityAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { complaints } = await dataAccess.getComplaints({}, 0, 1000);
    const priMap: Record<string, { count: number; totalScore: number }> = {
      Critical: { count: 0, totalScore: 0 },
      High: { count: 0, totalScore: 0 },
      Medium: { count: 0, totalScore: 0 },
      Low: { count: 0, totalScore: 0 }
    };

    complaints.forEach((c: any) => {
      if (priMap[c.priority]) {
        priMap[c.priority].count++;
        priMap[c.priority].totalScore += Number(c.priorityScore || 50);
      }
    });

    const priorities = Object.entries(priMap).map(([priority, val]) => ({
      priority,
      count: val.count,
      averageScore: val.count > 0 ? parseFloat((val.totalScore / val.count).toFixed(1)) : 0
    }));

    res.status(200).json({
      success: true,
      priorities
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getHotspots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const geocodedComplaints = await dataAccess.getGeocodedComplaints();

    if (geocodedComplaints.length < 2) {
      res.status(200).json({
        success: true,
        hotspots: [],
        message: 'No active spatial clusters detected (minimum 2 geocoded complaints required).'
      });
      return;
    }

    const clusterResult = await aiService.clusterHotspots(
      geocodedComplaints.map((c: any) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        latitude: parseFloat(String(c.latitude)),
        longitude: parseFloat(String(c.longitude)),
        priority: c.priority,
        created_at: typeof c.createdAt === 'string' ? c.createdAt : (c.createdAt ? c.createdAt.toISOString() : new Date().toISOString())
      }))
    );

    res.status(200).json({
      success: true,
      total: clusterResult.total_hotspots,
      hotspots: clusterResult.hotspots
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTrends = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { complaints } = await dataAccess.getComplaints({}, 0, 1000);
    const trendMap: Record<string, number> = {};

    complaints.forEach((c: any) => {
      const dateStr = typeof c.createdAt === 'string' ? c.createdAt : c.createdAt?.toISOString();
      if (dateStr) {
        const dateKey = dateStr.slice(0, 10);
        trendMap[dateKey] = (trendMap[dateKey] || 0) + 1;
      }
    });

    const trends = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    res.status(200).json({
      success: true,
      trends
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getAiInsights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const insights = await dataAccess.getInsights();
    res.status(200).json({
      success: true,
      insights
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
