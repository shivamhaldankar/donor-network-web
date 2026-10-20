// ============================================================
// Pulse Log Donation Page
// Owned by Member A (Slice 1: Blood matching, eligibility & donor profile)
// Contract §5, §6:
//   - Route: /donations (STAFF)
//   - Log a donation: POST /donations { donor_id, request_id?, donation_type, units? }
//   - Hospital is derived directly from staff member's token.
//   - Show the 409 "not eligible" message clearly when donor cooldown is violated.
//   - Triggers handle donor last_donation_date, eligible_status = 'N', and fulfill linked requests.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import './Donations.css';

export function Donations() {
  const { user } = useAuth();

  // Form states
  const [donorId, setDonorId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [donationType, setDonationType] = useState('BLOOD');
  const [units, setUnits] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Status and feedback states
  const [eligibleDonors, setEligibleDonors] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [successInfo, setSuccessInfo] = useState(null);
  const [ineligibleError, setIneligibleError] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // Load eligible donors and open requests for helper dropdowns
  const loadReferenceData = async () => {
    setLoadingData(true);
    try {
      const [donorsRes, reqsRes] = await Promise.all([
        api.get('/donors/eligible').catch(() => []),
        api.get('/requests?status=OPEN').catch(() => []),
      ]);
      setEligibleDonors(Array.isArray(donorsRes) ? donorsRes : []);
      setOpenRequests(Array.isArray(reqsRes) ? reqsRes : []);
    } catch (err) {
      console.warn('Could not load helper data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  const handleLogDonation = async (e) => {
    e.preventDefault();
    setGeneralError(null);
    setIneligibleError(null);
    setSuccessInfo(null);
    setSubmitting(true);

    try {
      const payload = {
        donor_id: parseInt(donorId, 10),
        request_id: requestId ? parseInt(requestId, 10) : undefined,
        donation_type: donationType,
        units: parseInt(units, 10),
      };

      const res = await api.post('/donations', payload);

      setSuccessInfo({
        donationId: res.donation_id,
        donorId: payload.donor_id,
        donationType: payload.donation_type,
        units: payload.units,
      });

      // Clear form
      setDonorId('');
      setRequestId('');
      loadReferenceData();
    } catch (err) {
      console.error('Donation logging error:', err);
      // Specifically check for HTTP 409 DONOR_NOT_ELIGIBLE
      if (err.status === 409 || err.code === 'DONOR_NOT_ELIGIBLE') {
        setIneligibleError(err.message || 'Donor is not currently eligible for blood donation.');
      } else {
        setGeneralError(err.message || 'Failed to record donation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDonor = (id) => {
    setDonorId(String(id));
    setIneligibleError(null);
    setGeneralError(null);
  };

  return (
    <div className="container" style={{ paddingBottom: '48px' }}>
      <PageHeader
        title="Log Completed Donation"
        subtitle="Hospital Staff Portal: Record completed blood and organ donations to update inventory and fulfill active requests."
      />

      {/* Prominent 409 Ineligible Alert */}
      {ineligibleError && (
        <div className="pulse-ineligible-alert" role="alert">
          <div className="pulse-ineligible-alert__title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Donation Blocked: Donor Not Eligible (HTTP 409)</span>
          </div>
          <p className="pulse-ineligible-alert__msg">
            {ineligibleError}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
            PostgreSQL trigger <code>trg_check_donor_eligibility</code> rejected this insert to uphold patient safety and the mandatory 90-day cooldown period.
          </p>
        </div>
      )}

      {/* Success Alert */}
      {successInfo && (
        <div className="pulse-success-alert" role="status">
          <strong>✓ Donation Logged Successfully!</strong> (Donation #{successInfo.donationId})
          <div style={{ marginTop: '4px' }}>
            Recorded {successInfo.units} unit(s) of {successInfo.donationType} for Donor #{successInfo.donorId}.
            The donor's cooldown has been initialized (eligible_status set to 'N'), and any linked hospital request is marked FULFILLED.
          </div>
        </div>
      )}

      {generalError && <ErrorBox message={generalError} />}

      <div className="pulse-donations-grid" style={{ marginTop: '16px' }}>
        {/* Left Column: Log Donation Form */}
        <div>
          <Card title="Donation Entry Form">
            <form onSubmit={handleLogDonation}>
              {/* Donor ID */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="donor-id-input" className="form-label">Donor ID *</label>
                <input
                  id="donor-id-input"
                  type="number"
                  min="1"
                  className="input-control"
                  placeholder="Enter registered donor ID (e.g. 1)"
                  value={donorId}
                  onChange={(e) => setDonorId(e.target.value)}
                  required
                />
                <span className="form-helper">
                  Select a donor from the eligible directory on the right, or enter their ID directly.
                </span>
              </div>

              {/* Donation Type */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="donation-type-select" className="form-label">Donation Type *</label>
                <select
                  id="donation-type-select"
                  className="input-control"
                  value={donationType}
                  onChange={(e) => setDonationType(e.target.value)}
                  required
                >
                  <option value="BLOOD">BLOOD (Enforces 90-day cooldown)</option>
                  <option value="ORGAN">ORGAN</option>
                </select>
              </div>

              {/* Units */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="units-input" className="form-label">Units Donated</label>
                <input
                  id="units-input"
                  type="number"
                  min="1"
                  max="10"
                  className="input-control"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  required
                />
              </div>

              {/* Linked Request ID */}
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="request-id-input" className="form-label">Linked Request ID (Optional)</label>
                <input
                  id="request-id-input"
                  type="number"
                  min="1"
                  className="input-control"
                  placeholder="e.g. 1 (marks request FULFILLED)"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                />
                <span className="form-helper">
                  If this donation fulfills an emergency request raised by your hospital, enter the request ID here.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={submitting}
              >
                {submitting ? 'Recording donation...' : 'Confirm & Log Donation'}
              </button>
            </form>
          </Card>
        </div>

        {/* Right Column: Reference Directory of Eligible Donors */}
        <div>
          <Card
            title="Eligible Donors Reference"
            headerExtra={
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                Click a donor to autofill ID
              </span>
            }
          >
            {loadingData ? (
              <Spinner label="Loading eligible donors..." />
            ) : eligibleDonors.length === 0 ? (
              <EmptyState title="No active eligible donors listed">
                All donors are currently within their cooldown period or registered at other locations.
              </EmptyState>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '480px' }}>
                <table className="pulse-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Blood</th>
                      <th>City</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleDonors.map((d) => (
                      <tr key={d.donor_id}>
                        <td><strong>#{d.donor_id}</strong></td>
                        <td>{d.name}</td>
                        <td>
                          <Badge tone="ok">{d.blood_type}</Badge>
                        </td>
                        <td>{d.city}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSelectDonor(d.donor_id)}
                          >
                            Select #{d.donor_id}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Donations;
