// ============================================================
// Pulse Route Registry & Dynamic Page Loader
// Owned by Member C (Web foundation)
// Contract §5:
//   src/routes.config.js lists every route with its roles and page file.
//   Pages are loaded with import.meta.glob('./pages/**/*.jsx'),
//   and a missing file shows a "Coming soon" placeholder.
//   To add a page, teammates just create the file at the listed path with a default export.
// ============================================================

import React from 'react';
import { ComingSoonPlaceholder } from './components/ui';

// Synchronously load all existing page components under ./pages/
const pageModules = import.meta.glob('./pages/**/*.jsx', { eager: true });

export const routesConfig = [
  {
    path: '/auth',
    roles: ['signed-out'],
    pageFile: 'pages/Auth.jsx',
    owner: 'C',
    label: null, // No sidebar item
  },
  {
    path: '/',
    roles: ['DONOR', 'STAFF'], // ADMIN redirects to /admin
    pageFile: 'pages/Dashboard.jsx',
    owner: 'C',
    label: 'Dashboard',
    icon: 'layout-dashboard',
  },
  {
    path: '/profile',
    roles: ['DONOR'],
    pageFile: 'pages/Profile.jsx',
    owner: 'A',
    label: 'My Profile',
    icon: 'user',
  },
  {
    path: '/notifications',
    roles: ['DONOR'],
    pageFile: 'pages/Notifications.jsx',
    owner: 'B',
    label: 'Notifications',
    icon: 'bell',
  },
  {
    path: '/organ-pledges',
    roles: ['DONOR'],
    pageFile: 'pages/organ/Pledges.jsx',
    owner: 'C',
    label: 'Organ Pledges',
    icon: 'heart-handshake',
  },
  {
    path: '/requests',
    roles: ['STAFF', 'ADMIN'],
    pageFile: 'pages/Requests.jsx',
    owner: 'A',
    label: 'Blood Requests',
    icon: 'droplet',
  },
  {
    path: '/donations',
    roles: ['STAFF'],
    pageFile: 'pages/Donations.jsx',
    owner: 'A',
    label: 'Log Donation',
    icon: 'plus-circle',
  },
  {
    path: '/donors',
    roles: ['STAFF', 'ADMIN'],
    pageFile: 'pages/Donors.jsx',
    owner: 'A',
    label: 'Eligible Donors',
    icon: 'users',
  },
  {
    path: '/organ-waitlist',
    roles: ['STAFF', 'ADMIN'],
    pageFile: 'pages/organ/Waitlist.jsx',
    owner: 'C',
    label: 'Organ Waitlist',
    icon: 'clipboard-list',
  },
  {
    path: '/organ-matching',
    roles: ['STAFF', 'ADMIN'],
    pageFile: 'pages/organ/Matching.jsx',
    owner: 'C',
    label: 'Organ Matching',
    icon: 'git-merge',
  },
  {
    path: '/admin',
    roles: ['ADMIN'],
    pageFile: 'pages/admin/Dashboard.jsx',
    owner: 'B',
    label: 'Admin Overview',
    icon: 'shield',
  },
  {
    path: '/admin/hospitals',
    roles: ['ADMIN'],
    pageFile: 'pages/admin/Hospitals.jsx',
    owner: 'B',
    label: 'Verify Hospitals',
    icon: 'building',
  },
  {
    path: '/admin/users',
    roles: ['ADMIN'],
    pageFile: 'pages/admin/Users.jsx',
    owner: 'B',
    label: 'Manage Users',
    icon: 'user-cog',
  },
  {
    path: '/admin/audit',
    roles: ['ADMIN'],
    pageFile: 'pages/admin/Audit.jsx',
    owner: 'B',
    label: 'Audit Log',
    icon: 'file-text',
  },
  {
    path: '/admin/notifications',
    roles: ['ADMIN'],
    pageFile: 'pages/admin/Notifications.jsx',
    owner: 'B',
    label: 'Queue Health',
    icon: 'activity',
  },
];

/**
 * Resolves the component for a given route config.
 * If the file exists, returns that component;
 * otherwise returns ComingSoonPlaceholder.
 */
export function resolvePageComponent(route) {
  const globKey = `./${route.pageFile.replace(/^src\//, '')}`;
  const mod = pageModules[globKey];
  if (mod && mod.default) {
    return mod.default;
  }
  return function FallbackComponent() {
    return React.createElement(ComingSoonPlaceholder, {
      label: route.label,
      pageFile: route.pageFile,
      owner: route.owner,
    });
  };
}

export default routesConfig;
