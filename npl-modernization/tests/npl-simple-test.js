const axios = require('axios');

async function testNPLIntegration() {
  console.log('🧪 NPL DeviceManagement Integration Test');
  console.log('=========================================');
  
  try {
    console.log('🔐 Step 1: Authentication...');
    const authResponse = await axios.post('http://localhost:8082/api/auth/login', {
      username: 'tenant@thingsboard.org',
      password: 'tenant'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('📊 Step 2: Testing device listing via NPL proxy...');
    try {
      const listResponse = await axios.get('http://localhost:8081/api/tenant/devices?pageSize=5', { headers });
      console.log('✅ Device listing successful via NPL proxy');
      console.log(`   Found ${listResponse.data.data?.length || 0} devices`);
    } catch (error) {
      console.error('❌ Device listing failed via NPL proxy');
      console.error(`   Error: ${error.response?.status} ${error.response?.statusText}`);
      console.error(`   Details: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('📊 Step 3: Testing device listing via direct ThingsBoard...');
    try {
      const directResponse = await axios.get('http://localhost:8082/api/tenant/devices?pageSize=5', { headers });
      console.log('✅ Device listing successful via direct ThingsBoard');
      console.log(`   Found ${directResponse.data.data?.length || 0} devices`);
    } catch (error) {
      console.error('❌ Device listing failed via direct ThingsBoard');
      console.error(`   Error: ${error.response?.status} ${error.response?.statusText}`);
    }
    
    console.log('🔍 Step 4: Testing overlay injection...');
    try {
      const uiResponse = await axios.get('http://localhost:8081/');
      const hasOverlay = uiResponse.data.includes('npl-overlay.js');
      if (hasOverlay) {
        console.log('✅ NPL overlay is properly injected');
      } else {
        console.log('❌ NPL overlay NOT found in UI');
      }
    } catch (error) {
      console.error('❌ Failed to check overlay injection');
    }
    
    console.log('');
    console.log('🎉 NPL Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ NPL Integration Test Failed');
    console.error('Fatal error:', error.message);
  }
}

testNPLIntegration();
