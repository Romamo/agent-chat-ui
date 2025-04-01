import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      setDebugInfo('Starting auth callback processing...');
      try {
        // Get the return URL from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        const decodedReturnUrl = returnUrl ? decodeURIComponent(returnUrl) : null;
        
        setDebugInfo(prev => prev + `\nReturn URL: ${decodedReturnUrl || 'none'}`);
        
        // Check if supabase client is available
        if (!supabase) {
          throw new Error('Supabase client is not available');
        }
        
        // Check if we have a session
        setDebugInfo(prev => prev + '\nChecking for session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setDebugInfo(prev => prev + `\nSession error: ${error.message}`);
          throw error;
        }
        
        setDebugInfo(prev => prev + `\nSession found: ${data?.session ? 'Yes' : 'No'}`);
        if (data?.session) {
          setDebugInfo(prev => prev + `\nUser ID: ${data.session.user.id}`);
        }
        
        if (data?.session) {
          // Authentication successful
          toast.success('Successfully signed in');
          setDebugInfo(prev => prev + '\nAuthentication successful');
          
          // Redirect to the original URL if available, otherwise to the home page
          if (decodedReturnUrl) {
            setDebugInfo(prev => prev + `\nAttempting to redirect to: ${decodedReturnUrl}`);
            
            // Try a different approach for redirection
            try {
              // First try with window.location.replace
              setDebugInfo(prev => prev + '\nUsing window.location.replace');
              window.location.replace(decodedReturnUrl);
              
              // If that doesn't work immediately, try a fallback approach after a short delay
              setTimeout(() => {
                setDebugInfo(prev => prev + '\nFallback: Using window.location.href');
                window.location.href = decodedReturnUrl;
              }, 500);
            } catch (e) {
              setDebugInfo(prev => prev + `\nRedirection error: ${e}`);
              // Final fallback
              setTimeout(() => {
                window.location.href = decodedReturnUrl;
              }, 1000);
            }
          } else {
            setDebugInfo(prev => prev + '\nNo return URL, redirecting to home');
            // Fallback to home page
            navigate('/');
          }
        } else {
          // No session found, redirect to home page
          navigate('/');
        }
      } catch (error: any) {
        console.error('Error in auth callback:', error);
        toast.error(error.message || 'Authentication failed');
        
        // Try to get the return URL even in error cases
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        
        if (returnUrl) {
          // If we have a return URL, redirect to it even on error
          const decodedReturnUrl = decodeURIComponent(returnUrl);
          window.location.href = decodedReturnUrl;
        } else {
          // Fallback to home page
          navigate('/');
        }
      }
    };

    handleAuthCallback();
  }, [navigate]);

  // Show a loading state while processing the callback
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground mb-4">Completing authentication...</p>
        
        {/* Debug information */}
        <div className="text-left bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs font-mono">
          <pre>{debugInfo || 'Initializing...'}</pre>
        </div>
        
        {/* Manual redirect button as fallback */}
        {debugInfo.includes('Attempting to redirect') && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">If you're not redirected automatically:</p>
            <button 
              onClick={() => {
                const urlParams = new URLSearchParams(window.location.search);
                const returnUrl = urlParams.get('returnUrl');
                if (returnUrl) {
                  window.location.href = decodeURIComponent(returnUrl);
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Click here to continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
