import { getAuthProvider } from '@/lib/auth-config';
import { AuthProviderInterface } from './types';
import SupabaseAuthProvider from './providers/Supabase';
import AnonymousAuthProvider from './providers/AnonProvider';
import { CustomSession as Session, CustomUser as User, CustomUserData as UserData } from './custom-types';

// Null auth provider that does nothing
class NullAuthProvider implements AuthProviderInterface {
  async initialize(): Promise<void> {}
  subscribeToAuthChanges() { return undefined; }
  async signIn() {}
  async signUp() {}
  async signOut() {}
  async resetPassword() {}
  getSession() { return null; }
  getUser() { return null; }
  getUserData() { return null; }
  getAccessToken() { return null; }
  getUserId() { return null; }
  isAuthenticated() { return false; }
}

// FallbackAuthProvider that combines Supabase and Anonymous providers
class FallbackAuthProvider implements AuthProviderInterface {
  private supabaseProvider: SupabaseAuthProvider;
  private anonProvider: AnonymousAuthProvider;
  private currentProvider: 'supabase' | 'anon' = 'anon';
  private subscriptionCallbacks: ((session: Session | null) => void)[] = [];

  constructor() {
    this.supabaseProvider = new SupabaseAuthProvider();
    this.anonProvider = new AnonymousAuthProvider();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize anon provider first as a fallback
      await this.anonProvider.initialize();
      console.log('[FallbackAuth] Anonymous provider initialized');
      
      // Then try to initialize Supabase
      try {
        await this.supabaseProvider.initialize();
        console.log('[FallbackAuth] Supabase provider initialized');
        
        // Check if we have a Supabase session
        const supabaseSession = this.supabaseProvider.getSession();
        if (supabaseSession) {
          this.currentProvider = 'supabase';
          console.log('[FallbackAuth] Using Supabase as primary provider (session found)');
        } else {
          this.currentProvider = 'anon';
          console.log('[FallbackAuth] Using Anonymous as fallback provider (no Supabase session)');
        }
      } catch (error) {
        console.error('[FallbackAuth] Failed to initialize Supabase, using Anonymous fallback:', error);
        this.currentProvider = 'anon';
      }
    } catch (error) {
      console.error('[FallbackAuth] Failed to initialize both providers:', error);
    }
  }

  subscribeToAuthChanges(callback: (session: Session | null) => void) {
    // Add callback to our list
    this.subscriptionCallbacks.push(callback);
    
    // Subscribe to Supabase auth changes
    const supabaseSubscription = this.supabaseProvider.subscribeToAuthChanges((session) => {
      if (session) {
        // If Supabase session exists, use Supabase as provider
        this.currentProvider = 'supabase';
        console.log('[FallbackAuth] Switched to Supabase provider (session received)');
      } else if (this.currentProvider === 'supabase') {
        // If Supabase session is lost, switch to anon
        this.currentProvider = 'anon';
        console.log('[FallbackAuth] Switched to Anonymous provider (Supabase session lost)');
      }
      
      // Log the current state for debugging
      console.log('[FallbackAuth] Current state:', {
        provider: this.currentProvider,
        hasSupabaseSession: !!this.supabaseProvider.getSession(),
        hasSupabaseUser: !!this.supabaseProvider.getUser(),
        hasSupabaseUserData: !!this.supabaseProvider.getUserData(),
        isAuthenticated: this.isAuthenticated()
      });
      
      // Notify all callbacks
      this.notifyCallbacks();
    });
    
    // Return a composite subscription that can be unsubscribed
    return {
      unsubscribe: () => {
        // Remove callback from our list
        this.subscriptionCallbacks = this.subscriptionCallbacks.filter(cb => cb !== callback);
        
        // Unsubscribe from Supabase
        if (supabaseSubscription) {
          supabaseSubscription.unsubscribe();
        }
      }
    };
  }

  private notifyCallbacks() {
    // Get current session
    const session = this.getSession();
    
    // Notify all callbacks
    for (const callback of this.subscriptionCallbacks) {
      callback(session);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.supabaseProvider.signIn(email, password);
    this.currentProvider = 'supabase';
    
    // Explicitly notify callbacks after sign-in to update UI
    this.notifyCallbacks();
    
    console.log('[FallbackAuth] After sign-in state:', {
      provider: this.currentProvider,
      hasSupabaseSession: !!this.supabaseProvider.getSession(),
      hasSupabaseUser: !!this.supabaseProvider.getUser(),
      hasSupabaseUserData: !!this.supabaseProvider.getUserData(),
      isAuthenticated: this.isAuthenticated()
    });
  }

  async signUp(email: string, password: string): Promise<void> {
    await this.supabaseProvider.signUp(email, password);
  }

  async signOut(): Promise<void> {
    if (this.currentProvider === 'supabase') {
      await this.supabaseProvider.signOut();
    }
    // Always fall back to anonymous after sign out
    this.currentProvider = 'anon';
  }

  async resetPassword(email: string): Promise<void> {
    await this.supabaseProvider.resetPassword(email);
  }

  async signInWithOAuth(provider: string, redirectUrl?: string): Promise<void> {
    if (this.supabaseProvider.signInWithOAuth) {
      await this.supabaseProvider.signInWithOAuth(provider, redirectUrl);
    }
  }

  getSession(): Session | null {
    return this.currentProvider === 'supabase' ? 
      this.supabaseProvider.getSession() : null;
  }

  getUser(): User | null {
    return this.currentProvider === 'supabase' ? 
      this.supabaseProvider.getUser() : null;
  }

  getUserData(): UserData | null {
    // For Supabase provider, get user data from Supabase
    if (this.currentProvider === 'supabase') {
      const userData = this.supabaseProvider.getUserData();
      const user = this.supabaseProvider.getUser();
      
      // If we have valid user data, return it
      if (userData && userData.id) {
        return userData;
      }
      
      // If we have a user but no userData, create basic userData from user
      if (user) {
        return {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email || 'User',
          avatar_url: user.user_metadata?.avatar_url || ''
        };
      }
    }
    
    // For anonymous users, don't return user data
    // This ensures anonymous users don't see a profile
    return null;
  }

  getAccessToken(): string | null {
    return this.currentProvider === 'supabase' ? 
      this.supabaseProvider.getAccessToken() : 
      this.anonProvider.getAccessToken();
  }

  getUserId(): string | null {
    return this.currentProvider === 'supabase' ? 
      this.supabaseProvider.getUserId() : 
      this.anonProvider.getUserId();
  }

  isAuthenticated(): boolean {
    // For Supabase provider, check if we have a valid session
    if (this.currentProvider === 'supabase') {
      return this.supabaseProvider.isAuthenticated();
    }
    
    // For anonymous provider, always return false to indicate not fully authenticated
    // This ensures anonymous users see the sign-in button
    return false;
  }
}

// Factory function to create the appropriate auth provider
export function createAuthProvider(): AuthProviderInterface {
  const providerType = getAuthProvider();
  
  switch (providerType) {
    case 'supabase':
      // Use the FallbackAuthProvider for Supabase to include anonymous fallback
      return new FallbackAuthProvider();
    case 'anon':
      return new AnonymousAuthProvider();
    case 'none':
    default:
      return new NullAuthProvider();
  }
}

// Get singleton instance of the auth provider
let authProviderInstance: AuthProviderInterface | null = null;

export function getAuthProviderInstance(): AuthProviderInterface {
  if (!authProviderInstance) {
    authProviderInstance = createAuthProvider();
  }
  return authProviderInstance;
}
