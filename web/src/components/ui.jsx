// ============================================================
// Pulse Shared UI Components
// Owned by Member C (Web foundation)
// Contract §5:
//   export { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState, ComingSoonPlaceholder };
//   <PageHeader title subtitle />  <Card title>…</Card>
//   <Badge tone="ok|warn|critical|neutral">…</Badge>
//   <Spinner />  <ErrorBox message />  <EmptyState>text</EmptyState>
// ============================================================

import React from 'react';
import './ui.css';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="pulse-page-header">
      <div>
        <h1 className="pulse-page-header__title">{title}</h1>
        {subtitle && <p className="pulse-page-header__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="pulse-page-header__actions">{action}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', headerExtra }) {
  return (
    <div className={`pulse-card ${className}`}>
      {(title || action || headerExtra) && (
        <div className="pulse-card__header">
          {title && <h3 className="pulse-card__title">{title}</h3>}
          {headerExtra}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="pulse-card__body">{children}</div>
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const validTone = ['ok', 'warn', 'critical', 'neutral'].includes(tone) ? tone : 'neutral';
  return (
    <span className={`pulse-badge pulse-badge--${validTone} ${className}`}>
      {children}
    </span>
  );
}

export function Spinner({ size = 'md', label = 'Loading...' }) {
  const sizeClass = size === 'sm' ? 'pulse-spinner--sm' : size === 'lg' ? 'pulse-spinner--lg' : '';
  return (
    <div className="pulse-spinner-container" role="status" aria-live="polite">
      <div className={`pulse-spinner ${sizeClass}`} />
      {label && <span className="pulse-spinner__label">{label}</span>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="pulse-error-box" role="alert">
      <svg className="pulse-error-box__icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <div className="pulse-error-box__content">
        {typeof message === 'string' ? message : message.message || 'An error occurred'}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="pulse-error-box__retry">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon, action }) {
  return (
    <div className="pulse-empty-state">
      {icon ? (
        <div className="pulse-empty-state__icon">{icon}</div>
      ) : (
        <svg className="pulse-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M9.5 15.5c1 1 4 1 5 0" />
        </svg>
      )}
      {title && <h4 className="pulse-empty-state__title">{title}</h4>}
      <div className="pulse-empty-state__text">{children}</div>
      {action && <div className="pulse-empty-state__action">{action}</div>}
    </div>
  );
}

export function ComingSoonPlaceholder({ label, pageFile, owner }) {
  return (
    <div style={{ maxWidth: 800, margin: '24px auto' }}>
      <Card title={label || 'Coming Soon'}>
        <EmptyState
          title={`${label || 'Page'} — Under Development`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48, color: 'var(--ink-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <p style={{ marginBottom: 12 }}>
            This feature is scheduled in the project plan.
          </p>
          <div style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--sand)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            Target file: <code>src/{pageFile}</code> (Owner: {owner})
          </div>
        </EmptyState>
      </Card>
    </div>
  );
}

export default { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState, ComingSoonPlaceholder };
