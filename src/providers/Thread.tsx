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
  
  // Add a debug effect to log token state changes
  useEffect(() => {
    console.log('Thread provider: Auth token state updated:', {
      hasToken: !!authTokenForRequests,
      token: authTokenForRequests ? `${authTokenForRequests.substring(0, 5)}...` : null,
      isAuthenticated,
      isAnonymous,
      userId: user?.id
    });
  }, [authTokenForRequests, isAuthenticated, isAnonymous, user?.id]);
  
  const getThreads = useCallback(async (): Promise<Thread[]> => {
    // Get environment variables for defaults
    const envApiUrl = import.meta.env.VITE_API_URL as string;
    const envAssistantId = import.meta.env.VITE_ASSISTANT_ID as string;
    
    // Use URL parameters with env var fallbacks
    const effectiveApiUrl = apiUrl || envApiUrl;
    const effectiveAssistantId = assistantId || envAssistantId;
    
    if (!effectiveApiUrl || !effectiveAssistantId) {
      console.log('Thread provider: Missing apiUrl or assistantId in both URL and environment variables');
      return [];
    }
    
    console.log(`Thread provider: Using apiUrl: ${effectiveApiUrl}, assistantId: ${effectiveAssistantId}`);
    
    // Get API key
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('Thread provider: No API key available');
    }
    
    // Build search metadata with assistant/graph ID
    const searchMetadata: ThreadSearchMetadata = {
      ...getThreadSearchMetadata(effectiveAssistantId),
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
      hasAuthTokenForRequests: !!authTokenForRequests,
      accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : null,
      authTokenForRequests: authTokenForRequests ? `${authTokenForRequests.substring(0, 5)}...` : null,
      user: user ? { id: user.id } : null
    });
    
    // Determine which auth token to use
    let tokenToUse = null;
    if (isAuthenticated && !isAnonymous) {
      // Prefer authTokenForRequests, but fall back to accessToken if needed
      tokenToUse = authTokenForRequests || accessToken;
      console.log('Thread provider: Using auth token for request:', tokenToUse ? `${tokenToUse.substring(0, 5)}...` : 'null');
    } else {
      console.log('Thread provider: Not using auth token for anonymous user');
    }
    
    // Get headers with the appropriate token
    const headers = getLangGraphHeaders(apiKey, tokenToUse);
    
    console.log('Thread provider: Search headers:', JSON.stringify(headers));
    
    // Use fetch with authentication headers instead of client.threads.search
    console.log('Thread provider: Sending thread search request to:', `${effectiveApiUrl}/threads/search`);
    console.log('Thread provider: Search metadata:', JSON.stringify(searchMetadata));
    
    try {
      // Create the complete headers object for the request
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };
      
      // Log the complete headers being sent
      console.log('Thread provider: Authorization header present:', 'Authorization' in requestHeaders);
      
      const response = await fetch(`${effectiveApiUrl}/threads/search`, {
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
      
      // Add more context to the error
      if (error instanceof Error) {
        // Enhance error message with auth state info
        const enhancedError = new Error(
          `${error.message} (Auth state: ${isAuthenticated ? 'authenticated' : 'not authenticated'}, ` +
          `Token present: ${!!tokenToUse})`
        );
        // Preserve the original stack trace
        enhancedError.stack = error.stack;
        throw enhancedError;
      }
      
      throw error; // Re-throw to allow the component to handle the error
    }
  }, [apiUrl, assistantId, isAuthenticated, isAnonymous, user, authTokenForRequests, accessToken]);

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
