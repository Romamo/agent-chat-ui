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
