const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// ThingsBoard configuration
const THINGSBOARD_URL = process.env.THINGSBOARD_URL || 'http://localhost:9090';
const THINGSBOARD_JWT_SECRET = process.env.THINGSBOARD_JWT_SECRET || 'thingsboard';

// Generate RSA key pair for JWT signing
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to JWK format
function pemToJwk(pem) {
  const key = crypto.createPublicKey(pem);
  const jwk = key.export({ format: 'jwk' });
  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: 'proxy-key-1',
    n: jwk.n,
    e: jwk.e
  };
}

// Enable CORS
app.use(cors());
app.use(express.json());

// OIDC Discovery endpoint
app.get('/.well-known/openid-configuration', (req, res) => {
  // Use the service name for internal communication
  const baseUrl = 'http://oidc-proxy:8080';
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/protocol/openid-connect/auth`,
    token_endpoint: `${baseUrl}/protocol/openid-connect/token`,
    userinfo_endpoint: `${baseUrl}/protocol/openid-connect/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code', 'token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    claims_supported: ['sub', 'iss', 'exp', 'iat', 'scopes', 'userId', 'tenantId']
  });
});

// JWKS endpoint - expose RSA public key
app.get('/.well-known/jwks.json', (req, res) => {
  res.json({
    keys: [pemToJwk(publicKey)]
  });
});

// Token endpoint - proxy to ThingsBoard and modify JWT
app.post('/protocol/openid-connect/token', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Forward to ThingsBoard's login endpoint
    const response = await axios.post(`${THINGSBOARD_URL}/api/auth/login`, {
      username,
      password
    });
    
    // Decode the original ThingsBoard JWT without verification
    const originalToken = response.data.token;
    const decoded = jwt.decode(originalToken, { complete: true });
    
    if (!decoded) {
      throw new Error('Failed to decode JWT');
    }
    
    // Create a new JWT with the proxy as issuer using RSA signing
    const baseUrl = 'http://oidc-proxy:8080';
    const modifiedPayload = {
      ...decoded.payload,
      iss: baseUrl // Change issuer to proxy URL
    };
    
    // Sign the modified JWT with RSA private key
    const modifiedToken = jwt.sign(modifiedPayload, privateKey, { 
      algorithm: 'RS256',
      keyid: 'proxy-key-1'
    });
    
    // Return in OIDC format
    res.json({
      access_token: modifiedToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid profile'
    });
  } catch (error) {
    console.error('Token endpoint error:', error.message);
    res.status(401).json({ error: 'invalid_grant' });
  }
});

// UserInfo endpoint
app.get('/protocol/openid-connect/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify and decode the JWT using RSA public key
    const decoded = jwt.verify(token, publicKey);
    
    // Return user info in OIDC format
    res.json({
      sub: decoded.sub,
      name: decoded.sub, // Use email as name
      email: decoded.sub,
      email_verified: true,
      scopes: decoded.scopes || []
    });
  } catch (error) {
    console.error('UserInfo endpoint error:', error.message);
    res.status(401).json({ error: 'invalid_token' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'thingsboard-oidc-proxy' });
});

app.listen(PORT, () => {
  console.log(`OIDC Proxy running on port ${PORT}`);
  console.log(`ThingsBoard URL: ${THINGSBOARD_URL}`);
  console.log('Using RSA keys for JWT signing');
}); 