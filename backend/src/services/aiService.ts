import axios from 'axios';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

const AI_BASE = ENV.PYTHON_AI_SERVICE_URL;

export interface AICategorizeResult {
  predicted_category: string;
  confidence_score: number;
  explanation: string;
}

export interface AISummarizeResult {
  summary: string;
  original_length: number;
  summary_length: number;
}

export interface AIPriorityResult {
  priority_score: number;
  priority_level: 'Low' | 'Medium' | 'High' | 'Critical';
  contributing_factors: Array<{ factor_name: string; points: number; rationale: string }>;
  explanation: string;
}

export interface AIDuplicateMatch {
  possible_duplicate_id: string;
  similarity_score: number;
  duplicate_confidence: string;
  explanation: string;
}

export interface AIDuplicateResult {
  is_duplicate: boolean;
  possible_duplicates: AIDuplicateMatch[];
}

export interface AIHotspotCluster {
  cluster_id: string;
  title: string;
  description: string;
  location: string;
  center_latitude: number;
  center_longitude: number;
  complaint_count: number;
  most_common_category: string;
  severity: string;
  average_priority: string;
  related_complaint_ids: string[];
}

export interface AIClusterResult {
  total_hotspots: number;
  hotspots: AIHotspotCluster[];
}

export interface AIActionBriefResult {
  recommended_department: string;
  target_sla_hours: number;
  immediate_containment: string;
  recommended_equipment: string[];
  suggested_action_brief: string;
}

export const aiService = {
  categorize: async (title: string, description: string, userCategory?: string): Promise<AICategorizeResult> => {
    try {
      const res = await axios.post(`${AI_BASE}/ai/categorize`, {
        title,
        description,
        user_category: userCategory
      }, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/categorize error (${err.message}). Using local fallback categorization.`);
      return {
        predicted_category: userCategory || 'Road Damage',
        confidence_score: 0.60,
        explanation: 'Assigned via local heuristic fallback.'
      };
    }
  },

  summarize: async (title: string, description: string, address?: string): Promise<AISummarizeResult> => {
    try {
      const res = await axios.post(`${AI_BASE}/ai/summarize`, {
        title,
        description,
        address
      }, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/summarize error (${err.message}). Using local fallback summarization.`);
      const summaryText = `${title}${address ? ` at ${address}` : ''}: ${description.substring(0, 120)}...`;
      return {
        summary: summaryText,
        original_length: description.length,
        summary_length: summaryText.length
      };
    }
  },

  computePriority: async (
    title: string,
    description: string,
    category: string,
    address?: string,
    reportedCount: number = 1
  ): Promise<AIPriorityResult> => {
    try {
      const res = await axios.post(`${AI_BASE}/ai/priority`, {
        title,
        description,
        category,
        address,
        reported_count: reportedCount
      }, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/priority error (${err.message}). Using local fallback scoring.`);
      return {
        priority_score: 50.0,
        priority_level: 'Medium',
        contributing_factors: [
          { factor_name: 'Baseline Weight', points: 50, rationale: 'Local heuristic fallback' }
        ],
        explanation: 'Medium Priority (Score: 50/100) via local intake baseline.'
      };
    }
  },

  detectDuplicates: async (
    currentComplaint: { id: string; title: string; description: string; category?: string; latitude?: number | null; longitude?: number | null },
    existingComplaints: Array<{ id: string; title: string; description: string; category?: string; latitude?: number | null; longitude?: number | null }>
  ): Promise<AIDuplicateResult> => {
    if (!existingComplaints.length) {
      return { is_duplicate: false, possible_duplicates: [] };
    }
    try {
      const res = await axios.post(`${AI_BASE}/ai/detect-duplicates`, {
        current_complaint: currentComplaint,
        existing_complaints: existingComplaints,
        similarity_threshold: 0.45,
        geo_proximity_km: 1.0
      }, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/detect-duplicates error (${err.message}).`);
      return { is_duplicate: false, possible_duplicates: [] };
    }
  },

  clusterHotspots: async (
    complaints: Array<{ id: string; title: string; category: string; latitude: number; longitude: number; priority?: string; created_at?: string }>
  ): Promise<AIClusterResult> => {
    if (complaints.length < 2) {
      return { total_hotspots: 0, hotspots: [] };
    }
    try {
      const res = await axios.post(`${AI_BASE}/ai/cluster`, {
        complaints,
        eps_km: 0.8,
        min_samples: 2
      }, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/cluster error (${err.message}).`);
      return { total_hotspots: 0, hotspots: [] };
    }
  },

  generateActionBrief: async (
    category: string,
    priorityLevel: string,
    complaintCount: number = 1,
    location?: string
  ): Promise<AIActionBriefResult> => {
    try {
      const res = await axios.post(`${AI_BASE}/ai/action-brief`, {
        category,
        priority_level: priorityLevel,
        complaint_count: complaintCount,
        location
      }, { timeout: 8000 });
      return res.data;
    } catch (err: any) {
      logger.warn(`Python AI /ai/action-brief error (${err.message}).`);
      return {
        recommended_department: category,
        target_sla_hours: 48,
        immediate_containment: 'Route to standard department queue for on-site inspection.',
        recommended_equipment: ['Standard Inspection Kit'],
        suggested_action_brief: `Recommendation: Dispatch field crew to inspect ${category} problem.`
      };
    }
  }
};
