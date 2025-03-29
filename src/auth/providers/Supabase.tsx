// Import the actual Supabase types we need to work with the client
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AuthProviderInterface } from '../types';
// Import our custom type aliases
import { CustomSession as Session, CustomUser as User, CustomUserData as UserData } from '../custom-types';

// Helper functions to convert between Supabase types and our custom types
function convertSupabaseSessionToCustom(supabaseSession: SupabaseSession): Session {
  return {
    access_token: supabaseSession.access_token,
    refresh_token: supabaseSession.refresh_token,
    expires_at: supabaseSession.expires_at,
    expires_in: supabaseSession.expires_in,
    user: convertSupabaseUserToCustom(supabaseSession.user),
  };
}

function convertSupabaseUserToCustom(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    user_metadata: supabaseUser.user_metadata,
    app_metadata: supabaseUser.app_metadata,
    created_at: supabaseUser.created_at,
  };
}

function extractUserDataFromUser(user: User): UserData {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name,
    avatar_url: user.user_metadata?.avatar_url,
  };
}

export class SupabaseAuthProvider implements AuthProviderInterface {
  private session: Session | null = null;
  private user: User | null = null;
  private userData: UserData | null = null;
  private accessToken: string | null = null;

  constructor() {
    // Initialization will be done separately via initialize()
  }

  // Initialize the auth state from Supabase
  async initialize(): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      return;
    }

    try {
      // Get current session
      const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (supabaseSession) {
        // Convert Supabase session to our custom Session type
        this.session = convertSupabaseSessionToCustom(supabaseSession);
        this.user = this.session.user;
        this.accessToken = this.session.access_token;
        
        console.log('[SupabaseAuth] Initialized with session, access token:', 
          this.accessToken ? `${this.accessToken.substring(0, 5)}...` : null, 
          'User ID:', this.user?.id);
        
        // Extract user data from our custom User type
        if (this.user) {
          this.userData = extractUserDataFromUser(this.user);
        }
      } else {
        console.log('[SupabaseAuth] Initialized with no session');
      }
    } catch (error) {
      console.error('[SupabaseAuth] Error initializing auth:', error);
      toast.error('Failed to initialize authentication');
    }
  }

  // Subscribe to auth state changes
  subscribeToAuthChanges(callback: (session: Session | null) => void) {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      return undefined;
    }
    
    const { data } = supabase.auth.onAuthStateChange(
      async (_event: string, supabaseSession: SupabaseSession | null) => {
        if (supabaseSession) {
          // Convert Supabase session to our custom Session type
          this.session = convertSupabaseSessionToCustom(supabaseSession);
          this.user = this.session.user;
          this.accessToken = this.session.access_token;
          
          console.log('[SupabaseAuth] Auth state changed, updated access token:', 
            this.accessToken ? `${this.accessToken.substring(0, 5)}...` : null, 
            'User ID:', this.user?.id);
          
          // Extract user data from our custom User type
          if (this.user) {
            this.userData = extractUserDataFromUser(this.user);
          }
        } else {
          this.session = null;
          this.user = null;
          this.userData = null;
          this.accessToken = null;
        }
        
        // Call the provided callback with our custom Session type
        callback(this.session);
      }
    );
    
    return data.subscription;
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      toast.error('Supabase authentication is not properly configured');
      return;
    }
    
    console.log('[SupabaseAuth] Attempting to sign in with email:', email);

    try {
      console.log('[SupabaseAuth] Starting sign in process');
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      toast.success('Signed in successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
  }

  // Sign up with email and password
  async signUp(email: string, password: string): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Verification email sent. Please check your inbox.');
    } catch (error: any) {
      console.error('[SupabaseAuth] Error signing up:', error);
      toast.error(error.message || 'Failed to sign up');
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Explicitly reset all auth state
      this.session = null;
      this.user = null;
      this.userData = null;
      this.accessToken = null;
      
      console.log('[SupabaseAuth] All auth state reset after sign out');
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('[SupabaseAuth] Error signing out:', error);
      toast.error(error.message || 'Failed to sign out');
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: any) {
      console.error('[SupabaseAuth] Error resetting password:', error);
      toast.error(error.message || 'Failed to send reset email');
      throw error;
    }
  }

  // Sign in with OAuth provider
  async signInWithOAuth(provider: string, redirectUrl?: string): Promise<void> {
    if (!supabase) {
      console.error('[SupabaseAuth] Supabase client is not available');
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      const options = redirectUrl ? { redirectTo: redirectUrl } : undefined;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any, // Type assertion needed for provider string
        options,
      });

      if (error) throw error;
      // No need for success toast as the user will be redirected
    } catch (error: any) {
      console.error(`[SupabaseAuth] Error signing in with ${provider}:`, error);
      toast.error(error.message || `Failed to sign in with ${provider}`);
      throw error;
    }
  }

  // Getters for auth state
  getSession(): Session | null {
    return this.session;
  }

  getUser(): User | null {
    return this.user;
  }

  getUserData(): UserData | null {
    return this.userData;
  }

  getAccessToken(): string | null {
    // Check if we have a session but no access token
    if (this.session && !this.accessToken) {
      console.log('[SupabaseAuth] Session exists but no access token, updating from session');
      this.accessToken = this.session.access_token;
    }
    
    console.log('[SupabaseAuth] getAccessToken called, returning:', this.accessToken ? `${this.accessToken.substring(0, 5)}...` : null);
    return this.accessToken;
  }

  getUserId(): string | null {
    return this.user?.id || null;
  }

  isAuthenticated(): boolean {
    const isAuth = !!this.user;
    console.log('[SupabaseAuth] isAuthenticated called, user:', this.user ? { id: this.user.id } : null, 'returning:', isAuth);
    return isAuth;
  }
}

export default SupabaseAuthProvider;
