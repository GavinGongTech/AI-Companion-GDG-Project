import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Shell } from "./Shell";
import { Hub } from "./pages/Hub";
import { Ask } from "./pages/Ask";
import { Quiz } from "./pages/Quiz";
import { Graph } from "./pages/Graph";
import { Course } from "./pages/Course";
import { useAuth } from "../lib/auth";
import { Loading } from "./pages/Loading";
import { SignIn } from "./pages/SignIn";
import { useEffect } from "react";

function NavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function consumeNavigateTo() {
      try {
        const data = await chrome.storage.session.get(["navigateTo"]);
        const dest = data.navigateTo;
        if (!dest || cancelled) return;
        await chrome.storage.session.remove(["navigateTo"]);
        if (dest === "ask") navigate("/ask");
        else if (dest === "quiz") navigate("/quiz");
        else if (dest === "home") navigate("/home");
      } catch {
        // ignore
      }
    }

    consumeNavigateTo();

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "session") return;
      if (changes.navigateTo?.newValue) {
        void consumeNavigateTo();
      }
    };
    chrome.storage.onChanged.addListener(listener);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [navigate]);

  return null;
}

export function App() {
  const user = useAuth();

  if (user === undefined) {
    return <Loading />;
  }

  if (user === null) {
    return <SignIn />;
  }

  return (
    <Shell>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Hub />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/graph" element={<Graph />} />
        <Route path="/course" element={<Course />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Shell>
  );
}
