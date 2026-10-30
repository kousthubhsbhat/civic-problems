import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsApi } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { Briefcase, Filter, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';

export const OfficerDashboard = ({ onSelectComplaint }) => {
  const { user, token, profile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDepartmentQueue = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;

      const data = await complaintsApi.list(token, filters);
      setComplaints(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load department queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentQueue();
  }, [token, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDepartmentQueue();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', marginBottom: '0.25rem' }}>
            <Briefcase size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Field Operations & Triage
            </span>
          </div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>
            Department Complaints Queue
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>
            Assigned to: <strong>{profile?.departments?.department_name || 'All Assigned Civic Categories'}</strong>
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchDepartmentQueue}
          disabled={loading}
        >
          <RefreshCw size={15} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['', 'Submitted', 'Under Review', 'In Progress', 'Resolved'].map((st) => (
            <button
              key={st}
              className="btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                background: statusFilter === st ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                color: statusFilter === st ? '#ffffff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)'
              }}
              onClick={() => setStatusFilter(st)}
            >
              {st || 'All Grievances'}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', minWidth: '260px' }}>
          <input
            type="text"
            className="form-input"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            placeholder="Search complaint # or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem' }}>
            <Search size={15} />
          </button>
        </form>
      </div>

      {/* Queue Listing */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading active department grievances from Supabase...
        </div>
      ) : error ? (
        <div className="glass-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', padding: '1.5rem', color: '#fb7185' }}>
          <p>{error}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <Briefcase className="empty-state-icon" />
          <h4 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Queue is Clear</h4>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.88rem', margin: 0 }}>
            {statusFilter
              ? `No complaints currently matched for status '${statusFilter}'.`
              : 'There are currently no complaints in the database awaiting departmental action.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {complaints.map((c) => (
            <div
              key={c.id}
              className="glass-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 2fr 1fr 1fr auto',
                alignItems: 'center',
                gap: '1.25rem',
                cursor: 'pointer'
              }}
              onClick={() => onSelectComplaint(c.id)}
            >
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  {c.complaint_number}
                </span>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.2rem 0' }}>
                  {c.title}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {c.category}
                </span>
              </div>

              <div>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {c.ai_summary || c.description}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.2rem', display: 'block' }}>
                  📍 {c.address}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
                  PRIORITY
                </span>
                <PriorityBadge priority={c.priority} score={c.priority_score} />
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
                  CURRENT STATUS
                </span>
                <StatusBadge status={c.status} />
              </div>

              <div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={(e) => { e.stopPropagation(); onSelectComplaint(c.id); }}
                >
                  <span>Review</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
