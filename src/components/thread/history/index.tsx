import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/auth/providers";

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="h-full flex flex-col w-full gap-2 items-start justify-start overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        return (
          <div key={t.thread_id} className="w-full px-1">
            <Button
              variant="ghost"
              className="text-left items-start justify-start font-normal w-[280px]"
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">{itemText}</p>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="h-full flex flex-col w-full gap-2 items-start justify-start overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton key={`skeleton-${i}`} className="w-[280px] h-10" />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  
  // Get URL parameters at the component level
  const [apiUrl, setApiUrl] = useQueryState("apiUrl");
  const [assistantId, setAssistantId] = useQueryState("assistantId");
  
  // Get environment variables for defaults
  const envApiUrl = import.meta.env.VITE_API_URL as string;
  const envAssistantId = import.meta.env.VITE_ASSISTANT_ID as string;

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } = useThreads();
  
  // Get auth state to ensure we have auth info before loading threads
  const { isLoading: authLoading, isAuthenticated, user, accessToken } = useAuth();
  
  // Use a ref to track if threads have been loaded for this user/session
  // This prevents multiple loading calls even in React strict mode
  const loadedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const loadAttemptRef = useRef(0);
  
  // Load threads after authentication is complete
  useEffect(() => {
    // Only load threads after auth is initialized and we're in browser
    if (typeof window === "undefined") {
      return;
    }
    
    if (authLoading) {
      console.log('ThreadHistory: Auth still loading, waiting...');
      setThreadsLoading(true);
      return;
    }
    
    // Check if we have the required URL parameters and set defaults if missing
    let effectiveApiUrl = apiUrl;
    let effectiveAssistantId = assistantId;
    let paramsUpdated = false;
    
    if (!effectiveApiUrl && envApiUrl) {
      console.warn('ThreadHistory: Missing apiUrl in URL parameters, using env default:', envApiUrl);
      effectiveApiUrl = envApiUrl;
      // Update the URL parameter
      setApiUrl(envApiUrl);
      paramsUpdated = true;
    }
    
    if (!effectiveAssistantId && envAssistantId) {
      console.warn('ThreadHistory: Missing assistantId in URL parameters, using env default:', envAssistantId);
      effectiveAssistantId = envAssistantId;
      // Update the URL parameter
      setAssistantId(envAssistantId);
      paramsUpdated = true;
    }
    
    // If still missing after trying env vars, show error
    if (!effectiveApiUrl || !effectiveAssistantId) {
      console.error('ThreadHistory: Missing apiUrl or assistantId in both URL and environment variables');
      toast.error('Missing API URL or Assistant ID. Please check your configuration.');
      setThreadsLoading(false);
      return;
    }
    
    // If we updated parameters, wait for the next render cycle
    if (paramsUpdated) {
      console.log('ThreadHistory: Updated URL parameters with defaults, waiting for next render cycle');
      return;
    }
    
    // Get current user ID or 'anonymous' if not authenticated
    const currentUserId = isAuthenticated && user ? user.id : 'anonymous';
    
    // Check if we've already loaded threads for this user
    // or if the user has changed (e.g., after login/logout)
    if (loadedRef.current && userIdRef.current === currentUserId) {
      console.log('ThreadHistory: Already loaded threads for this user, skipping');
      return;
    }
    
    // Track this load attempt
    const currentAttempt = ++loadAttemptRef.current;
    
    console.log(`ThreadHistory: Loading threads for user: ${currentUserId} (attempt ${currentAttempt})`);
    console.log(`ThreadHistory: Using apiUrl: ${effectiveApiUrl}, assistantId: ${effectiveAssistantId}`);
    setThreadsLoading(true);
    
    // Wait for auth state to be fully propagated
    setTimeout(() => {
      // Check if this is still the most recent attempt
      if (currentAttempt !== loadAttemptRef.current) {
        console.log(`ThreadHistory: Skipping stale load attempt ${currentAttempt}`);
        return;
      }
      
      console.log(`ThreadHistory: Executing getThreads with auth token: ${accessToken ? 'present' : 'not present'}`);
      
      getThreads()
        .then(threads => {
          // Update refs to track successful load
          loadedRef.current = true;
          userIdRef.current = currentUserId;
          
          console.log(`ThreadHistory: Loaded ${threads.length} threads for user: ${currentUserId}`);
          setThreads(threads);
        })
        .catch(error => {
          console.error('ThreadHistory: Error loading threads:', error);
          
          // More specific error message based on error type
          if (error.message && error.message.includes('401')) {
            toast.error('Authentication error loading threads. Please sign in again.');
          } else if (error.message && error.message.includes('404')) {
            toast.error('Thread service not found. Please check your API URL.');
          } else {
            toast.error('Failed to load threads. Please try refreshing the page.');
          }
          
          // Reset the loaded flag on error so we can try again
          loadedRef.current = false;
        })
        .finally(() => {
          if (currentAttempt === loadAttemptRef.current) {
            setThreadsLoading(false);
          }
        });
    }, 300); // Increased delay to ensure auth state is fully propagated
  }, [authLoading, isAuthenticated, user, accessToken, apiUrl, assistantId, getThreads, setThreads, setThreadsLoading]);

  return (
    <>
      <div className="hidden lg:flex flex-col border-r-[1px] border-slate-300 items-start justify-start gap-6 h-screen w-[300px] shrink-0 shadow-inner-right">
        <div className="flex items-center justify-between w-full pt-1.5 px-4">
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Thread History
          </h1>
        </div>
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent side="left" className="lg:hidden flex">
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
