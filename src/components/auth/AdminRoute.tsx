import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="screen-message">Loading administrator account…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <main className="access-denied">
        <h1>Administrator access required</h1>

        <p>
          Your account does not have permission to modify tournament settings.
        </p>
      </main>
    );
  }

  return children;
}