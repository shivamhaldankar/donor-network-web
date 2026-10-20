// ============================================================
// Pulse Eligible Donors Directory Page
// Owned by Member A (Slice 1: Blood matching, eligibility & donor profile)
// Contract §5, §6:
//   - Route: /donors (STAFF, ADMIN)
//   - Directory of eligible donors from GET /donors/eligible (vw_eligible_donors)
//   - Table columns: Name, Blood Type, City, Last Donation Date.
//   - Privacy rule: phone and email are shielded and NEVER exposed here.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import './Donors.css';

const BLOOD_GROUPS = ['ALL', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export function Donors() {
  const { user } = useAuth();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('ALL');

  const loadEligibleDonors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/donors/eligible');
      setDonors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load eligible donors:', err);
      setError(err.message || 'Could not load eligible donors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEligibleDonors();
  }, [loadEligibleDonors]);

  // Filter donors by search query and blood type
  const filteredDonors = donors.filter((d) => {
    const matchesBlood =
      selectedBloodGroup === 'ALL' || d.blood_type === selectedBloodGroup;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      d.name.toLowerCase().includes(term) ||
      (d.city && d.city.toLowerCase().includes(term));
    return matchesBlood && matchesSearch;
  });

  return (
    <div className="container" style={{ paddingBottom: '48px' }}>
      <PageHeader
        title="Eligible Donors Directory"
        subtitle="Network Directory: Active blood donors currently past their 90-day cooldown period and available for donation matching."
      />

      {error && <ErrorBox message={error} onRetry={loadEligibleDonors} />}

      <Card style={{ marginTop: '20px' }}>
        {/* Toolbar: Search input + Blood Group Pills */}
        <div className="pulse-donors-toolbar">
          <div className="pulse-donors-search">
            <input
              type="text"
              className="input-control"
              placeholder="Search by donor name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="pulse-blood-pills">
            {BLOOD_GROUPS.map((bg) => (
              <button
                key={bg}
                type="button"
                className={`pulse-blood-pill ${selectedBloodGroup === bg ? 'pulse-blood-pill--active' : ''}`}
                onClick={() => setSelectedBloodGroup(bg)}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading eligible donors..." />
        ) : filteredDonors.length === 0 ? (
          <EmptyState title="No donors match your criteria">
            {searchTerm || selectedBloodGroup !== 'ALL'
              ? 'Try adjusting your search query or selecting another blood group.'
              : 'There are currently no active eligible donors registered on the network.'}
          </EmptyState>
        ) : (
          <div className="pulse-table-wrap">
            <div style={{ marginBottom: '10px', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
              Showing <strong>{filteredDonors.length}</strong> eligible donor(s)
            </div>

            <table className="pulse-table">
              <thead>
                <tr>
                  <th>Donor Name</th>
                  <th>Blood Group</th>
                  <th>City</th>
                  <th>Last Donation</th>
                  <th>Availability Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDonors.map((d) => (
                  <tr key={d.donor_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Donor #{d.donor_id}</div>
                    </td>
                    <td>
                      <Badge tone="ok">{d.blood_type}</Badge>
                    </td>
                    <td>{d.city || 'Not specified'}</td>
                    <td>
                      {d.last_donation_date ? (
                        <span>{d.last_donation_date}</span>
                      ) : (
                        <span style={{ color: 'var(--teal)', fontStyle: 'italic' }}>
                          First-time Donor
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge tone="ok">Eligible Now</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Privacy rule notice */}
        <div className="pulse-privacy-callout">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4zm-5 6a1 1 0 100-2 1 1 0 000 2zm4-1a1 1 0 11-2 0 1 1 0 012 0zm3 1a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>Donor Privacy Protection:</strong> Phone numbers and email addresses are shielded. Hospital staff receive contact information only when a donor is actively matched to an emergency request.
          </span>
        </div>
      </Card>
    </div>
  );
}

export default Donors;