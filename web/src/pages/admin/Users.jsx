// ============================================================
// Pulse Admin User Management Page
// Owned by Member B (Phase B4: Admin UI)
// Contract §5, §6:
//   - Route: /admin/users (ADMIN only)
//   - GET /admin/users (donors and staff lists)
//   - PATCH /admin/users/:role/:id/active ({ is_active: boolean })
//   - Activate / Deactivate toggles for donors and hospital staff
//   - Writes audit log via lib/audit.js
// ============================================================

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './admin.css';

export default function Users() {
  const [usersData, setUsersData] = useState({ donors: [], staff: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('DONORS'); // 'DONORS' | 'STAFF'
  const [search, setSearch] = useState('');
  const [updatingKey, setUpdatingKey] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/users');
      setUsersData({
        donors: Array.isArray(data?.donors) ? data.donors : [],
        staff: Array.isArray(data?.staff) ? data.staff : [],
      });
    } catch (err) {
      console.warn('GET /admin/users failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (role, item) => {
    const isDonor = role === 'donor';
    const id = isDonor ? item.donor_id : item.staff_id;
    const nextActive = !item.is_active;
    const actionLabel = nextActive ? 'activate' : 'deactivate';

    const confirmMsg = nextActive
      ? `Re-activate ${role} account for ${item.name} (${item.email})?`
      : `Deactivate ${role} account for ${item.name}? This will prevent them from signing in.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const key = `${role}-${id}`;
    setUpdatingKey(key);
    setFeedback(null);
    setError(null);

    try {
      await api.patch(`/admin/users/${role}/${id}/active`, {
        is_active: nextActive,
      });

      // Update state locally
      setUsersData((prev) => {
        if (isDonor) {
          return {
            ...prev,
            donors: prev.donors.map((d) =>
              d.donor_id === id ? { ...d, is_active: nextActive } : d
            ),
          };
        } else {
          return {
            ...prev,
            staff: prev.staff.map((s) =>
              s.staff_id === id ? { ...s, is_active: nextActive } : s
            ),
          };
        }
      });

      setFeedback({
        type: 'success',
        message: `Account for "${item.name}" was successfully ${nextActive ? 'activated' : 'deactivated'}.`,
      });
    } catch (err) {
      console.error(`Failed to ${actionLabel} user:`, err);
      setError(err);
    } finally {
      setUpdatingKey(null);
    }
  };

  // Filter current list
  const currentList = activeTab === 'DONORS' ? usersData.donors : usersData.staff;
  const filteredList = currentList.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const nameMatch = item.name && item.name.toLowerCase().includes(q);
    const emailMatch = item.email && item.email.toLowerCase().includes(q);
    const hospitalMatch =
      item.hospital_name && item.hospital_name.toLowerCase().includes(q);
    return nameMatch || emailMatch || hospitalMatch;
  });

  const deactivatedDonorsCount = usersData.donors.filter((d) => !d.is_active).length;
  const deactivatedStaffCount = usersData.staff.filter((s) => !s.is_active).length;

  return (
    <div className="admin-page">
      <PageHeader
        title="User Management"
        subtitle="Manage authorization and access status for blood/organ donors and hospital staff"
        action={
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={loadUsers}
            disabled={loading}
          >
            Refresh Users
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
        <ErrorBox message={error} onRetry={loadUsers} />
      )}

      <Card>
        {/* Navigation tabs & search */}
        <div className="admin-toolbar">
          <div className="admin-toolbar__left">
            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'DONORS' ? 'admin-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveTab('DONORS');
                  setSearch('');
                }}
              >
                Donors ({usersData.donors.length})
                {deactivatedDonorsCount > 0 && (
                  <span style={{ marginLeft: 6 }}>
                    <Badge tone="critical">{deactivatedDonorsCount} inactive</Badge>
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'STAFF' ? 'admin-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveTab('STAFF');
                  setSearch('');
                }}
              >
                Hospital Staff ({usersData.staff.length})
                {deactivatedStaffCount > 0 && (
                  <span style={{ marginLeft: 6 }}>
                    <Badge tone="critical">{deactivatedStaffCount} inactive</Badge>
                  </span>
                )}
              </button>
            </div>

            <input
              type="text"
              className="admin-search-input"
              placeholder={`Search ${activeTab === 'DONORS' ? 'donors' : 'staff'} by name or email...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && <Spinner label="Loading user accounts..." />}

        {!loading && currentList.length === 0 && (
          <EmptyState
            title={`No ${activeTab === 'DONORS' ? 'donors' : 'staff members'} registered`}
          >
            There are currently no accounts in this user category.
          </EmptyState>
        )}

        {!loading && currentList.length > 0 && filteredList.length === 0 && (
          <EmptyState title="No matching accounts found">
            No accounts match your search filter "{search}".
          </EmptyState>
        )}

        {!loading && filteredList.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  {activeTab === 'STAFF' && <th>Hospital Affiliation</th>}
                  <th>Account Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item) => {
                  const role = activeTab === 'DONORS' ? 'donor' : 'staff';
                  const id = activeTab === 'DONORS' ? item.donor_id : item.staff_id;
                  const key = `${role}-${id}`;
                  const isUpdating = updatingKey === key;

                  return (
                    <tr key={key}>
                      <td>#{id}</td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.email}</td>
                      {activeTab === 'STAFF' && (
                        <td>
                          <strong>{item.hospital_name || '—'}</strong>
                        </td>
                      )}
                      <td>
                        {item.is_active ? (
                          <Badge tone="ok">Active</Badge>
                        ) : (
                          /* Coral strictly reserved for inactive/critical states */
                          <Badge tone="critical">Deactivated</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.is_active ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--critical admin-btn--sm"
                            onClick={() => handleToggleActive(role, item)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Updating...' : 'Deactivate'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary admin-btn--sm"
                            onClick={() => handleToggleActive(role, item)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Updating...' : 'Activate'}
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
