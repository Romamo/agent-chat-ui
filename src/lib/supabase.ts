import { createClient } from '@supabase/supabase-js';
import { getAuthConfig, getAuthProvider } from './auth-config';

// Initialize Supabase client if Supabase auth provider is configured
const authProvider = getAuthProvider();
const config = getAuthConfig();

// Export auth enabled flag for backward compatibility
export const isAuthEnabled = authProvider !== 'none';

// Only create the client if Supabase is the configured provider and credentials are provided
export const supabase = authProvider === 'supabase' && config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

// Type for user data
export type UserData = {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
};
