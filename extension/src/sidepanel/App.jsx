import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./Shell";
import { Hub } from "./pages/Hub";
import { Ask } from "./pages/Ask";
import { Quiz } from "./pages/Quiz";
import { Graph } from "./pages/Graph";
import { Course } from "./pages/Course";

export function App() {
  return (
    <Shell>
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