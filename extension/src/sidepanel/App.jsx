import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./Shell";
import { Loading } from "./pages/Loading";
import { Hub } from "./pages/Hub";
import { Ask } from "./pages/Ask";
import { Quiz } from "./pages/Quiz";
import { Graph } from "./pages/Graph";
import { SignIn } from "./pages/SignIn";
import { useAuth } from "./lib/auth";

export function App() {
  const user = useAuth();

  // Loading state
  if (user === undefined) {
    return <Loading />;
  }

  // Not authenticated
  if (user === null) {
    return <SignIn />;
  }

  // Authenticated
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/graph" element={<Graph />} />
        <Route path="*" element={<Navigate to="/hub" replace />} />
      </Routes>
    </Shell>
  );
}
