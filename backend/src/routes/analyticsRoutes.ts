import { Router } from 'express';
import {
  getOverview,
  getCategoryAnalytics,
  getPriorityAnalytics,
  getHotspots,
  getTrends,
  getAiInsights
} from '../controllers/analyticsController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/overview', requireAuth, getOverview);
router.get('/categories', requireAuth, getCategoryAnalytics);
router.get('/priorities', requireAuth, getPriorityAnalytics);
router.get('/hotspots', requireAuth, getHotspots);
router.get('/trends', requireAuth, getTrends);
router.get('/insights', requireAuth, getAiInsights);
router.get('/ai-insights', requireAuth, getAiInsights);

export default router;
