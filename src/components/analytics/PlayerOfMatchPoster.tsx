import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { getPlayerPhotoUrl } from "../../services/playerPhotos";
import { formatCricketOvers } from "../../services/scoring";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type {
  MatchPlayerAwardSuggestion,
  PlayerTournamentStatistics
} from "../../services/tournamentAnalytics";
import type { Tournament } from "../../types/database";

import "./PlayerOfMatchPoster.css";

interface PlayerOfMatchPosterProps {
  tournament: Tournament;
  suggestion: MatchPlayerAwardSuggestion;
  player: PlayerTournamentStatistics;
  reason: string;
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export default function PlayerOfMatchPoster({
  tournament,
  suggestion,
  player,
  reason
}: PlayerOfMatchPosterProps) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { match, innings } = suggestion;
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);
  const playerPhoto = getPlayerPhotoUrl(player.photoPath);
  const firstName = match.team_one?.name ?? match.team_one_placeholder ?? "Team one";
  const secondName = match.team_two?.name ?? match.team_two_placeholder ?? "Team two";
  const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
  const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);
  const firstScore = innings.find(
    (record) => record.batting_team_id === match.team_one_id
  );
  const secondScore = innings.find(
    (record) => record.batting_team_id === match.team_two_id
  );

  async function download() {
    if (!posterRef.current || downloading) return;
    setDownloading(true);

    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(posterRef.current.querySelectorAll("img"))
          .map((image) => image.decode?.().catch(() => undefined))
      );
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#040b18"
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${safeName(tournament.tournament_name)}-match-${match.match_number}-player-of-match.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="pom-poster-showcase">
      <div
        ref={posterRef}
        className="pom-poster"
        style={{
          "--pom-player-team": player.teamColor,
          "--pom-first-team": match.team_one?.team_color ?? "#2f72ff",
          "--pom-second-team": match.team_two?.team_color ?? "#ff7a18"
        } as CSSProperties}
      >
        <div className="pom-poster-grid" />
        <div className="pom-poster-glow" />

        <header>
          <div className="pom-poster-brand-logos">
            {societyLogo && <img src={societyLogo} alt="" />}
            {tournamentLogo && <img src={tournamentLogo} alt="" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h1>{tournament.tournament_name}</h1>
            <p>MATCH {match.match_number} · {match.stage.replaceAll("_", " ")}</p>
          </div>
          <strong>OFFICIAL AWARD</strong>
        </header>

        <section className="pom-match-strip">
          <article>
            <div>{firstLogo ? <img src={firstLogo} alt="" /> : initials(firstName)}</div>
            <span>{firstName}</span>
            <strong>{firstScore ? `${firstScore.runs}/${firstScore.wickets}` : "—"}</strong>
            <small>
              {firstScore
                ? `${formatCricketOvers(firstScore.legal_balls, firstScore.balls_per_over)} OVERS`
                : "NO SCORE"}
            </small>
          </article>
          <b>VS</b>
          <article>
            <div>{secondLogo ? <img src={secondLogo} alt="" /> : initials(secondName)}</div>
            <span>{secondName}</span>
            <strong>{secondScore ? `${secondScore.runs}/${secondScore.wickets}` : "—"}</strong>
            <small>
              {secondScore
                ? `${formatCricketOvers(secondScore.legal_balls, secondScore.balls_per_over)} OVERS`
                : "NO SCORE"}
            </small>
          </article>
        </section>

        <main>
          <div className="pom-player-photo">
            {playerPhoto
              ? <img src={playerPhoto} alt="" />
              : <strong>{initials(player.playerName)}</strong>}
          </div>
          <div className="pom-player-copy">
            <span>PLAYER OF THE MATCH</span>
            <h2>{player.playerName}</h2>
            <h3>{player.teamName}</h3>
            <div className="pom-performance-row">
              {player.runs > 0 && <b>{player.runs} RUNS</b>}
              {player.wickets > 0 && <b>{player.wickets} WICKETS</b>}
              {player.catches > 0 && <b>{player.catches} CATCHES</b>}
              {player.stumpings > 0 && <b>{player.stumpings} STUMPINGS</b>}
              {player.runOuts > 0 && <b>{player.runOuts} RUN-OUTS</b>}
            </div>
            <p>{reason}</p>
          </div>
        </main>

        <section className="pom-result">
          <span>MATCH RESULT</span>
          <strong>{match.result_summary ?? "Match completed"}</strong>
        </section>

        <footer>
          <span>{match.venue ?? "Venue TBA"}</span>
          <strong>{tournament.society_name}</strong>
        </footer>
      </div>

      <button type="button" onClick={download} disabled={downloading}>
        {downloading ? "Preparing image…" : "Download Player of the Match poster"}
      </button>
    </section>
  );
}
