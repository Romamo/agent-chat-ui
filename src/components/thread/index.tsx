import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useAuth } from "@/auth/providers";
import { useState, FormEvent } from "react";
import { getAuthProvider } from "@/lib/auth-config";
import { SignInModal } from "../auth/SignInModal";
import { AuthButton } from "../auth/AuthButton";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

export function Thread() {
  const [threadId, setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const prevAuthState = useRef<boolean | null>(null);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const { isAuthenticated } = useAuth();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);
  
  // Load any saved pending message from localStorage on component mount
  useEffect(() => {
    const savedMessage = localStorage.getItem('pendingMessage');
    if (savedMessage) {
      setPendingMessage(savedMessage);
      setInput(savedMessage);
    }
  }, []);
  
  // We're no longer using this effect to auto-send messages after authentication
  // Instead, we're handling it directly in the onSignInSuccess callback
  useEffect(() => {
    // Update previous auth state
    prevAuthState.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const error = stream.error as any;
      const message = error.message;
      const status = error.status || (error.response && error.response.status);
      
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      
      // Check if error is a 403 Forbidden
      if (status === 403 || (message && message.includes("403"))) {
        // Save the current input as pending message
        if (input && input.trim()) {
          setPendingMessage(input);
          localStorage.setItem('pendingMessage', input);
        }
        
        toast.error("Authentication required", {
          description: "Please sign in to send your message. Your message will be preserved.",
          duration: 5000,
          richColors: true,
          closeButton: true,
        });
        setIsSignInModalOpen(true);
      } else {
        // For other errors, show the generic error message
        toast.error("An error occurred. Please try again.", {
          description: (
            <p>
              <strong>Error:</strong> <code>{message}</code>
            </p>
          ),
          richColors: true,
          closeButton: true,
        });
      }
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Ensure we have the latest pending message from localStorage if available
    const storedMessage = localStorage.getItem('pendingMessage');
    if (storedMessage && !pendingMessage) {
      setPendingMessage(storedMessage);
    }
    
    // Use pending message if available, otherwise use input
    // We need to directly access localStorage here because state updates might not be reflected immediately
    const messageToSend = pendingMessage || storedMessage || input;
    
    if (!messageToSend?.trim() || isLoading) {
      return;
    }
    
    // Check if user is authenticated before sending the message
    // Skip authentication check if using anonymous auth provider
    const currentAuthProvider = getAuthProvider();
    
    // Direct check of environment variables for debugging
    const directEnvCheck = {
      VITE_ENABLE_AUTH: import.meta.env.VITE_ENABLE_AUTH,
      VITE_AUTH_PROVIDER: import.meta.env.VITE_AUTH_PROVIDER,
      rawProvider: import.meta.env.VITE_AUTH_PROVIDER,
      providerType: typeof import.meta.env.VITE_AUTH_PROVIDER
    };
    
    console.log('[Thread] Direct env check:', directEnvCheck);
    console.log('[Thread] Auth check when sending message:', { 
      isAuthenticated, 
      authProvider: currentAuthProvider,
      willShowSignIn: !isAuthenticated && currentAuthProvider !== 'anon'
    });
    
    // Force skip sign-in if VITE_AUTH_PROVIDER is explicitly 'anon'
    const forceSkipSignIn = import.meta.env.VITE_AUTH_PROVIDER === 'anon';
    
    if (!isAuthenticated && currentAuthProvider !== 'anon' && !forceSkipSignIn) {
      console.log('[Thread] Opening sign-in modal');
      setPendingMessage(messageToSend);
      localStorage.setItem('pendingMessage', messageToSend);
      setIsSignInModalOpen(true);
      return;
    }
    
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: messageToSend,
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);
    
    // We're not catching errors here anymore as they're handled by the useEffect hook
    // that watches stream.error
    stream.submit(
      { messages: [...toolMessages, newHumanMessage] },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    // Clear both input and pending message
    setInput("");
    setPendingMessage(null);
    localStorage.removeItem('pendingMessage');
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
    });
  };

  const chatStarted = !!threadId || !!messages.length;

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <div className="relative lg:flex hidden">
        <motion.div
          className="absolute h-full border-r bg-white overflow-hidden z-20"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div className="relative h-full" style={{ width: 300 }}>
            <ThreadHistory />
          </div>
        </motion.div>
      </div>
      
      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInModalOpen} 
        onClose={() => {
          setIsSignInModalOpen(false);
          // Keep the pending message in the input field
          if (pendingMessage) {
            setInput(pendingMessage);
          }
        }} 
        onSignInSuccess={() => {
          setIsSignInModalOpen(false);
          
          // Get the message directly from localStorage to avoid closure issues with state
          const storedMessage = localStorage.getItem('pendingMessage');
          
          if (storedMessage) {
            // Use a longer timeout to ensure auth state is fully updated
            setTimeout(() => {
              // Create a function that directly uses the stored message
              const submitStoredMessage = () => {
                // Create a synthetic submit event
                const event = new Event('submit') as unknown as FormEvent;
                
                // Temporarily set the input to the stored message
                setInput(storedMessage);
                
                // Small delay to ensure state update
                setTimeout(() => {
                  // Clear localStorage first
                  localStorage.removeItem('pendingMessage');
                  
                  // Then submit the form
                  handleSubmit(event);
                }, 100);
              };
              
              submitStoredMessage();
            }, 1500);
          }
        }}
      />
      <motion.div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden relative",
          !chatStarted && "grid-rows-[1fr]",
        )}
        layout={isLargeScreen}
        animate={{
          marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
          width: chatHistoryOpen
            ? isLargeScreen
              ? "calc(100% - 300px)"
              : "100%"
            : "100%",
        }}
        transition={
          isLargeScreen
            ? { type: "spring", stiffness: 300, damping: 30 }
            : { duration: 0 }
        }
      >
        {!chatStarted && (
          <div className="absolute top-0 left-0 w-full flex items-center justify-between z-10 h-[52px] px-4">
            <div className="flex items-center">
              {(!chatHistoryOpen || !isLargeScreen) ? (
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
              ) : (
                <div className="w-10"></div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AuthButton />
            </div>
          </div>
        )}
        {chatStarted && (
          <div className="flex items-center justify-between gap-3 h-[52px] px-4 z-10 relative">
            <div className="flex items-center justify-start gap-2 relative">
              <div className="absolute left-0 z-10">
                {(!chatHistoryOpen || !isLargeScreen) && (
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
                )}
              </div>
              <motion.button
                className="flex gap-2 items-center cursor-pointer"
                onClick={() => setThreadId(null)}
                animate={{
                  marginLeft: !chatHistoryOpen ? 48 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <LangGraphLogoSVG width={32} height={32} />
                <span className="text-xl font-semibold tracking-tight">
                  Agent Chat
                </span>
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              <AuthButton />
              <TooltipIconButton
                size="lg"
                className="p-4"
                tooltip="New thread"
                variant="ghost"
                onClick={() => setThreadId(null)}
              >
                <SquarePen className="size-5" />
              </TooltipIconButton>
            </div>

            <div className="absolute inset-x-0 top-full h-5 bg-gradient-to-b from-background to-background/0" />
          </div>
        )}

        <StickToBottom className="relative flex-1 overflow-hidden">
          <StickyToBottomContent
            className={cn(
              "absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
              !chatStarted && "flex flex-col items-stretch mt-[25vh]",
              chatStarted && "grid grid-rows-[1fr_auto]",
            )}
            contentClassName="pt-8 pb-16  max-w-3xl mx-auto flex flex-col gap-4 w-full"
            content={
              <>
                {messages
                  .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                  .map((message, index) =>
                    message.type === "human" ? (
                      <HumanMessage
                        key={message.id || `${message.type}-${index}`}
                        message={message}
                        isLoading={isLoading}
                      />
                    ) : (
                      <AssistantMessage
                        key={message.id || `${message.type}-${index}`}
                        message={message}
                        isLoading={isLoading}
                        handleRegenerate={handleRegenerate}
                      />
                    ),
                  )}
                {isLoading && !firstTokenReceived && (
                  <AssistantMessageLoading />
                )}
              </>
            }
            footer={
              <div className="sticky flex flex-col items-center gap-8 bottom-0 px-4 bg-white">
                {!chatStarted && (
                  <div className="flex gap-3 items-center">
                    <LangGraphLogoSVG className="flex-shrink-0 h-8" />
                    <h1 className="text-2xl font-semibold tracking-tight">
                      Agent Chat
                    </h1>
                  </div>
                )}

                <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 animate-in fade-in-0 zoom-in-95" />

                <div className="bg-muted rounded-2xl border shadow-xs mx-auto mb-8 w-full max-w-3xl relative z-10">
                  <form
                    onSubmit={handleSubmit}
                    className="grid grid-rows-[1fr_auto] gap-2 max-w-3xl mx-auto"
                  >
                    <textarea
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        // If we have a pending message, update it as well
                        if (pendingMessage) {
                          setPendingMessage(e.target.value);
                          localStorage.setItem('pendingMessage', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
                          e.preventDefault();
                          const el = e.target as HTMLElement | undefined;
                          const form = el?.closest("form");
                          form?.requestSubmit();
                        }
                      }}
                      placeholder="Type your message..."
                      className="p-3.5 pb-0 border-none bg-transparent field-sizing-content shadow-none ring-0 outline-none focus:outline-none focus:ring-0 resize-none"
                    />

                    <div className="flex items-center justify-between p-2 pt-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="render-tool-calls"
                            checked={hideToolCalls ?? false}
                            onCheckedChange={setHideToolCalls}
                          />
                          <Label
                            htmlFor="render-tool-calls"
                            className="text-sm text-gray-600"
                          >
                            Hide Tool Calls
                          </Label>
                        </div>
                      </div>
                      {stream.isLoading ? (
                        <Button key="stop" onClick={() => stream.stop()}>
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          className="transition-all shadow-md"
                          disabled={isLoading || !input.trim()}
                        >
                          Send
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            }
          />
        </StickToBottom>
      </motion.div>
    </div>
  );
}
