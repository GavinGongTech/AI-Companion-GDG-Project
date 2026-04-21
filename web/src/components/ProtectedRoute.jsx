import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }) {
  const user = useAuth();
  if (user === undefined) return null; // loading
  if (user === null) return <Navigate to="/login" replace />;
  return children;
}
