// ============================================================
// Pulse Admin Notifications & Queue Health Page
// Owned by Member B (Phase B4: Admin UI)
// Contract §5, §6:
//   - Route: /admin/notifications (ADMIN only)
//   - GET /admin/notifications (pending/sent/failed counts + recent failures)
//   - POST /admin/jobs/restore-eligibility ("Run eligibility restore now" button)
//   - Coral reserved STRICTLY for failed notifications
// ============================================================

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState } from '../../components/ui';
import './admin.css';

export default function Notifications() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/notifications');
      setData(res);
    } catch (err) {
      console.warn('GET /admin/notifications failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunEligibilityRestore = async () => {
    setJobLoading(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/jobs/restore-eligibility');
      setFeedback({
        type: 'success',
        message: `Eligibility restore completed successfully! Restored ${res.restored ?? 0} donor(s) to eligible status.`,
      });
      // Reload queue data as restore job may have queued ELIGIBLE_AGAIN notifications
      await loadData();
    } catch (err) {
      console.error('Eligibility restore failed:', err);
      setFeedback({
        type: 'coral',
        message: err.message || 'Failed to trigger eligibility restore job.',
      });
    } finally {
      setJobLoading(false);
    }
  };

  const counts = data?.counts || { pending: 0, sent: 0, failed: 0 };
  const failures = Array.isArray(data?.recent_failures) ? data.recent_failures : [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Notification Queue Health"
        subtitle="Monitor background worker dispatch health, retry queues, and trigger manual jobs"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={handleRunEligibilityRestore}
              disabled={jobLoading || loading}
            >
              {jobLoading ? 'Running Job...' : 'Run Eligibility Restore Now'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={loadData}
              disabled={loading}
            >
              Refresh Queue
            </button>
          </div>
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
        <ErrorBox message={error} onRetry={loadData} />
      )}

      {loading && <Spinner label="Loading notification queue metrics..." />}

      {!loading && !data && !error && (
        <EmptyState title="Queue status unavailable">
          Could not retrieve notification metrics from the server.
        </EmptyState>
      )}

      {!loading && data && (
        <>
          {/* Queue Count Cards */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Pending Dispatch</span>
              <span className="admin-stat-card__value">{counts.pending ?? 0}</span>
              <span className="admin-stat-card__subtext">
                {counts.pending > 0 ? (
                  <Badge tone="warn">Queued for next tick</Badge>
                ) : (
                  <Badge tone="ok">Queue Empty</Badge>
                )}
              </span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Successfully Sent</span>
              <span className="admin-stat-card__value">{counts.sent ?? 0}</span>
              <span className="admin-stat-card__subtext">
                <Badge tone="ok">Delivered via provider</Badge>
              </span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-card__title">Failed Deliveries</span>
              <span className="admin-stat-card__value">{counts.failed ?? 0}</span>
              <span className="admin-stat-card__subtext">
                {counts.failed > 0 ? (
                  /* Coral strictly for failed notifications */
                  <Badge tone="critical">{counts.failed} Exceeded Max Retries</Badge>
                ) : (
                  <Badge tone="neutral">0 Failures</Badge>
                )}
              </span>
            </div>
          </div>

          {/* Worker Architecture Note */}
          <Card title="Background Worker Architecture & Diagnostics">
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>How the Dispatcher Operates:</strong> The background notifier worker executes every 30 seconds.
                It fetches up to 20 <Badge tone="neutral">PENDING</Badge> notifications in a transaction using{' '}
                <code style={{ background: 'var(--sand)', padding: '2px 4px', borderRadius: 3 }}>
                  FOR UPDATE SKIP LOCKED
                </code>{' '}
                to prevent race conditions between workers.
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>Fault Isolation:</strong> Notification dispatch is completely decoupled from request creation.
                If the email or SMS gateway is offline, blood requests still succeed immediately while notifications remain safely queued.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Automatic Retries:</strong> Transient network errors increment the <code>attempts</code> counter.
                After 3 consecutive failures, the item is marked as <Badge tone="critical">FAILED</Badge> and surfaced below.
              </p>
            </div>
          </Card>

          {/* Recent Failures Table */}
          <Card title="Recent Dispatch Failures">
            {failures.length === 0 ? (
              <EmptyState title="No failed notifications">
                All queued notifications have either been dispatched successfully or are
                currently awaiting worker processing.
              </EmptyState>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Donor ID</th>
                      <th>Type</th>
                      <th>Channel</th>
                      <th>Subject</th>
                      <th>Attempts</th>
                      <th>Queued At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((item) => (
                      <tr key={item.notification_id}>
                        <td>#{item.notification_id}</td>
                        <td>
                          <strong>Donor #{item.donor_id}</strong>
                        </td>
                        <td>
                          <Badge tone="neutral">{item.type}</Badge>
                        </td>
                        <td>
                          <Badge tone="neutral">{item.channel}</Badge>
                        </td>
                        <td>{item.subject || '—'}</td>
                        <td>
                          <Badge tone="critical">
                            {item.attempts} / 3 Attempts
                          </Badge>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : '—'}
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
