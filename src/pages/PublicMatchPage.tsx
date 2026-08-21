import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import MatchSummaryCard from "../components/scoring/MatchSummaryCard";
import ScorecardTables from "../components/scoring/ScorecardTables";

import {
  getPublicMatchBundle,
  getRequiredRate,
  subscribeToPublicMatch,
  type PublicMatchBundle
} from "../services/publicScoring";

import { formatCricketOvers } from "../services/scoring";
import { getPlayerPhotoUrl } from "../services/playerPhotos";
import { getTeamLogoUrl } from "../services/teams";
import { getTournamentBrandingUrl } from "../services/tournamentBranding";

import "./PublicScores.css";

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

export default function PublicMatchPage() {
  const { publicSlug = "", matchId = "" } = useParams();
  const [bundle, setBundle] = useState<PublicMatchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setBundle(await getPublicMatchBundle(publicSlug, matchId));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Scorecard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [matchId, publicSlug]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToPublicMatch(matchId, () => void load()), [load, matchId]);
  useEffect(() => {
    const fallbackRefresh = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(fallbackRefresh);
  }, [load]);

  const currentInnings = useMemo(() =>
    bundle?.innings.find((innings) => innings.id === bundle.liveState?.current_innings_id) ??
    bundle?.innings.at(-1) ?? null,
  [bundle]);

  const striker = useMemo(() =>
    currentInnings?.batting_scorecards?.find((row) => row.player_id === bundle?.liveState?.striker_player_id) ?? null,
  [bundle, currentInnings]);

  const nonStriker = useMemo(() =>
    currentInnings?.batting_scorecards?.find((row) => row.player_id === bundle?.liveState?.non_striker_player_id) ?? null,
  [bundle, currentInnings]);

  const bowler = useMemo(() =>
    currentInnings?.bowling_scorecards?.find((row) => row.player_id === bundle?.liveState?.bowler_player_id) ?? null,
  [bundle, currentInnings]);

  if (loading) return <main className="public-score-page"><section className="public-message">Loading live score…</section></main>;
  if (!bundle || errorMessage) return <main className="public-score-page"><section className="public-message public-error">{errorMessage || "Match not found."}</section></main>;

  const { tournament, match } = bundle;
  const firstName = match.team_one?.name ?? match.team_one_placeholder ?? "Team one";
  const secondName = match.team_two?.name ?? match.team_two_placeholder ?? "Team two";
  const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
  const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);
  const target = currentInnings?.target_runs ?? bundle.liveState?.target_runs ?? null;
  const chase = getRequiredRate(currentInnings, target);
  const pomPhoto = getPlayerPhotoUrl(bundle.playerOfMatch?.photo_path ?? null);

  return (
    <main className="public-score-page public-match-page">
      <header className="public-score-header">
        <Link to={`/t/${publicSlug}`}>← All matches</Link>
        <div className="public-tournament-logos">
          {societyLogo && <img src={societyLogo} alt="" />}
          {tournamentLogo && <img src={tournamentLogo} alt="" />}
        </div>
        <div>
          <span>{tournament.society_name}</span>
          <h1>{tournament.tournament_name}</h1>
          <p>MATCH {match.match_number} · {match.stage.replaceAll("_", " ")}</p>
        </div>
        <strong className={`public-status status-${match.status}`}>{match.status.replaceAll("_", " ")}</strong>
      </header>

      <section className="public-live-hero">
        <article className="public-hero-team">
          <div>{firstLogo ? <img src={firstLogo} alt="" /> : initials(firstName)}</div>
          <h2>{firstName}</h2>
        </article>

        <div className="public-main-score">
          <span>{currentInnings ? `INNINGS ${currentInnings.innings_number}` : "MATCH CENTRE"}</span>
          <strong>{currentInnings ? `${currentInnings.runs}/${currentInnings.wickets}` : "VS"}</strong>
          <h3>{currentInnings ? `${formatCricketOvers(currentInnings.legal_balls, currentInnings.balls_per_over)} overs` : match.scheduled_at ? new Date(match.scheduled_at).toLocaleString("en-GB") : "Time TBA"}</h3>
          {bundle.liveState?.free_hit && <b className="public-free-hit">FREE HIT</b>}
          {match.result_summary && <p>{match.result_summary}</p>}
        </div>

        <article className="public-hero-team">
          <div>{secondLogo ? <img src={secondLogo} alt="" /> : initials(secondName)}</div>
          <h2>{secondName}</h2>
        </article>
      </section>

      {currentInnings && target && match.status === "live" && (
        <section className="public-chase-strip">
          <div><span>TARGET</span><strong>{target}</strong></div>
          <div><span>NEED</span><strong>{chase.requiredRuns} RUNS</strong></div>
          <div><span>BALLS LEFT</span><strong>{chase.remainingBalls}</strong></div>
          <div><span>REQUIRED RATE</span><strong>{chase.requiredRate?.toFixed(2) ?? "—"}</strong></div>
        </section>
      )}

      {match.status === "live" && currentInnings && (
        <section className="public-live-players">
          <article>
            <span>STRIKER *</span>
            <h3>{striker?.player_name ?? bundle.liveState?.striker_name ?? "New batter"}</h3>
            <strong>{striker?.runs ?? 0} <small>({striker?.balls ?? 0})</small></strong>
            <p>{striker?.fours ?? 0} fours · {striker?.sixes ?? 0} sixes</p>
          </article>
          <article>
            <span>NON-STRIKER</span>
            <h3>{nonStriker?.player_name ?? bundle.liveState?.non_striker_name ?? "New batter"}</h3>
            <strong>{nonStriker?.runs ?? 0} <small>({nonStriker?.balls ?? 0})</small></strong>
            <p>{nonStriker?.fours ?? 0} fours · {nonStriker?.sixes ?? 0} sixes</p>
          </article>
          <article className="public-current-bowler">
            <span>{bundle.liveState?.next_bowler_required ? "NEXT BOWLER TO BE SELECTED" : "CURRENT BOWLER"}</span>
            <h3>{bowler?.player_name ?? bundle.liveState?.bowler_name ?? "Over complete"}</h3>
            <strong>{bowler ? formatCricketOvers(bowler.legal_balls, currentInnings.balls_per_over) : "—"} <small>overs</small></strong>
            <p>{bowler?.runs_conceded ?? 0} runs · {bowler?.wickets ?? 0} wickets</p>
          </article>
        </section>
      )}

      {bundle.recentEvents.length > 0 && match.status === "live" && (
        <section className="public-recent-balls">
          <span>RECENT BALLS</span>
          <div>{bundle.recentEvents.slice(0, 10).reverse().map((event) => (
            <b key={event.id} className={event.is_wicket && event.wicket_counts ? "ball-wicket" : event.runs_off_bat === 6 ? "ball-six" : ""}>
              {event.is_wicket && event.wicket_counts ? "W" : event.extra_type === "wide" ? `${event.extra_runs}WD` : event.extra_type === "no_ball" ? `${event.runs_off_bat + event.extra_runs}NB` : event.runs_off_bat + event.extra_runs}
            </b>
          ))}</div>
        </section>
      )}

      {bundle.innings.length > 0 && (
        <section className="public-full-scorecard">
          <header><span>FULL SCORECARD</span><h2>Match performance</h2></header>
          <ScorecardTables match={match} innings={bundle.innings} fielding={bundle.fielding} />
        </section>
      )}

      {bundle.playerOfMatch && (
        <section className="public-player-award">
          <div>{pomPhoto ? <img src={pomPhoto} alt="" /> : initials(bundle.playerOfMatch.full_name)}</div>
          <span>PLAYER OF THE MATCH</span>
          <h2>{bundle.playerOfMatch.full_name}</h2>
          <p>{match.player_of_match_reason ?? "Outstanding all-round match performance."}</p>
        </section>
      )}

      {bundle.innings.length > 0 && (
        <MatchSummaryCard tournament={tournament} match={match} innings={bundle.innings} playerOfMatch={bundle.playerOfMatch} />
      )}
    </main>
  );
}
