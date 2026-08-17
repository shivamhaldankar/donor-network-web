import { useState } from 'react';

function Requests() {
  const [patientName, setPatientName] = useState('');
  const [requestType, setRequestType] = useState('BLOOD');
  const [bloodType, setBloodType] = useState('');
  const [organType, setOrganType] = useState('');
  const [urgency, setUrgency] = useState('MODERATE');
  const [requestList, setRequestList] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRequest = { patientName, requestType, bloodType, organType, urgency };
    setRequestList([...requestList, newRequest]);
    setPatientName('');
    setBloodType('');
    setOrganType('');
  };

  return (
    <div>
      <h1>Requests</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Patient name"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
        />

        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
        >
          <option value="BLOOD">Blood</option>
          <option value="ORGAN">Organ</option>
        </select>

        {requestType === 'BLOOD' && (
          <select
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
          >
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
        )}

        {requestType === 'ORGAN' && (
          <select
            value={organType}
            onChange={(e) => setOrganType(e.target.value)}
          >
            <option value="">Select organ</option>
            <option value="Kidney">Kidney</option>
            <option value="Liver">Liver</option>
            <option value="Cornea">Cornea</option>
            <option value="Heart">Heart</option>
            <option value="Lung">Lung</option>
            <option value="Pancreas">Pancreas</option>
          </select>
        )}

        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
        >
          <option value="CRITICAL">Critical</option>
          <option value="MODERATE">Moderate</option>
          <option value="LOW">Low</option>
        </select>

        <button type="submit">Create Request</button>
      </form>

      <h2>Open Requests</h2>
      <ul>
        {requestList.map((r, index) => (
          <li key={index}>
            {r.patientName} — {r.requestType}
            {r.requestType === 'BLOOD' ? ` (${r.bloodType})` : ''}
            {r.requestType === 'ORGAN' ? ` (${r.organType})` : ''}
            {' — '}{r.urgency}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Requests;