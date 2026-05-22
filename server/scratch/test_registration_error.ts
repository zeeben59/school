import axios from 'axios';

const testRegistration = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      schoolName: "Royal Academy",
      directorFullName: "john doe",
      email: "test-reg-" + Date.now() + "@example.com",
      phone: "+2347039975646",
      address: "No:14 nwafia street",
      password: "password123",
      confirmPassword: "password123"
    });
    console.log('Success:', response.data);
  } catch (error: any) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
};

testRegistration();
