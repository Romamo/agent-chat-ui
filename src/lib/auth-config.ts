/**
 * Authentication configuration
 * This file centralizes all authentication-related configuration
 */

// Check if authentication is enabled via environment variables
export const isAuthEnabled = import.meta.env.VITE_ENABLE_AUTH === 'true';

// Authentication provider type
export type AuthProvider = 'supabase' | 'anon' | 'none';

// Get the configured authentication provider
export const getAuthProvider = (): AuthProvider => {
  if (!isAuthEnabled) {
    return 'none';
  }
  
  // Check if a specific auth provider is configured
  const configuredProvider = import.meta.env.VITE_AUTH_PROVIDER as AuthProvider;
  
  if (configuredProvider === 'anon') {
    return 'anon';
  }
  
  // Always use Supabase with anonymous fallback when Supabase is the provider
  console.log('[Auth Config] Using Supabase with anonymous fallback');
  
  // Default to Supabase (which includes anonymous fallback)
  return 'supabase';
};

/**
 * Get the headers for LangGraph API requests
 * This includes the API key and auth token if available
 */
export const getLangGraphHeaders = (apiKey: string | null, authToken: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  
  // Ensure we have valid values for logging
  const tokenToLog = authToken ? 
    (typeof authToken === 'string' && authToken.length > 5 ? 
      `${authToken.substring(0, 5)}...` : 
      'invalid format') : 
    null;
  
  console.log('[getLangGraphHeaders] Called with:', {
    hasApiKey: !!apiKey,
    hasAuthToken: !!authToken,
    authTokenType: authToken ? typeof authToken : 'null',
    authToken: tokenToLog
  });
  
  // Add API key if available
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
    console.log('[getLangGraphHeaders] Added X-Api-Key header');
  }
  
  // Add auth token if available and valid
  if (authToken && typeof authToken === 'string' && authToken.trim() !== '') {
    headers['Authorization'] = `Bearer ${authToken}`;
    console.log('[getLangGraphHeaders] Added Authorization header with Bearer token');
  } else {
    console.log('[getLangGraphHeaders] No Authorization header added:', 
      authToken === null ? '(null token)' : 
      authToken === undefined ? '(undefined token)' : 
      authToken === '' ? '(empty string token)' : 
      '(invalid token format)');
  }
  
  console.log('[getLangGraphHeaders] Returning headers:', headers);
  return headers;
};

/**
 * Create a custom fetch function that includes auth headers
 * This can be used with the LangGraph SDK
 */
export const createAuthFetch = (apiKey: string | null, authToken: string | null) => {
  return async (url: string, options: RequestInit = {}) => {
    // Get auth headers
    const authHeaders = getLangGraphHeaders(apiKey, authToken);
    
    // Merge with existing headers
    const headers = {
      ...options.headers,
      ...authHeaders,
    };
    
    // Return fetch with merged headers
    return fetch(url, {
      ...options,
      headers,
    });
  };
};

// Auth configuration interface
export interface AuthConfig {
  provider: AuthProvider;
  // Add provider-specific configuration here as needed
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  // No additional config needed for anon provider
}

// Get the full authentication configuration
export const getAuthConfig = (): AuthConfig => {
  const provider = getAuthProvider();
  
  if (provider === 'none') {
    return { provider: 'none' };
  }
  
  if (provider === 'anon') {
    return { provider: 'anon' };
  }
  
  if (provider === 'supabase') {
    return {
      provider: 'supabase',
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    };
  }
  
  // Default fallback
  return { provider: 'none' };
};
