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

// Define a type for thread metadata that can include user_id
type ThreadSearchMetadata = {
  graph_id?: string;
  assistant_id?: string;
  user_id?: string;
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
    if (!apiUrl || !assistantId) return [];
    
    // Get API key
    const apiKey = getApiKey();
    
    // Build search metadata with assistant/graph ID
    const searchMetadata: ThreadSearchMetadata = {
      ...getThreadSearchMetadata(assistantId),
    };
    
    // Add user ID to metadata search if user is authenticated
    if (isAuthenticated && user) {
      console.log(`Filtering threads for user ID: ${user.id}`);
      searchMetadata.user_id = user.id;
    } else {
      console.log('User not authenticated, not filtering threads by user ID');
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
    
    // Log the auth token being used
    console.log('Using auth token for request:', authTokenForRequests ? `${authTokenForRequests.substring(0, 5)}...` : null);
    
    // Use the auth token from state
    const headers = getLangGraphHeaders(apiKey, authTokenForRequests);
    
    console.log('Thread search headers:', JSON.stringify(headers), 'Auth token available:', !!accessToken, 'User authenticated:', isAuthenticated, 'Is anonymous:', isAnonymous);
    
    // Use fetch with authentication headers instead of client.threads.search
    console.log('Sending thread search request to:', `${apiUrl}/threads/search`);
    console.log('Search metadata:', searchMetadata);
    
    try {
      // Create the complete headers object for the request
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };
      
      // Log the complete headers being sent
      console.log('Complete headers for /threads/search request:', requestHeaders);
      console.log('Authorization header present:', 'Authorization' in requestHeaders);
      
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
        console.error(`Failed to fetch threads: ${response.status} ${response.statusText}`, errorText);
        return [];
      }
      
      console.log('Thread search response status:', response.status);
      
      const threads: Thread[] = await response.json();
      
      // Log the number of threads found
      console.log(`Found ${threads.length} threads for ${isAuthenticated ? `user ${user?.id}` : 'anonymous user'}`);
      
      // If not authenticated, threads will be filtered by assistant/graph ID only
      return threads;
    } catch (error) {
      console.error('Error during thread search fetch:', error);
      return [];
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
