import {useState} from 'react';
function Donors(){
    const [name,setName]=useState('');
    const [phone,setPhone]=useState('');
    const [bloodType,setBloodType]=useState('');
    const [donorList,setDonorList]=useState([]);
    const handleSubmit=(e)=>{
        e.preventDefault();
        const newDonor={name,phone,bloodType};  
        setDonorList([...donorList,newDonor]);
        setName('');
        setPhone('');
        setBloodType('');
};
return(
    <div>
        <h1>Donors</h1>
        <form onSubmit={handleSubmit}>
            <input 
            type='text'
            placeholder='Enter donor name'
            value={name}
            onChange={(e)=>setName(e.target.value)}
            />
            <input 
            type='text'
            placeholder='Enter phone number'
            value={phone}
            onChange={(e)=>setPhone(e.target.value)}
            />
            <select
            value={bloodType}
            onChange={(e)=>setBloodType(e.target.value)}
            >
                <option value="">Select Blood Type:</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
            </select>
            <button type="submit">Register Donor</button>
        </form>

        <h2>Registered Donors</h2>
        <ul>
            {donorList.map((donor,index)=>(
            <li key={index}>
                {donor.name} - {donor.phone} - {donor.bloodType}
            </li>
        ))}
        </ul>
    </div>
);
}
export default Donors;