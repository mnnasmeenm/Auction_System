import {
  useCallback,
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import RegisteredPlayersPoster from
  "../components/players/RegisteredPlayersPoster";

import {
  getPlayers
} from "../services/players";

import {
  getTournament
} from "../services/tournaments";

import type {
  Player,
  Tournament
} from "../types/database";

import "./RegisteredPlayersPosterPage.css";

export default function RegisteredPlayersPosterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadPosterData = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [tournamentRecord, playerRecords] =
        await Promise.all([
          getTournament(tournamentId),
          getPlayers(tournamentId)
        ]);

      setTournament(tournamentRecord);
      setPlayers(playerRecords);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The registered-player poster could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadPosterData();
  }, [loadPosterData]);

  if (!tournamentId) {
    return (
      <main className="registered-poster-page">
        <section className="registered-poster-message">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/tournaments")
            }
          >
            Choose tournament
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="registered-poster-page">
      <header className="registered-poster-page-header">
        <button
          type="button"
          onClick={() =>
            navigate(
              `/admin/players?tournament=${tournamentId}`
            )
          }
        >
          ← Registered players
        </button>

        <p className="page-label">
          SOCIAL MEDIA POSTERS
        </p>

        <h1>Registered-player posters</h1>

        <p>
          Preview and download the complete player list.
          Large registrations are divided into multiple
          poster images automatically.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <section className="registered-poster-message">
          Preparing registered players…
        </section>
      ) : !tournament ? (
        <section className="registered-poster-message">
          Tournament information is unavailable.
        </section>
      ) : (
        <RegisteredPlayersPoster
          tournament={tournament}
          players={players}
        />
      )}
    </main>
  );
}