import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

// Define the context type for anonymous users
interface AnonContextType {
  id: string | null;
  isAnonymous: boolean;
  isLoading: boolean;
  createAnonSession: () => void;
  clearAnonSession: () => void;
}

// Create the context with undefined as default value
const AnonContext = createContext<AnonContextType | undefined>(undefined);

// Local storage key for anonymous ID
const ANON_ID_KEY = 'lg:chat:anon_id';

export const AnonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [id, setId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize anonymous session from local storage
  useEffect(() => {
    const initializeAnonSession = () => {
      try {
        // Try to get existing anonymous ID from local storage
        const storedId = localStorage.getItem(ANON_ID_KEY);
        
        if (storedId) {
          console.log('[Anon] Restored anonymous session:', storedId);
          setId(storedId);
        } else {
          // If no existing ID, create a new one
          createAnonSession();
        }
      } catch (error) {
        console.error('[Anon] Error initializing anonymous session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAnonSession();
  }, []);

  // Create a new anonymous session
  const createAnonSession = () => {
    try {
      const newId = uuidv4();
      localStorage.setItem(ANON_ID_KEY, newId);
      setId(newId);
      console.log('[Anon] Created new anonymous session:', newId);
    } catch (error) {
      console.error('[Anon] Error creating anonymous session:', error);
      toast.error('Failed to create anonymous session');
    }
  };

  // Clear the anonymous session
  const clearAnonSession = () => {
    try {
      localStorage.removeItem(ANON_ID_KEY);
      setId(null);
      console.log('[Anon] Cleared anonymous session');
    } catch (error) {
      console.error('[Anon] Error clearing anonymous session:', error);
      toast.error('Failed to clear anonymous session');
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo<AnonContextType>(() => ({
    id,
    // An anonymous user is one who has an anonymous ID but no authenticated session
    isAnonymous: false, // This will be overridden in the AnonWithAuthProvider
    isLoading,
    createAnonSession,
    clearAnonSession,
  }), [
    id,
    isLoading
    // createAnonSession and clearAnonSession are stable function references
    // created in the component body and don't need to be dependencies
  ]);

  return (
    <AnonContext.Provider value={contextValue}>
      {children}
    </AnonContext.Provider>
  );
};

// Custom hook to use the anonymous context
export const useAnon = (): AnonContextType => {
  const context = useContext(AnonContext);
  if (context === undefined) {
    throw new Error('useAnon must be used within an AnonProvider');
  }
  return context;
};

export default AnonContext;
