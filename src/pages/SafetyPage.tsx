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

import {
  cleanupTestingTournament,
  resetTournamentMatchTestingData
} from "../services/testCleanup";

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

  const [cleanupConfirmation, setCleanupConfirmation] =
    useState("");

  const [cleanupAcknowledged, setCleanupAcknowledged] =
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

  async function permanentlyCleanupTestingData() {
    if (!tournament) {
      return;
    }

    if (tournament.status !== "paused") {
      setErrorMessage(
        "Pause the tournament before permanently cleaning testing data."
      );
      return;
    }

    if (cleanupConfirmation.trim() !== tournament.tournament_name) {
      setErrorMessage(
        "Type the exact tournament name to confirm cleanup."
      );
      return;
    }

    if (!cleanupAcknowledged) {
      setErrorMessage(
        "Confirm that you understand this cleanup cannot be undone."
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete all testing data for ${tournament.tournament_name}? ` +
      "A backup will download first. This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("Creating final backup before cleanup…");

    try {
      const backupContents = await createTournamentBackup(
        tournament.id
      );

      downloadBackup(
        backupContents,
        tournament.tournament_name
      );

      setSuccessMessage("Backup downloaded. Permanently cleaning test data…");

      const result = await cleanupTestingTournament({
        tournamentId: tournament.id,
        confirmationName: cleanupConfirmation.trim()
      });

      const warningText = result.warnings.length > 0
        ? `\n\nWarnings:\n${result.warnings
            .map((warning) => `${warning.area}: ${warning.message}`)
            .join("\n")}`
        : "";

      window.alert(
        `${result.message}\n` +
        `Storage objects removed: ${result.deletedStorageObjects}\n` +
        `Manager accounts removed: ${result.deletedManagerAccounts}` +
        warningText
      );

      navigate("/admin/tournaments", { replace: true });
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Testing data could not be cleaned up."
      );
    } finally {
      setWorking(false);
    }
  }

  async function resetMatchTestingData() {
    if (!tournament) return;

    if (tournament.status !== "paused") {
      setErrorMessage(
        "Pause the tournament before resetting match testing data."
      );
      return;
    }

    const confirmation = window.prompt(
      "Type RESET MATCHES to permanently remove every schedule and scoring record while keeping teams and players."
    );

    if (confirmation?.trim().toUpperCase() !== "RESET MATCHES") return;
    if (!window.confirm("Download a backup and reset all match data?")) return;

    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("Creating backup before match reset…");

    try {
      const backupContents = await createTournamentBackup(tournament.id);
      downloadBackup(backupContents, tournament.tournament_name);
      const deletedMatches = await resetTournamentMatchTestingData(
        tournament.id
      );

      setSuccessMessage(
        `${deletedMatches} matches and their scoring data were removed. Teams and players were preserved.`
      );
      await loadPage();
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Match testing data could not be reset."
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
            The backup contains auction values
            only—no payment transaction records.
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

      <section className="safety-card match-testing-reset">
        <div>
          <span>TESTING TOOL</span>
          <h2>Reset schedule and scoring data</h2>
          <p>
            Removes scheduled, live and completed matches with their innings,
            deliveries and scorecards. Teams, players, divisions and auction
            records remain available.
          </p>
        </div>

        <button
          type="button"
          disabled={working || tournament?.status !== "paused"}
          onClick={resetMatchTestingData}
        >
          {working ? "Resetting…" : "Backup and reset match data"}
        </button>

        <small>
          Pause first. After resetting, team assignments and schedule
          generation are available again.
        </small>
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

      <section className="safety-card cleanup-danger-zone">
        <div className="cleanup-danger-heading">
          <div>
            <span>PERMANENT TEST CLEANUP</span>
            <h2>Delete this testing tournament completely</h2>
          </div>

          <b>IRREVERSIBLE</b>
        </div>

        <p>
          Use this only after testing is finished. It downloads a final backup,
          then removes this tournament, its related database records, assigned
          manager accounts, player photos, team logos, manager photos and
          tournament-branding files.
        </p>

        <div className="cleanup-requirements">
          <span className={tournament?.status === "paused" ? "complete" : ""}>
            1. Tournament is paused
          </span>
          <span className={cleanupConfirmation === tournament?.tournament_name ? "complete" : ""}>
            2. Exact name entered
          </span>
          <span className={cleanupAcknowledged ? "complete" : ""}>
            3. Permanent deletion accepted
          </span>
        </div>

        <label className="cleanup-name-field">
          Type <strong>{tournament?.tournament_name}</strong> to confirm

          <input
            value={cleanupConfirmation}
            onChange={(event) => setCleanupConfirmation(event.target.value)}
            placeholder={tournament?.tournament_name}
            autoComplete="off"
          />
        </label>

        <label className="cleanup-acknowledgement">
          <input
            type="checkbox"
            checked={cleanupAcknowledged}
            onChange={(event) => setCleanupAcknowledged(event.target.checked)}
          />

          <span>
            I understand this permanently deletes the selected testing
            tournament and cannot be reversed.
          </span>
        </label>

        <button
          type="button"
          className="cleanup-permanent-button"
          disabled={
            working ||
            tournament?.status !== "paused" ||
            cleanupConfirmation !== tournament?.tournament_name ||
            !cleanupAcknowledged
          }
          onClick={permanentlyCleanupTestingData}
        >
          {working
            ? "Cleanup in progress…"
            : "Download backup and delete test tournament"}
        </button>
      </section>
    </main>
  );
}
