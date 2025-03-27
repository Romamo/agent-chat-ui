import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, UserData } from '@/lib/supabase';
import { getAuthProvider, isAuthEnabled } from '@/lib/auth-config';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userData: UserData | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAuthEnabled: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Get the configured auth provider
  const authProvider = getAuthProvider();

  useEffect(() => {
    // Skip auth initialization if auth is disabled or provider is 'none'
    if (authProvider === 'none' || (authProvider === 'supabase' && !supabase)) {
      setIsLoading(false);
      return;
    }

    // Initialize auth state from Supabase
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase!.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session) {
          setSession(session);
          setUser(session.user);
          setAccessToken(session.access_token);
          
          // Set user data from auth information
          if (session.user) {
            setUserData({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
            });
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        toast.error('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth state change listener for Supabase
    let subscription: { unsubscribe: () => void } | undefined;
    
    if (authProvider === 'supabase' && supabase) {
      // Get initial session
      const initSession = async () => {
        try {
          // We need to check again inside this function scope
          if (!supabase) {
            console.error('Supabase client is not available');
            return;
          }
          
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Initial session found', session.user.id);
            setSession(session);
            setUser(session.user);
            setAccessToken(session.access_token);
            
            // Set user data from auth information
            console.log('Setting user data from session:', session.user);
            
            setUserData({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
            });
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error getting initial session:', error);
        setIsLoading(false);
      }
      };
      
      // Initialize with current session
      // Call initSession and handle any errors
      initSession().catch(error => {
        console.error('Error initializing session:', error);
        setIsLoading(false);
      });
      
      // Listen for auth changes
      const response = supabase.auth.onAuthStateChange(
        async (_event: string, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
          setAccessToken(session?.access_token ?? null);
          
          if (session?.user) {
            // Set user data from auth information
            setUserData({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
            });
          } else {
            setUserData(null);
          }
        }
      );
      
      subscription = response.data.subscription;
    }

    // Initialize
    initializeAuth();

    // Cleanup subscription
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    // Check if auth is enabled and the provider is supported
    if (authProvider === 'none') {
      console.log('[Auth] Auth is disabled, cannot sign in');
      toast.error('Authentication is not enabled');
      return;
    }
    
    // Check if Supabase provider is configured correctly
    if (authProvider === 'supabase' && !supabase) {
      console.log('[Auth] Supabase not configured properly');
      toast.error('Supabase authentication is not properly configured');
      return;
    }
    
    console.log('[Auth] Attempting to sign in with email:', email);

    try {
      console.log('[Auth] Starting sign in process');
      setIsLoading(true);
      
      // At this point, we know authProvider is 'supabase' and supabase is not null
      // TypeScript doesn't recognize our earlier checks, so we need to assert again
      if (!supabase) {
        throw new Error('Supabase client is not available');
      }
      
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
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    // Check if auth is enabled and the provider is supported
    if (authProvider === 'none') {
      toast.error('Authentication is not enabled');
      return;
    }
    
    // Check if Supabase provider is configured correctly
    if (authProvider === 'supabase' && !supabase) {
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      setIsLoading(true);
      
      // At this point, we know authProvider is 'supabase' and supabase is not null
      // TypeScript doesn't recognize our earlier checks, so we need to assert again
      if (!supabase) {
        throw new Error('Supabase client is not available');
      }
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Verification email sent. Please check your inbox.');
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast.error(error.message || 'Failed to sign up');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    // Check if auth is enabled and the provider is supported
    if (authProvider === 'none') {
      return;
    }
    
    // Check if Supabase provider is configured correctly
    if (authProvider === 'supabase' && !supabase) {
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      setIsLoading(true);
      
      // At this point, we know authProvider is 'supabase' and supabase is not null
      // TypeScript doesn't recognize our earlier checks, so we need to assert again
      if (!supabase) {
        throw new Error('Supabase client is not available');
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Explicitly reset all auth state
      setSession(null);
      setUser(null);
      setUserData(null);
      setAccessToken(null);
      
      console.log('All auth state reset after sign out');
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(error.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    // Check if auth is enabled and the provider is supported
    if (authProvider === 'none') {
      toast.error('Authentication is not enabled');
      return;
    }
    
    // Check if Supabase provider is configured correctly
    if (authProvider === 'supabase' && !supabase) {
      toast.error('Supabase authentication is not properly configured');
      return;
    }

    try {
      setIsLoading(true);
      
      // At this point, we know authProvider is 'supabase' and supabase is not null
      // TypeScript doesn't recognize our earlier checks, so we need to assert again
      if (!supabase) {
        throw new Error('Supabase client is not available');
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Failed to send reset email');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add debug logging to track auth state
  console.log('Auth Provider State:', {
    user: user ? 'exists' : 'null',
    userData: userData ? 'exists' : 'null',
    session: session ? 'exists' : 'null',
    isAuthenticated: !!user
  });
  
  const value = {
    session,
    user,
    userData,
    accessToken,
    isAuthenticated: !!user,
    isAuthEnabled,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
