import { useState } from 'react';

function Auth() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [role, setRole] = useState('DONOR'); // 'DONOR' or 'STAFF'

  return (
    <div>
      <h1>{mode === 'login' ? 'Sign In' : 'Sign Up'}</h1>

      <button onClick={() => setMode('login')}>Sign In</button>
      <button onClick={() => setMode('signup')}>Sign Up</button>

      <br /><br />

      <button onClick={() => setRole('DONOR')}>I'm a Donor</button>
      <button onClick={() => setRole('STAFF')}>Hospital Staff</button>

      <p>Mode: {mode} | Role: {role}</p>
    </div>
  );
}

export default Auth;