import { Routes ,Route,Link } from 'react-router-dom';
import Donors from './pages/Donors.jsx';
import Requests from  './pages/Requests.jsx';
function App() {
  return (
    <div>
      <nav>
        <Link to="/donors">Donors</Link>
        {' | '}
        <Link to="/requests">Requests</Link>
      </nav>
      <Routes>
        <Route path="/donors" element={<Donors/>}/>
        <Route path="/requests" element={<Requests/>}/>
      </Routes>
    </div>
  );
}
export default App;