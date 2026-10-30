import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { aiService } from '../services/aiService';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * POST /api/ai/generate-insights
 * Runs DBSCAN geographic clustering on active complaints and persists generated insights
 */
router.post('/generate-insights', requireAuth, requireRole(['Administrator', 'Department_Officer']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const complaints = await prisma.complaint.findMany({
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

    if (complaints.length < 2) {
      res.status(200).json({
        success: true,
        message: 'Insufficient geocoded complaints to generate clusters (minimum 2 required).',
        total_clusters: 0,
        generated_insights: []
      });
      return;
    }

    const clusterResult = await aiService.clusterHotspots(
      complaints.map(c => ({
        id: c.id,
        title: c.title,
        category: c.category,
        latitude: c.latitude as number,
        longitude: c.longitude as number,
        priority: c.priority,
        created_at: c.createdAt.toISOString()
      }))
    );

    if (!clusterResult.hotspots || clusterResult.hotspots.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No spatial hotspots detected at current threshold.',
        total_clusters: 0,
        generated_insights: []
      });
      return;
    }

    const createdInsights = [];
    for (const h of clusterResult.hotspots) {
      const insight = await prisma.aIInsight.create({
        data: {
          insightType: 'Hotspot',
          title: h.title,
          description: h.description,
          location: h.location,
          severity: h.severity,
          relatedComplaintIds: h.related_complaint_ids
        }
      });
      createdInsights.push(insight);
    }

    res.status(200).json({
      success: true,
      total_clusters: clusterResult.total_hotspots,
      insights: createdInsights
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
