// Initialize environment variables for testing
process.env.NODE_ENV = 'test';
process.env.TB_URL = process.env.TB_URL || 'http://localhost:9090';
process.env.NPL_PROXY_URL = process.env.NPL_PROXY_URL || 'http://localhost:8081';
process.env.NPL_ENGINE_URL = process.env.NPL_ENGINE_URL || 'http://localhost:12000';
process.env.NPL_READ_MODEL_URL = process.env.NPL_READ_MODEL_URL || 'http://localhost:5001';

// Global test timeout
jest.setTimeout(30000);