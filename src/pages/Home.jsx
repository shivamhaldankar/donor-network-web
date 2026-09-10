import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Heart,
  Droplets,
  Building2,
  ShieldAlert,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loginAsDemo } = useAuth();


  return (
    <div className="space-y-16 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-radial from-slate-900 via-slate-900 to-slate-950 text-white p-8 sm:p-16 shadow-2xl border border-slate-800">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-6 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Real-Time Medical Response Coordination</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] text-white">
            Connecting Life-Saving Donors with Emergency Needs.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            A unified network empowering volunteer blood and organ donors to instantly match with urgent hospital requests, ICU requirements, and trauma operations.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/requests"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>View Emergency Requests</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/donors"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all hover:scale-105 active:scale-95"
            >
              <Droplets className="w-4 h-4 text-rose-400" />
              <span>Explore Donor Registry</span>
            </Link>
          </div>

          {/* Quick Demo Shortcuts if not logged in */}
          {!isAuthenticated && (
            <div className="mt-10 pt-8 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Quick Demo:</span>
              <button
                onClick={() => loginAsDemo('donor')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-rose-300 border border-slate-700 transition-colors"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
                <span>Test as Rahul (Donor O+)</span>
              </button>
              <button
                onClick={() => loginAsDemo('staff')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-slate-700 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test as Dr. Priya (Hospital Staff)</span>
              </button>
            </div>
          )}
        </div>

        {/* Subtle glow background */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <Droplets className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">1,240+</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Registered Blood Donors</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">48</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Verified Medical Centers</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">&lt; 15 mins</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Avg. Emergency Response Time</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">98.4%</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Fulfillment Rate</div>
        </div>
      </div>

      {/* Two Pillars: Donors & Hospital Staff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Donor Pillar */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-rose-50 to-white border border-rose-200/70 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 mb-5">
              <Heart className="w-6 h-6 fill-white/20" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">For Volunteer Donors</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Register your blood group or organ pledge. When an emergency case occurs in your city requiring your exact match, you receive an urgent alert to save a life.
            </p>
            <ul className="mt-5 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Instant dispatch notifications for matching blood & organ types</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Privacy preserved until you confirm willingness to donate</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Track your donation timeline and community impact</span>
              </li>
            </ul>
          </div>
          <div className="mt-8">
            <Link
              to="/donors"
              className="inline-flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700 group"
            >
              <span>Join as a Donor</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Staff Pillar */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-200/70 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 mb-5">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">For Hospital & ICU Staff</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Facing a rare blood type shortage or urgent organ transplant requirement? Broadcast verified emergency requests across the network with priority tagging.
            </p>
            <ul className="mt-5 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Publish blood units or organ requirements in seconds</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Set urgency levels: Critical (immediate), Moderate, or Elective</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Direct coordination with verified responding donors</span>
              </li>
            </ul>
          </div>
          <div className="mt-8">
            <Link
              to="/requests"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 group"
            >
              <span>Publish Emergency Need</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
