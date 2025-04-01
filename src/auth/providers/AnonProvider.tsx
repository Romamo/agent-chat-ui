// No longer need uuid for anonymous users
import { toast } from 'sonner';
import { CustomSession as Session, CustomUser as User, CustomUserData as UserData } from '../custom-types';
import { AuthProviderInterface } from '../types';

// No longer storing anonymous ID in localStorage

export class AnonymousAuthProvider implements AuthProviderInterface {
  // No longer storing an ID for anonymous users
  private userData: UserData | null = null;

  constructor() {
    // Initialization will be done separately via initialize()
  }

  // Initialize the anonymous session
  async initialize(): Promise<void> {
    try {
      // Set up anonymous user with no ID
      this.setUserData();
      console.log('[AnonAuth] Initialized anonymous session with no ID');
    } catch (error) {
      console.error('[AnonAuth] Error initializing anonymous session:', error);
    }
  }

  // No longer creating sessions with IDs for anonymous users

  // Set user data for anonymous user
  private setUserData(): void {
    this.userData = {
      id: null, // Keep ID null for anonymous users
      email: '',
      name: 'Anonymous User',
      avatar_url: '',
    };
  }

  // Clear the anonymous session
  private clearSession(): void {
    try {
      this.userData = null;
      console.log('[AnonAuth] Cleared anonymous session');
    } catch (error) {
      console.error('[AnonAuth] Error clearing anonymous session:', error);
      toast.error('Failed to clear anonymous session');
    }
  }

  // Subscribe to auth state changes (not used for anonymous auth)
  subscribeToAuthChanges(_callback: (session: Session | null) => void) {
    // Anonymous auth doesn't have state changes to subscribe to
    return undefined;
  }

  // Auth methods (most are no-ops for anonymous auth)
  async signIn(_email: string, _password: string): Promise<void> {
    toast.error('Sign in is not available in anonymous mode');
  }

  async signUp(_email: string, _password: string): Promise<void> {
    toast.error('Sign up is not available in anonymous mode');
  }

  async signOut(): Promise<void> {
    try {
      this.clearSession();
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('[AnonAuth] Error signing out of anonymous session:', error);
      toast.error(error.message || 'Failed to sign out');
    }
  }

  async resetPassword(_email: string): Promise<void> {
    toast.error('Password reset is not available in anonymous mode');
  }

  // Getters for auth state
  getSession(): Session | null {
    return null; // Anonymous users don't have a session
  }

  getUser(): User | null {
    return null; // Anonymous users don't have a user object
  }

  getUserData(): UserData | null {
    return this.userData;
  }

  getAccessToken(): string | null {
    return null; // Anonymous users don't have an access token
  }

  getUserId(): string | null {
    // Return undefined for anonymous users
    return null;
  }

  isAuthenticated(): boolean {
    return false; // Anonymous users are never authenticated
  }
}

export default AnonymousAuthProvider;
