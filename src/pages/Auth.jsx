import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Heart,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function Auth({ onAuth }) {
  const { login, signup, loginAsDemo, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/donors';

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('DONOR'); // 'DONOR' | 'STAFF'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [city, setCity] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('Blood Bank & Emergency');
  const [employeeId, setEmployeeId] = useState('');
  const [pledges, setPledges] = useState(['Blood']);
  const [error, setError] = useState('');

  const togglePledge = (pledge) => {
    setPledges((prev) =>
      prev.includes(pledge) ? prev.filter((p) => p !== pledge) : [...prev, pledge]
    );
  };

  const handleDemoLogin = (demoRole) => {
    loginAsDemo(demoRole);
    if (onAuth) onAuth({ role: demoRole === 'donor' ? 'DONOR' : 'STAFF' });
    navigate(demoRole === 'donor' ? '/donors' : '/requests', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let authUser;
      if (mode === 'login') {
        if (!email) {
          setError('Please enter your email address');
          return;
        }
        authUser = await login({ email, password, role });
      } else {
        if (!name.trim()) {
          setError('Please enter your full name');
          return;
        }
        if (!email.trim()) {
          setError('Please enter an email address');
          return;
        }

        const userData = {
          name,
          email,
          role,
          phone,
          ...(role === 'DONOR'
            ? { bloodGroup, city, pledges }
            : { hospitalName, department, employeeId }),
        };
        authUser = await signup(userData);
      }

      if (onAuth) onAuth(authUser);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Authentication failed. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-50">
      <div className="w-full max-w-lg">
        {/* Quick Demo Login Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Instant Demo Logins</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDemoLogin('donor')}
              className="flex items-center justify-between p-2.5 text-left rounded-xl bg-white hover:bg-rose-50/70 border border-slate-200 hover:border-rose-300 text-xs transition-all group"
            >
              <div>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                  Rahul (Donor)
                </span>
                <span className="text-[11px] text-slate-500 block">O+ Universal Blood</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('staff')}
              className="flex items-center justify-between p-2.5 text-left rounded-xl bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 text-xs transition-all group"
            >
              <div>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Dr. Priya (Staff)
                </span>
                <span className="text-[11px] text-slate-500 block">Apollo City Hospital</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          {/* Role Tabs */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Join the Network'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select your role and proceed to access emergency donor coordination
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setRole('DONOR')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                role === 'DONOR'
                  ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className={`w-4 h-4 ${role === 'DONOR' ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>I'm a Donor</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('STAFF')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                role === 'STAFF'
                  ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Hospital Staff</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                mode === 'signup'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'DONOR' ? 'e.g. Rahul Sharma' : 'e.g. Dr. Priya Patel'}
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === 'DONOR' ? 'donor@network.org' : 'staff@hospital.org'}
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            {/* Extra fields for Donor signup */}
            {mode === 'signup' && role === 'DONOR' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Blood Group
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full py-2.5 px-3 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City / Location
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai, Maharashtra"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Willing to Donate (Pledge)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Blood', 'Platelets', 'Kidney', 'Liver (Partial)', 'Eye/Cornea'].map((item) => {
                      const selected = pledges.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => togglePledge(item)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                            selected
                              ? 'bg-rose-50 border-rose-300 text-rose-700 font-medium'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {selected && <CheckCircle2 className="w-3 h-3 text-rose-500" />}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Extra fields for Staff signup */}
            {mode === 'signup' && role === 'STAFF' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Hospital / Medical Facility
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      placeholder="e.g. Apollo Memorial Hospital"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Emergency / ICU"
                      className="w-full py-2.5 px-3 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Staff / Emp ID
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="EMP-4421"
                      className="w-full py-2.5 px-3 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                role === 'DONOR'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
              } disabled:opacity-50`}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? `Sign In as ${role === 'DONOR' ? 'Donor' : 'Staff'}`
                      : `Complete ${role === 'DONOR' ? 'Donor' : 'Staff'} Registration`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}