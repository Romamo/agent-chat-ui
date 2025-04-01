import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { useAuth } from "@/auth/providers";
import { getLangGraphHeaders } from "@/lib/auth-config";
import { toast } from "sonner";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
  authToken: string | null
): Promise<boolean> {
  try {
    const headers = getLangGraphHeaders(apiKey, authToken);
    console.log('checkGraphStatus', headers);
    const res = await fetch(`${apiUrl}/info`, {
      headers,
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
  authToken,
  userId,
  isAnonymous,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
  authToken: string | null;
  userId: string | null;
  isAnonymous: boolean;
}) => {
  // Log the props received by StreamSession
  console.log('StreamSession initialized with:', {
    hasApiKey: !!apiKey,
    apiUrl,
    assistantId,
    hasAuthToken: !!authToken,
    authToken: authToken ? `${authToken.substring(0, 5)}...` : null,
    userId
  });
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  // Create a function to modify requests to include user ID in thread creation and add auth headers
  useEffect(() => {
    // Store the original fetch function
    const originalFetch = window.fetch;
    
    // Override the global fetch function
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      // Convert input to string to check if it's a thread creation request
      const url = input.toString();
      
      // Only modify thread creation requests if userId is available
      if (userId && url.includes('/threads') && init?.method === 'POST') {
        try {
          // Get the request body
          const bodyStr = init.body as string;
          if (bodyStr) {
            const body = JSON.parse(bodyStr);
            
            // Add owner to thread metadata
            body.metadata = { ...body.metadata, owner: userId };
            
            // Update the request with the modified body
            init.body = JSON.stringify(body);
            
            console.log(`Adding owner ${userId} to thread creation:`, body);
          }
        } catch (error) {
          console.error('Error adding user ID to thread creation:', error);
        }
      }
      
      // Add auth headers to all requests
      // For API key, always include it if available
      // For auth token, only include it if it's an authenticated user (not anonymous)
      console.log('Adding auth headers to request:', {
        url,
        hasApiKey: !!apiKey,
        hasAuthToken: !!authToken,
        authToken: authToken ? `${authToken.substring(0, 5)}...` : null,
        isAnonymous // Use the isAnonymous flag passed from StreamProvider
      });
      
      // For anonymous users, always set authToken to null to prevent Authorization header
      const tokenToUse = isAnonymous ? null : authToken;
      const headers = getLangGraphHeaders(apiKey, tokenToUse);
      init = init || {};
      init.headers = { ...init.headers, ...headers };
      
      // Log auth headers for debugging
      if (url.includes('/threads')) {
        console.log('Auth headers for request to ' + url + ':', JSON.stringify(headers), 'Has auth token:', !!authToken);
      }
      
      // Call the original fetch with our modifications
      return originalFetch(input, init);
    };
    
    // Cleanup: restore the original fetch when component unmounts
    return () => {
      window.fetch = originalFetch;
    };
  }, [userId, apiKey, authToken]);
  
  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onCustomEvent: (event, options) => {
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      setThreadId(id);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  // Get auth loading state from Auth provider
  const { isLoading: authLoading } = useAuth();
  
  useEffect(() => {
    console.log('useEffect', { authLoading });
    // Only check graph status after auth is initialized
    if (authLoading) {
      console.log('Skipping graph status check - auth still loading');
      return;
    }
    
    console.log('Checking graph status with auth initialized:', { authToken, isAnonymous });
    // For anonymous users, explicitly set authToken to null
    const tokenToUse = isAnonymous ? null : authToken;
    checkGraphStatus(apiUrl, apiKey, tokenToUse).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl, authToken, authLoading]); // Re-run when auth loading state changes

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // First, declare all state hooks at the top level
  const [apiUrl, setApiUrl] = useQueryState("apiUrl");
  const [apiKey, _setApiKey] = useState(() => getApiKey());
  const [assistantId, setAssistantId] = useQueryState("assistantId");
  const [authTokenToUse, setAuthTokenToUse] = useState<string | null>(null);
  
  // Get auth token, user ID, and loading state from Auth provider
  const { accessToken, isAuthenticated, userId, isAnonymous, isLoading: authLoading } = useAuth();

  // Get environment variables
  const envApiUrl = import.meta.env.VITE_API_URL as string;
  const envAssistantId = import.meta.env.VITE_ASSISTANT_ID as string;
  const envApiKey = import.meta.env.VITE_LANGSMITH_API_KEY as string;

  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", { defaultValue: envApiUrl || "" });
  const [assistantId, setAssistantId] = useQueryState("assistantId", { defaultValue: envAssistantId || "" });
  
  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || envApiKey || "";
  });

  // Define all callbacks after state hooks
  const setApiKey = useCallback((key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  }, [_setApiKey]);
  
  // Define the token update function - moved up to ensure consistent hook order
  const updateAuthToken = useCallback(async () => {
    // First set the token from props if available
    if (isAuthenticated && !isAnonymous && accessToken) {
      console.log('StreamProvider: Using access token from auth context');
      setAuthTokenToUse(accessToken);
      return;
    }
    
    // If not authenticated or is anonymous, clear the token
    if (!isAuthenticated || isAnonymous) {
      console.log('StreamProvider: User not authenticated or anonymous, clearing token');
      setAuthTokenToUse(null);
      return;
    }
    
    // If authenticated but no access token, try to get it from Supabase
    try {
      console.log('StreamProvider: Attempting to get token directly from Supabase');
      // Import supabase client directly to get the current session
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) {
        console.error('StreamProvider: Supabase client is not available');
        return;
      }
      
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        console.log('StreamProvider: Retrieved access token directly from Supabase session');
        setAuthTokenToUse(data.session.access_token);
      } else {
        console.log('StreamProvider: No access token in Supabase session');
        setAuthTokenToUse(null);
      }
    } catch (error) {
      console.error('StreamProvider: Error getting access token from Supabase:', error);
      setAuthTokenToUse(null);
    }
  }, [isAuthenticated, isAnonymous, accessToken, setAuthTokenToUse]);
  
  // Use a single useEffect to update the token
  useEffect(() => {
    // Only try to get the token from Supabase if authenticated but no token
    if (isAuthenticated && !isAnonymous) {
      updateAuthToken();
    } else {
      setAuthTokenToUse(null);
    }
  }, [isAuthenticated, isAnonymous, accessToken, userId, updateAuthToken]);

  if (!apiUrl || !assistantId) {
  };

  // Determine final values to use, prioritizing URL params then env vars
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;
  
  // If we're missing any required values, show the form
  if (!finalApiUrl || !finalAssistantId) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full p-4">
        <div className="animate-in fade-in-0 zoom-in-95 flex flex-col border bg-background shadow-lg rounded-lg max-w-3xl">
          <div className="flex flex-col gap-2 mt-14 p-6 border-b">
            <div className="flex items-start flex-col gap-2">
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">
                Agent Chat
              </h1>
            </div>
            <p className="text-muted-foreground">
              Welcome to Agent Chat! Before you get started, you need to enter
              the URL of the deployment and the assistant / graph ID.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const apiUrl = formData.get("apiUrl") as string;
              const assistantId = formData.get("assistantId") as string;
              const apiKey = formData.get("apiKey") as string;

              setApiUrl(apiUrl);
              setApiKey(apiKey);
              setAssistantId(assistantId);

              form.reset();
            }}
            className="flex flex-col gap-6 p-6 bg-muted/50"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiUrl">
                Deployment URL<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the URL of your LangGraph deployment. Can be a local, or
                production deployment.
              </p>
              <Input
                id="apiUrl"
                name="apiUrl"
                className="bg-background"
                defaultValue={apiUrl || DEFAULT_API_URL}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assistantId">
                Assistant / Graph ID<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the ID of the graph (can be the graph name), or
                assistant to fetch threads from, and invoke when actions are
                taken.
              </p>
              <Input
                id="assistantId"
                name="assistantId"
                className="bg-background"
                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">LangSmith API Key</Label>
              <p className="text-muted-foreground text-sm">
                This is <strong>NOT</strong> required if using a local LangGraph
                server. This value is stored in your browser's local storage and
                is only used to authenticate requests sent to your LangGraph
                server.
              </p>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey ?? ""}
                className="bg-background"
                placeholder="lsv2_pt_..."
              />
            </div>

            <div className="flex justify-end mt-2">
              <Button type="submit" size="lg">
                Continue
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Show loading state while auth is initializing
  if (authLoading) {
    console.log('StreamProvider: Auth still loading, not rendering StreamSession yet');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <LangGraphLogoSVG className="h-10 text-gray-400" />
          <div className="text-gray-500">Initializing authentication...</div>
        </div>
      </div>
    );
  }

  // Only render StreamSession after auth is fully loaded
  console.log('StreamProvider: Auth loaded, rendering StreamSession with:', {
    isAuthenticated,
    isAnonymous,
    hasAuthToken: !!accessToken,
    accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : null,
    hasUserId: !!userId,
    userId: userId
  });
  
  // Note: Thread loading is now handled in the ThreadHistory component
  
  console.log('StreamProvider passing to StreamSession:', {
    isAuthenticated,
    isAnonymous,
    accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : null,
    authTokenToUse: authTokenToUse ? `${authTokenToUse.substring(0, 5)}...` : null
  });
  
  return (
    <StreamSession 
      apiKey={apiKey} 
      apiUrl={apiUrl} 
      assistantId={assistantId}
      authToken={authTokenToUse}
      userId={userId}
      isAnonymous={isAnonymous}
    >
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
