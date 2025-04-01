import "./index.css";
import App from "./App.tsx";
import { createRoot } from "react-dom/client";
import { StreamProvider } from "./providers/Stream.tsx";
import { ThreadProvider } from "./providers/Thread.tsx";
import { AuthProvider, AnonProvider } from "./auth/providers";
import { AnonWithAuthProvider } from "./auth/providers/AnonWithAuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <NuqsAdapter>
      <AnonProvider>
        <AuthProvider>
          <AnonWithAuthProvider>
            <ThreadProvider>
              <StreamProvider>
                <App />
              </StreamProvider>
            </ThreadProvider>
          </AnonWithAuthProvider>
        </AuthProvider>
      </AnonProvider>
      <Toaster />
    </NuqsAdapter>
  </BrowserRouter>,
);
