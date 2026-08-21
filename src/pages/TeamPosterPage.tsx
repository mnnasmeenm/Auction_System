import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DivisionRosterPoster from "../components/teams/DivisionRosterPoster";
import TeamSquadPoster from "../components/teams/TeamSquadPoster";
import {
  getTeamPosterData,
  setTeamLeadership,
  type TeamPosterData
} from "../services/teamPoster";
import "./TeamPosterPage.css";

type PosterTemplate = "photo" | "name-list";

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
  const requestedDivisionId = searchParams.get("division") ?? "";

  const [data, setData] = useState<TeamPosterData | null>(null);
  const [captainId, setCaptainId] = useState("");
  const [viceCaptainId, setViceCaptainId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [posterTemplate, setPosterTemplate] =
    useState<PosterTemplate>("photo");

  const loadPoster = useCallback(async () => {
    if (mode === "admin" && !requestedTeamId) {
      setErrorMessage("Select a team before opening its poster.");
      setLoading(false);
      return;
    }

    try {
      const posterData = await getTeamPosterData(
        mode === "admin" ? requestedTeamId : undefined,
        requestedDivisionId || undefined
      );

      setData(posterData);
      setCaptainId(posterData.team.captain_player_id ?? "");
      setViceCaptainId(posterData.team.vice_captain_player_id ?? "");
      setPosterTemplate(
        posterData.players.some((player) => Boolean(player.photo_path))
          ? "photo"
          : "name-list"
      );
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
  }, [mode, requestedTeamId, requestedDivisionId]);

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
        divisionId: data.division.id,
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

        <p className="page-label">
          {data?.division.name ?? "DIVISION"} · SOCIAL MEDIA POSTER
        </p>
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
          <section className="team-poster-template-panel">
            <div>
              <h2>Poster template</h2>
              <p>
                Use the name-list layout for a manually registered division
                without player or owner photographs.
              </p>
            </div>

            <label>
              Poster style
              <select
                value={posterTemplate}
                onChange={(event) =>
                  setPosterTemplate(event.target.value as PosterTemplate)
                }
              >
                <option value="photo">Photo squad poster</option>
                <option value="name-list">Name-list poster (no photos)</option>
              </select>
            </label>
          </section>

          <form
            className="team-leadership-panel"
            onSubmit={handleLeadershipSubmit}
          >
            <div>
              <h2>Captain and vice-captain</h2>
              <p>
                Select leadership from the {data.division.name} squad of {data.team.name}.
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

          {posterTemplate === "name-list" ? (
            <DivisionRosterPoster data={data} />
          ) : (
            <TeamSquadPoster data={data} />
          )}
        </>
      )}
    </main>
  );
}
