import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/auth/providers';
import { useAnonWithAuth } from '@/auth/providers/AnonWithAuthProvider';
import { Button } from '@/components/ui/button';
import { UserProfile } from './UserProfile';
import { SignInModal } from './SignInModal';
import { LogIn } from 'lucide-react';
import { getAuthProvider } from '@/lib/auth-config';

const AuthButtonComponent: React.FC = () => {
  const { isAuthenticated, user, userData } = useAuth();
  const { isAnonymous } = useAnonWithAuth();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  
  // Memoize modal open handler to prevent recreation on each render
  const handleOpenSignInModal = useCallback(() => setIsSignInModalOpen(true), []);
  const handleCloseSignInModal = useCallback(() => setIsSignInModalOpen(false), []);
  // Memoize the auth provider to prevent it from being called on every render
  const authProvider = useMemo(() => getAuthProvider(), []);
  
  // Debug logging only in development and only when dependencies change
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('AuthButton state changed:', { 
        isAuthenticated, 
        isAnonymous,
        authProvider,
        user: user ? 'exists' : 'null',
        userData: userData ? 'exists' : 'null'
      });
    }
  }, [isAuthenticated, isAnonymous, authProvider, user, userData]);

  // Don't render anything if auth is disabled or using anonymous auth
  if (process.env.NODE_ENV === 'development') {
    console.log('[AuthButton] Deciding whether to render:', {
      authProvider,
      isAuthenticated,
      isAnonymous,
      shouldHide: authProvider === 'anon'
    });
  }
  
  if (authProvider === 'anon') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthButton] Hiding auth button');
    }
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

  // Render UserProfile for authenticated users, sign-in button otherwise
  const authContent = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthButton] Rendering auth content:', { 
        isAuthenticated, 
        isAnonymous, 
        hasUser: !!user,
        hasUserData: !!userData
      });
    }
    
    // If authenticated and not anonymous, show the user profile
    if (isAuthenticated && !isAnonymous) {
      return <UserProfile />;
    }
    
    // Otherwise show sign-in button
    return signInButton;
  }, [isAuthenticated, isAnonymous, signInButton, user, userData]);

  return (
    <>
      {authContent}
      {signInModal}
    </>
  );
};

export const AuthButton = React.memo(AuthButtonComponent);
export default AuthButton;
