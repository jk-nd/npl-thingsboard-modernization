// Direct Service Worker Registration - No Angular dependency
console.log('🚀 NPL Service Worker Direct Registration Script Loaded');

// Function to get ThingsBoard JWT token
function getThingsBoardJWTToken() {
  try {
    // Try multiple possible token locations
    const locations = [
      () => {
        const authUser = localStorage.getItem('authUser');
        if (authUser) {
          const user = JSON.parse(authUser);
          return user.token;
        }
        return null;
      },
      () => localStorage.getItem('jwt_token'),
      () => localStorage.getItem('token'), 
      () => localStorage.getItem('access_token'),
      () => sessionStorage.getItem('authUser') ? JSON.parse(sessionStorage.getItem('authUser')).token : null,
      () => sessionStorage.getItem('jwt_token'),
      () => sessionStorage.getItem('token')
    ];

    for (let i = 0; i < locations.length; i++) {
      try {
        const token = locations[i]();
        if (token) {
          console.log(`🔑 Found JWT token in location ${i + 1}`);
          return token;
        }
      } catch (e) {
        // Continue to next location
      }
    }
    
    // Debug: log all storage contents
    console.log('🔍 Available localStorage keys:', Object.keys(localStorage));
    console.log('🔍 Available sessionStorage keys:', Object.keys(sessionStorage));
    console.log('🔍 localStorage contents:');
    for (let key of Object.keys(localStorage)) {
      try {
        const value = localStorage.getItem(key);
        console.log(`  ${key}:`, value?.substring(0, 100) + (value?.length > 100 ? '...' : ''));
      } catch (e) {
        console.log(`  ${key}: <error reading>`);
      }
    }
    
    console.warn('⚠️ No JWT token found in any storage location');
    return null;
  } catch (error) {
    console.error('❌ Error getting JWT token:', error);
    return null;
  }
}

// Function to register service worker
function registerNPLServiceWorker() {
  if ('serviceWorker' in navigator) {
    console.log('🔄 Attempting to register NPL Service Worker...');
    
    navigator.serviceWorker.register('/npl-service-worker.js', { scope: '/' })
      .then(function(registration) {
        console.log('✅ NPL Service Worker registered successfully:', registration);
        
        // Send JWT token to service worker when it's ready
        const sendTokenToSW = function() {
          const token = getThingsBoardJWTToken();
          if (token && registration.active) {
            registration.active.postMessage({
              type: 'JWT_TOKEN_UPDATE',
              token: token
            });
            console.log('📤 Sent JWT token to Service Worker');
          }
        };
        
        // Wait for service worker to become active
        if (registration.active) {
          console.log('🎉 NPL Service Worker is already active and ready!');
          sendTokenToSW();
        } else {
          registration.addEventListener('updatefound', function() {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function() {
                if (newWorker.state === 'activated') {
                  console.log('🎉 NPL Service Worker activated and ready for request interception!');
                  sendTokenToSW();
                }
              });
            }
          });
        }
        
        // Listen for token requests from service worker
        navigator.serviceWorker.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'REQUEST_JWT_TOKEN') {
            console.log('🔄 Service Worker requested JWT token');
            const token = getThingsBoardJWTToken();
            if (token && event.source) {
              event.source.postMessage({
                type: 'JWT_TOKEN_RESPONSE',
                token: token
              });
              console.log('📤 Sent JWT token to Service Worker on request');
            }
          }
        });
        
      })
      .catch(function(error) {
        console.error('❌ NPL Service Worker registration failed:', error);
      });
  } else {
    console.warn('⚠️ Service Workers not supported in this browser');
  }
}

// Register immediately and after DOM is ready
console.log('📍 Scheduling Service Worker registration...');
setTimeout(registerNPLServiceWorker, 1000);

// Also try when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(registerNPLServiceWorker, 2000);
  });
} else {
  setTimeout(registerNPLServiceWorker, 1500);
}
