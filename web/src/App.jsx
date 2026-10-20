// ============================================================
// Pulse Main Application & Layout
// Owned by Member C (Web foundation)
// Contract §5:
//   App.jsx + a layout with a role-based sidebar generated from the route table,
//   showing the signed-in user's name, role and a Sign out button.
//   Signed-out users go to /auth; a role without access is redirected home;
//   ADMIN visiting / goes to /admin.
// ============================================================

import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { routesConfig, resolvePageComponent } from './routes.config';
import './App.css';

function NavIcon({ name }) {
  // SVG icons for sidebar links
  switch (name) {
    case 'layout-dashboard':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'user':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'bell':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case 'heart-handshake':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case 'droplet':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
        </svg>
      );
    case 'plus-circle':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case 'users':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'clipboard-list':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>
      );
    case 'git-merge':
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M6 21V9a9 9 0 009 9" />
        </svg>
      );
    case 'shield':
    case 'building':
    case 'user-cog':
    case 'file-text':
    case 'activity':
    default:
      return (
        <svg className="pulse-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
  }
}

function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  // Filter routes visible in sidebar for the current role
  const visibleRoutes = routesConfig.filter(
    (route) => route.label && route.roles.includes(user.role)
  );

  return (
    <>
      {mobileOpen && (
        <div className="pulse-sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`pulse-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="pulse-sidebar__brand">
          <div className="pulse-sidebar__logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 22, height: 22 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className="pulse-sidebar__title">Pulse</div>
            <div className="pulse-sidebar__subtitle">Donor Network</div>
          </div>
        </div>

        <nav className="pulse-sidebar__nav">
          <div className="pulse-sidebar__section-title">Navigation</div>
          {visibleRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              end={route.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `pulse-nav-link ${isActive ? 'active' : ''}`}
            >
              <NavIcon name={route.icon} />
              <span>{route.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="pulse-sidebar__user">
          <div className="pulse-user-card">
            <div className="pulse-user-info">
              <div className="pulse-user-name" title={user.name || 'User'}>
                {user.name || 'Signed-in User'}
              </div>
              <span className={`pulse-user-role pulse-user-role--${user.role?.toLowerCase()}`}>
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="pulse-btn-logout"
              title="Sign Out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MainLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="pulse-layout">
      {user && (
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      )}
      <div className="pulse-main-content">
        {user && (
          <header className="pulse-topbar">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="btn btn-secondary btn-sm pulse-topbar__toggle"
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              {user.role === 'DONOR' && 'Donor Portal'}
              {user.role === 'STAFF' && `Hospital Staff ${user.hospital_id ? `(#${user.hospital_id})` : ''}`}
              {user.role === 'ADMIN' && 'System Administration'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {user.name}
              </span>
            </div>
          </header>
        )}
        <main className="pulse-page-container">{children}</main>
      </div>
    </div>
  );
}

/**
 * RouteGuard checks auth and role permissions according to contract §5:
 * - Signed-out users go to /auth
 * - Signed-in users visiting /auth go to /admin (if ADMIN) or /
 * - ADMIN visiting / goes to /admin
 * - Role without access goes home (/admin if ADMIN else /)
 */
function RouteGuard({ route, component: Component }) {
  const { user } = useAuth();
  const location = useLocation();

  // Route /auth is only for signed-out users
  if (route.path === '/auth') {
    if (user) {
      return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;
    }
    return <Component />;
  }

  // All other routes require auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Contract: ADMIN visiting / goes to /admin
  if (route.path === '/' && user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  // Role check
  if (route.roles && !route.roles.includes(user.role)) {
    const homeUrl = user.role === 'ADMIN' ? '/admin' : '/';
    return <Navigate to={homeUrl} replace />;
  }

  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {routesConfig.map((route) => {
          const Component = resolvePageComponent(route);
          return (
            <Route
              key={route.path}
              path={route.path}
              element={<RouteGuard route={route} component={Component} />}
            />
          );
        })}
        {/* Unknown routes redirect home or to /auth */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;