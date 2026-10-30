import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsApi } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { PlusCircle, Inbox, Clock, MapPin, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export const CitizenDashboard = ({ onOpenSubmitModal, onSelectComplaint }) => {
  const { user, token, profile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyComplaints = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await complaintsApi.list(token);
      setComplaints(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your complaints from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyComplaints();
  }, [token]);

  const total = complaints.length;
  const pending = complaints.filter(c => ['Submitted', 'Under Review', 'In Progress'].includes(c.status)).length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Hero Welcome & Action */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Citizen Grievance Portal
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {user
              ? `Welcome back, ${profile?.full_name || user.email}! Report civic issues with instant AI triage.`
              : 'Sign in to file complaints, upload photos to Supabase Storage, and track real-time resolution.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={fetchMyComplaints}
            disabled={loading}
            title="Refresh database records"
          >
            <RefreshCw size={16} className={loading ? 'pulse-dot' : ''} />
            <span>Sync</span>
          </button>

          <button
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            onClick={onOpenSubmitModal}
          >
            <PlusCircle size={18} />
            <span>File New Grievance</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Direct real data from DB, starts at 0 if empty) */}
      <div className="stats-grid">
        <div className="glass-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Total Grievances Filed
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {total}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Verified in Supabase Database</p>
        </div>

        <div className="glass-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Pending Action
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {pending}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Under Review or In Progress</p>
        </div>

        <div className="glass-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Resolved Cases
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
            {resolved}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Confirmed by Department Officers</p>
        </div>
      </div>

      {/* My Complaints Section */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Grievance Submissions</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Showing {complaints.length} actual records</span>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Retrieving live records from Supabase PostgreSQL...
        </div>
      ) : error ? (
        <div className="glass-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', padding: '1.5rem', color: '#fb7185' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>Unable to load complaints</span>
          </div>
          <p style={{ fontSize: '0.85rem' }}>{error}</p>
        </div>
      ) : complaints.length === 0 ? (
        /* Empty State adhering to: "The dashboard must start empty and display actual database records." */
        <div className="empty-state">
          <Inbox className="empty-state-icon" />
          <h4 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>No Grievances Found</h4>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '0.9rem', margin: 0 }}>
            Your citizen dashboard is currently empty. Be the first to report an issue like a pothole, water leak, or street light failure in your community.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={onOpenSubmitModal}>
            <PlusCircle size={16} />
            <span>Submit Your First Grievance</span>
          </button>
        </div>
      ) : (
        <div className="complaints-grid">
          {complaints.map((c) => (
            <div
              key={c.id}
              className="glass-card"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              onClick={() => onSelectComplaint(c.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    {c.complaint_number}
                  </span>
                  <StatusBadge status={c.status} />
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem', lineHeight: '1.4' }}>
                  {c.title}
                </h4>

                <p style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                  marginBottom: '0.85rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {c.ai_summary || c.description}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                  <MapPin size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.address}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem'
                }}>
                  <PriorityBadge priority={c.priority} score={c.priority_score} />
                  <span style={{ color: 'var(--text-dim)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
