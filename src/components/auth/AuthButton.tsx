import React, { useState } from 'react';
import { useAuth } from '@/providers/Auth';
import { Button } from '@/components/ui/button';
import { UserProfile } from './UserProfile';
import { SignInModal } from './SignInModal';
import { LogIn } from 'lucide-react';
import { getAuthProvider } from '@/lib/auth-config';

export const AuthButton: React.FC = () => {
  const { isAuthenticated, isAuthEnabled, user, userData } = useAuth();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const authProvider = getAuthProvider();
  
  // Debug logging
  console.log('AuthButton render:', { 
    isAuthenticated, 
    isAuthEnabled, 
    authProvider,
    user: user ? 'exists' : 'null',
    userData: userData ? 'exists' : 'null'
  });

  // Don't render anything if auth is disabled or no provider is configured
  if (authProvider === 'none' || !isAuthEnabled) {
    return null;
  }

  return (
    <>
      {(isAuthenticated || userData) ? (
        <UserProfile />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSignInModalOpen(true)}
          className="gap-2"
        >
          <LogIn className="h-4 w-4" />
          <span>Sign In</span>
        </Button>
      )}
      
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
      />
    </>
  );
};

export default AuthButton;
