import {
  useState
} from "react";

import type {
  FormEvent
} from "react";

import {
  Navigate
} from "react-router-dom";

import {
  supabase
} from "../services/supabase";

import {
  useAuth
} from "../context/AuthContext";

export default function LoginPage() {
  const {
    user,
    role,
    loading: authLoading
  } = useAuth();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  if (authLoading) {
    return (
      <div className="screen-message">
        Checking authentication…
      </div>
    );
  }

  if (user && role === "admin") {
    return (
      <Navigate
        to="/admin/tournaments"
        replace
      />
    );
  }

  if (user && role === "manager") {
    return (
      <Navigate
        to="/manager"
        replace
      />
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage("");

    try {
      const {
        data,
        error
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email
                .trim()
                .toLowerCase(),

            password
          });

      if (error) {
        setErrorMessage(
          error.message
        );

        return;
      }

      if (!data.user) {
        setErrorMessage(
          "The account could not be loaded."
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected login error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-logo">
          AW
        </div>

        <p className="page-label">
          SECURE ACCESS
        </p>

        <h1>
          Aththariq Player
          Auction System
        </h1>

        <p className="login-description">
          Administrators and team managers
          can sign in using their assigned
          accounts.
        </p>

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >
          <label>
            Email address

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete=
                "current-password"
              required
            />
          </label>

          {errorMessage && (
            <p className="form-error">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Signing in…"
              : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}