const axios = require('axios');

async function run() {
  try {
    const email = "test" + Date.now() + "@example.com";
    const password = "password123";
    
    console.log("Registering user...");
    const regRes = await axios.post('http://localhost:5001/api/user/register', {
      name: "Test User",
      email,
      password
    });
    console.log("Register Response:", regRes.data);
    
    console.log("Logging in...");
    const loginRes = await axios.post('http://localhost:5001/api/user/login', {
      email,
      password
    });
    console.log("Login Response:", loginRes.data);
  } catch (error) {
    console.log("Full error message:", error.message);
    if (error.response) console.log("Response data:", error.response.data);
  }
}

run();
