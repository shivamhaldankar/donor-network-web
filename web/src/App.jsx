import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Donors from './pages/Donors';
import Requests from './pages/Requests';
import { HeartHandshake } from 'lucide-react';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-rose-500 selection:text-white">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth onAuth={(user) => console.log('Logged in:', user)} />} />
            <Route path="/donors" element={<Donors />} />
            <Route path="/requests" element={<Requests />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-200 bg-white py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2 font-medium">
              <HeartHandshake className="w-4 h-4 text-rose-600" />
              <span>DonorNetwork © {new Date().getFullYear()} — Built to Save Lives Rapidly</span>
            </div>
            <p className="text-slate-400">
              For medical emergencies, please coordinate directly with your nearest certified trauma center or blood bank.
            </p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}

export default App;