import type { PropsWithChildren, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({
  children,
}: PropsWithChildren): ReactNode {
  const user = useAuth();

  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
