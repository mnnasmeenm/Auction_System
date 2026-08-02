import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import "./ManagerChangePasswordPage.css";

export default function ManagerChangePasswordPage() {
  const navigate = useNavigate();
  const { fullName, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 10) {
      setErrorMessage("Use at least 10 characters for your new password.");
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setErrorMessage(
        "Include an uppercase letter, lowercase letter and number."
      );
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password
      });

      if (passwordError) throw passwordError;

      const { error: profileError } = await supabase.rpc(
        "complete_manager_password_change"
      );

      if (profileError) throw profileError;

      await refreshProfile();
      navigate("/manager", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your password could not be changed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main className="manager-password-page">
      <section className="manager-password-panel">
        <span className="manager-password-label">FIRST LOGIN SECURITY</span>
        <h1>Create your password</h1>
        <p>
          Welcome{fullName ? `, ${fullName}` : ""}. Replace the temporary
          password before opening your team portal.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Confirm new password
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <small>
            Minimum 10 characters with uppercase, lowercase and a number.
          </small>

          {errorMessage && <div className="form-error">{errorMessage}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Saving password…" : "Save password and continue"}
          </button>
        </form>

        <button
          type="button"
          className="manager-password-signout"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}