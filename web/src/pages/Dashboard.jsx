// ============================================================
// Pulse Main Dashboard
// Owned by Member C (Web foundation & dashboards)
// Contract §5, §6:
//   - Donor view: eligibility status and next eligible date from GET /donors/me, plus open matches
//   - Staff view: GET /stats/staff cards and critical requests from GET /requests/critical
//   - Coral ONLY for critical requests
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import './Dashboard.css';

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Donor state
  const [donorProfile, setDonorProfile] = useState(null);
  const [donorMatches, setDonorMatches] = useState([]);

  // Staff state
  const [staffStats, setStaffStats] = useState(null);
  const [criticalRequests, setCriticalRequests] = useState([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        if (user?.role === 'DONOR') {
          // Fetch donor profile & open matches
          try {
            const profile = await api.get('/donors/me');
            if (isMounted) setDonorProfile(profile);
          } catch (err) {
            console.warn('GET /donors/me fallback', err);
            // In dev mode before Member A's API is ready:
            if (isMounted) {
              setDonorProfile({
                name: user.name || 'Aarav Shah',
                blood_type: 'O+',
                is_eligible: true,
                days_remaining: 0,
                next_eligible_date: 'Immediate',
                last_donation_date: null,
              });
            }
          }

          try {
            const matches = await api.get('/donors/me/matches');
            if (isMounted) setDonorMatches(Array.isArray(matches) ? matches : []);
          } catch {
            if (isMounted) setDonorMatches([]);
          }
        } else if (user?.role === 'STAFF') {
          // Fetch staff stats and critical requests
          try {
            const stats = await api.get('/stats/staff');
            if (isMounted) setStaffStats(stats);
          } catch (err) {
            console.warn('GET /stats/staff fallback', err);
            if (isMounted) {
              setStaffStats({
                open_critical_requests: 1,
                eligible_donors: 8,
                waitlist_size: 6,
              });
            }
          }

          try {
            const critical = await api.get('/requests/critical');
            if (isMounted) setCriticalRequests(Array.isArray(critical) ? critical : []);
          } catch (err) {
            console.warn('GET /requests/critical fallback', err);
            if (isMounted) {
              setCriticalRequests([
                {
                  request_id: 101,
                  hospital: 'City Care Hospital',
                  blood_type_needed: 'O+',
                  patient_name: 'Patient Vikram',
                  urgency: 'CRITICAL',
                  days_open: 1,
                },
              ]);
            }
          }
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return <Spinner label="Loading dashboard data..." />;
  }

  return (
    <div className="pulse-dashboard">
      <PageHeader
        title={`Welcome back, ${user?.name || 'Pulse Member'}`}
        subtitle={
          user?.role === 'DONOR'
            ? 'Track your real-time eligibility countdown, donation history, and emergency requests.'
            : 'Hospital Operations Overview — Monitor critical shortages and patient waiting lists.'
        }
      />

      {error && <ErrorBox message={error} />}

      {/* ================= DONOR VIEW ================= */}
      {user?.role === 'DONOR' && (
        <>
          {/* Eligibility Hero Card */}
          <div className="pulse-donor-eligibility-hero">
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal)' }}>
                Donation Eligibility Status
              </span>
              <h2 style={{ fontSize: 24, marginTop: 4 }}>
                {donorProfile?.is_eligible ? 'You are Eligible to Donate Now!' : 'Donation Cooldown in Progress'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 4, maxWidth: 520 }}>
                {donorProfile?.is_eligible
                  ? 'Your blood profile is active. If a nearby trauma center or emergency ICU urgently requires your blood group, you will receive an alert.'
                  : `A 90-day cooldown period is enforced for safety. Your next eligible donation date is ${donorProfile?.next_eligible_date || 'soon'}.`}
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <Link to="/organ-pledges" className="btn btn-secondary btn-sm">
                  Manage Organ Pledges
                </Link>
                <Link to="/profile" className="btn btn-secondary btn-sm">
                  View Full Profile
                </Link>
              </div>
            </div>

            <div className="pulse-countdown-ring-box">
              <div
                className={`pulse-countdown-badge ${!donorProfile?.is_eligible ? 'pulse-countdown-badge--waiting' : ''}`}
                title="Days Remaining"
              >
                {donorProfile?.days_remaining ?? 0}d
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {donorProfile?.is_eligible ? 'Ready for Donation' : `${donorProfile?.days_remaining} Days Remaining`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Blood Group: <strong>{donorProfile?.blood_type || 'Unknown'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Open Emergency Matches for this Donor */}
          <Card title="Emergency Matches Awaiting Your Response">
            {donorMatches.length === 0 ? (
              <EmptyState title="No Open Urgent Matches">
                You currently have no pending emergency donation requests. We will notify you when a patient near you needs your blood group.
              </EmptyState>
            ) : (
              <div className="pulse-table-container">
                <table className="pulse-table">
                  <thead>
                    <tr>
                      <th>Hospital</th>
                      <th>City</th>
                      <th>Blood Type</th>
                      <th>Urgency</th>
                      <th>Distance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donorMatches.map((m) => (
                      <tr key={m.match_id}>
                        <td><strong>{m.hospital_name}</strong></td>
                        <td>{m.hospital_city}</td>
                        <td><Badge tone="ok">{m.blood_type_needed}</Badge></td>
                        <td><Badge tone="critical">{m.urgency}</Badge></td>
                        <td>{m.distance_km != null ? `${m.distance_km} km` : 'Same city'}</td>
                        <td>
                          <Link to="/profile" className="btn btn-primary btn-sm">
                            Respond
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ================= STAFF VIEW ================= */}
      {user?.role === 'STAFF' && (
        <>
          {/* Key Metrics Cards */}
          <div className="pulse-stats-grid">
            <div className={`pulse-stat-card ${staffStats?.open_critical_requests > 0 ? 'pulse-stat-card--critical' : ''}`}>
              <div className="pulse-stat-card__label">Open Critical Requests</div>
              <div className="pulse-stat-card__value">
                {staffStats?.open_critical_requests ?? 0}
              </div>
              <div className="pulse-stat-card__subtext">Urgent cases requiring immediate blood</div>
            </div>

            <div className="pulse-stat-card">
              <div className="pulse-stat-card__label">Eligible Donors in Region</div>
              <div className="pulse-stat-card__value" style={{ color: 'var(--teal)' }}>
                {staffStats?.eligible_donors ?? 0}
              </div>
              <div className="pulse-stat-card__subtext">Ready for immediate dispatch matching</div>
            </div>

            <div className="pulse-stat-card">
              <div className="pulse-stat-card__label">Organ Waiting List Patients</div>
              <div className="pulse-stat-card__value">
                {staffStats?.waitlist_size ?? 0}
              </div>
              <div className="pulse-stat-card__subtext">Active patients registered at your hospital</div>
            </div>
          </div>

          {/* Urgent Cases Table */}
          <Card
            title="Critical Open Requests (Immediate Priority)"
            action={
              <Link to="/requests" className="btn btn-coral btn-sm">
                + Create Emergency Request
              </Link>
            }
          >
            {criticalRequests.length === 0 ? (
              <EmptyState title="No Critical Requests Pending">
                Your hospital currently has no open critical blood or organ requests.
              </EmptyState>
            ) : (
              <div className="pulse-table-container">
                <table className="pulse-table">
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Patient</th>
                      <th>Needed</th>
                      <th>Urgency</th>
                      <th>Days Open</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalRequests.map((req) => (
                      <tr key={req.request_id} className="critical-row">
                        <td>#{req.request_id}</td>
                        <td><strong>{req.patient_name || 'Emergency Patient'}</strong></td>
                        <td>
                          <Badge tone="ok">{req.blood_type_needed || req.organ_type_needed}</Badge>
                        </td>
                        <td>
                          <Badge tone="critical">CRITICAL</Badge>
                        </td>
                        <td>{req.days_open != null ? `${req.days_open}d` : 'Today'}</td>
                        <td>
                          <Link to="/requests" className="btn btn-secondary btn-sm">
                            View Matches
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Quick Shortcuts for Staff */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Organ Transplantation Matching">
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 14 }}>
                Review active donor pledges and run the multi-criteria matching algorithm to find compatible recipients based on ABO compatibility, urgency, and distance.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link to="/organ-matching" className="btn btn-primary btn-sm">
                  Run Organ Matching
                </Link>
                <Link to="/organ-waitlist" className="btn btn-secondary btn-sm">
                  Manage Waitlist
                </Link>
              </div>
            </Card>

            <Card title="Blood Donations & Dispatch">
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 14 }}>
                Record completed blood donations to automatically trigger donor cooldown and fulfill hospital requests, or browse the active verified donor directory.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link to="/donations" className="btn btn-primary btn-sm">
                  Log Blood Donation
                </Link>
                <Link to="/donors" className="btn btn-secondary btn-sm">
                  Browse Eligible Donors
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
