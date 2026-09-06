import { Routes ,Route,Link } from 'react-router-dom';
import Auth from './pages/Auth.jsx';
import Donors from './pages/Donors.jsx';
import Requests from  './pages/Requests.jsx';

function App() {
  return (
    <div>
      <Link to="/auth">Sign In</Link>
      <nav>
        <Link to="/donors">Donors</Link>
        {' | '}
        <Link to="/requests">Requests</Link>
      </nav>
      <Routes>
        <Route path="/auth" element={<Auth onAuth={(user) => console.log('Logged in:', user)} />} />
        <Route path="/donors" element={<Donors/>}/>
        <Route path="/requests" element={<Requests/>}/>
      </Routes>
    </div>
  );
}
export default App;