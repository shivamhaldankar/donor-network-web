/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEMO_USERS = {
  donor: {
    id: 'usr_donor_1',
    name: 'Rahul Sharma',
    email: 'donor@network.org',
    role: 'DONOR',
    bloodGroup: 'O+',
    phone: '+91 98765 43210',
    city: 'Mumbai',
    pledges: ['Blood', 'Kidney'],
  },
  staff: {
    id: 'usr_staff_1',
    name: 'Dr. Priya Patel',
    email: 'staff@cityhospital.org',
    role: 'STAFF',
    hospitalName: 'Apollo City Hospital',
    department: 'Emergency & Blood Bank',
    phone: '+91 98123 45678',
    employeeId: 'EMP-9021',
  },
};

const STORAGE_KEY = 'donor_network_user_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = async ({ email, role }) => {
    setLoading(true);
    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Check if matching demo user
    let loggedUser;
    if (email === 'donor@network.org' || role === 'DONOR') {
      loggedUser = {
        ...DEMO_USERS.donor,
        email: email || DEMO_USERS.donor.email,
        name: email ? email.split('@')[0] : DEMO_USERS.donor.name,
        role: 'DONOR',
      };
    } else {
      loggedUser = {
        ...DEMO_USERS.staff,
        email: email || DEMO_USERS.staff.email,
        name: email ? email.split('@')[0] : DEMO_USERS.staff.name,
        role: 'STAFF',
      };
    }


    setUser(loggedUser);
    setLoading(false);
    return loggedUser;
  };

  const signup = async (userData) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const newUser = {
      id: `usr_${Date.now()}`,
      ...userData,
    };

    setUser(newUser);
    setLoading(false);
    return newUser;
  };

  const loginAsDemo = (demoType) => {
    const demo = DEMO_USERS[demoType];
    if (demo) {
      setUser(demo);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        role: user?.role || null,
        isDonor: user?.role === 'DONOR',
        isStaff: user?.role === 'STAFF',
        loading,
        login,
        signup,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
