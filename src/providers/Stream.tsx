import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
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
import { useAuth } from "./Auth";
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
  authToken: string | null,
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
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
  authToken: string | null;
  userId: string | null;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  // Create a function to modify requests to include user ID in thread creation
  useEffect(() => {
    if (!userId) return;
    
    // Store the original fetch function
    const originalFetch = window.fetch;
    
    // Override the global fetch function
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      // Convert input to string to check if it's a thread creation request
      const url = input.toString();
      
      // Only modify thread creation requests
      if (url.includes('/threads') && init?.method === 'POST') {
        try {
          // Get the request body
          const bodyStr = init.body as string;
          if (bodyStr) {
            const body = JSON.parse(bodyStr);
            
            // Add user ID to thread metadata
            body.metadata = { ...body.metadata, user_id: userId };
            
            // Update the request with the modified body
            init.body = JSON.stringify(body);
            
            console.log(`Adding user ID ${userId} to thread creation:`, body);
          }
        } catch (error) {
          console.error('Error adding user ID to thread creation:', error);
        }
      }
      
      // Add auth headers to all requests
      const headers = getLangGraphHeaders(apiKey, authToken);
      init = init || {};
      init.headers = { ...init.headers, ...headers };
      
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
    
    console.log('Checking graph status with auth initialized:', { authToken });
    checkGraphStatus(apiUrl, apiKey, authToken).then((ok) => {
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

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [apiUrl, setApiUrl] = useQueryState("apiUrl");
  const [apiKey, _setApiKey] = useState(() => {
    return getApiKey();
  });
  
  // Get auth token, user ID, and loading state from Auth provider
  const { accessToken, isAuthenticated, user, isLoading: authLoading } = useAuth();

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  const [assistantId, setAssistantId] = useQueryState("assistantId");

  if (!apiUrl || !assistantId) {
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
                defaultValue={apiUrl ?? "http://localhost:2024"}
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
                defaultValue={assistantId ?? "agent"}
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
  console.log('StreamProvider: Auth loaded, rendering StreamSession with auth token:', !!accessToken);
  
  // Note: Thread loading is now handled in the ThreadHistory component
  
  return (
    <StreamSession 
      apiKey={apiKey} 
      apiUrl={apiUrl} 
      assistantId={assistantId}
      authToken={isAuthenticated ? accessToken : null}
      userId={isAuthenticated && user ? user.id : null}
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
