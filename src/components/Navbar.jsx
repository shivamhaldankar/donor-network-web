import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartHandshake, Droplets, ShieldAlert, LogOut, User, Building2 } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-lg text-slate-900 leading-tight">
                <span>DonorNetwork</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Blood & Organ Emergency Network</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/donors"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/donors')
                  ? 'bg-rose-50 text-rose-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Droplets className="w-4 h-4 text-rose-500" />
              <span>Donors Directory</span>
            </Link>

            <Link
              to="/requests"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/requests')
                  ? 'bg-rose-50 text-rose-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Emergency Requests</span>
            </Link>
          </nav>

          {/* Right Action: Auth / Profile */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-800 leading-none">
                    {user.name}
                  </span>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {isStaff ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700">
                        <Building2 className="w-3 h-3" />
                        Hospital Staff
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                        <User className="w-3 h-3" />
                        Donor ({user.bloodGroup || 'Blood & Organ'})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm shadow-rose-500/30 transition-all hover:shadow-md hover:shadow-rose-500/25"
              >
                <User className="w-4 h-4" />
                <span>Sign In / Join</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
