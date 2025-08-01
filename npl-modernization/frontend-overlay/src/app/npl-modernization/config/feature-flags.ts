// NPL Modernization Feature Flags
// This allows safe enabling/disabling of NPL features during development

export interface NplFeatureFlags {
  enableInterceptor: boolean;
  enableGraphQL: boolean;
  enableNplEngine: boolean;
  enableLogging: boolean;
}

// Current configuration - can be easily toggled for testing
export const NPL_FEATURE_FLAGS: NplFeatureFlags = {
  enableInterceptor: false, // TEMPORARILY DISABLED for build testing
  enableGraphQL: false,     // TEMPORARILY DISABLED for build testing
  enableNplEngine: false,   // TEMPORARILY DISABLED for build testing
  enableLogging: false      // TEMPORARILY DISABLED for build testing
};

// Environment-based override capability
export function getNplFeatureFlags(): NplFeatureFlags {
  // In production or if build issues, can be disabled via environment
  const isProduction = typeof window !== 'undefined' && 
    (window as any)['TB_PRODUCTION_MODE'] === true;
  
  if (isProduction) {
    return {
      ...NPL_FEATURE_FLAGS,
      enableLogging: false  // Disable logging in production
    };
  }
  
  return NPL_FEATURE_FLAGS;
} 