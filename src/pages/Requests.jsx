import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Building2,
  Clock,
  Plus,
  Heart,
  Droplet,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Send,
  X
} from 'lucide-react';


const INITIAL_REQUESTS = [
  {
    id: 101,
    patientName: 'Emergency Trauma Ward #4',
    patientCode: 'PT-9042',
    hospitalName: 'Apollo City Hospital',
    department: 'ICU & Trauma Center',
    requestType: 'BLOOD',
    bloodType: 'O-',
    unitsRequired: 3,
    urgency: 'CRITICAL',
    organType: '',
    timeAgo: '15 mins ago',
    requiredWithin: 'Immediate (< 2 hrs)',
    contactPerson: 'Dr. Priya Patel (Chief Blood Bank Officer)',
    contactPhone: '+91 98123 45678',
    status: 'OPEN',
    responsesCount: 1,
  },
  {
    id: 102,
    patientName: 'Pediatric Cardiac Surgery',
    patientCode: 'PT-8819',
    hospitalName: 'Lilavati Children Hospital',
    department: 'Pediatric Cardiac ICU',
    requestType: 'BLOOD',
    bloodType: 'AB-',
    unitsRequired: 2,
    urgency: 'CRITICAL',
    organType: '',
    timeAgo: '45 mins ago',
    requiredWithin: 'Today by 6:00 PM',
    contactPerson: 'Nurse Supervisor Reena',
    contactPhone: '+91 97788 11223',
    status: 'OPEN',
    responsesCount: 0,
  },
  {
    id: 103,
    patientName: 'Renal Transplant Program',
    patientCode: 'PT-7650',
    hospitalName: 'Fortis Healthcare',
    department: 'Nephrology & Organ Transplant',
    requestType: 'ORGAN',
    bloodType: 'B+',
    unitsRequired: 1,
    urgency: 'MODERATE',
    organType: 'Kidney',
    timeAgo: '2 hours ago',
    requiredWithin: 'Within 48 hours',
    contactPerson: 'Dr. Alok Verma',
    contactPhone: '+91 99887 66554',
    status: 'OPEN',
    responsesCount: 2,
  },
  {
    id: 104,
    patientName: 'Oncology Chemotherapy Support',
    patientCode: 'PT-5421',
    hospitalName: 'Tata Memorial Cancer Center',
    department: 'Hemato-Oncology',
    requestType: 'BLOOD',
    bloodType: 'A+',
    unitsRequired: 4,
    urgency: 'MODERATE',
    organType: '',
    timeAgo: '5 hours ago',
    requiredWithin: 'Next 24 hours',
    contactPerson: 'Blood Bank Desk',
    contactPhone: '+91 98665 44332',
    status: 'OPEN',
    responsesCount: 3,
  },
  {
    id: 105,
    patientName: 'Cornea Restoration Registry',
    patientCode: 'PT-3199',
    hospitalName: 'L.V. Prasad Eye Institute',
    department: 'Ophthalmology Surgery',
    requestType: 'ORGAN',
    bloodType: '',
    unitsRequired: 1,
    urgency: 'LOW',
    organType: 'Cornea',
    timeAgo: '1 day ago',
    requiredWithin: 'Elective (Within 1 week)',
    contactPerson: 'Eye Bank Coordinator',
    contactPhone: '+91 98222 33445',
    status: 'OPEN',
    responsesCount: 4,
  },
];

export default function Requests() {
  const { user, isStaff, loginAsDemo } = useAuth();

  const [requestList, setRequestList] = useState(INITIAL_REQUESTS);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, BLOOD, ORGAN
  const [urgencyFilter, setUrgencyFilter] = useState('ALL'); // ALL, CRITICAL, MODERATE, LOW

  // Form state
  const [patientName, setPatientName] = useState('');
  const [requestType, setRequestType] = useState('BLOOD');
  const [bloodType, setBloodType] = useState('O+');
  const [organType, setOrganType] = useState('Kidney');
  const [urgency, setUrgency] = useState('CRITICAL');
  const [unitsRequired, setUnitsRequired] = useState(2);
  const [hospitalName, setHospitalName] = useState(user?.hospitalName || 'Apollo City Hospital');
  const [department, setDepartment] = useState(user?.department || 'Emergency Care');
  const [requiredWithin, setRequiredWithin] = useState('Within 4 hours');

  // Response confirmation state
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseSuccess, setResponseSuccess] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    const newReq = {
      id: Date.now(),
      patientName: patientName.trim(),
      patientCode: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalName: hospitalName.trim() || 'General Medical Hospital',
      department: department.trim() || 'Emergency Ward',
      requestType,
      bloodType: requestType === 'BLOOD' ? bloodType : '',
      organType: requestType === 'ORGAN' ? organType : '',
      unitsRequired: Number(unitsRequired) || 1,
      urgency,
      timeAgo: 'Just now',
      requiredWithin,
      contactPerson: user?.name || 'Hospital Duty Doctor',
      contactPhone: user?.phone || '+91 98765 00000',
      status: 'OPEN',
      responsesCount: 0,
    };

    setRequestList([newReq, ...requestList]);
    setPatientName('');
    setShowForm(false);
  };

  const handleRespond = (req) => {
    setRespondingTo(req);
  };

  const confirmResponse = () => {
    if (!respondingTo) return;
    setRequestList((prev) =>
      prev.map((r) =>
        r.id === respondingTo.id ? { ...r, responsesCount: r.responsesCount + 1 } : r
      )
    );
    setResponseSuccess(respondingTo);
    setRespondingTo(null);
    setTimeout(() => setResponseSuccess(null), 5000);
  };

  const filteredRequests = requestList.filter((req) => {
    const matchesTab =
      activeTab === 'ALL' || req.requestType === activeTab;
    const matchesUrgency =
      urgencyFilter === 'ALL' || req.urgency === urgencyFilter;
    return matchesTab && matchesUrgency;
  });

  const criticalCount = requestList.filter((r) => r.urgency === 'CRITICAL').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast Notification */}
      {responseSuccess && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl flex items-start gap-3 border border-emerald-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Response Dispatched!</h4>
            <p className="text-xs text-emerald-200 mt-1">
              Your pledge has been sent to {responseSuccess.hospitalName}. The duty coordinator will contact you immediately. Thank you for saving lives!
            </p>
          </div>
          <button
            onClick={() => setResponseSuccess(null)}
            className="text-emerald-400 hover:text-white ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 text-white p-6 sm:p-10 mb-8 shadow-xl shadow-rose-600/15">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white">
                <span className="w-2 h-2 rounded-full bg-red-300 animate-ping" />
                Live Dispatch Center
              </span>
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-xs">
                  {criticalCount} CRITICAL
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Emergency Patient Requests
            </h1>
            <p className="text-rose-100 text-sm sm:text-base mt-2">
              Verified real-time blood and organ requirements issued by authorized medical centers and trauma units.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isStaff ? (
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{showForm ? 'Close Dispatch Form' : 'Publish Emergency Need'}</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                <span className="text-xs text-white/90 px-2 font-medium">Hospital Staff Portal:</span>
                <button
                  onClick={() => loginAsDemo('staff')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-slate-900 hover:bg-rose-50 text-xs font-bold transition-all shadow-xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Switch to Staff View</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Decorative circle */}
        <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Staff Dispatch Request Form */}
      {showForm && isStaff && (
        <div className="mb-10 bg-white rounded-3xl border border-rose-200/80 shadow-xl shadow-rose-500/5 p-6 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>Publish Hospital Emergency Request</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch an emergency alert across our registered donor network.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Authorized Staff: {user?.name}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Patient Identifier / Case Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ICU Bed #3 / Trauma Case"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Hospital Name
              </label>
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="Hospital Name"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Department / Ward
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Emergency & Surgery"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Request Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequestType('BLOOD')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    requestType === 'BLOOD'
                      ? 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Droplet className="w-3.5 h-3.5 text-rose-500" />
                  <span>Blood / Platelets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('ORGAN')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    requestType === 'ORGAN'
                      ? 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Organ Transplant</span>
                </button>
              </div>
            </div>

            {requestType === 'BLOOD' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Required Blood Group
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg} {bg === 'O-' ? '(Universal Need)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Organ
                </label>
                <select
                  value={organType}
                  onChange={(e) => setOrganType(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {['Kidney', 'Liver', 'Cornea', 'Heart', 'Lung', 'Pancreas'].map((organ) => (
                    <option key={organ} value={organ}>
                      {organ}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Urgency Level
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold"
              >
                <option value="CRITICAL">🔴 CRITICAL (Immediate Life Threat)</option>
                <option value="MODERATE">🟡 MODERATE (Needed in 24-48 Hours)</option>
                <option value="LOW">🟢 LOW (Elective / Advance Booking)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Units / Quantity Needed
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={unitsRequired}
                onChange={(e) => setUnitsRequired(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Timeframe / Deadline
              </label>
              <input
                type="text"
                placeholder="e.g. Within 2 hours"
                value={requiredWithin}
                onChange={(e) => setRequiredWithin(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="md:col-span-3 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all"
              >
                Dispatch Emergency Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          {['ALL', 'BLOOD', 'ORGAN'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat === 'ALL' && 'All Needs'}
              {cat === 'BLOOD' && '🩸 Blood & Platelets'}
              {cat === 'ORGAN' && '🫀 Organ Transplants'}
            </button>
          ))}
        </div>

        {/* Urgency Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-400 mr-1">Urgency:</span>
          {['ALL', 'CRITICAL', 'MODERATE', 'LOW'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setUrgencyFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                urgencyFilter === lvl
                  ? lvl === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : lvl === 'MODERATE'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className={`bg-white rounded-3xl border transition-all p-6 flex flex-col justify-between ${
              req.urgency === 'CRITICAL'
                ? 'border-rose-300 shadow-md shadow-rose-500/10 hover:border-rose-400'
                : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
            }`}
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shadow-xs ${
                      req.requestType === 'BLOOD'
                        ? req.bloodType === 'O-'
                          ? 'bg-rose-700 text-white ring-2 ring-rose-500/40'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    <span className="text-base leading-none">
                      {req.requestType === 'BLOOD' ? req.bloodType : req.organType}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
                      {req.requestType === 'BLOOD' ? `${req.unitsRequired} Units` : 'Donor'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{req.patientName}</h3>
                      <span className="text-[11px] font-mono text-slate-400">({req.patientCode})</span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {req.hospitalName} • {req.department}
                    </p>
                  </div>
                </div>

                {/* Urgency Badge */}
                <div className="flex flex-col items-end">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      req.urgency === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                        : req.urgency === 'MODERATE'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {req.urgency === 'CRITICAL' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                    {req.urgency}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">{req.timeAgo}</span>
                </div>
              </div>

              {/* Requirement Details */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-500" /> Timeframe:
                  </span>
                  <span className="font-bold text-slate-800">{req.requiredWithin}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500">Contact Person:</span>
                  <span className="font-medium text-slate-700">{req.contactPerson}</span>
                </div>
              </div>
            </div>

            {/* Card Action */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                <span>{req.responsesCount} response{req.responsesCount !== 1 ? 's' : ''}</span>
              </span>

              <button
                onClick={() => handleRespond(req)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  req.urgency === 'CRITICAL'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 hover:scale-105'
                    : 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-105'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>I Can Donate</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 mt-6">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Open Requests Under This Filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            All emergency needs for this selection are currently addressed or pending dispatch.
          </p>
        </div>
      )}

      {/* Response Confirmation Modal */}
      {respondingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 fill-rose-500/20" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Confirm Donor Response</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              You are offering to respond to the emergency request at{' '}
              <strong className="text-slate-800">{respondingTo.hospitalName}</strong> for{' '}
              <strong className="text-rose-600">
                {respondingTo.requestType === 'BLOOD' ? respondingTo.bloodType : respondingTo.organType}
              </strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 mb-6 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold text-slate-800">{respondingTo.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Urgency:</span>
                <span className="font-bold text-rose-600">{respondingTo.urgency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duty Coordinator:</span>
                <span className="font-semibold text-slate-800">{respondingTo.contactPerson}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setRespondingTo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmResponse}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all"
              >
                Confirm & Dispatch My Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}