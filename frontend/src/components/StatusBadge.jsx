import React from 'react';

export const StatusBadge = ({ status }) => {
  const getBadgeClass = (s) => {
    switch (s) {
      case 'Submitted': return 'badge-submitted';
      case 'Under Review': return 'badge-under-review';
      case 'In Progress': return 'badge-in-progress';
      case 'Resolved': return 'badge-resolved';
      case 'Rejected': return 'badge-rejected';
      default: return 'badge-submitted';
    }
  };

  return (
    <span className={`badge ${getBadgeClass(status)}`}>
      <span className="pulse-dot" style={{ backgroundColor: 'currentColor' }}></span>
      {status || 'Submitted'}
    </span>
  );
};

export const PriorityBadge = ({ priority, score }) => {
  const getBadgeClass = (p) => {
    switch (p) {
      case 'Critical': return 'badge-priority-critical';
      case 'High': return 'badge-priority-high';
      case 'Medium': return 'badge-priority-medium';
      case 'Low': return 'badge-priority-low';
      default: return 'badge-priority-medium';
    }
  };

  return (
    <span className={`badge ${getBadgeClass(priority)}`}>
      <span>{priority || 'Medium'}</span>
      {score !== undefined && score !== null && (
        <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({Number(score).toFixed(0)})</span>
      )}
    </span>
  );
};
