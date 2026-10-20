// ============================================================
// Pulse Donor Profile Page
// Owned by Member A (Slice 1: Blood matching, eligibility & donor profile)
// Contract §5, §6:
//   - Route: /profile (DONOR)
//   - Eligibility countdown: ring or progress bar showing days_remaining out of 90.
//     "Eligible now" in teal when is_eligible, otherwise days left & next_eligible_date.
//     NEVER use coral here (coral is strictly for critical requests).
//   - Donation history (GET /donors/me/donations)
//   - Matches received with Accept / Decline (POST /matches/:id/respond)
//   - Edit form: phone, city, LocationPicker, notify_email, notify_sms (PUT /donors/me)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import { LocationPicker } from '../components/LocationPicker';
import './Profile.css';

export function Profile() {
  const { user } = useAuth();

  // Data states
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [donations, setDonations] = useState([]);

  // UI status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [respondingMatchId, setRespondingMatchId] = useState(null);

  // Form states
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  // Load all donor profile data
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, matchesData, donationsData] = await Promise.all([
        api.get('/donors/me'),
        api.get('/donors/me/matches'),
        api.get('/donors/me/donations'),
      ]);

      setProfile(profileData);
      setMatches(Array.isArray(matchesData) ? matchesData : []);
      setDonations(Array.isArray(donationsData) ? donationsData : []);

      // Initialize form fields
      setPhone(profileData.phone || '');
      setCity(profileData.city || '');
      setLocation({
        latitude: profileData.latitude ?? null,
        longitude: profileData.longitude ?? null,
      });
      setNotifyEmail(Boolean(profileData.notify_email));
      setNotifySms(Boolean(profileData.notify_sms));
    } catch (err) {
      console.error('Failed to load donor profile data:', err);
      setError(err.message || 'Could not load profile. Please make sure the backend is reachable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Handle profile update form submission
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updated = await api.put('/donors/me', {
        name: profile?.name,
        phone: phone.trim(),
        city: city.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        notify_email: notifyEmail,
        notify_sms: notifySms,
      });

      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Handle responding to a match (Accept / Decline)
  const handleMatchResponse = async (matchId, responseChoice) => {
    setRespondingMatchId(matchId);
    setError(null);

    try {
      const res = await api.post(`/matches/${matchId}/respond`, { response: responseChoice });
      // Update match locally
      setMatches((prev) =>
        prev.map((m) =>
          m.match_id === matchId
            ? { ...m, contacted_status: res.contacted_status, responded_on: res.responded_on }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to respond to match:', err);
      setError(err.message || `Failed to record match response: ${err.message}`);
    } finally {
      setRespondingMatchId(null);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px 16px' }}>
        <Spinner size="lg" label="Loading donor profile..." />
      </div>
    );
  }

  const isEligible = Boolean(profile?.is_eligible);
  const daysRemaining = profile?.days_remaining ?? 0;
  const totalDays = profile?.total_days || 90;

  // SVG circular progress calculation
  // Radius = 66, Circumference = 2 * PI * 66 ≈ 414.69
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  // Progress fraction (0 to 1), where 1 = 100% eligible (0 days remaining)
  const progressRatio = isEligible ? 1 : Math.max(0, Math.min(1, (totalDays - daysRemaining) / totalDays));
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="container" style={{ paddingBottom: '48px' }}>
      <PageHeader
        title="Donor Profile & Availability"
        subtitle={`Welcome, ${profile?.name || user?.name || 'Donor'}. View your blood donation cooldown status, emergency matches, and settings.`}
      />

      {error && <ErrorBox message={error} onRetry={loadProfileData} />}

      <div className="pulse-profile-grid" style={{ marginTop: '20px' }}>
        {/* Left Column: Eligibility Countdown & Quick Bio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="Eligibility Countdown">
            <div className="pulse-countdown-card">
              <div className="pulse-profile-blood-tag">
                {profile?.blood_type || 'O+'}
              </div>

              {/* Progress Ring */}
              <div className="pulse-countdown-ring-wrap">
                <svg className="pulse-countdown-svg" viewBox="0 0 160 160">
                  <circle
                    className="pulse-countdown-bg"
                    cx="80"
                    cy="80"
                    r={radius}
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    className="pulse-countdown-progress"
                    cx="80"
                    cy="80"
                    r={radius}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>

                <div className="pulse-countdown-inner">
                  {isEligible ? (
                    <>
                      <span className="pulse-countdown-number" style={{ fontSize: '1.6rem' }}>Ready</span>
                      <span className="pulse-countdown-unit">Eligible</span>
                    </>
                  ) : (
                    <>
                      <span className="pulse-countdown-number">{daysRemaining}</span>
                      <span className="pulse-countdown-unit">Days Left</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Indicator (Strictly Teal or Sand/Neutral - NEVER Coral) */}
              <div>
                {isEligible ? (
                  <div className="pulse-countdown-badge-eligible">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Eligible now</span>
                  </div>
                ) : (
                  <div className="pulse-countdown-badge-ineligible">
                    <span>90-day cooldown active</span>
                  </div>
                )}
              </div>

              <p className="pulse-countdown-info">
                {isEligible ? (
                  'You are in good standing to respond to urgent blood requests and donate.'
                ) : (
                  <>
                    Next eligible date:{' '}
                    <span className="pulse-countdown-date">
                      {profile?.next_eligible_date || 'In 60 days'}
                    </span>
                  </>
                )}
              </p>

              {profile?.last_donation_date && (
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                  Last blood donation: {profile.last_donation_date}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Account Info */}
          <Card title="Account Info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>Email (Login ID): </span>
                <span style={{ fontWeight: 600 }}>{profile?.email}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>Blood Group: </span>
                <span style={{ fontWeight: 600 }}>{profile?.blood_type}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>City: </span>
                <span style={{ fontWeight: 600 }}>{profile?.city || 'Not specified'}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Emergency Matches, Donation History, and Profile Edit Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section: Received Emergency Matches */}
          <Card title="Emergency Blood Matches Received">
            {matches.length === 0 ? (
              <EmptyState title="No match requests at this time">
                When nearby hospitals raise critical requests matching your blood type, you will be notified here immediately.
              </EmptyState>
            ) : (
              <div className="pulse-match-list">
                {matches.map((m) => {
                  const isCritical = m.urgency === 'CRITICAL';
                  const isPending = m.contacted_status === 'PENDING' || m.contacted_status === 'CONTACTED';
                  const distanceLabel =
                    m.distance_km !== null && m.distance_km !== undefined
                      ? `${m.distance_km} km away`
                      : `in ${m.hospital_city || 'your city'}`;

                  return (
                    <div
                      key={m.match_id}
                      className={`pulse-match-card ${isCritical ? 'pulse-match-card--critical' : ''}`}
                    >
                      <div className="pulse-match-card__header">
                        <div>
                          <h4 className="pulse-match-card__hospital">{m.hospital_name}</h4>
                          <span className="pulse-match-card__city">{m.hospital_city} • {distanceLabel}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <Badge tone="ok">{m.blood_type_needed || profile?.blood_type}</Badge>
                          {/* Coral Badge ONLY for CRITICAL urgency */}
                          <Badge tone={isCritical ? 'critical' : 'warn'}>
                            {m.urgency}
                          </Badge>
                        </div>
                      </div>

                      <div className="pulse-match-card__meta">
                        <span>Matched on: {m.matched_on ? new Date(m.matched_on).toLocaleDateString() : 'Recent'}</span>
                        <span>•</span>
                        <span>
                          Status:{' '}
                          <strong style={{ color: m.contacted_status === 'ACCEPTED' ? 'var(--teal)' : 'inherit' }}>
                            {m.contacted_status}
                          </strong>
                        </span>
                      </div>

                      {isPending ? (
                        <div className="pulse-match-card__actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={respondingMatchId === m.match_id}
                            onClick={() => handleMatchResponse(m.match_id, 'ACCEPTED')}
                          >
                            {respondingMatchId === m.match_id ? 'Recording...' : 'Accept Request'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={respondingMatchId === m.match_id}
                            onClick={() => handleMatchResponse(m.match_id, 'DECLINED')}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                          Responded: {m.contacted_status} {m.responded_on ? `(${new Date(m.responded_on).toLocaleDateString()})` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Section: Donation History */}
          <Card title="Donation History">
            {donations.length === 0 ? (
              <EmptyState title="No recorded donations yet">
                When you donate at a verified hospital, staff will log the donation and it will appear here.
              </EmptyState>
            ) : (
              <div className="pulse-table-wrap">
                <table className="pulse-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Units</th>
                      <th>Hospital</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.donation_id}>
                        <td>{d.donated_on}</td>
                        <td>
                          <Badge tone={d.donation_type === 'BLOOD' ? 'ok' : 'neutral'}>
                            {d.donation_type}
                          </Badge>
                        </td>
                        <td>{d.units || 1} unit(s)</td>
                        <td>{d.hospital_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Section: Profile & Notification Settings */}
          <Card title="Edit Contact Details & Notification Settings">
            {saveSuccess && (
              <div
                style={{
                  backgroundColor: 'var(--teal-light)',
                  border: '1px solid var(--teal)',
                  color: 'var(--teal)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                }}
              >
                Profile settings successfully saved.
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="pulse-form-grid">
                <div>
                  <label htmlFor="phone-input" className="form-label">Phone Number</label>
                  <input
                    id="phone-input"
                    type="tel"
                    className="input-control"
                    placeholder="e.g. 9811111111"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="city-input" className="form-label">City</label>
                  <input
                    id="city-input"
                    type="text"
                    className="input-control"
                    placeholder="e.g. Pune"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              {/* Geographic Coordinates via LocationPicker */}
              <div style={{ marginTop: '16px' }}>
                <LocationPicker
                  value={location}
                  onChange={(newLoc) => setLocation(newLoc)}
                />
              </div>

              {/* Notification Preferences */}
              <div style={{ marginTop: '20px' }}>
                <label className="form-label">Notification Preferences</label>
                <div className="pulse-toggle-group">
                  <label className="pulse-toggle-label">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                    />
                    <span>Email notifications (matches and eligibility restore alerts)</span>
                  </label>

                  <label className="pulse-toggle-label">
                    <input
                      type="checkbox"
                      checked={notifySms}
                      onChange={(e) => setNotifySms(e.target.checked)}
                    />
                    <span>SMS text alerts (requires valid phone number)</span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving changes...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Profile;
