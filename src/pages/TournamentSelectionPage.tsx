import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import type {
  Tournament
} from "../types/database";

import {
  deleteTournament,
  getTournaments
} from "../services/tournaments";

import {
  useAuth
} from "../context/AuthContext";

import "./TournamentPages.css";

function formatDate(date?: string) {
  if (!date) {
    return "Date unavailable";
  }

  return new Date(date).toLocaleDateString(
    "en-LK",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

export default function TournamentSelectionPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [tournaments, setTournaments] =
    useState<Tournament[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const records = await getTournaments();
      setTournaments(records);
    } catch (error) {
      console.error(
        "Tournament loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournaments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(
    tournament: Tournament
  ) {
    const confirmed = window.confirm(
      `Delete ${tournament.tournament_name}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    try {
      await deleteTournament(tournament.id);
      await loadTournaments();
    } catch (error) {
      console.error(
        "Tournament deletion error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The tournament could not be deleted."
      );
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <main className="tournament-selection-page">
      <header className="selection-header">
        <div>
          <p className="page-label">
            ATHTHARIQ WELFARE SOCIETY
          </p>

          <h1>Select a tournament</h1>

          <p>
            Open an existing tournament or create a new one.
          </p>
        </div>

        <div className="selection-account">
          <span>{user?.email}</span>

          <button
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="selection-actions">
        <div>
          <h2>Your tournaments</h2>

          <p>
            Each tournament keeps its own teams, players,
            budgets, allocation history and settings.
          </p>
        </div>

        <button
          type="button"
          className="create-tournament-button"
          onClick={() =>
            navigate("/admin/setup")
          }
        >
          + Create new tournament
        </button>
      </section>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <section className="tournament-empty">
          Loading tournaments…
        </section>
      ) : tournaments.length === 0 ? (
        <section className="tournament-empty">
          <div className="empty-tournament-icon">
            T
          </div>

          <h2>No tournaments created</h2>

          <p>
            Create your first tournament to configure teams
            and register players.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/setup")
            }
          >
            Create first tournament
          </button>
        </section>
      ) : (
        <section className="tournament-grid">
          {tournaments.map((tournament) => (
            <article
              className="tournament-card"
              key={tournament.id}
            >
              <div className="tournament-card-top">
                <span
                  className={`tournament-status status-${tournament.status}`}
                >
                  {tournament.status}
                </span>

                <span>
                  {formatDate(tournament.created_at)}
                </span>
              </div>

              <div className="tournament-symbol">
                {tournament.tournament_name
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h2>
                {tournament.tournament_name}
              </h2>

              <p>{tournament.society_name}</p>

              <dl className="tournament-summary">
                <div>
                  <dt>Team points</dt>

                  <dd>
                    {tournament.starting_budget
                      .toLocaleString()}
                  </dd>
                </div>

                <div>
                  <dt>Squad size</dt>

                  <dd>
                    {tournament.maximum_squad_size}
                  </dd>
                </div>
              </dl>

              <div className="tournament-card-actions">
                <button
                  type="button"
                  className="open-tournament-button"
                  onClick={() =>
                    navigate(
                      `/admin/tournaments/${tournament.id}`
                    )
                  }
                >
                  Open tournament
                </button>

                <button
                  type="button"
                  className="delete-tournament-button"
                  onClick={() =>
                    handleDelete(tournament)
                  }
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}