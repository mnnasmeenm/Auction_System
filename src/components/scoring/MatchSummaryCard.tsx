import { type CSSProperties, useRef, useState, Fragment } from "react";

import { toPng } from "html-to-image";

import { formatCricketOvers } from "../../services/scoring";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type {
  BattingScorecard,
  BowlingScorecard,
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

function topBatters(rows: BattingScorecard[] = []) {
  return [...rows].sort((first, second) => {
    if (second.runs !== first.runs) return second.runs - first.runs;
    const firstRate = first.balls > 0 ? first.runs / first.balls : 0;
    const secondRate = second.balls > 0 ? second.runs / second.balls : 0;
    return secondRate - firstRate;
  }).slice(0, 4);
}

function topBowlers(rows: BowlingScorecard[] = []) {
  return [...rows].sort((first, second) => {
    // 1. Most Wickets
    if (second.wickets !== first.wickets) {
      return second.wickets - first.wickets;
    }
    
    // Calculate Economy (Runs per ball)
    const firstEconomy = first.legal_balls > 0 ? first.runs_conceded / first.legal_balls : first.runs_conceded;
    const secondEconomy = second.legal_balls > 0 ? second.runs_conceded / second.legal_balls : second.runs_conceded;
  
    // 2. Best Economy
    if (firstEconomy !== secondEconomy) {
      return firstEconomy - secondEconomy;
    }
    
    // 3. Fewest Runs Conceded
    return first.runs_conceded - second.runs_conceded;
  }).slice(0, 4);
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
  const inningsHighlights = [...innings]
    .sort((first, second) => first.innings_number - second.innings_number)
    .map((record) => ({
      innings: record,
      batters: topBatters(record.batting_scorecards),
      bowlers: topBowlers(record.bowling_scorecards)
    }));

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

        {inningsHighlights.length > 0 && (
          <section className="match-summary-performances">
            {inningsHighlights.map(({ innings: record, batters, bowlers }) => (
              <article key={record.id}>
                <header>
                  <span>INNINGS {record.innings_number}</span>
                  <strong>{teamNameForInnings(match, record.batting_team_id)}</strong>
                </header>

                <div>
                  <span>TOP BATTING</span>
                  {batters.length > 0 ? (
                    batters.map((batter, idx) => (
                      <Fragment key={idx}>
                        <strong style={{ marginTop: idx > 0 ? '8px' : '0' }}>
                          {batter.player_name ?? "Not recorded"}
                        </strong>
                        <small>
                          {batter.runs} RUNS · {batter.balls} BALLS · {batter.fours}×4 · {batter.sixes}×6
                        </small>
                      </Fragment>
                    ))
                  ) : (
                    <Fragment>
                      <strong>Not recorded</strong>
                      <small>—</small>
                    </Fragment>
                  )}
                </div>

                <div>
                  <span>TOP BOWLING</span>
                  {bowlers.length > 0 ? (
                    bowlers.map((bowler, idx) => (
                      <Fragment key={idx}>
                        <strong style={{ marginTop: idx > 0 ? '8px' : '0' }}>
                          {bowler.player_name ?? "Not recorded"}
                        </strong>
                        <small>
                          {bowler.wickets}/{bowler.runs_conceded} · {formatCricketOvers(bowler.legal_balls, record.balls_per_over)} OVERS
                        </small>
                      </Fragment>
                    ))
                  ) : (
                    <Fragment>
                      <strong>Not recorded</strong>
                      <small>—</small>
                    </Fragment>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

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

function teamNameForInnings(match: TournamentMatch, teamId: string) {
  if (teamId === match.team_one_id) {
    return match.team_one?.name ?? match.team_one_placeholder ?? "Team one";
  }
  if (teamId === match.team_two_id) {
    return match.team_two?.name ?? match.team_two_placeholder ?? "Team two";
  }
  return "Team";
}