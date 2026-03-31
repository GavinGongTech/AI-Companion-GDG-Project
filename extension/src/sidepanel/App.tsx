import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./Shell";
import { Loading } from "./pages/Loading";
import { Hub } from "./pages/Hub";
import { Ask } from "./pages/Ask";
import { Quiz } from "./pages/Quiz";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Loading />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
