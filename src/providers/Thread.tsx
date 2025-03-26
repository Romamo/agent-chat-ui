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
  Dispatch,
  SetStateAction,
} from "react";
import { useAuth } from "./Auth";
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
  
  // Get user ID from Auth provider if user is authenticated
  const { user, isAuthenticated } = useAuth();

  // Get accessToken from Auth provider at component level
  const { accessToken } = useAuth();
  
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
    const headers = getLangGraphHeaders(apiKey, isAuthenticated && accessToken ? accessToken : null);
    
    console.log('Thread search headers:', headers, 'Auth token available:', !!accessToken, 'User authenticated:', isAuthenticated);
    
    // Use fetch with authentication headers instead of client.threads.search
    const response = await fetch(`${apiUrl}/threads/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        metadata: searchMetadata,
        limit: 100
      })
    });
    
    if (!response.ok) {
      console.error('Failed to fetch threads:', await response.text());
      return [];
    }
    
    const threads: Thread[] = await response.json();
    
    // Log the number of threads found
    console.log(`Found ${threads.length} threads for ${isAuthenticated ? `user ${user?.id}` : 'anonymous user'}`);
    
    // If not authenticated, threads will be filtered by assistant/graph ID only

    return threads;
  }, [apiUrl, assistantId, isAuthenticated, user, accessToken]);

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
