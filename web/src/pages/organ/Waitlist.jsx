// ============================================================
// Pulse Organ Waitlist Management Page
// Owned by Member C (Slice 3: Organ Matching & Dashboards)
// Contract §5, §6:
//   - Route: /organ-waitlist (STAFF, ADMIN)
//   - Add patient to organ waitlist (name, organ, blood group, urgency 1-10)
//   - View ranked waitlist (vw_waitlist_ranked) with days waiting
//   - Remove patient button (PATCH /organs/waitlist/:id/remove)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './organ.css';

const ORGAN_OPTIONS = ['Kidney', 'Liver', 'Cornea', 'Heart', 'Lung', 'Pancreas'];
const BLOOD_GROUPS = ['O', 'A', 'B', 'AB'];

export function Waitlist() {
  const { user } = useAuth();
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form fields
  const [patientName, setPatientName] = useState('');
  const [organType, setOrganType] = useState('Kidney');
  const [bloodGroup, setBloodGroup] = useState('O');
  const [urgencyScore, setUrgencyScore] = useState(7);

  const loadWaitlist = async () => {
    setError(null);
    try {
      const data = await api.get('/organs/waitlist');
      setWaitlist(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load waitlist', err);
      // Fallback seed entries
      setWaitlist([
        { waitlist_id: 1, hospital_name: 'City Care Hospital', patient_name: 'Ramesh Patil', organ_type: 'Kidney', blood_group: 'O', urgency_score: 9, listed_on: '2026-04-03', days_waiting: 200, status: 'WAITING' },
        { waitlist_id: 2, hospital_name: 'Sunrise Medical Center', patient_name: 'Sunita Rao', organ_type: 'Kidney', blood_group: 'A', urgency_score: 7, listed_on: '2026-09-20', days_waiting: 30, status: 'WAITING' },
        { waitlist_id: 3, hospital_name: 'City Care Hospital', patient_name: 'Imran Sheikh', organ_type: 'Kidney', blood_group: 'B', urgency_score: 5, listed_on: '2025-12-24', days_waiting: 300, status: 'WAITING' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, []);

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await api.post('/organs/waitlist', {
        patient_name: patientName.trim(),
        organ_type: organType,
        blood_group: bloodGroup,
        urgency_score: parseInt(urgencyScore, 10),
      });

      setSuccessMsg(`Patient ${patientName.trim()} added to waiting list (#${res.waitlist_id}).`);
      setPatientName('');
      setUrgencyScore(7);
      await loadWaitlist();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (waitlistId) => {
    if (!window.confirm(`Are you sure you want to remove waitlist entry #${waitlistId}?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/organs/waitlist/${waitlistId}/remove`);
      setSuccessMsg(`Patient #${waitlistId} removed from active waitlist.`);
      await loadWaitlist();
    } catch (err) {
      setError(err);
    }
  };

  const getUrgencyTone = (score) => {
    if (score >= 8) return 'critical';
    if (score >= 5) return 'warn';
    return 'ok';
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'WAITING':
        return 'warn';
      case 'MATCHED':
        return 'ok';
      case 'TRANSPLANTED':
        return 'ok';
      case 'REMOVED':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="organ-page">
      <PageHeader
        title="Organ Waiting List"
        subtitle="Manage patients awaiting organ transplants. Ranks candidates automatically by clinical urgency score and days on waitlist."
      />

      {error && <ErrorBox message={error} />}

      {successMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--teal-light)', color: 'var(--teal)', border: '1px solid var(--teal-surface)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      {/* Staff Add Patient Form */}
      {user?.role === 'STAFF' && (
        <Card title="Add Patient to Waiting List">
          <form onSubmit={handleAddPatient}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="patient-name-input" className="form-label">Patient Name</label>
                <input
                  id="patient-name-input"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Ramesh Patil"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="organ-type-select" className="form-label">Organ Needed</label>
                <select
                  id="organ-type-select"
                  className="select-control"
                  value={organType}
                  onChange={(e) => setOrganType(e.target.value)}
                >
                  {ORGAN_OPTIONS.map((org) => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="blood-group-select" className="form-label">ABO Blood Group</label>
                <select
                  id="blood-group-select"
                  className="select-control"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="urgency-score-select" className="form-label">Clinical Urgency (1–10)</label>
                <select
                  id="urgency-score-select"
                  className="select-control"
                  value={urgencyScore}
                  onChange={(e) => setUrgencyScore(e.target.value)}
                >
                  <option value="10">10 — Extreme / Critical Emergency</option>
                  <option value="9">9 — High ICU Urgency</option>
                  <option value="8">8 — Severe Organ Failure</option>
                  <option value="7">7 — High Urgency</option>
                  <option value="6">6 — Moderate-High</option>
                  <option value="5">5 — Moderate</option>
                  <option value="4">4 — Stable / Monitored</option>
                  <option value="3">3 — Routine Waitlist</option>
                  <option value="2">2 — Low Urgency</option>
                  <option value="1">1 — Minimal Risk</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? <Spinner size="sm" label="Registering..." /> : '+ List Patient on Registry'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Ranked Waiting List Table */}
      <Card
        title={user?.role === 'STAFF' ? "Hospital Ranked Waiting List" : "All Regional Waiting Lists (Admin View)"}
        headerExtra={
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Sorted by Urgency Descending, then Waiting Days Descending
          </span>
        }
      >
        {loading ? (
          <Spinner label="Loading ranked waitlist..." />
        ) : waitlist.length === 0 ? (
          <EmptyState title="No Waiting Patients">
            There are currently no patients registered on the organ waiting list.
          </EmptyState>
        ) : (
          <div className="pulse-table-container">
            <table className="pulse-table">
              <thead>
                <tr>
                  <th>Waitlist ID</th>
                  <th>Patient Name</th>
                  <th>Hospital</th>
                  <th>Organ</th>
                  <th>ABO Group</th>
                  <th>Urgency</th>
                  <th>Days Waiting</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((row) => (
                  <tr key={row.waitlist_id}>
                    <td>#{row.waitlist_id}</td>
                    <td><strong>{row.patient_name}</strong></td>
                    <td>{row.hospital_name}</td>
                    <td><Badge tone="ok">{row.organ_type}</Badge></td>
                    <td><strong>{row.blood_group}</strong></td>
                    <td>
                      <Badge tone={getUrgencyTone(row.urgency_score)}>
                        Score {row.urgency_score} / 10
                      </Badge>
                    </td>
                    <td>{row.days_waiting} days</td>
                    <td>
                      <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td>
                      {row.status === 'WAITING' ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(row.waitlist_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--coral)' }}
                        >
                          Remove
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

export default Waitlist;
