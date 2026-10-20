// ============================================================
// Pulse Organ Pledges Page
// Owned by Member C (Slice 3: Organ Matching & Dashboards)
// Contract §5, §6:
//   - Route: /organ-pledges (DONOR)
//   - Pledge an organ from the six types
//   - View own pledges with status badges
//   - Withdraw pledge (show "already matched" error clearly)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './organ.css';

const ORGAN_TYPES = [
  { type: 'Kidney', desc: 'Renal transplant to restore renal function' },
  { type: 'Liver', desc: 'Hepatic transplant for acute or end-stage liver disease' },
  { type: 'Cornea', desc: 'Restores sight in patients suffering corneal blindness' },
  { type: 'Heart', desc: 'Cardiac transplant for end-stage heart failure' },
  { type: 'Lung', desc: 'Pulmonary transplant for severe respiratory failure' },
  { type: 'Pancreas', desc: 'Beta-cell organ for severe diabetes complications' },
];

export function Pledges() {
  const { user } = useAuth();
  const [pledges, setPledges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [selectedType, setSelectedType] = useState('Kidney');

  const loadPledges = async () => {
    setError(null);
    try {
      const data = await api.get('/organs/pledges');
      setPledges(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch pledges from backend', err);
      // Dev mock if API not up yet
      setPledges([
        { organ_id: 1, organ_type: 'Kidney', status: 'AVAILABLE', registered_on: '2026-01-15' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPledges();
  }, []);

  const handlePledge = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await api.post('/organs/pledges', { organ_type: selectedType });
      setSuccessMsg(`Successfully pledged your ${res.organ_type}! Your generosity can save lives.`);
      await loadPledges();
    } catch (err) {
      setError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async (organId, currentStatus) => {
    if (!window.confirm('Are you sure you want to withdraw this organ pledge?')) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await api.del(`/organs/pledges/${organId}`);
      setSuccessMsg(`Organ pledge #${organId} has been withdrawn.`);
      await loadPledges();
    } catch (err) {
      setError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'ok';
      case 'MATCHED':
        return 'warn';
      case 'DONATED':
        return 'ok';
      case 'WITHDRAWN':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="organ-page">
      <PageHeader
        title="My Organ Pledges"
        subtitle="Manage your voluntary organ donation pledges. When an emergency patient is blood-compatible, your pledge helps doctors match recipients."
      />

      {error && <ErrorBox message={error} />}

      {successMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--teal-light)', color: 'var(--teal)', border: '1px solid var(--teal-surface)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      {/* Register a New Pledge Card */}
      <Card title="Pledge an Organ for Donation">
        <form onSubmit={handlePledge}>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 14 }}>
            Choose an organ type from the six supported donor categories:
          </p>

          <div className="organ-type-grid">
            {ORGAN_TYPES.map((org) => (
              <div
                key={org.type}
                className={`organ-type-card ${selectedType === org.type ? 'selected' : ''}`}
                onClick={() => setSelectedType(org.type)}
                role="button"
                tabIndex={0}
              >
                <div className="organ-type-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
                <div className="organ-type-card__label">{org.type}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              Selected: <strong>{selectedType}</strong> — {ORGAN_TYPES.find((o) => o.type === selectedType)?.desc}
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn btn-primary"
            >
              {actionLoading ? <Spinner size="sm" label="Registering..." /> : `Confirm ${selectedType} Pledge`}
            </button>
          </div>
        </form>
      </Card>

      {/* Existing Pledges Table */}
      <Card title="Your Registered Pledges">
        {loading ? (
          <Spinner label="Loading your pledges..." />
        ) : pledges.length === 0 ? (
          <EmptyState title="No Active Pledges Found">
            You haven't pledged any organs yet. Select an organ type above to make a life-saving pledge.
          </EmptyState>
        ) : (
          <div className="pulse-table-container">
            <table className="pulse-table">
              <thead>
                <tr>
                  <th>Pledge ID</th>
                  <th>Organ Type</th>
                  <th>Status</th>
                  <th>Date Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pledges.map((p) => (
                  <tr key={p.organ_id}>
                    <td>#{p.organ_id}</td>
                    <td><strong>{p.organ_type}</strong></td>
                    <td>
                      <Badge tone={getStatusTone(p.status)}>{p.status}</Badge>
                    </td>
                    <td>{p.registered_on}</td>
                    <td>
                      {p.status === 'AVAILABLE' ? (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(p.organ_id, p.status)}
                          disabled={actionLoading}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--coral)' }}
                        >
                          Withdraw Pledge
                        </button>
                      ) : p.status === 'MATCHED' ? (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(p.organ_id, p.status)}
                          className="btn btn-secondary btn-sm"
                          title="Attempting withdrawal will test the database protection rule"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Withdraw (Matched)
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Pledges;
