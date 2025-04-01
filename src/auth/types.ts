import { CustomSession as Session, CustomUser as User, CustomUserData as UserData } from './custom-types';

// Base authentication provider interface
export interface AuthProviderInterface {
  // Core authentication methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithOAuth?: (provider: string, redirectUrl?: string) => Promise<void>;
  
  // State getters
  getSession: () => Session | null;
  getUser: () => User | null;
  getUserData: () => UserData | null;
  getAccessToken: () => string | null;
  getUserId: () => string | null;
  isAuthenticated: () => boolean;
  
  // Initialization
  initialize: () => Promise<void>;
  subscribeToAuthChanges: (callback: (session: Session | null) => void) => { unsubscribe: () => void } | undefined;
}

// Auth state interface
export interface AuthState {
  session: Session | null;
  user: User | null;
  userData: UserData | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
}

// Auth provider type
export type AuthProviderType = 'supabase' | 'anon' | 'none';
