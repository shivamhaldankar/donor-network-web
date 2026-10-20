// ============================================================
// Pulse Blood & Organ Requests Management Page
// Owned by Member A (Slice 1: Blood matching, eligibility & donor profile)
// Contract §5, §6:
//   - Route: /requests (STAFF, ADMIN)
//   - Form with conditional blood-type vs organ-type, urgency, radius.
//     Admin is read-only (requests created by hospital staff).
//   - After a CRITICAL blood request is created, immediately load and show matched donors with distance.
//   - List of hospital requests with status badges and Cancel button.
//   - Coral badges ONLY for CRITICAL urgency.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import './Requests.css';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ORGAN_TYPES = ['Kidney', 'Liver', 'Cornea', 'Heart', 'Lung', 'Pancreas'];

export function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form state
  const [requestType, setRequestType] = useState('BLOOD');
  const [bloodTypeNeeded, setBloodTypeNeeded] = useState('O+');
  const [organTypeNeeded, setOrganTypeNeeded] = useState('Kidney');
  const [urgency, setUrgency] = useState('CRITICAL');
  const [radiusKm, setRadiusKm] = useState(50);
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [patientName, setPatientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Recently matched donors view (after creating a critical request)
  const [recentMatchResult, setRecentMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // Inspect matches modal / expanded view
  const [inspectRequestId, setInspectRequestId] = useState(null);
  const [inspectedMatches, setInspectedMatches] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Load requests
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'ALL' ? '/requests' : `/requests?status=${statusFilter}`;
      const data = await api.get(url);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError(err.message || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle request submission
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    setRecentMatchResult(null);

    try {
      const payload = {
        request_type: requestType,
        blood_type_needed: requestType === 'BLOOD' ? bloodTypeNeeded : undefined,
        organ_type_needed: requestType === 'ORGAN' ? organTypeNeeded : undefined,
        urgency,
        radius_km: parseInt(radiusKm, 10),
        units_needed: parseInt(unitsNeeded, 10),
        patient_name: patientName.trim() || undefined,
      };

      const res = await api.post('/requests', payload);

      // If critical blood request matched donors, immediately fetch matched donors list
      if (res.status === 'MATCHED' && res.match_count > 0) {
        setMatchLoading(true);
        try {
          const matchedDonors = await api.get(`/requests/${res.request_id}/matches`);
          setRecentMatchResult({
            requestId: res.request_id,
            matchCount: res.match_count,
            bloodType: bloodTypeNeeded,
            radius: radiusKm,
            matches: Array.isArray(matchedDonors) ? matchedDonors : [],
          });
        } catch (mErr) {
          console.warn('Could not load immediate match details:', mErr);
        } finally {
          setMatchLoading(false);
        }
      }

      // Reset form
      setPatientName('');
      loadRequests();
    } catch (err) {
      console.error('Failed to create request:', err);
      setFormError(err.message || 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle request cancellation
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    setError(null);
    try {
      await api.patch(`/requests/${requestId}/cancel`);
      // Update local state
      setRequests((prev) =>
        prev.map((r) => (r.request_id === requestId ? { ...r, status: 'CANCELLED' } : r))
      );
    } catch (err) {
      console.error('Failed to cancel request:', err);
      setError(err.message || 'Could not cancel request.');
    }
  };

  // Inspect matches for an existing request
  const handleInspectMatches = async (requestId) => {
    if (inspectRequestId === requestId) {
      setInspectRequestId(null);
      return;
    }
    setInspectRequestId(requestId);
    setInspectLoading(true);
    try {
      const data = await api.get(`/requests/${requestId}/matches`);
      setInspectedMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load matches:', err);
      setInspectedMatches([]);
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '48px' }}>
      <PageHeader
        title="Blood & Organ Availability Requests"
        subtitle={
          isAdmin
            ? 'Administrator View: Inspect hospital requests across the entire network.'
            : 'Hospital Staff View: Create critical blood or organ requests and view matched nearby donors.'
        }
      />

      {error && <ErrorBox message={error} onRetry={loadRequests} />}

      {/* Immediate Match Banner (Appears after creating a CRITICAL request) */}
      {recentMatchResult && (
        <div className="pulse-matched-banner" role="region" aria-label="Auto-matching results">
          <div className="pulse-matched-banner__title">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>
              Request #{recentMatchResult.requestId} Matched {recentMatchResult.matchCount} Eligible Donors!
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--ink)' }}>
            The database trigger automatically matched {recentMatchResult.matchCount} eligible{' '}
            <strong>{recentMatchResult.bloodType}</strong> donor(s) within {recentMatchResult.radius} km.
            Notifications have been queued and donors can be contacted:
          </p>

          {matchLoading ? (
            <Spinner size="sm" label="Loading donor distances..." />
          ) : (
            <div className="pulse-donor-matches-grid">
              {recentMatchResult.matches.map((m) => (
                <div key={m.match_id} className="pulse-donor-match-tile">
                  <div className="pulse-donor-match-tile__name">
                    <span>{m.name}</span>
                    <Badge tone="ok">{m.blood_type}</Badge>
                  </div>
                  <div className="pulse-donor-match-tile__dist">
                    {m.distance_km !== null ? `📍 ${m.distance_km} km away` : '📍 In your city'}
                  </div>
                  <div className="pulse-donor-match-tile__phone">
                    📞 {m.phone || 'Phone on file'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pulse-requests-grid">
        {/* Left Column: Create Request Form */}
        <div>
          <Card title={isAdmin ? 'Request Creation (Staff Only)' : 'Create New Request'}>
            {isAdmin ? (
              <div style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                <p>
                  As an Administrator, you have full read access to inspect all hospital requests and audit trails.
                  Requests are initiated by verified Hospital Staff accounts.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateRequest}>
                {formError && <ErrorBox message={formError} />}

                {/* Type Toggle: BLOOD vs ORGAN */}
                <div className="pulse-type-toggle">
                  <button
                    type="button"
                    className={`pulse-type-toggle-btn ${requestType === 'BLOOD' ? 'pulse-type-toggle-btn--active' : ''}`}
                    onClick={() => setRequestType('BLOOD')}
                  >
                    Blood Request
                  </button>
                  <button
                    type="button"
                    className={`pulse-type-toggle-btn ${requestType === 'ORGAN' ? 'pulse-type-toggle-btn--active' : ''}`}
                    onClick={() => setRequestType('ORGAN')}
                  >
                    Organ Request
                  </button>
                </div>

                {/* Conditional Field: Blood Type vs Organ Type */}
                {requestType === 'BLOOD' ? (
                  <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="blood-type-select" className="form-label">Blood Type Needed *</label>
                    <select
                      id="blood-type-select"
                      className="input-control"
                      value={bloodTypeNeeded}
                      onChange={(e) => setBloodTypeNeeded(e.target.value)}
                      required
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="organ-type-select" className="form-label">Organ Needed *</label>
                    <select
                      id="organ-type-select"
                      className="input-control"
                      value={organTypeNeeded}
                      onChange={(e) => setOrganTypeNeeded(e.target.value)}
                      required
                    >
                      {ORGAN_TYPES.map((ot) => (
                        <option key={ot} value={ot}>{ot}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Urgency Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Urgency Level *</label>
                  <div className="pulse-urgency-grid">
                    <div
                      className={`pulse-urgency-card pulse-urgency-card--critical ${urgency === 'CRITICAL' ? 'pulse-urgency-card--selected' : ''}`}
                      onClick={() => setUrgency('CRITICAL')}
                    >
                      CRITICAL (Auto-match)
                    </div>
                    <div
                      className={`pulse-urgency-card pulse-urgency-card--moderate ${urgency === 'MODERATE' ? 'pulse-urgency-card--selected' : ''}`}
                      onClick={() => setUrgency('MODERATE')}
                    >
                      MODERATE
                    </div>
                    <div
                      className={`pulse-urgency-card pulse-urgency-card--low ${urgency === 'LOW' ? 'pulse-urgency-card--selected' : ''}`}
                      onClick={() => setUrgency('LOW')}
                    >
                      LOW
                    </div>
                  </div>
                  {urgency === 'CRITICAL' && requestType === 'BLOOD' && (
                    <p className="form-helper" style={{ color: 'var(--coral)', marginTop: 6, fontWeight: 500 }}>
                      ⚡ Critical blood requests automatically run Haversine matching and notify nearby donors.
                    </p>
                  )}
                </div>

                {/* Search Radius */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="radius-input" className="form-label">Search Radius (km)</label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--teal)' }}>{radiusKm} km</span>
                  </div>
                  <input
                    id="radius-input"
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(e.target.value)}
                    style={{ width: '100%', accentColor: 'var(--teal)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    <span>5 km</span>
                    <span>50 km (default)</span>
                    <span>500 km</span>
                  </div>
                </div>

                {/* Units Needed & Patient Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label htmlFor="units-input" className="form-label">Units</label>
                    <input
                      id="units-input"
                      type="number"
                      min="1"
                      max="50"
                      className="input-control"
                      value={unitsNeeded}
                      onChange={(e) => setUnitsNeeded(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-input" className="form-label">Patient Name (Optional)</label>
                    <input
                      id="patient-input"
                      type="text"
                      className="input-control"
                      placeholder="e.g. Ramesh P."
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting request...' : 'Publish Request'}
                </button>
              </form>
            )}
          </Card>
        </div>

        {/* Right Column: Hospital Requests List */}
        <div>
          <Card title={isAdmin ? 'All Network Requests' : 'Your Hospital Requests'}>
            {/* Filter Tabs */}
            <div className="pulse-filter-tabs">
              {['ALL', 'OPEN', 'MATCHED', 'FULFILLED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`pulse-filter-tab ${statusFilter === st ? 'pulse-filter-tab--active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st}
                </button>
              ))}
            </div>

            {loading ? (
              <Spinner label="Loading requests..." />
            ) : requests.length === 0 ? (
              <EmptyState title="No requests found">
                No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} requests currently on record.
              </EmptyState>
            ) : (
              <div>
                {requests.map((r) => {
                  const isCritical = r.urgency === 'CRITICAL';
                  const isMatched = r.status === 'MATCHED';
                  const isCancellable = r.status === 'OPEN' || r.status === 'MATCHED';
                  const isExpanded = inspectRequestId === r.request_id;

                  return (
                    <div
                      key={r.request_id}
                      className={`pulse-request-item ${isCritical ? 'pulse-request-item--critical' : ''}`}
                    >
                      <div className="pulse-request-item__header">
                        <div>
                          <h4 className="pulse-request-item__title">
                            {r.request_type === 'BLOOD' ? `${r.blood_type_needed} Blood` : `${r.organ_type_needed} Organ`}
                            {r.patient_name ? ` for ${r.patient_name}` : ''}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                            {r.hospital_name} • Request #{r.request_id}
                          </span>
                        </div>

                        <div className="pulse-request-item__badges">
                          {/* Coral Badge strictly for CRITICAL urgency */}
                          <Badge tone={isCritical ? 'critical' : r.urgency === 'MODERATE' ? 'warn' : 'neutral'}>
                            {r.urgency}
                          </Badge>
                          <Badge tone={isMatched ? 'ok' : r.status === 'FULFILLED' ? 'ok' : r.status === 'CANCELLED' ? 'neutral' : 'warn'}>
                            {r.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="pulse-request-item__details">
                        <span>Radius: {r.radius_km} km</span>
                        <span>Requested: {new Date(r.requested_on).toLocaleDateString()}</span>
                        <span>
                          Matches: <strong>{r.match_count || 0} donor(s)</strong>
                        </span>
                      </div>

                      {/* Actions: View Matches & Cancel */}
                      <div className="pulse-request-item__actions">
                        <div>
                          {r.match_count > 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleInspectMatches(r.request_id)}
                            >
                              {isExpanded ? 'Hide Matches' : `View ${r.match_count} Matched Donor(s)`}
                            </button>
                          )}
                        </div>

                        <div>
                          {isCancellable && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ color: 'var(--coral)', border: '1px solid var(--border)' }}
                              onClick={() => handleCancelRequest(r.request_id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Matched Donors Drawer */}
                      {isExpanded && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                          {inspectLoading ? (
                            <Spinner size="sm" label="Loading matched donors..." />
                          ) : inspectedMatches.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>No match logs recorded.</p>
                          ) : (
                            <div className="pulse-donor-matches-grid">
                              {inspectedMatches.map((m) => (
                                <div key={m.match_id} className="pulse-donor-match-tile">
                                  <div className="pulse-donor-match-tile__name">
                                    <span>{m.name}</span>
                                    <Badge tone="ok">{m.blood_type}</Badge>
                                  </div>
                                  <div className="pulse-donor-match-tile__dist">
                                    {m.distance_km !== null ? `📍 ${m.distance_km} km away` : '📍 Same-city fallback'}
                                  </div>
                                  <div className="pulse-donor-match-tile__phone">
                                    📞 {m.phone || 'Phone on file'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                                    Status: <strong>{m.contacted_status}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Requests;