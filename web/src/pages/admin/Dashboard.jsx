// ============================================================
// Pulse Admin Dashboard
// Owned by Member B (Phase B4: Admin UI)
// Contract §5, §6:
//   - Route: /admin (ADMIN only)
//   - Stat cards from GET /admin/stats
//   - Notification queue counts
//   - Recent audit entries
//   - Coral reserved STRICTLY for critical/failed states
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './admin.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/stats');
      setStats(data);
    } catch (err) {
      console.warn('GET /admin/stats failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="admin-page">
      <PageHeader
        title="Admin Control Center"
        subtitle={`Welcome, ${user?.name || 'Administrator'} — Pulse network overview and system health`}
        action={
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={loadStats}
            disabled={loading}
          >
            Refresh Metrics
          </button>
        }
      />

      {loading && <Spinner label="Loading system metrics..." />}

      {error && !loading && (
        <ErrorBox message={error} onRetry={loadStats} />
      )}

      {!loading && !error && !stats && (
        <EmptyState title="No statistics available">
          Could not retrieve system statistics at this time.
        </EmptyState>
      )}

      {!loading && !error && stats && (
        <>
          {/* Stat cards grid */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Registered Donors</span>
              <span className="admin-stat-card__value">{stats.users?.donors ?? 0}</span>
              <span className="admin-stat-card__subtext">
                <Badge tone="ok">Active Pool</Badge>
              </span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Hospital Staff</span>
              <span className="admin-stat-card__value">{stats.users?.staff ?? 0}</span>
              <span className="admin-stat-card__subtext">
                Authorized medical personnel
              </span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Partner Hospitals</span>
              <span className="admin-stat-card__value">{stats.hospitals?.total ?? 0}</span>
              <span className="admin-stat-card__subtext">
                {stats.hospitals?.unverified > 0 ? (
                  <Badge tone="warn">{stats.hospitals.unverified} Unverified</Badge>
                ) : (
                  <Badge tone="ok">All Verified</Badge>
                )}
              </span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Queue Status</span>
              <span className="admin-stat-card__value">
                {stats.notifications?.pending ?? 0}
              </span>
              <span className="admin-stat-card__subtext">
                {stats.notifications?.failed > 0 ? (
                  <Badge tone="critical">{stats.notifications.failed} Failed</Badge>
                ) : (
                  <Badge tone="neutral">0 Failures</Badge>
                )}
              </span>
            </div>
          </div>

          {/* Quick Admin Actions */}
          <Card title="Quick Management Navigation">
            <div className="admin-quick-links">
              <Link to="/admin/hospitals" className="admin-quick-link-card">
                <span className="admin-quick-link-card__title">
                  Verify Hospitals
                  {stats.hospitals?.unverified > 0 && (
                    <Badge tone="warn">{stats.hospitals.unverified} pending</Badge>
                  )}
                </span>
                <span className="admin-quick-link-card__desc">
                  Review and authorize partner medical facilities
                </span>
              </Link>

              <Link to="/admin/users" className="admin-quick-link-card">
                <span className="admin-quick-link-card__title">
                  User Management
                </span>
                <span className="admin-quick-link-card__desc">
                  Activate or deactivate donors and hospital staff accounts
                </span>
              </Link>

              <Link to="/admin/notifications" className="admin-quick-link-card">
                <span className="admin-quick-link-card__title">
                  Queue Health
                  {stats.notifications?.failed > 0 && (
                    <Badge tone="critical">{stats.notifications.failed} failed</Badge>
                  )}
                </span>
                <span className="admin-quick-link-card__desc">
                  Inspect dispatch worker status and run manual eligibility jobs
                </span>
              </Link>

              <Link to="/admin/audit" className="admin-quick-link-card">
                <span className="admin-quick-link-card__title">
                  Audit Trail
                </span>
                <span className="admin-quick-link-card__desc">
                  Inspect immutable system logs and trigger records
                </span>
              </Link>
            </div>
          </Card>

          {/* Recent Audit Log */}
          <Card
            title="Recent Audit Activity"
            action={
              <Link to="/admin/audit" className="admin-btn admin-btn--secondary admin-btn--sm">
                View Full Audit Log
              </Link>
            }
          >
            {(!stats.recent_audit || stats.recent_audit.length === 0) ? (
              <EmptyState title="No recent audit events">
                System activities will be automatically recorded here by database triggers.
              </EmptyState>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_audit.map((entry) => (
                      <tr key={entry.log_id}>
                        <td>
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : '—'}
                        </td>
                        <td>
                          <span className="admin-audit-actor">
                            <Badge tone="neutral">
                              {entry.actor_role || 'SYSTEM'}
                              {entry.actor_id ? ` #${entry.actor_id}` : ''}
                            </Badge>
                          </span>
                        </td>
                        <td>
                          <span className="admin-audit-action">{entry.action}</span>
                        </td>
                        <td>
                          {entry.entity ? `${entry.entity} #${entry.entity_id}` : '—'}
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
    </div>
  );
}
