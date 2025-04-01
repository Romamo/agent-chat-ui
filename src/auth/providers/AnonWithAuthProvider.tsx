import React, { ReactNode, createContext, useContext, useMemo } from 'react';
import { useAnon } from './AnonContext';
import { useAuth } from './Auth';

// Define the context type for anonymous with auth state
interface AnonWithAuthContextType {
  isAnonymous: boolean;
}

// Create the context with undefined as default value
const AnonWithAuthContext = createContext<AnonWithAuthContextType | undefined>(undefined);

/**
 * AnonWithAuthProvider combines the anonymous and authentication states
 * to determine if a user is truly anonymous (has an anon ID but no auth session)
 */
export const AnonWithAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const anon = useAnon();
  const auth = useAuth();
  
  // A user is anonymous if they have an anonymous ID but are not authenticated
  const isAnonymous = useMemo(() => {
    const hasAnonId = !!anon.id;
    const isAuthenticated = auth.isAuthenticated;
    
    console.log('[AnonWithAuth] State:', { 
      hasAnonId, 
      isAuthenticated,
      authUser: auth.user ? 'exists' : 'null',
      authUserData: auth.userData ? 'exists' : 'null'
    });
    
    // User is anonymous if they have an anonymous ID but are not authenticated
    return hasAnonId && !isAuthenticated;
  }, [anon.id, auth.isAuthenticated, auth.user, auth.userData]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<AnonWithAuthContextType>(() => ({
    isAnonymous,
  }), [isAnonymous]);
  
  return (
    <AnonWithAuthContext.Provider value={contextValue}>
      {children}
    </AnonWithAuthContext.Provider>
  );
};

// Custom hook to use the anonymous with auth context
export const useAnonWithAuth = (): AnonWithAuthContextType => {
  const context = useContext(AnonWithAuthContext);
  if (context === undefined) {
    throw new Error('useAnonWithAuth must be used within an AnonWithAuthProvider');
  }
  return context;
};

export default AnonWithAuthContext;
