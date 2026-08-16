import { useState } from 'react';

function App() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const[bloodType, setBloodType] = useState('');
  const handleSubmit = (e) =>{
    e.preventDefault();
    alert(`Registering: ${name}, Phone: ${phone}, Blood Type: ${bloodType}`);
  }
  return (
    <div>
      <h1>Donor Network</h1>
      <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter donor name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br>
      </br>
      <input
        type="text"
        placeholder="Enter phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      ></input>
      <br></br>
      <select value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
        <option value="">Select blood type</option>
        <option value="A+">A+</option>
        <option value="A-">A-</option>
        <option value="B+">B+</option>
        <option value="B-">B-</option>
        <option value="AB+">AB+</option>
        <option value="AB-">AB-</option>
        <option value="O+">O+</option>
        <option value="O-">O-</option>
      </select>
      <br></br>
      <p>You typed: {name}</p>
      <p>Phone: {phone}</p>
      <p>Blood Type: {bloodType}</p>
      <button type="submit">Register</button>
      </form>
    </div>
  );
}

export default App;