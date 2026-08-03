import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TeamSquadPoster from "../components/teams/TeamSquadPoster";
import {
  getTeamPosterData,
  setTeamLeadership,
  type TeamPosterData
} from "../services/teamPoster";
import "./TeamPosterPage.css";

export default function TeamPosterPage({
  mode
}: {
  mode: "admin" | "manager";
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTeamId = mode === "admin"
    ? searchParams.get("team") ?? ""
    : "";

  const [data, setData] = useState<TeamPosterData | null>(null);
  const [captainId, setCaptainId] = useState("");
  const [viceCaptainId, setViceCaptainId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPoster = useCallback(async () => {
    if (mode === "admin" && !requestedTeamId) {
      setErrorMessage("Select a team before opening its poster.");
      setLoading(false);
      return;
    }

    try {
      const posterData = await getTeamPosterData(
        mode === "admin" ? requestedTeamId : undefined
      );

      setData(posterData);
      setCaptainId(posterData.team.captain_player_id ?? "");
      setViceCaptainId(posterData.team.vice_captain_player_id ?? "");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The team poster could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [mode, requestedTeamId]);

  useEffect(() => {
    loadPoster();
  }, [loadPoster]);

  async function handleLeadershipSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!data) return;

    if (!captainId || !viceCaptainId) {
      setErrorMessage("Select both captain and vice-captain.");
      return;
    }

    if (captainId === viceCaptainId) {
      setErrorMessage("Captain and vice-captain must be different players.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setTeamLeadership({
        teamId: data.team.id,
        captainPlayerId: captainId,
        viceCaptainPlayerId: viceCaptainId
      });

      setSuccessMessage("Captain and vice-captain updated successfully.");
      await loadPoster();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Team leadership could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  const backPath = mode === "admin"
    ? `/admin/teams?tournament=${data?.team.tournament_id ?? searchParams.get("tournament") ?? ""}`
    : "/manager";

  return (
    <main className="team-poster-page">
      <header className="team-poster-page-header">
        <button type="button" onClick={() => navigate(backPath)}>
          ← {mode === "admin" ? "Teams" : "My team"}
        </button>

        <p className="page-label">SOCIAL MEDIA POSTER</p>
        <h1>Official team squad</h1>
        <p>
          Assign the leadership, preview the final squad and download the poster.
        </p>
      </header>

      {errorMessage && <div className="form-error">{errorMessage}</div>}
      {successMessage && <div className="team-poster-success">{successMessage}</div>}

      {loading ? (
        <section className="team-poster-message">Loading team poster…</section>
      ) : !data ? (
        <section className="team-poster-message">
          Team poster information is unavailable.
        </section>
      ) : (
        <>
          <form
            className="team-leadership-panel"
            onSubmit={handleLeadershipSubmit}
          >
            <div>
              <h2>Captain and vice-captain</h2>
              <p>
                Only players purchased by {data.team.name} can be selected.
              </p>
            </div>

            <label>
              Captain
              <select
                value={captainId}
                onChange={(event) => setCaptainId(event.target.value)}
                disabled={data.players.length < 2}
              >
                <option value="">Select captain</option>
                {data.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Vice-captain
              <select
                value={viceCaptainId}
                onChange={(event) => setViceCaptainId(event.target.value)}
                disabled={data.players.length < 2}
              >
                <option value="">Select vice-captain</option>
                {data.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={saving || data.players.length < 2}
            >
              {saving ? "Saving…" : "Save leadership"}
            </button>
          </form>

          <TeamSquadPoster data={data} />
        </>
      )}
    </main>
  );
}