// ============================================================
// Pulse Admin Hospital Verification Page
// Owned by Member B (Phase B4: Admin UI)
// Contract §5, §6:
//   - Route: /admin/hospitals (ADMIN only)
//   - GET /hospitals (public/admin list)
//   - PATCH /hospitals/:id/verify ({ verified: boolean })
//   - Table with Verify / Unverify toggle
//   - Triggers trg_audit_hospitals in database automatically
// ============================================================

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './admin.css';

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNVERIFIED' | 'VERIFIED'
  const [search, setSearch] = useState('');

  const loadHospitals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/hospitals');
      setHospitals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('GET /hospitals failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const handleToggleVerify = async (hospital) => {
    const nextStatus = !hospital.verified;
    const actionLabel = nextStatus ? 'verify' : 'unverify';

    if (!window.confirm(`Are you sure you want to ${actionLabel} "${hospital.name}"?`)) {
      return;
    }

    setUpdatingId(hospital.hospital_id);
    setFeedback(null);
    setError(null);

    try {
      const updated = await api.patch(`/hospitals/${hospital.hospital_id}/verify`, {
        verified: nextStatus,
      });

      // Update state locally
      setHospitals((prev) =>
        prev.map((h) =>
          h.hospital_id === hospital.hospital_id
            ? { ...h, verified: updated.verified }
            : h
        )
      );

      setFeedback({
        type: 'success',
        message: `Hospital "${hospital.name}" was successfully ${nextStatus ? 'verified' : 'unverified'}. Staff ${nextStatus ? 'can now' : 'cannot'} raise blood requests.`,
      });
    } catch (err) {
      console.error(`Failed to ${actionLabel} hospital:`, err);
      setError(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered list
  const filteredHospitals = hospitals.filter((h) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'VERIFIED' && h.verified) ||
      (filter === 'UNVERIFIED' && !h.verified);

    const matchesSearch =
      search.trim() === '' ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      (h.city && h.city.toLowerCase().includes(search.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const unverifiedCount = hospitals.filter((h) => !h.verified).length;

  return (
    <div className="admin-page">
      <PageHeader
        title="Hospital Verification"
        subtitle="Authorize medical institutions to create blood requests and coordinate matches"
        action={
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={loadHospitals}
            disabled={loading}
          >
            Refresh Hospitals
          </button>
        }
      />

      {feedback && (
        <div className={`admin-alert-banner admin-alert-banner--${feedback.type}`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--sm"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && !loading && (
        <ErrorBox message={error} onRetry={loadHospitals} />
      )}

      <Card>
        {/* Toolbar with filters & search */}
        <div className="admin-toolbar">
          <div className="admin-toolbar__left">
            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab-btn ${filter === 'ALL' ? 'admin-tab-btn--active' : ''}`}
                onClick={() => setFilter('ALL')}
              >
                All ({hospitals.length})
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${filter === 'UNVERIFIED' ? 'admin-tab-btn--active' : ''}`}
                onClick={() => setFilter('UNVERIFIED')}
              >
                Unverified ({unverifiedCount})
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${filter === 'VERIFIED' ? 'admin-tab-btn--active' : ''}`}
                onClick={() => setFilter('VERIFIED')}
              >
                Verified ({hospitals.length - unverifiedCount})
              </button>
            </div>

            <input
              type="text"
              className="admin-search-input"
              placeholder="Filter by name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            {unverifiedCount > 0 && (
              <Badge tone="warn">{unverifiedCount} Requires Attention</Badge>
            )}
          </div>
        </div>

        {loading && <Spinner label="Loading hospitals list..." />}

        {!loading && hospitals.length === 0 && (
          <EmptyState title="No partner hospitals found">
            There are currently no hospital records registered in the system.
          </EmptyState>
        )}

        {!loading && hospitals.length > 0 && filteredHospitals.length === 0 && (
          <EmptyState title="No hospitals match your filter">
            Try adjusting your search query or selecting a different status tab.
          </EmptyState>
        )}

        {!loading && filteredHospitals.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hospital ID</th>
                  <th>Hospital Name</th>
                  <th>City</th>
                  <th>Verification Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHospitals.map((hospital) => {
                  const isUpdating = updatingId === hospital.hospital_id;
                  return (
                    <tr key={hospital.hospital_id}>
                      <td>#{hospital.hospital_id}</td>
                      <td>
                        <strong>{hospital.name}</strong>
                      </td>
                      <td>{hospital.city || '—'}</td>
                      <td>
                        {hospital.verified ? (
                          <Badge tone="ok">Verified</Badge>
                        ) : (
                          <Badge tone="warn">Unverified</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {hospital.verified ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                            onClick={() => handleToggleVerify(hospital)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Updating...' : 'Unverify'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary admin-btn--sm"
                            onClick={() => handleToggleVerify(hospital)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Updating...' : 'Verify Hospital'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
