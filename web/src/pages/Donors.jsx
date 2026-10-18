import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Droplets,
  Search,
  Plus,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  Heart,
  UserCheck,
  Filter,
  Copy,
  Check
} from 'lucide-react';

const INITIAL_DONORS = [
  {
    id: 1,
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    bloodType: 'O+',
    city: 'South Mumbai',
    status: 'Available',
    lastDonated: '4 months ago',
    pledges: ['Blood', 'Platelets', 'Kidney'],
    isUniversal: false,
  },
  {
    id: 2,
    name: 'Ananya Deshmukh',
    phone: '+91 98234 56789',
    bloodType: 'O-',
    city: 'Pune, MH',
    status: 'Available',
    lastDonated: '6 months ago',
    pledges: ['Blood', 'Cornea'],
    isUniversal: true,
  },
  {
    id: 3,
    name: 'Vikram Mehta',
    phone: '+91 98111 22334',
    bloodType: 'A+',
    city: 'Thane West',
    status: 'Available',
    lastDonated: 'Never (First-time)',
    pledges: ['Blood', 'Liver (Partial)'],
    isUniversal: false,
  },
  {
    id: 4,
    name: 'Dr. Sneha Reddy',
    phone: '+91 97654 32109',
    bloodType: 'B+',
    city: 'Navi Mumbai',
    status: 'Donated Recently',
    lastDonated: '2 weeks ago',
    pledges: ['Blood', 'Platelets'],
    isUniversal: false,
  },
  {
    id: 5,
    name: 'Karan Malhotra',
    phone: '+91 98989 12345',
    bloodType: 'AB+',
    city: 'Bandra, Mumbai',
    status: 'Available',
    lastDonated: '8 months ago',
    pledges: ['Plasma', 'Cornea'],
    isUniversal: false,
  },
  {
    id: 6,
    name: 'Pooja Iyer',
    phone: '+91 97123 98765',
    bloodType: 'A-',
    city: 'Andheri East',
    status: 'Available',
    lastDonated: '1 year ago',
    pledges: ['Blood', 'Kidney'],
    isUniversal: false,
  },
];

const BLOOD_TYPES = ['ALL', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function Donors() {
  const { user } = useAuth();

  const [donorList, setDonorList] = useState(INITIAL_DONORS);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bloodType, setBloodType] = useState(user?.bloodGroup || 'O+');
  const [city, setCity] = useState(user?.city || '');
  const [organPledge, setOrganPledge] = useState(user?.pledges || ['Blood']);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBloodType, setSelectedBloodType] = useState('ALL');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyPhone = (id, phoneNumber) => {
    navigator.clipboard.writeText(phoneNumber);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !bloodType) return;

    const newDonor = {
      id: Date.now(),
      name,
      phone,
      bloodType,
      city: city.trim() || 'Unspecified City',
      status: 'Available',
      lastDonated: 'Just registered',
      pledges: organPledge.length > 0 ? organPledge : ['Blood'],
      isUniversal: bloodType === 'O-',
    };

    setDonorList([newDonor, ...donorList]);
    setName('');
    setPhone('');
    setCity('');
    setShowForm(false);
  };

  const filteredDonors = donorList.filter((donor) => {
    const matchesSearch =
      donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.bloodType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBlood =
      selectedBloodType === 'ALL' || donor.bloodType === selectedBloodType;

    const matchesAvailability = !onlyAvailable || donor.status === 'Available';

    return matchesSearch && matchesBlood && matchesAvailability;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white p-6 sm:p-10 mb-8 shadow-xl shadow-rose-600/15">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md mb-3 text-rose-100">
              <Heart className="w-3.5 h-3.5 fill-rose-200" />
              Verified Community Donors
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Life-Saving Donor Directory
            </h1>
            <p className="text-rose-100 text-sm sm:text-base mt-2">
              Search verified volunteer blood, plasma, and organ donors ready to respond during critical emergencies.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'Close Registration' : 'Register as Donor'}</span>
          </button>
        </div>

        {/* Subtle Decorative Elements */}
        <div className="absolute -right-8 -bottom-8 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Donor Registration Drawer / Modal Form */}
      {showForm && (
        <div className="mb-10 bg-white rounded-3xl border border-rose-200/80 shadow-lg shadow-rose-500/5 p-6 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900">Volunteer Donor Registration</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Join our emergency response registry. Your contact info is shared only for verified urgent requests.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Free Registration
            </span>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Phone Number (Emergency Contact) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Blood Group <span className="text-rose-500">*</span>
              </label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              >
                <option value="O+">O+ (Universal Red Cell Donor for Positives)</option>
                <option value="O-">O- (Universal Red Cell Donor for Everyone)</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+ (Universal Plasma Donor)</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                City / Region
              </label>
              <input
                type="text"
                placeholder="e.g. Mumbai, Andheri East"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Donation Pledges
              </label>
              <div className="flex flex-wrap gap-2">
                {['Blood', 'Platelets', 'Plasma', 'Kidney', 'Liver (Partial)', 'Cornea'].map((p) => {
                  const active = organPledge.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() =>
                        setOrganPledge((prev) =>
                          prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
                Complete Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name, city, or blood type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>

        {/* Blood Group Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Group:
          </span>
          {BLOOD_TYPES.map((bt) => (
            <button
              key={bt}
              onClick={() => setSelectedBloodType(bt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedBloodType === bt
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {bt}
            </button>
          ))}
        </div>

        {/* Availability Toggle */}
        <label className="flex items-center gap-2 cursor-pointer self-start lg:self-auto text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500"
          />
          <span>Only Available Now</span>
        </label>
      </div>

      {/* Donors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDonors.map((donor) => (
          <div
            key={donor.id}
            className="bg-white rounded-2xl border border-slate-200/90 hover:border-rose-200 hover:shadow-lg hover:shadow-slate-200/50 transition-all p-5 flex flex-col justify-between"
          >
            <div>
              {/* Card Top */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xs ${
                      donor.bloodType === 'O-'
                        ? 'bg-rose-700 text-white ring-2 ring-rose-500/50'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {donor.bloodType}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{donor.name}</span>
                      <UserCheck className="w-3.5 h-3.5 text-blue-500" title="Verified Volunteer" />
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {donor.city}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    donor.status === 'Available'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      donor.status === 'Available' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {donor.status}
                </span>
              </div>

              {/* Pledges & Last Donation */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last Donated: {donor.lastDonated}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {donor.pledges?.map((pledge) => (
                    <span
                      key={pledge}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium"
                    >
                      {pledge}
                    </span>
                  ))}
                  {donor.isUniversal && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                      ⭐ Universal Donor
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Action */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <a
                href={`tel:${donor.phone}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{donor.phone}</span>
              </a>

              <button
                onClick={() => handleCopyPhone(donor.id, donor.phone)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Copy phone number"
              >
                {copiedId === donor.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredDonors.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 mt-6">
          <Droplets className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Donors Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Try adjusting your search query or blood type filter, or register as a donor to join the list!
          </p>
        </div>
      )}
    </div>
  );
}