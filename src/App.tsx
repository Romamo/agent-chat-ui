import "./App.css";
import { Thread } from "@/components/thread";
import { Routes, Route } from "react-router-dom";
import AuthCallback from "@/components/auth/AuthCallback";

function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Thread />} />
    </Routes>
  );
}

export default App;
