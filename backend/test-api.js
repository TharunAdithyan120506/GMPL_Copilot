async function run() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginIdentifier: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;
    
    console.log("Token:", token.substring(0, 20) + "...");
    
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const vendorsRes = await fetch('http://localhost:3000/api/v1/vendors', { headers });
    const vendorsData = await vendorsRes.json();
    console.log("Vendors data:", vendorsData);

    const materialsRes = await fetch('http://localhost:3000/api/v1/raw-materials', { headers });
    const materialsData = await materialsRes.json();
    console.log("Materials data:", materialsData);
    
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
