import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { formatCricketOvers } from "../../services/scoring";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type {
  MatchInnings,
  Player,
  Tournament,
  TournamentMatch
} from "../../types/database";

import "./MatchSummaryCard.css";

interface MatchSummaryCardProps {
  tournament: Tournament;
  match: TournamentMatch;
  innings: MatchInnings[];
  playerOfMatch?: Player | null;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

function teamScore(innings: MatchInnings[], teamId: string | null) {
  return innings.find((record) => record.batting_team_id === teamId) ?? null;
}

export default function MatchSummaryCard({
  tournament,
  match,
  innings,
  playerOfMatch = null
}: MatchSummaryCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const firstName = match.team_one?.name ?? match.team_one_placeholder ?? "Team one";
  const secondName = match.team_two?.name ?? match.team_two_placeholder ?? "Team two";
  const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
  const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);
  const firstScore = teamScore(innings, match.team_one_id);
  const secondScore = teamScore(innings, match.team_two_id);

  async function downloadCard() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(cardRef.current.querySelectorAll("img"))
          .map((image) => image.decode?.().catch(() => undefined))
      );
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#071126"
      });
      const link = document.createElement("a");
      link.download = `${safeName(tournament.tournament_name)}-match-${match.match_number}-summary.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="match-summary-showcase">
      <div
        ref={cardRef}
        className="match-summary-card"
        style={{
          "--summary-first": match.team_one?.team_color ?? "#2f72ff",
          "--summary-second": match.team_two?.team_color ?? "#ff7a18"
        } as CSSProperties}
      >
        <div className="match-summary-grid" />
        <header>
          <div className="match-summary-brand-logos">
            {societyLogo && <img src={societyLogo} alt="" />}
            {tournamentLogo && <img src={tournamentLogo} alt="" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h2>{tournament.tournament_name}</h2>
            <p>MATCH {match.match_number} · {match.stage.replaceAll("_", " ")}</p>
          </div>
          <strong>{match.status === "completed" ? "FINAL" : match.status.replaceAll("_", " ")}</strong>
        </header>

        <main>
          <article className="match-summary-team summary-team-one">
            <div>{firstLogo ? <img src={firstLogo} alt="" /> : <b>{initials(firstName)}</b>}</div>
            <h3>{firstName}</h3>
            <strong>{firstScore ? `${firstScore.runs}/${firstScore.wickets}` : "—"}</strong>
            <small>{firstScore ? `${formatCricketOvers(firstScore.legal_balls, firstScore.balls_per_over)} OVERS` : "YET TO BAT"}</small>
          </article>
          <div className="match-summary-versus"><span>VS</span></div>
          <article className="match-summary-team summary-team-two">
            <div>{secondLogo ? <img src={secondLogo} alt="" /> : <b>{initials(secondName)}</b>}</div>
            <h3>{secondName}</h3>
            <strong>{secondScore ? `${secondScore.runs}/${secondScore.wickets}` : "—"}</strong>
            <small>{secondScore ? `${formatCricketOvers(secondScore.legal_balls, secondScore.balls_per_over)} OVERS` : "YET TO BAT"}</small>
          </article>
        </main>

        <section className="match-summary-result">
          <span>{match.status === "completed" ? "MATCH RESULT" : "LIVE SCORE"}</span>
          <h1>{match.result_summary ?? "MATCH IN PROGRESS"}</h1>
          {playerOfMatch && (
            <p>PLAYER OF THE MATCH · <b>{playerOfMatch.full_name}</b></p>
          )}
        </section>

        <footer>
          <span>{match.venue ?? "Venue TBA"}</span>
          <strong>{tournament.society_name}</strong>
        </footer>
      </div>
      <button type="button" className="match-summary-download" onClick={downloadCard} disabled={downloading}>
        {downloading ? "Preparing image…" : "Download match summary"}
      </button>
    </section>
  );
}
