import request from 'supertest';
import app from '../src/app';
import { hashPassword, comparePassword } from '../src/utils/password';
import { signToken, verifyToken } from '../src/utils/jwt';
import { registerSchema, loginSchema } from '../src/validators/authValidators';
import { createComplaintSchema } from '../src/validators/complaintValidators';
import { aiService } from '../src/services/aiService';

describe('Smart Civic Backend Test Suite', () => {
  describe('Password Security & Hashing', () => {
    it('hashes passwords securely using bcrypt', async () => {
      const raw = 'SuperSecret123!';
      const hashed = await hashPassword(raw);
      expect(hashed).not.toBe(raw);
      expect(hashed).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix

      const isMatch = await comparePassword(raw, hashed);
      expect(isMatch).toBe(true);

      const isWrong = await comparePassword('WrongPassword', hashed);
      expect(isWrong).toBe(false);
    });
  });

  describe('JWT Token Lifecycle', () => {
    it('signs and verifies JWT authentication tokens with user payload', () => {
      const payload = {
        id: 'user-uuid-1234',
        email: 'citizen@civicpulse.org',
        name: 'Jane Citizen',
        role: 'Citizen' as const,
        departmentId: null
      };

      const token = signToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe('Citizen');
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates user registration input and enforces email & password rules', () => {
      const valid = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'Citizen'
      };
      expect(() => registerSchema.parse(valid)).not.toThrow();

      // Invalid email
      expect(() => registerSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();

      // Short password (<6 chars)
      expect(() => registerSchema.parse({ ...valid, password: '123' })).toThrow();
    });

    it('validates complaint creation inputs', () => {
      const validComplaint = {
        title: 'Deep pothole on 4th cross',
        description: 'Road surface is heavily broken and damaging scooters.',
        category: 'Road Damage',
        address: '4th Cross, Sector 2',
        latitude: 12.9716,
        longitude: 77.5946
      };
      expect(() => createComplaintSchema.parse(validComplaint)).not.toThrow();

      // Missing description
      expect(() => createComplaintSchema.parse({ ...validComplaint, description: '' })).toThrow();
    });
  });

  describe('Express Endpoints & Security Route Guards', () => {
    it('GET /health returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toContain('Civic Grievance Management');
    });

    it('GET /api/complaints rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/complaints');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing or invalid authentication token');
    });

    it('GET /api/analytics/overview rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('PATCH /api/complaints/:id/status rejects unauthorized citizen role', async () => {
      // Create a valid token with role: Citizen
      const citizenToken = signToken({
        id: 'citizen-123',
        email: 'citizen@test.com',
        name: 'Citizen Jane',
        role: 'Citizen',
        departmentId: null
      });

      const res = await request(app)
        .patch('/api/complaints/fake-id/status')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: 'Resolved', remarks: 'Trying to resolve as citizen' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });
  });

  describe('Python AI Service Integration Client', () => {
    it('categorizes complaint and handles AI service response or fallback', async () => {
      const result = await aiService.categorize(
        'Water overflowing from blocked gutter on 5th main',
        'Stagnant water accumulation causing foul smell for 3 days'
      );
      expect(result).toHaveProperty('predicted_category');
      expect(result).toHaveProperty('confidence_score');
      expect(result.confidence_score).toBeGreaterThan(0);
    });

    it('computes explainable priority score with contributing factors', async () => {
      const priorityRes = await aiService.computePriority(
        'Broken sparking wire near elementary school',
        'Live electric wire has fallen and is causing serious electrocution danger',
        'Public Safety'
      );
      expect(priorityRes).toHaveProperty('priority_score');
      expect(priorityRes).toHaveProperty('priority_level');
      expect(['Critical', 'High', 'Medium', 'Low']).toContain(priorityRes.priority_level);
      expect(priorityRes.contributing_factors.length).toBeGreaterThan(0);
    });

    it('generates administrative action brief', async () => {
      const brief = await aiService.generateActionBrief('Road Damage', 'High', 3, 'Downtown Central');
      expect(brief).toHaveProperty('recommended_department');
      expect(brief).toHaveProperty('target_sla_hours');
      expect(brief).toHaveProperty('suggested_action_brief');
      expect(brief.target_sla_hours).toBeLessThanOrEqual(48);
    });
  });
});
