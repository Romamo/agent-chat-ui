import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { useAuth } from "@/auth/providers";
import { getLangGraphHeaders } from "@/lib/auth-config";

interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

// Define a type for thread metadata that can include owner
type ThreadSearchMetadata = {
  graph_id?: string;
  assistant_id?: string;
  owner?: string;
};

function getThreadSearchMetadata(assistantId: string): ThreadSearchMetadata {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  
  // Get all auth-related values from Auth provider at component level
  const { user, isAuthenticated, accessToken, isAnonymous } = useAuth();
  
  // State to store the auth token for requests
  const [authTokenForRequests, setAuthTokenForRequests] = useState<string | null>(null);
  
  // Effect to update the auth token when auth state changes
  useEffect(() => {
    const updateAuthToken = async () => {
      // If authenticated and not anonymous, get the token
      if (isAuthenticated && !isAnonymous) {
        if (accessToken) {
          console.log('Thread provider: Using access token from auth context');
          setAuthTokenForRequests(accessToken);
        } else {
          // Try to get token directly from Supabase
          try {
            console.log('Thread provider: Attempting to get token from Supabase');
            const { supabase } = await import('@/lib/supabase');
            if (!supabase) {
              console.error('Thread provider: Supabase client is not available');
              setAuthTokenForRequests(null);
              return;
            }
            
            const { data } = await supabase.auth.getSession();
            if (data.session?.access_token) {
              console.log('Thread provider: Retrieved access token from Supabase session');
              setAuthTokenForRequests(data.session.access_token);
            } else {
              console.log('Thread provider: No access token in Supabase session');
              setAuthTokenForRequests(null);
            }
          } catch (error) {
            console.error('Thread provider: Error getting access token from Supabase:', error);
            setAuthTokenForRequests(null);
          }
        }
      } else {
        // Not authenticated or anonymous, clear the token
        console.log('Thread provider: User not authenticated or anonymous, clearing token');
        setAuthTokenForRequests(null);
      }
    };
    
    updateAuthToken();
  }, [isAuthenticated, isAnonymous, accessToken, user?.id]);
  
  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) {
      console.log('Thread provider: Missing apiUrl or assistantId, cannot fetch threads');
      return [];
    }
    
    // Get API key
    const apiKey = getApiKey();
    
    // Build search metadata with assistant/graph ID
    const searchMetadata: ThreadSearchMetadata = {
      ...getThreadSearchMetadata(assistantId),
    };
    
    // Add owner to metadata search if user is authenticated
    if (isAuthenticated && user) {
      console.log(`Thread provider: Filtering threads for owner: ${user.id}`);
      searchMetadata.owner = user.id;
    } else {
      console.log('Thread provider: User not authenticated, not filtering threads by owner');
    }

    // Add authentication headers to the request
    // For anonymous users, we'll still pass the API key but not the bearer token
    console.log('Thread provider auth state:', {
      isAuthenticated,
      isAnonymous,
      hasAccessToken: !!accessToken,
      accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : null,
      user: user ? { id: user.id } : null
    });
    
    // Determine which auth token to use
    let tokenToUse = null;
    if (isAuthenticated && !isAnonymous) {
      tokenToUse = authTokenForRequests;
      console.log('Thread provider: Using auth token for request:', tokenToUse ? `${tokenToUse.substring(0, 5)}...` : 'null');
    } else {
      console.log('Thread provider: Not using auth token for anonymous user');
    }
    
    // Get headers with the appropriate token
    const headers = getLangGraphHeaders(apiKey, tokenToUse);
    
    console.log('Thread provider: Search headers:', JSON.stringify(headers));
    console.log('Thread provider: Auth token available:', !!accessToken, 'User authenticated:', isAuthenticated, 'Is anonymous:', isAnonymous);
    
    // Use fetch with authentication headers instead of client.threads.search
    console.log('Thread provider: Sending thread search request to:', `${apiUrl}/threads/search`);
    console.log('Thread provider: Search metadata:', searchMetadata);
    
    try {
      // Create the complete headers object for the request
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };
      
      // Log the complete headers being sent
      console.log('Thread provider: Complete headers for /threads/search request:', requestHeaders);
      console.log('Thread provider: Authorization header present:', 'Authorization' in requestHeaders);
      
      const response = await fetch(`${apiUrl}/threads/search`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          metadata: searchMetadata,
          limit: 100
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Thread provider: Failed to fetch threads: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch threads: ${response.status} ${response.statusText}`);
      }
      
      console.log('Thread provider: Search response status:', response.status);
      
      let threads: Thread[] = [];
      try {
        threads = await response.json();
      } catch (jsonError) {
        console.error('Thread provider: Error parsing JSON response:', jsonError);
        throw new Error('Failed to parse thread data from server');
      }
      
      // Log the number of threads found
      console.log(`Thread provider: Found ${threads.length} threads for ${isAuthenticated ? `user ${user?.id}` : 'anonymous user'}`);
      
      return threads;
    } catch (error) {
      console.error('Thread provider: Error during thread search fetch:', error);
      throw error; // Re-throw to allow the component to handle the error
    }
  }, [apiUrl, assistantId, isAuthenticated, isAnonymous, user, authTokenForRequests]);

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
