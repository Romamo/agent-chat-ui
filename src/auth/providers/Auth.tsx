import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { CustomSession as Session, CustomUser as User, CustomUserData as UserData } from '@/auth/custom-types';
import { getAuthProviderInstance } from '@/auth/factory';
import { toast } from 'sonner';
import { useAnon } from './AnonContext';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userData: UserData | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  userId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get anonymous user context
  const { isAnonymous } = useAnon();

  // Get the auth provider instance
  const authProviderInstance = getAuthProviderInstance();

  useEffect(() => {
    // Initialize the auth provider
    const initAuth = async () => {
      try {
        setIsLoading(true);
        
        // Initialize the auth provider
        await authProviderInstance.initialize();
        
        // Set initial state from the provider
        setSession(authProviderInstance.getSession());
        setUser(authProviderInstance.getUser());
        setUserData(authProviderInstance.getUserData());
        setAccessToken(authProviderInstance.getAccessToken());
        setUserId(authProviderInstance.getUserId());
        
        console.log('[Auth] Initialized with provider:', authProviderInstance.constructor.name);
        console.log('[Auth] Is anonymous:', isAnonymous);
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
        toast.error('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };

    // Subscribe to auth state changes
    const subscription = authProviderInstance.subscribeToAuthChanges((session) => {
      setSession(session);
      setUser(authProviderInstance.getUser());
      setUserData(authProviderInstance.getUserData());
      setAccessToken(authProviderInstance.getAccessToken());
      setUserId(authProviderInstance.getUserId());
      
      console.log('[Auth] Auth state changed:', {
        user: authProviderInstance.getUser() ? 'exists' : 'null',
        userData: authProviderInstance.getUserData() ? 'exists' : 'null',
        session: session ? 'exists' : 'null',
      });
    });

    // Initialize auth
    initAuth();

    // Cleanup subscription
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      await authProviderInstance.signIn(email, password);
    } catch (error: any) {
      // Error handling is done inside the provider
      console.error('[Auth] Error signing in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      await authProviderInstance.signUp(email, password);
    } catch (error: any) {
      // Error handling is done inside the provider
      console.error('[Auth] Error signing up:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      await authProviderInstance.signOut();
      
      // Reset local state after sign out
      setSession(null);
      setUser(null);
      setUserData(null);
      setAccessToken(null);
      setUserId(null);
    } catch (error: any) {
      // Error handling is done inside the provider
      console.error('[Auth] Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      await authProviderInstance.resetPassword(email);
    } catch (error: any) {
      // Error handling is done inside the provider
      console.error('[Auth] Error resetting password:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      // Get the current URL for redirection after authentication
      const currentUrl = window.location.href;
      
      // Extract the URL parameters that need to be preserved
      const url = new URL(currentUrl);
      const apiUrl = url.searchParams.get('apiUrl');
      const assistantId = url.searchParams.get('assistantId');
      
      // Build the redirect URL with the necessary parameters
      let redirectUrl = window.location.origin;
      if (apiUrl || assistantId) {
        redirectUrl += '/?';
        if (apiUrl) redirectUrl += `apiUrl=${encodeURIComponent(apiUrl)}`;
        if (apiUrl && assistantId) redirectUrl += '&';
        if (assistantId) redirectUrl += `assistantId=${encodeURIComponent(assistantId)}`;
        if (url.hash) redirectUrl += url.hash;
      }
      
      console.log('[Auth] Redirecting after auth to:', redirectUrl);
      
      // Call the provider's OAuth method if available
      if (authProviderInstance.signInWithOAuth) {
        await authProviderInstance.signInWithOAuth('google', redirectUrl);
      } else {
        toast.error('OAuth sign-in is not supported by the current auth provider');
      }
    } catch (error: any) {
      // Error handling is done inside the provider
      console.error('[Auth] Error signing in with Google:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debug logging moved to useEffect to prevent re-renders on every state change
  useEffect(() => {
    console.log('[Auth] Provider State:', {
      user: user ? 'exists' : 'null',
      userData: userData ? 'exists' : 'null',
      session: session ? 'exists' : 'null',
      isAuthenticated: authProviderInstance.isAuthenticated(),
      provider: authProviderInstance.constructor.name
    });
  }, [user, userData, session, authProviderInstance]);
  
  // Log authentication state for debugging
  console.log('[Auth] Current auth state:', {
    isAuthenticated: authProviderInstance.isAuthenticated(),
    hasSession: !!session,
    hasUser: !!user,
    hasAccessToken: !!accessToken,
    accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : null,
    isAnonymous,
    userId
  });
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo(() => {
    const isAuthenticated = authProviderInstance.isAuthenticated();
    console.log('[Auth] Creating context value with:', {
      isAuthenticated,
      hasAccessToken: !!accessToken,
      isAnonymous
    });
    
    return {
      session,
      user,
      userData,
      accessToken,
      isAuthenticated,
      isAnonymous,
      isLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      signInWithGoogle,
      userId,
    };
  }, [
    session,
    user,
    userData,
    accessToken,
    authProviderInstance,
    isAnonymous,
    isLoading,
    userId
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
