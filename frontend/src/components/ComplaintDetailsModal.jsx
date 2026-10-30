import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsApi } from '../services/api';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { X, MapPin, Calendar, Clock, Copy, Shield, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const ComplaintDetailsModal = ({ complaintId, isOpen, onClose, onRefresh }) => {
  const { token, profile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status update form
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!complaintId || !isOpen) return;

    setLoading(true);
    setError(null);

    complaintsApi.getById(complaintId, token)
      .then((res) => {
        setData(res);
        setNewStatus(res.complaint.status);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch complaint details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [complaintId, isOpen, token]);

  if (!isOpen) return null;

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      alert('Please enter official remarks explaining this status update.');
      return;
    }

    setUpdating(true);
    try {
      await complaintsApi.updateStatus(complaintId, newStatus, remarks.trim(), token);
      setRemarks('');
      // Refresh modal data
      const updated = await complaintsApi.getById(complaintId, token);
      setData(updated);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const isOfficerOrAdmin = profile?.role === 'administrator' || profile?.role === 'department_officer';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading complaint details from Supabase...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
            <p>{error}</p>
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                    {data.complaint.complaint_number}
                  </span>
                  <StatusBadge status={data.complaint.status} />
                  <PriorityBadge priority={data.complaint.priority} score={data.complaint.priority_score} />
                </div>
                <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>{data.complaint.title}</h2>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Meta information row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                fontSize: '0.82rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block' }}>Department</span>
                  <strong>{data.complaint.departments?.department_name || 'Unassigned'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block' }}>Category</span>
                  <strong>{data.complaint.category}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block' }}>Submitted On</span>
                  <strong>{new Date(data.complaint.created_at).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block' }}>Reported By</span>
                  <strong>{data.complaint.profiles?.full_name || 'Citizen'}</strong>
                </div>
              </div>

              {/* Duplicate Complaints Warning Banner */}
              {data.duplicates && data.duplicates.length > 0 && (
                <div style={{
                  background: 'rgba(251, 146, 60, 0.1)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb923c', fontWeight: 700, marginBottom: '0.35rem' }}>
                    <AlertTriangle size={18} />
                    <span>AI Duplicate Grievance Alert ({data.duplicates.length} match detected)</span>
                  </div>
                  {data.duplicates.map((dup) => (
                    <div key={dup.id} style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '0.4rem' }}>
                      • <strong>Similarity: {(Number(dup.similarity_score) * 100).toFixed(1)}%</strong> — {dup.explanation}
                    </div>
                  ))}
                </div>
              )}

              {/* Description & Image */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Citizen Description
                </h4>
                <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                  {data.complaint.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <MapPin size={15} style={{ color: 'var(--primary)' }} />
                <span>{data.complaint.address}</span>
                {data.complaint.latitude && data.complaint.longitude && (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    ({data.complaint.latitude.toFixed(4)}, {data.complaint.longitude.toFixed(4)})
                  </span>
                )}
              </div>

              {/* Complaint Site Image */}
              {(() => {
                const rawImg = data.complaint.imageUrl || data.complaint.image_url;
                if (!rawImg) return null;
                const backendHost = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
                const fullImgUrl = rawImg.startsWith('http') ? rawImg : `${backendHost}${rawImg}`;
                return (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Photo from Site
                    </h4>
                    <a href={fullImgUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={fullImgUrl}
                        alt="Complaint Site Photo"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '260px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      />
                    </a>
                  </div>
                );
              })()}

              {/* AI Explainable Analysis Box */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <Shield size={16} />
                  <span>Explainable AI Assessment & Triage</span>
                </div>
                {data.complaint.ai_summary && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '0.35rem 0' }}>
                    <strong>AI Executive Summary:</strong> {data.complaint.ai_summary}
                  </p>
                )}
                {data.complaint.priority_explanation && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.35rem 0' }}>
                    <strong>Scoring Factors:</strong> {data.complaint.priority_explanation}
                  </p>
                )}
              </div>

              {/* Complaint History Timeline */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Resolution Audit Trail & History
                </h4>
                {(!data.history || data.history.length === 0) ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No status transitions recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {data.history.map((h, idx) => (
                      <div key={h.id || idx} style={{
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)'
                      }}>
                        <CheckCircle2 size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              Status: <span style={{ color: '#60a5fa' }}>{h.new_status}</span>
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>
                            {h.remarks}
                          </p>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            Logged by: {h.profiles?.full_name || 'System / Officer'} ({h.profiles?.role || 'Authority'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Update Form for Officers and Administrators */}
              {isOfficerOrAdmin && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem'
                }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Officer Action: Update Resolution Status
                  </h4>
                  <form onSubmit={handleStatusSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">New Status</label>
                        <select
                          className="form-select"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                        >
                          <option value="Submitted">Submitted</option>
                          <option value="Under Review">Under Review</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Official Remarks *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Dispatched asphalt repair crew to location"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={updating}
                    >
                      {updating ? 'Recording Status in Supabase...' : 'Update Status & Log Remarks'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
