import {
  useCallback,
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import type {
  Tournament
} from "../types/database";

import {
  getTournament
} from "../services/tournaments";

import {
  createTournamentBackup,
  downloadBackup,
  getOperatorEvents,
  setTournamentPaused,
  type OperatorEvent
} from "../services/systemSafety";

import "./SafetyPage.css";

const checklist = [
  "Confirm the projector and operator device are connected.",
  "Confirm every team budget and squad limit before bidding.",
  "Keep the auction paused during breaks or disputes.",
  "Create a backup before the event and after each session.",
  "Use History for reversals; never edit sold-player records manually."
];

function readableAction(
  action: string
) {
  return action
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function SafetyPage() {
  const navigate = useNavigate();
  const [searchParams] =
    useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [events, setEvents] =
    useState<OperatorEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [working, setWorking] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    successMessage,
    setSuccessMessage
  ] = useState("");

  const loadPage = useCallback(
    async () => {
      if (!tournamentId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [
          record,
          auditEvents
        ] = await Promise.all([
          getTournament(tournamentId),
          getOperatorEvents(
            tournamentId
          )
        ]);

        setTournament(record);
        setEvents(auditEvents);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Safety controls could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function togglePause() {
    if (!tournament) {
      return;
    }

    const currentlyPaused =
      tournament.status === "paused";

    const confirmed =
      window.confirm(
        currentlyPaused
          ? "Resume this auction now?"
          : "Pause this auction now?"
      );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setTournamentPaused(
        tournament.id,
        !currentlyPaused
      );

      setSuccessMessage(
        currentlyPaused
          ? "Auction resumed."
          : "Auction paused. Event-day changes are locked."
      );

      await loadPage();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Status could not be changed."
      );
    } finally {
      setWorking(false);
    }
  }

  async function exportBackup() {
    if (!tournament) {
      return;
    }

    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const contents =
        await createTournamentBackup(
          tournament.id
        );

      downloadBackup(
        contents,
        tournament.tournament_name
      );

      setSuccessMessage(
        "Backup exported successfully."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Backup could not be created."
      );
    } finally {
      setWorking(false);
    }
  }

  if (!tournamentId) {
    return (
      <main className="safety-page">
        <section className="safety-empty">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/admin/tournaments"
              )
            }
          >
            Choose tournament
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="safety-page">
        <section className="safety-empty">
          Loading safety controls…
        </section>
      </main>
    );
  }

  return (
    <main className="safety-page">
      <header className="safety-header">
        <p className="page-label">
          EVENT-DAY CONTROL
        </p>

        <h1>Safety and backups</h1>

        <p>
          Protect live auction records and
          maintain an operator trail.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="safety-success">
          {successMessage}
        </div>
      )}

      <section className="safety-grid">
        <article className="safety-card">
          <span
            className={
              `large-status ` +
              `status-${tournament?.status}`
            }
          >
            {tournament?.status}
          </span>

          <h2>Auction status</h2>

          <p>
            Pausing locks bids, sales,
            reversals and tournament-record
            changes.
          </p>

          <button
            type="button"
            disabled={
              working ||
              !tournament
            }
            className={
              tournament?.status ===
              "paused"
                ? "resume-control"
                : "pause-control"
            }
            onClick={togglePause}
          >
            {tournament?.status ===
            "paused"
              ? "Resume auction"
              : "Pause auction"}
          </button>
        </article>

        <article className="safety-card">
          <h2>Portable backup</h2>

          <p>
            Download tournament settings,
            teams, players, auction state,
            sales and audit records.
          </p>

          <button
            type="button"
            disabled={
              working ||
              !tournament
            }
            className="backup-control"
            onClick={exportBackup}
          >
            Download backup
          </button>

          <small>
            The backup contains tournament
            points only—no payment data.
          </small>
        </article>
      </section>

      <section className="safety-card operator-checklist">
        <h2>Operator checklist</h2>

        {checklist.map((item) => (
          <label key={item}>
            <input type="checkbox" />

            <span>{item}</span>
          </label>
        ))}
      </section>

      <section className="safety-card">
        <div className="safety-section-heading">
          <div>
            <h2>
              Recent protected actions
            </h2>

            <p>
              Latest pause, resume, sale and
              reversal records.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPage}
          >
            Refresh
          </button>
        </div>

        {events.length === 0 ? (
          <p className="audit-empty">
            No protected actions recorded.
          </p>
        ) : (
          <div className="audit-list">
            {events.map((event) => (
              <article key={event.id}>
                <strong>
                  {readableAction(
                    event.action
                  )}
                </strong>

                <span>
                  {new Date(
                    event.created_at
                  ).toLocaleString()}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}