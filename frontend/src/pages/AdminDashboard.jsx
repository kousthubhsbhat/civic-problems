import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsApi, complaintsApi, aiApi } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import {
  BarChart3,
  Flame,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Layers,
  MapPin,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

export const AdminDashboard = ({ onSelectComplaint }) => {
  const { token } = useAuth();

  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadAllData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [overviewData, insightsData, complaintsData] = await Promise.all([
        analyticsApi.getOverview(token),
        analyticsApi.getInsights(token),
        complaintsApi.list(token, {
          status: statusFilter,
          category: categoryFilter,
          search: searchTerm
        })
      ]);

      setStats(overviewData);
      setInsights(insightsData || []);
      setComplaints(complaintsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load command center data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token, statusFilter, categoryFilter]);

  const handleRunClustering = async () => {
    setClustering(true);
    try {
      const res = await aiApi.generateHotspots(token);
      alert(res.message || `Detected ${res.total_clusters} spatial clusters!`);
      // Reload insights
      const updatedInsights = await analyticsApi.getInsights(token);
      setInsights(updatedInsights || []);
    } catch (err) {
      alert(`AI clustering failed: ${err.message}`);
    } finally {
      setClustering(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAllData();
  };

  const total = stats?.totalComplaints ?? 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Title & Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.25rem' }}>
            <Layers size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Municipal Command Center
            </span>
          </div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>
            Civic Operations & AI Intelligence
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>
            Real-time Supabase analytics and automated geospatial hotspot intelligence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={loadAllData}
            disabled={loading}
          >
            <RefreshCw size={15} />
            <span>Sync DB</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={handleRunClustering}
            disabled={clustering}
          >
            <Sparkles size={16} />
            <span>{clustering ? 'Clustering...' : 'Detect AI Hotspots'}</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards (Always reflects actual database counts, 0 when empty) */}
      <div className="stats-grid">
        <div className="glass-card">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Total Complaints
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {total}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Live Supabase records</p>
        </div>

        <div className="glass-card">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active / In Progress
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#818cf8', marginTop: '0.25rem' }}>
            {stats?.inProgress ?? 0}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Dispatched to crews</p>
        </div>

        <div className="glass-card">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Critical Urgency
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#f43f5e', marginTop: '0.25rem' }}>
            {stats?.criticalUrgent ?? 0}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>High hazard incidents</p>
        </div>

        <div className="glass-card">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Avg AI Priority Score
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {stats?.averagePriorityScore ?? 0}
            <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 500 }}>/100</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Algorithmic safety triage</p>
        </div>
      </div>

      {/* AI Hotspots & Insights Row */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={20} color="#f97316" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Emerging Civic Hotspots & AI Insights
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {insights.length} active spatial clusters detected
          </span>
        </div>

        {insights.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
              No geographic hotspots registered in Supabase yet.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
              When multiple complaints cluster near the same coordinates, click <strong>"Detect AI Hotspots"</strong> to analyze geographic clusters.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="glass-card"
                style={{
                  borderLeft: ins.severity === 'Critical' ? '4px solid #f43f5e' : '4px solid #fb923c'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{ins.title}</h4>
                  <span className={`badge ${ins.severity === 'Critical' ? 'badge-priority-critical' : 'badge-priority-high'}`}>
                    {ins.severity}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0.4rem 0' }}>
                  {ins.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.65rem' }}>
                  <span>📍 {ins.location}</span>
                  <span>{new Date(ins.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Master Complaints Grid & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          All Municipal Grievances Master Table
        </h3>

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', width: '220px' }}
              placeholder="Search #, title, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.75rem' }}>
              <Search size={14} />
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading master database records...
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <Layers className="empty-state-icon" />
          <h4 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Database Starts Empty</h4>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '0.9rem', margin: 0 }}>
            {total === 0
              ? 'No fake complaints or default stats exist. As citizens submit actual grievances, the master log and analytics will populate here.'
              : 'No complaints match your active filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>COMPLAINT #</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>TITLE & LOCATION</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>DEPARTMENT</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>AI PRIORITY</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700 }}>DATE</th>
                <th style={{ padding: '1rem', color: 'var(--text-dim)', fontWeight: 700, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectComplaint(c.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {c.complaint_number}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      📍 {c.address}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {c.departments?.department_name || c.category}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <PriorityBadge priority={c.priority} score={c.priority_score} />
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={(e) => { e.stopPropagation(); onSelectComplaint(c.id); }}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
