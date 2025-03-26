import React, { useState } from 'react';
import { useAuth } from '@/providers/Auth';
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
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Handle sign out with proper state management
  const handleSignOut = async () => {
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
  };

  // Debug logging
  console.log('UserProfile render:', { 
    userData, 
    user: user ? 'exists' : 'null',
    isAuthenticated,
    isLoading,
    isSigningOut
  });

  // If we have a user but no userData, show a fallback profile button
  if (!userData && user) {
    console.log('UserProfile: No userData but user exists, showing fallback');
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
  
  if (!userData) {
    console.log('UserProfile: No userData and no user, returning null');
    return null;
  }

  // Get initials for avatar fallback
  const getInitials = () => {
    if (userData.name) {
      return userData.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    }
    return userData.email?.[0].toUpperCase() || 'U';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {userData.avatar_url && (
              <AvatarImage src={userData.avatar_url} alt={userData.name || 'User'} />
            )}
            <AvatarFallback>{getInitials()}</AvatarFallback>
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
  );
};

export default UserProfile;
