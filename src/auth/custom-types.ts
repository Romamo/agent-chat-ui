// Custom Session type to replace Supabase Session
export interface CustomSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user: CustomUser;
}

// Custom User type to replace Supabase User
export interface CustomUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  app_metadata?: {
    [key: string]: any;
  };
  created_at?: string;
}

// Custom user data type
export interface CustomUserData {
  id: string | null;
  email?: string;
  name?: string;
  avatar_url?: string;
}
