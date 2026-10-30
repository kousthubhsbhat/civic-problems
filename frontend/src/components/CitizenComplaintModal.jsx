import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsApi } from '../services/api';
import { X, Upload, MapPin, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

const CATEGORIES = [
  'Roads & Infrastructure',
  'Water Supply & Sewage',
  'Sanitation & Solid Waste',
  'Electricity & Public Lighting',
  'Public Health & Safety',
  'Parks & Urban Greenery'
];

export const CitizenComplaintModal = ({ isOpen, onClose, onSuccess }) => {
  const { token, user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, or WEBP images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds maximum 5MB size limit.');
      return;
    }

    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setDetectingLocation(false);
        if (!address) {
          setAddress(`Civic GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        }
      },
      (err) => {
        setDetectingLocation(false);
        setError(`Location detection failed: ${err.message}. You can manually enter the address.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !address.trim()) {
      setError('Please provide title, detailed description, and address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('address', address.trim());
      if (latitude) formData.append('latitude', latitude);
      if (longitude) formData.append('longitude', longitude);
      if (imageFile) formData.append('image', imageFile);

      const result = await complaintsApi.submit(formData, token);
      setSuccessInfo(result);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Register Civic Grievance</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              AI will triage priority, route to the department, and detect duplicates.
            </p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              color: '#fb7185',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div style={{
              background: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              color: '#34d399',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <CheckCircle size={18} />
                <span>Grievance Registered Successfully!</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: '0.2rem 0' }}>
                Complaint No: <strong>{successInfo.complaint?.complaint_number}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>
                AI Priority: <strong>{successInfo.complaint?.priority}</strong> ({successInfo.complaint?.priority_score}/100)
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Broken water pipe flooding street"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Civic Category</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Location Address *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 14th Cross, 5th Main Road"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>

          {/* GPS Coordinates & Detection */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginBottom: '1.15rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                GEOTAGGING (FOR ACCURATE DUPLICATE & HOTSPOT MAPPING)
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                onClick={handleDetectLocation}
                disabled={detectingLocation}
              >
                <MapPin size={13} />
                <span>{detectingLocation ? 'Locating...' : 'Detect GPS'}</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <input
                type="number"
                step="any"
                className="form-input"
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                placeholder="Latitude (e.g. 12.9716)"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <input
                type="number"
                step="any"
                className="form-input"
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                placeholder="Longitude (e.g. 77.5946)"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the problem, hazard level, landmarks, and impact on residents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Image Upload for Supabase Storage */}
          <div className="form-group">
            <label className="form-label">Attach Photo (Supabase Storage: civic-complaint-images)</label>
            <div style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.01)',
              position: 'relative'
            }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
              <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                {imageFile ? imageFile.name : 'Click or drag image to upload (Max 5MB)'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                JPEG, PNG, or WEBP
              </p>
            </div>

            {imagePreview && (
              <div style={{ marginTop: '0.75rem', position: 'relative', width: 'fit-content' }}>
                <img
                  src={imagePreview}
                  alt="Complaint Preview"
                  style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#f43f5e',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Sparkles size={16} />
              <span>{loading ? 'Processing with AI & Uploading...' : 'Submit Grievance'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
