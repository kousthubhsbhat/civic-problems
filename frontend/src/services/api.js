const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getHeaders = (token, isFormData = false) => {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

/**
 * Complaints API
 */
export const complaintsApi = {
  // Submit new complaint with optional image
  submit: async (formData, token) => {
    const response = await fetch(`${BACKEND_URL}/api/complaints`, {
      method: 'POST',
      headers: getHeaders(token, true),
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to submit complaint');
    return data;
  },

  // Get list of complaints with role-based filtering
  list: async (token, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.search) params.append('search', filters.search);

    const url = `${BACKEND_URL}/api/complaints${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch complaints');
    return data.complaints;
  },

  // Get single complaint with history and duplicate records
  getById: async (id, token) => {
    const response = await fetch(`${BACKEND_URL}/api/complaints/${id}`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch complaint details');
    return data;
  },

  // Update status (Officer or Admin)
  updateStatus: async (id, status, remarks, token) => {
    const response = await fetch(`${BACKEND_URL}/api/complaints/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status, remarks })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to update status');
    return data;
  },

  // Reassign department / priority (Officer or Admin)
  reassign: async (id, payload, token) => {
    const response = await fetch(`${BACKEND_URL}/api/complaints/${id}/assign`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to reassign complaint');
    return data;
  }
};

/**
 * Analytics API
 */
export const analyticsApi = {
  // Fetch real-time database analytics
  getOverview: async (token) => {
    const response = await fetch(`${BACKEND_URL}/api/analytics/overview`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch analytics');
    return data.stats;
  },

  // Fetch AI insights and hotspots
  getInsights: async (token) => {
    const response = await fetch(`${BACKEND_URL}/api/analytics/insights`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch insights');
    return data.insights;
  }
};

/**
 * AI API
 */
export const aiApi = {
  generateHotspots: async (token) => {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-insights`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to trigger hotspot analysis');
    return data;
  }
};

/**
 * Departments API
 */
export const departmentsApi = {
  list: async () => {
    const response = await fetch(`${BACKEND_URL}/api/departments`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch departments');
    return data.departments;
  }
};

/**
 * Authentication API (Node.js REST Backend)
 */
export const authApi = {
  register: async ({ name, email, password, role }) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  login: async ({ email, password }) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  logout: async () => {
    const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST'
    });
    return response.json();
  },

  getMe: async (token) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Session expired');
    return data.user;
  }
};

