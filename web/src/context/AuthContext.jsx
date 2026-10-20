// Compatibility bridge for prototype Donors.jsx and Requests.jsx
// Forwards directly to the new Pulse AuthContext (owned by Member C)
import { useAuth as useRealAuth } from '../auth/AuthContext';

export function AuthProvider({ children }) {
  return children;
}

export function useAuth() {
  const realAuth = useRealAuth();
  const user = realAuth?.user;
  return {
    ...realAuth,
    user,
    isAuthenticated: !!user,
    role: user?.role || null,
    isDonor: user?.role === 'DONOR',
    isStaff: user?.role === 'STAFF',
  };
}

export default useAuth;
