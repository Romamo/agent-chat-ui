/**
 * Authentication configuration
 * This file centralizes all authentication-related configuration
 */

// Check if authentication is enabled via environment variables
export const isAuthEnabled = import.meta.env.VITE_ENABLE_AUTH === 'true';

// Authentication provider type
export type AuthProvider = 'supabase' | 'none';

// Get the configured authentication provider
export const getAuthProvider = (): AuthProvider => {
  if (!isAuthEnabled) {
    return 'none';
  }
  
  // Currently only Supabase is supported, but this could be extended
  // to support other providers like Firebase, Auth0, etc.
  return 'supabase';
};

/**
 * Get the headers for LangGraph API requests
 * This includes the API key and auth token if available
 */
export const getLangGraphHeaders = (apiKey: string | null, authToken: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  
  // Add API key if available
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }
  console.log('Auth token:', authToken);
  // Add auth token if available
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
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
}

// Get the full authentication configuration
export const getAuthConfig = (): AuthConfig => {
  const provider = getAuthProvider();
  
  if (provider === 'none') {
    return { provider: 'none' };
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
