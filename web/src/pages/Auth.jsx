// ============================================================
// Pulse Authentication Page
// Owned by Member C (Web foundation)
// Contract §5, §6:
//   - Sign In / Sign Up tabs
//   - Donor / Hospital Staff toggle
//   - Small "Admin sign in" link (no public sign-up for Admin)
//   - Donor sign-up fields: name, email, password, phone, blood_type, city, LocationPicker
//   - Staff sign-up fields: name, email, password, hospital dropdown (GET /hospitals), staff_role
//   - Show server errors inline
//   - Calls POST /auth/signup and POST /auth/login
//   - VITE_DEV_FAKE_AUTH=true dev shortcut
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { ErrorBox, Spinner } from '../components/ui';
import { LocationPicker } from '../components/LocationPicker';
import './Auth.css';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// Dev fake accounts based on seed data
const DEV_FAKE_USERS = [
  {
    label: 'Aarav (Donor, O+)',
    token: 'fake-jwt-token-donor-1',
    user: { id: 1, role: 'DONOR', name: 'Aarav Shah', email: 'aarav@example.com' },
  },
  {
    label: 'Priya (Donor, O+)',
    token: 'fake-jwt-token-donor-2',
    user: { id: 2, role: 'DONOR', name: 'Priya Nair', email: 'priya@example.com' },
  },
  {
    label: 'Anita (Staff, City Care)',
    token: 'fake-jwt-token-staff-1',
    user: { id: 1, role: 'STAFF', name: 'Anita Kulkarni', hospital_id: 1, email: 'staff.citycare@example.com' },
  },
  {
    label: 'Farhan (Staff, Sunrise)',
    token: 'fake-jwt-token-staff-2',
    user: { id: 2, role: 'STAFF', name: 'Farhan Qureshi', hospital_id: 2, email: 'staff.sunrise@example.com' },
  },
  {
    label: 'Admin (System)',
    token: 'fake-jwt-token-admin',
    user: { id: 1, role: 'ADMIN', name: 'System Admin', email: 'admin@pulse.test' },
  },
];

export function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [role, setRole] = useState('DONOR'); // 'DONOR' | 'STAFF' | 'ADMIN'
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Donor fields
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState({ latitude: null, longitude: null });

  // Staff fields
  const [hospitalId, setHospitalId] = useState('');
  const [staffRole, setStaffRole] = useState('Coordinator');
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // State feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isDevFakeAuth = import.meta.env.VITE_DEV_FAKE_AUTH === 'true';

  // Load hospitals for staff signup dropdown
  useEffect(() => {
    let isMounted = true;
    if (mode === 'signup' && role === 'STAFF') {
      setLoadingHospitals(true);
      api.get('/hospitals')
        .then((data) => {
          if (!isMounted) return;
          const list = Array.isArray(data) ? data : [];
          setHospitals(list);
          if (list.length > 0 && !hospitalId) {
            setHospitalId(list[0].hospital_id);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.warn('Could not load hospitals list', err);
            // Fallback seed hospitals if backend isn't up yet
            setHospitals([
              { hospital_id: 1, name: 'City Care Hospital', city: 'Pune', verified: true },
              { hospital_id: 2, name: 'Sunrise Medical Center', city: 'Mumbai', verified: true },
              { hospital_id: 3, name: 'Lifeline Hospital', city: 'Pune', verified: true },
              { hospital_id: 4, name: 'New Hope Clinic', city: 'Nashik', verified: false },
            ]);
            setHospitalId(1);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingHospitals(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [mode, role]);

  const handleDevLogin = (fake) => {
    login({ token: fake.token, user: fake.user });
    navigate(fake.user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
  };

  const handleSwitchToAdmin = () => {
    setIsAdminMode(true);
    setRole('ADMIN');
    setMode('signin');
    setError(null);
  };

  const handleSwitchToUser = (targetRole = 'DONOR') => {
    setIsAdminMode(false);
    setRole(targetRole);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (mode === 'signin') {
        result = await api.post('/auth/login', {
          role,
          email: email.trim(),
          password,
        });
      } else {
        // Sign up
        if (role === 'DONOR') {
          result = await api.post('/auth/signup', {
            role: 'DONOR',
            name: name.trim(),
            email: email.trim(),
            password,
            phone: phone.trim(),
            blood_type: bloodType,
            city: city.trim() || undefined,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } else {
          // STAFF
          result = await api.post('/auth/signup', {
            role: 'STAFF',
            name: name.trim(),
            email: email.trim(),
            password,
            hospital_id: parseInt(hospitalId, 10),
            staff_role: staffRole.trim() || undefined,
          });
        }
      }

      // Persist auth and navigate
      if (result && result.token && result.user) {
        login({ token: result.token, user: result.user });
        const from = location.state?.from?.pathname;
        const target = from || (result.user.role === 'ADMIN' ? '/admin' : '/');
        navigate(target, { replace: true });
      } else {
        throw new Error('Server returned an unexpected response format');
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pulse-auth-container">
      <div className="pulse-auth-card">
        {/* Brand Header */}
        <div className="pulse-auth-brand">
          <div className="pulse-auth-brand__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 24, height: 24 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 className="pulse-auth-brand__title">Pulse</h1>
          <p className="pulse-auth-brand__subtitle">
            Real-Time Blood & Organ Donor Availability Network
          </p>
        </div>

        {/* Dev fake auth shortcut */}
        {isDevFakeAuth && (
          <div className="pulse-dev-auth-banner">
            <div className="pulse-dev-auth-title">
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span>Dev Quick Sign-In (VITE_DEV_FAKE_AUTH)</span>
            </div>
            <div className="pulse-dev-auth-buttons">
              {DEV_FAKE_USERS.map((fake) => (
                <button
                  key={fake.label}
                  type="button"
                  onClick={() => handleDevLogin(fake)}
                  className="pulse-dev-btn"
                >
                  {fake.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode Tabs (Sign In / Sign Up) - Hidden in Admin Mode */}
        {!isAdminMode ? (
          <div className="pulse-auth-tabs">
            <button
              type="button"
              className={`pulse-auth-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => { setMode('signin'); setError(null); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`pulse-auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(null); }}
            >
              Sign Up
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Administrator Authentication
            </span>
          </div>
        )}

        {/* Role Toggle (Donor / Hospital Staff) - Hidden in Admin Mode */}
        {!isAdminMode && (
          <div className="pulse-role-toggle">
            <button
              type="button"
              className={`pulse-role-btn ${role === 'DONOR' ? 'active' : ''}`}
              onClick={() => { setRole('DONOR'); setError(null); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <span>Donor</span>
            </button>
            <button
              type="button"
              className={`pulse-role-btn ${role === 'STAFF' ? 'active' : ''}`}
              onClick={() => { setRole('STAFF'); setError(null); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
              </svg>
              <span>Hospital Staff</span>
            </button>
          </div>
        )}

        {/* Inline Server Error Box */}
        {error && <ErrorBox message={error} />}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Sign Up Fields: Full Name */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-name" className="form-label">Full Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                required
                className="input-control"
                placeholder="e.g. Ramesh Patil"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {/* Email Address */}
          <div className="form-group">
            <label htmlFor="auth-email" className="form-label">Email Address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              className="input-control"
              placeholder="e.g. user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="auth-password" className="form-label">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && (
              <span className="form-helper">Must be at least 6 characters</span>
            )}
          </div>

          {/* Donor-specific sign-up fields */}
          {mode === 'signup' && role === 'DONOR' && (
            <>
              <div className="form-group">
                <label htmlFor="auth-phone" className="form-label">Phone Number</label>
                <input
                  id="auth-phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  className="input-control"
                  placeholder="e.g. 9811000001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-blood-type" className="form-label">Blood Type</label>
                <select
                  id="auth-blood-type"
                  className="select-control"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                >
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="auth-city" className="form-label">City (Optional)</label>
                <input
                  id="auth-city"
                  type="text"
                  autoComplete="address-level2"
                  className="input-control"
                  placeholder="e.g. Pune, Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <LocationPicker
                value={coords}
                onChange={setCoords}
              />
            </>
          )}

          {/* Staff-specific sign-up fields */}
          {mode === 'signup' && role === 'STAFF' && (
            <>
              <div className="form-group">
                <label htmlFor="auth-hospital" className="form-label">Affiliated Hospital</label>
                {loadingHospitals ? (
                  <div style={{ padding: '8px 0' }}><Spinner size="sm" label="Loading hospitals..." /></div>
                ) : (
                  <select
                    id="auth-hospital"
                    className="select-control"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    required
                  >
                    {hospitals.map((h) => (
                      <option key={h.hospital_id} value={h.hospital_id}>
                        {h.name} ({h.city}) {!h.verified ? '— Pending Verification' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <span className="form-helper">
                  Note: Staff of unverified hospitals cannot create requests until approved by Admin.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="auth-staff-role" className="form-label">Staff Role / Title</label>
                <input
                  id="auth-staff-role"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Coordinator, Nurse, Transfusion Specialist"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary pulse-auth-submit"
          >
            {loading ? (
              <Spinner size="sm" label={mode === 'signin' ? 'Signing in...' : 'Registering...'} />
            ) : (
              mode === 'signin'
                ? `Sign In as ${isAdminMode ? 'Admin' : role === 'DONOR' ? 'Donor' : 'Staff'}`
                : `Create ${role === 'DONOR' ? 'Donor' : 'Staff'} Account`
            )}
          </button>
        </form>

        {/* Footer with Admin Sign In toggle */}
        <div className="pulse-auth-footer">
          {!isAdminMode ? (
            <button
              type="button"
              onClick={handleSwitchToAdmin}
              className="pulse-admin-link"
            >
              Administrator Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSwitchToUser('DONOR')}
              className="pulse-admin-link"
            >
              ← Back to Donor / Staff Portal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;