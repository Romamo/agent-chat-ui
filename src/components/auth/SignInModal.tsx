import React, { useState } from 'react';
import { useAuth } from '@/providers/Auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose, onSignInSuccess }) => {
  const { signIn, signUp, resetPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        
        // Call onSignInSuccess if provided, otherwise just close the modal
        if (onSignInSuccess) {
          onSignInSuccess();
        } else {
          onClose();
        }
      } else if (mode === 'signup') {
        await signUp(email, password);
        // Don't close modal as user needs to verify email
        setMode('signin');
      } else if (mode === 'reset') {
        await resetPassword(email);
        toast.success('Password reset email sent. Please check your inbox.');
        setMode('signin');
      }
    } catch (error) {
      // Error is already handled in the auth provider
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'signin':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Sign In</DialogTitle>
              <DialogDescription>
                Sign in to your account to access personalized features.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 font-normal"
                    onClick={() => setMode('reset')}
                  >
                    Forgot password?
                  </Button>
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="text-center text-sm">
                Don't have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="px-0 font-normal"
                  onClick={() => setMode('signup')}
                >
                  Sign up
                </Button>
              </div>
            </form>
          </>
        );
        
      case 'signup':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Create an Account</DialogTitle>
              <DialogDescription>
                Sign up to save your conversations and access more features.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="px-0 font-normal"
                  onClick={() => setMode('signin')}
                >
                  Sign in
                </Button>
              </div>
            </form>
          </>
        );
        
      case 'reset':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <div className="text-center text-sm">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 font-normal"
                  onClick={() => setMode('signin')}
                >
                  Back to sign in
                </Button>
              </div>
            </form>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
};

export default SignInModal;
