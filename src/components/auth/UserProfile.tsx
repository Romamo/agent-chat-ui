import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/providers';
import { useAnonWithAuth } from '@/auth/providers/AnonWithAuthProvider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { userData, signOut, isLoading, user, isAuthenticated } = useAuth();
  const { isAnonymous } = useAnonWithAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Handle sign out with proper state management - memoized to prevent recreation on each render
  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      // The Auth provider will handle the toast notification
    } catch (error) {
      console.error('Error during sign out:', error);
      // Error is already handled in the Auth provider
    } finally {
      setIsSigningOut(false);
    }
  }, [signOut]);

  // Debug logging - only in development to prevent performance impact in production
  if (process.env.NODE_ENV === 'development') {
    // Using React.useEffect to avoid re-renders caused by console.log
    React.useEffect(() => {
      console.log('UserProfile state:', { 
        userData, 
        user: user ? 'exists' : 'null',
        isAuthenticated,
        isAnonymous,
        isLoading,
        isSigningOut
      });
    }, [userData, user, isAuthenticated, isAnonymous, isLoading, isSigningOut]);
  }

  // Memoize the fallback UI for when we have a user but no userData
  const fallbackProfile = useMemo(() => {
    // Don't show profile for anonymous users
    if (isAnonymous) {
      return null;
    }
    
    // Show fallback profile for authenticated users with missing userData
    if (!userData && user) {
      return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">User</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email || ''}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isLoading || isSigningOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{isSigningOut ? 'Signing out...' : 'Log out'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      );
    }
    return null;
  }, [userData, user, isAnonymous, isLoading, isSigningOut, handleSignOut]);
  
  // Return the fallback UI if available
  if (fallbackProfile) {
    return fallbackProfile;
  }
  
  // Return null if no userData is available or if user is anonymous
  if (!userData || isAnonymous) {
    return null;
  }

  // Get initials for avatar fallback - memoized to prevent recalculation on every render
  const initials = useMemo(() => {
    if (userData?.name) {
      return userData.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    }
    return userData?.email?.[0]?.toUpperCase() || 'U';
  }, [userData?.name, userData?.email]);

  // Memoize the main profile UI to prevent unnecessary re-renders
  const mainProfile = useMemo(() => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {userData.avatar_url && (
              <AvatarImage src={userData.avatar_url} alt={userData.name || 'User'} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userData.name || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userData.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isLoading || isSigningOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? 'Signing out...' : 'Log out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [userData, isLoading, isSigningOut, initials, handleSignOut]);

  return mainProfile;
};

export default UserProfile;
