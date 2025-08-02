const axios = require('axios');

// Simple NPL DeviceManagement Integration Test
async function testNPLIntegration() {
  console.log('🧪 NPL DeviceManagement Integration Test');
  console.log('=========================================');
  
  try {
    // Step 1: Authenticate with ThingsBoard
    console.log('🔐 Step 1: Authentication...');
    const authResponse = await axios.post('http://localhost:8082/api/auth/login', {
      username: 'tenant@thingsboard.org',
      password: 'tenant'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // Step 2: Test device listing via NPL proxy (GraphQL)
    console.log('📊 Step 2: Testing device listing via NPL proxy...');
    try {
      const listResponse = await axios.get('http://localhost:8081/api/tenant/devices?pageSize=5', { headers });
      console.log('✅ Device listing successful via NPL proxy');
      console.log(`   Found ${listResponse.data.data?.length || 0} devices`);
    } catch (error) {
      console.error('❌ Device listing failed via NPL proxy');
      console.error('   Error:', error.response?.status, error.response?.statusText);
      console.error('   Details:', error.response?.data?.message || error.message);
    }
    
    // Step 3: Test device listing via direct ThingsBoard
    console.log('📊 Step 3: Testing device listing via direct ThingsBoard...');
    try {
      const directResponse = await axios.get('http://localhost:8082/api/tenant/devices?pageSize=5', { headers });
      console.log('✅ Device listing successful via direct ThingsBoard');
      console.log(`   Found ${directResponse.data.data?.length || 0} devices`);
    } catch (error) {
      console.error('❌ Device listing failed via direct ThingsBoard');
      console.error('   Error:', error.response?.status, error.response?.statusText);
    }
    
    // Step 4: Test device creation via NPL proxy (NPL Engine)
    console.log('📱 Step 4: Testing device creation via NPL proxy...');
    try {
      const createResponse = await axios.post('http://localhost:8081/api/device', {
        name: 'NPL-Test-Device-' + Date.now(),
        type: 'sensor',
        label: 'Created via NPL integration test'
      }, { headers });
      
      console.log('✅ Device creation successful via NPL proxy');
      console.log(`   Device ID: ${createResponse.data.id}`);
      console.log(`   Device Name: ${createResponse.data.name}`);
      
      // Clean up: Delete the test device
      if (createResponse.data.id) {
        try {
          await axios.delete(`http://localhost:8082/api/device/${createResponse.data.id}`, { headers });
          console.log('🧹 Test device cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️ Failed to clean up test device');
        }
      }
      
    } catch (error) {
      console.error('❌ Device creation failed via NPL proxy');
      console.error('   Error:', error.response?.status, error.response?.statusText);
      console.error('   Details:', error.response?.data?.message || error.message);
    }
    
    // Step 5: Check overlay injection
    console.log('🔍 Step 5: Testing overlay injection...');
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
    console.log('');
    console.log('📋 Summary:');
    console.log('- Authentication: Working ✅');
    console.log('- Overlay Injection: Check above ✅/❌');
    console.log('- GraphQL Read Operations: Check above ✅/❌'); 
    console.log('- NPL Write Operations: Check above ✅/❌');
    console.log('');
    console.log('💡 If any tests failed, check:');
    console.log('   • Docker services are running: docker compose ps');
    console.log('   • NPL features are enabled in overlay');
    console.log('   • Browser console for routing logs at http://localhost:8081');
    
  } catch (error) {
    console.error('❌ NPL Integration Test Failed');
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the test
testNPLIntegration(); 