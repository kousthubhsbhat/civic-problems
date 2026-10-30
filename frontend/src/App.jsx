import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { OfficerDashboard } from './pages/OfficerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { CitizenComplaintModal } from './components/CitizenComplaintModal';
import { ComplaintDetailsModal } from './components/ComplaintDetailsModal';
import { AuthModal } from './pages/AuthModal';

const MainLayout = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('citizen');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOpenSubmit = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSubmitModalOpen(true);
  };

  const handleSelectComplaint = (id) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedComplaintId(id);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'citizen' && (
          <CitizenDashboard
            key={`citizen-${refreshTrigger}`}
            onOpenSubmitModal={handleOpenSubmit}
            onSelectComplaint={handleSelectComplaint}
          />
        )}

        {activeTab === 'officer' && (
          <OfficerDashboard
            key={`officer-${refreshTrigger}`}
            onSelectComplaint={handleSelectComplaint}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            key={`admin-${refreshTrigger}`}
            onSelectComplaint={handleSelectComplaint}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-dim)',
        background: 'rgba(10, 13, 20, 0.9)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span>Smart Civic Governance Platform • Powered by <strong>Supabase</strong> (Database, Auth, Storage) & <strong>Python FastAPI</strong> AI</span>
          <span>Zero Fake Data • Dynamic Database Persistence</span>
        </div>
      </footer>

      {/* Modals */}
      <CitizenComplaintModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <ComplaintDetailsModal
        complaintId={selectedComplaintId}
        isOpen={Boolean(selectedComplaintId)}
        onClose={() => setSelectedComplaintId(null)}
        onRefresh={handleRefresh}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
