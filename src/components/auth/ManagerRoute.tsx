import type {
  ReactNode
} from "react";

import {
  Navigate
} from "react-router-dom";

import {
  useAuth
} from "../../context/AuthContext";

interface ManagerRouteProps {
  children: ReactNode;
}

export default function ManagerRoute({
  children
}: ManagerRouteProps) {
  const {
    user,
    isManager,
    teamId,
    loading
  } = useAuth();

  if (loading) {
    return (
      <div className="screen-message">
        Loading manager account…
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!isManager) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (!teamId) {
    return (
      <main className="access-denied">
        <h1>
          Team assignment required
        </h1>

        <p>
          This manager account has not
          been assigned to a team.
        </p>
      </main>
    );
  }

  return children;
}