import { supabase } from "./supabase";

import { getTournamentMatches } from "./matches";

import type {
  FieldingScorecard,
  MatchBallEvent,
  MatchInnings,
  MatchLiveState,
  Player,
  Tournament,
  TournamentMatch
} from "../types/database";

export interface PublicMatchBundle {
  tournament: Tournament;
  match: TournamentMatch;
  innings: MatchInnings[];
  liveState: MatchLiveState | null;
  recentEvents: MatchBallEvent[];
  fielding: FieldingScorecard[];
  playerOfMatch: Player | null;
}

export async function getPublicTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("is_public", true)
    .not("public_slug", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function getPublicTournament(
  publicSlug: string
): Promise<Tournament> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("public_slug", publicSlug)
    .eq("is_public", true)
    .single();

  if (error) throw error;
  return data as Tournament;
}

export async function getPublicTournamentMatches(
  tournamentId: string
): Promise<TournamentMatch[]> {
  const matches = await getTournamentMatches(tournamentId);
  return matches.filter((match) => match.is_published);
}

export async function getPublicMatchBundle(
  publicSlug: string,
  matchId: string
): Promise<PublicMatchBundle> {
  const tournament = await getPublicTournament(publicSlug);
  const matches = await getPublicTournamentMatches(tournament.id);
  const match = matches.find((record) => record.id === matchId);

  if (!match) {
    throw new Error("This published match could not be found.");
  }

  const [
    inningsResponse,
    liveResponse,
    eventsResponse,
    fieldingResponse,
    playerOfMatchResponse
  ] = await Promise.all([
    supabase
      .from("match_innings")
      .select(`
        *,
        batting_scorecards(*),
        bowling_scorecards(*),
        fall_of_wickets(*)
      `)
      .eq("match_id", matchId)
      .order("innings_number"),
    supabase
      .from("match_live_state")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .from("match_ball_events")
      .select("*")
      .eq("match_id", matchId)
      .order("sequence_number", { ascending: false })
      .limit(18),
    supabase
      .from("fielding_scorecards")
      .select("*")
      .eq("match_id", matchId)
      .order("player_name"),
    match.player_of_match_id
      ? supabase
          .from("players")
          .select("*")
          .eq("id", match.player_of_match_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const error =
    inningsResponse.error ||
    liveResponse.error ||
    eventsResponse.error ||
    fieldingResponse.error ||
    playerOfMatchResponse.error;

  if (error) throw error;

  return {
    tournament,
    match,
    innings: (inningsResponse.data ?? []) as unknown as MatchInnings[],
    liveState: liveResponse.data as MatchLiveState | null,
    recentEvents: (eventsResponse.data ?? []) as MatchBallEvent[],
    fielding: (fieldingResponse.data ?? []) as FieldingScorecard[],
    playerOfMatch: playerOfMatchResponse.data as Player | null
  };
}

export function getRequiredRate(
  innings: MatchInnings | null,
  targetRuns: number | null
) {
  if (!innings || !targetRuns) {
    return { requiredRuns: null, remainingBalls: null, requiredRate: null };
  }

  const requiredRuns = Math.max(targetRuns - innings.runs, 0);
  const maximumBalls = innings.maximum_overs * innings.balls_per_over;
  const remainingBalls = Math.max(maximumBalls - innings.legal_balls, 0);
  const remainingOvers = remainingBalls / innings.balls_per_over;

  return {
    requiredRuns,
    remainingBalls,
    requiredRate:
      remainingOvers > 0 && requiredRuns > 0
        ? requiredRuns / remainingOvers
        : requiredRuns === 0
          ? 0
          : null
  };
}

export function subscribeToPublicMatch(
  matchId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`public-score-${matchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_innings", filter: `match_id=eq.${matchId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_ball_events", filter: `match_id=eq.${matchId}` },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
