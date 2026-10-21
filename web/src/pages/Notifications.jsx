// ============================================================
// Pulse Donor Notifications Page
// Owned by Member B (Phase B4: Frontend UI)
// Contract §5, §6:
//   - Route: /notifications (DONOR only)
//   - GET /notifications/me (latest 50 notifications)
//   - Displays channel and status badges
//   - Coral reserved STRICTLY for failed notification states
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../components/ui';
import './Notifications.css';

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL' | 'EMAIL' | 'SMS'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'MATCH' | 'ELIGIBLE_AGAIN'

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/notifications/me');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('GET /notifications/me failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Filter list
  const filteredNotifications = notifications.filter((notif) => {
    const matchesChannel =
      channelFilter === 'ALL' || notif.channel === channelFilter;
    const matchesType =
      typeFilter === 'ALL' || notif.type === typeFilter;
    return matchesChannel && matchesType;
  });

  return (
    <div className="notifications-page">
      <PageHeader
        title="My Notifications"
        subtitle={`Alerts and updates for ${user?.name || 'Donor'} regarding local blood matches and eligibility`}
        action={
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={loadNotifications}
            disabled={loading}
          >
            Refresh Alerts
          </button>
        }
      />

      {error && !loading && (
        <ErrorBox message={error} onRetry={loadNotifications} />
      )}

      {/* Filter toolbar if notifications exist */}
      {!loading && notifications.length > 0 && (
        <Card>
          <div className="admin-toolbar" style={{ marginBottom: 0 }}>
            <div className="admin-toolbar__left">
              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab-btn ${channelFilter === 'ALL' ? 'admin-tab-btn--active' : ''}`}
                  onClick={() => setChannelFilter('ALL')}
                >
                  All Channels ({notifications.length})
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${channelFilter === 'EMAIL' ? 'admin-tab-btn--active' : ''}`}
                  onClick={() => setChannelFilter('EMAIL')}
                >
                  Email ({notifications.filter((n) => n.channel === 'EMAIL').length})
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${channelFilter === 'SMS' ? 'admin-tab-btn--active' : ''}`}
                  onClick={() => setChannelFilter('SMS')}
                >
                  SMS ({notifications.filter((n) => n.channel === 'SMS').length})
                </button>
              </div>

              <select
                className="admin-search-input"
                style={{ minWidth: 160 }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Alert Types</option>
                <option value="MATCH">Urgent Blood Matches</option>
                <option value="ELIGIBLE_AGAIN">Eligibility Restores</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </span>
            </div>
          </div>
        </Card>
      )}

      {loading && <Spinner label="Loading your notification alerts..." />}

      {!loading && notifications.length === 0 && (
        <EmptyState title="No notifications yet">
          <p>
            When a hospital within your designated area creates an urgent blood request matching
            your blood type, you will receive real-time notifications here.
          </p>
          <p style={{ marginTop: 8 }}>
            You will also be notified when the 90-day cooldown period elapses and you become eligible to donate again.
          </p>
        </EmptyState>
      )}

      {!loading && notifications.length > 0 && filteredNotifications.length === 0 && (
        <EmptyState title="No notifications match the chosen filter">
          Try selecting "All Channels" or resetting the alert type dropdown.
        </EmptyState>
      )}

      {!loading && filteredNotifications.length > 0 && (
        <div className="notifications-list">
          {filteredNotifications.map((notif) => {
            const isSent = notif.status === 'SENT';
            const isFailed = notif.status === 'FAILED';
            const isPending = notif.status === 'PENDING';

            return (
              <div key={notif.notification_id} className="notification-card">
                <div className="notification-card__header">
                  <div className="notification-card__meta">
                    {/* Notification Type badge */}
                    <Badge
                      tone={
                        notif.type === 'MATCH'
                          ? 'ok'
                          : notif.type === 'ELIGIBLE_AGAIN'
                          ? 'warn'
                          : 'neutral'
                      }
                    >
                      {notif.type === 'MATCH'
                        ? 'Match Alert'
                        : notif.type === 'ELIGIBLE_AGAIN'
                        ? 'Eligible Again'
                        : notif.type}
                    </Badge>

                    {/* Channel badge */}
                    <Badge tone="neutral">
                      {notif.channel === 'EMAIL' ? 'Email' : notif.channel === 'SMS' ? 'SMS' : notif.channel}
                    </Badge>

                    {/* Delivery Status badge - Coral STRICTLY for failed */}
                    {isSent && <Badge tone="ok">Delivered</Badge>}
                    {isPending && <Badge tone="warn">Queued</Badge>}
                    {isFailed && <Badge tone="critical">Failed Delivery</Badge>}
                  </div>

                  <span className="notification-card__time">
                    {notif.sent_at
                      ? `Sent ${new Date(notif.sent_at).toLocaleString()}`
                      : notif.created_at
                      ? `Queued ${new Date(notif.created_at).toLocaleString()}`
                      : '—'}
                  </span>
                </div>

                {notif.subject && (
                  <h3 className="notification-card__subject">{notif.subject}</h3>
                )}

                <div className="notification-card__body">
                  {notif.message}
                </div>

                <div className="notification-card__footer">
                  <span>
                    Notification #{notif.notification_id}
                  </span>
                  {notif.sent_at && notif.created_at && (
                    <span>
                      Delivery delay:{' '}
                      {Math.max(
                        0,
                        Math.round(
                          (new Date(notif.sent_at).getTime() -
                            new Date(notif.created_at).getTime()) /
                            1000
                        )
                      )}
                      s
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
