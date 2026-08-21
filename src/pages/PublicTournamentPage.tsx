import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {
  getPublicTournament,
  getPublicTournamentMatches
} from "../services/publicScoring";

import { getTeamLogoUrl } from "../services/teams";
import { getTournamentBrandingUrl } from "../services/tournamentBranding";

import type { Tournament, TournamentMatch } from "../types/database";

import "./PublicScores.css";

function MatchTile({ match, slug }: { match: TournamentMatch; slug: string }) {
  const firstName = match.team_one?.name ?? match.team_one_placeholder ?? "TBA";
  const secondName = match.team_two?.name ?? match.team_two_placeholder ?? "TBA";
  const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
  const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);

  return (
    <Link className="public-match-tile" to={`/t/${slug}/match/${match.id}`}>
      <header>
        <span>MATCH {match.match_number}</span>
        <b className={`public-status status-${match.status}`}>{match.status.replaceAll("_", " ")}</b>
      </header>
      <div className="public-match-team">
        <div>{firstLogo ? <img src={firstLogo} alt="" /> : firstName.slice(0, 2)}</div>
        <strong>{firstName}</strong>
      </div>
      <div className="public-match-team">
        <div>{secondLogo ? <img src={secondLogo} alt="" /> : secondName.slice(0, 2)}</div>
        <strong>{secondName}</strong>
      </div>
      <footer>
        <span>{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Time TBA"}</span>
        <b>{match.result_summary ?? match.venue ?? "Venue TBA"}</b>
      </footer>
    </Link>
  );
}

export default function PublicTournamentPage() {
  const { publicSlug = "" } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const record = await getPublicTournament(publicSlug);
      const fixtures = await getPublicTournamentMatches(record.id);
      setTournament(record);
      setMatches(fixtures);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tournament could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [publicSlug]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const groups = useMemo(() => ({
    live: matches.filter((match) => match.status === "live" || match.status === "innings_break"),
    upcoming: matches.filter((match) => match.status === "scheduled"),
    recent: matches.filter((match) => match.status === "completed" || match.status === "no_result")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
  }), [matches]);

  if (loading) return <main className="public-score-page"><section className="public-message">Loading match centre…</section></main>;
  if (!tournament || errorMessage) return <main className="public-score-page"><section className="public-message public-error">{errorMessage || "Tournament not found."}</section></main>;

  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);

  return (
    <main className="public-score-page">
      <header className="public-tournament-header">
        <Link to="/">← Tournaments</Link>
        <div className="public-tournament-logos">
          {societyLogo && <img src={societyLogo} alt="" />}
          {tournamentLogo && <img src={tournamentLogo} alt="" />}
        </div>
        <div>
          <span>{tournament.society_name}</span>
          <h1>{tournament.tournament_name}</h1>
          <p>Official public match centre</p>
        </div>
      </header>

      {([
        ["LIVE NOW", groups.live],
        ["UPCOMING MATCHES", groups.upcoming],
        ["RECENT RESULTS", groups.recent]
      ] as Array<[string, TournamentMatch[]]>).map(([title, records]) => (
        <section className="public-match-section" key={title}>
          <header><h2>{title}</h2><span>{records.length} MATCH{records.length === 1 ? "" : "ES"}</span></header>
          {records.length === 0 ? <p className="public-no-matches">No matches in this section.</p> : (
            <div className="public-match-grid">
              {records.map((match) => <MatchTile key={match.id} match={match} slug={publicSlug} />)}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
