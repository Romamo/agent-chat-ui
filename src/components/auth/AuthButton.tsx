import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/auth/providers';
import { useAnonWithAuth } from '@/auth/providers/AnonWithAuthProvider';
import { Button } from '@/components/ui/button';
import { UserProfile } from './UserProfile';
import { SignInModal } from './SignInModal';
import { LogIn } from 'lucide-react';
import { getAuthProvider } from '@/lib/auth-config';

export const AuthButton: React.FC = () => {
  const { isAuthenticated, isAuthEnabled, user, userData } = useAuth();
  const { isAnonymous } = useAnonWithAuth();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  
  // Memoize modal open handler to prevent recreation on each render
  const handleOpenSignInModal = useCallback(() => setIsSignInModalOpen(true), []);
  const handleCloseSignInModal = useCallback(() => setIsSignInModalOpen(false), []);
  const authProvider = getAuthProvider();
  
  // Debug logging only in development and only when dependencies change
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('AuthButton state changed:', { 
        isAuthenticated, 
        isAuthEnabled, 
        isAnonymous,
        authProvider,
        user: user ? 'exists' : 'null',
        userData: userData ? 'exists' : 'null'
      });
    }
  }, [isAuthenticated, isAuthEnabled, isAnonymous, authProvider, user, userData]);

  // Don't render anything if auth is disabled, no provider is configured, or using anonymous auth
  console.log('[AuthButton] Deciding whether to render:', {
    authProvider,
    isAuthEnabled,
    isAuthenticated,
    isAnonymous,
    shouldHide: authProvider === 'anon' || !isAuthEnabled
  });
  
  if (authProvider === 'anon' || !isAuthEnabled) {
    console.log('[AuthButton] Hiding auth button');
    return null;
  }

  // Memoize the sign-in button to prevent unnecessary re-renders
  const signInButton = useMemo(() => (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleOpenSignInModal}
      className="gap-2"
    >
      <LogIn className="h-4 w-4" />
      <span>Sign In</span>
    </Button>
  ), [handleOpenSignInModal]);

  // Memoize the sign-in modal to prevent unnecessary re-renders
  const signInModal = useMemo(() => (
    <SignInModal
      isOpen={isSignInModalOpen}
      onClose={handleCloseSignInModal}
    />
  ), [isSignInModalOpen, handleCloseSignInModal]);

  // Memoize the entire component output based on authentication state
  const authContent = useMemo(() => {
    // If authenticated and not anonymous, show the user profile
    if (isAuthenticated && !isAnonymous) {
      return <UserProfile />;
    }
    // Otherwise show sign-in button
    return signInButton;
  }, [isAuthenticated, isAnonymous, signInButton]);

  return (
    <>
      {authContent}
      {signInModal}
    </>
  );
};

export default AuthButton;
