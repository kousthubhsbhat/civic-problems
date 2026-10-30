import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, LogOut, LogIn, Activity, Database, Server } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const Navbar = ({ activeTab, setActiveTab, onOpenAuthModal }) => {
  const { user, profile, signOut, isConfigured } = useAuth();
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const checkBackend = () => {
      fetch(`${BACKEND_URL}/health`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'healthy') setBackendOnline(true);
        })
        .catch(() => setBackendOnline(false));
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="navbar" id="main-navigation">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('citizen')}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            padding: '0.5rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)'
          }}>
            <Shield size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Civic<span style={{ color: '#3b82f6' }}>Pulse</span>
            </h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: 0 }}>Smart Governance Platform</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '0.25rem',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          gap: '0.25rem'
        }}>
          <button
            className="btn"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              background: activeTab === 'citizen' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'citizen' ? '#ffffff' : 'var(--text-muted)'
            }}
            onClick={() => setActiveTab('citizen')}
          >
            Citizen Portal
          </button>

          <button
            className="btn"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              background: activeTab === 'officer' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'officer' ? '#ffffff' : 'var(--text-muted)'
            }}
            onClick={() => setActiveTab('officer')}
          >
            Department Queue
          </button>

          <button
            className="btn"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              background: activeTab === 'admin' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'admin' ? '#ffffff' : 'var(--text-muted)'
            }}
            onClick={() => setActiveTab('admin')}
          >
            Admin Command Center
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Live Backend API Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.75rem',
          color: backendOnline ? '#34d399' : '#f87171',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.35rem 0.75rem',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <Server size={13} />
          <span className="pulse-dot" style={{ backgroundColor: backendOnline ? '#34d399' : '#f87171' }}></span>
          <span>{backendOnline ? 'Backend API: Online' : 'Backend API: Offline'}</span>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {profile?.full_name || user.email}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                Role: {profile?.role || 'citizen'}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={onOpenAuthModal}
          >
            <LogIn size={15} />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </nav>
  );
};
