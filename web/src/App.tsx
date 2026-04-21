import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { Download } from "./pages/Download";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { Welcome } from "./pages/Welcome";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));

export default function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/download" element={<Download />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}
