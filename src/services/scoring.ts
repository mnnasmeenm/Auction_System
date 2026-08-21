import { supabase } from "./supabase";

import type {
  BallExtraType,
  BattingScorecard,
  BowlingScorecard,
  DismissalType,
  FallOfWicket,
  FieldingScorecard,
  MatchBallEvent,
  MatchInnings,
  MatchLiveState,
  Player,
  ScoringMode,
  TournamentMatch
} from "../types/database";

import { getTournamentMatches } from "./matches";

export interface MatchScoringBundle {
  match: TournamentMatch;
  innings: MatchInnings[];
  liveState: MatchLiveState | null;
  recentEvents: MatchBallEvent[];
  players: Player[];
  fielding: FieldingScorecard[];
}

export interface StartMatchScoringInput {
  matchId: string;
  scoringMode: Exclude<ScoringMode, "hybrid">;
  tossWinnerId: string;
  tossDecision: "bat" | "bowl";
  battingTeamId: string;
  overs: number;
  ballsPerOver: number;
  wickets: number;
}

export interface BallEventInput {
  batterPlayerId?: string | null;
  batterName: string;
  nonStrikerPlayerId?: string | null;
  nonStrikerName?: string | null;
  bowlerPlayerId?: string | null;
  bowlerName: string;
  runsOffBat: number;
  extraType?: BallExtraType | null;
  extraRuns: number;
  isWicket: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  dismissedPlayerName?: string | null;
  fielderPlayerId?: string | null;
  wicketCounts?: boolean;
  creditedBowlerWicket?: boolean;
  runOutKind?: "direct" | "assisted" | null;
  note?: string | null;
}

export interface ManualBattingInput {
  playerId?: string | null;
  playerName: string;
  battingPosition: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissalType: DismissalType;
  dismissalText?: string | null;
}

export interface ManualBowlingInput {
  playerId?: string | null;
  playerName: string;
  legalBalls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  dotBalls: number;
  foursConceded: number;
  sixesConceded: number;
}

export interface ManualFieldingInput {
  playerId?: string | null;
  playerName: string;
  catches: number;
  stumpings: number;
  directRunOuts: number;
  assistedRunOuts: number;
}

export interface ManualFallOfWicketInput {
  wicketNumber: number;
  teamRuns: number;
  legalBalls: number;
  playerId?: string | null;
  playerName: string;
}

export interface ManualInningsScoreInput {
  runs: number;
  wickets: number;
  legalBalls: number;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penaltyRuns: number;
  isAllOut: boolean;
  batting: ManualBattingInput[];
  bowling: ManualBowlingInput[];
  fielding: ManualFieldingInput[];
  fallOfWickets: ManualFallOfWicketInput[];
}

function mapBallEvent(input: BallEventInput) {
  return {
    batter_player_id: input.batterPlayerId ?? null,
    batter_name: input.batterName.trim(),
    non_striker_player_id: input.nonStrikerPlayerId ?? null,
    non_striker_name: input.nonStrikerName?.trim() || null,
    bowler_player_id: input.bowlerPlayerId ?? null,
    bowler_name: input.bowlerName.trim(),
    runs_off_bat: input.runsOffBat,
    extra_type: input.extraType ?? null,
    extra_runs: input.extraRuns,
    is_wicket: input.isWicket,
    dismissal_type: input.dismissalType ?? null,
    dismissed_player_id: input.dismissedPlayerId ?? null,
    dismissed_player_name: input.dismissedPlayerName?.trim() || null,
    fielder_player_id: input.fielderPlayerId ?? null,
    wicket_counts: input.wicketCounts ?? true,
    credited_bowler_wicket: input.creditedBowlerWicket ?? true,
    run_out_kind: input.runOutKind ?? null,
    note: input.note?.trim() || null
  };
}

function mapManualScore(input: ManualInningsScoreInput) {
  return {
    runs: input.runs,
    wickets: input.wickets,
    legal_balls: input.legalBalls,
    wides: input.wides,
    no_balls: input.noBalls,
    byes: input.byes,
    leg_byes: input.legByes,
    penalty_runs: input.penaltyRuns,
    is_all_out: input.isAllOut,
    batting: input.batting.map((row) => ({
      player_id: row.playerId ?? null,
      player_name: row.playerName.trim(),
      batting_position: row.battingPosition,
      runs: row.runs,
      balls: row.balls,
      fours: row.fours,
      sixes: row.sixes,
      dismissal_type: row.dismissalType,
      dismissal_text: row.dismissalText?.trim() || null
    })),
    bowling: input.bowling.map((row) => ({
      player_id: row.playerId ?? null,
      player_name: row.playerName.trim(),
      legal_balls: row.legalBalls,
      maidens: row.maidens,
      runs_conceded: row.runsConceded,
      wickets: row.wickets,
      wides: row.wides,
      no_balls: row.noBalls,
      dot_balls: row.dotBalls,
      fours_conceded: row.foursConceded,
      sixes_conceded: row.sixesConceded
    })),
    fielding: input.fielding.map((row) => ({
      player_id: row.playerId ?? null,
      player_name: row.playerName.trim(),
      catches: row.catches,
      stumpings: row.stumpings,
      direct_run_outs: row.directRunOuts,
      assisted_run_outs: row.assistedRunOuts
    })),
    fall_of_wickets: input.fallOfWickets.map((row) => ({
      wicket_number: row.wicketNumber,
      team_runs: row.teamRuns,
      legal_balls: row.legalBalls,
      player_id: row.playerId ?? null,
      player_name: row.playerName.trim()
    }))
  };
}

export function formatCricketOvers(
  legalBalls: number,
  ballsPerOver: number
): string {
  const safeBallsPerOver = Math.max(1, ballsPerOver);
  return `${Math.floor(legalBalls / safeBallsPerOver)}.${
    legalBalls % safeBallsPerOver
  }`;
}

export async function getMatchScoringBundle(
  tournamentId: string,
  matchId: string
): Promise<MatchScoringBundle> {
  const matches = await getTournamentMatches(tournamentId);
  const match = matches.find((record) => record.id === matchId);

  if (!match) {
    throw new Error("The selected match was not found.");
  }

  const [
    inningsResponse,
    liveResponse,
    eventsResponse,
    playersResponse,
    fieldingResponse
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
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("full_name"),
    supabase
      .from("fielding_scorecards")
      .select("*")
      .eq("match_id", matchId)
      .order("player_name")
  ]);

  const error =
    inningsResponse.error ||
    liveResponse.error ||
    eventsResponse.error ||
    playersResponse.error ||
    fieldingResponse.error;

  if (error) {
    throw error;
  }

  return {
    match,
    innings: (inningsResponse.data ?? []) as unknown as MatchInnings[],
    liveState: liveResponse.data as MatchLiveState | null,
    recentEvents: (eventsResponse.data ?? []) as MatchBallEvent[],
    players: (playersResponse.data ?? []) as Player[],
    fielding: (fieldingResponse.data ?? []) as FieldingScorecard[]
  };
}

export async function startMatchScoring(
  input: StartMatchScoringInput
): Promise<void> {
  const { error } = await supabase.rpc("start_match_scoring", {
    p_match_id: input.matchId,
    p_scoring_mode: input.scoringMode,
    p_toss_winner_id: input.tossWinnerId,
    p_toss_decision: input.tossDecision,
    p_batting_team_id: input.battingTeamId,
    p_overs: input.overs,
    p_balls_per_over: input.ballsPerOver,
    p_wickets: input.wickets
  });

  if (error) throw error;
}

export async function recordMatchBall(
  matchId: string,
  expectedRevision: number,
  input: BallEventInput
): Promise<void> {
  const { error } = await supabase.rpc("record_match_ball", {
    p_match_id: matchId,
    p_expected_revision: expectedRevision,
    p_event: mapBallEvent(input)
  });

  if (error) throw error;
}

export async function undoLastMatchBall(
  matchId: string,
  expectedRevision: number,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc("undo_last_match_ball", {
    p_match_id: matchId,
    p_expected_revision: expectedRevision,
    p_reason: reason.trim()
  });

  if (error) throw error;
}

export async function saveManualInningsScore(
  matchId: string,
  expectedRevision: number,
  score: ManualInningsScoreInput
): Promise<void> {
  const { error } = await supabase.rpc("save_manual_innings_score", {
    p_match_id: matchId,
    p_expected_revision: expectedRevision,
    p_score: mapManualScore(score)
  });

  if (error) throw error;
}

export async function completeCurrentInnings(
  matchId: string,
  expectedRevision: number
): Promise<void> {
  const { error } = await supabase.rpc("complete_current_innings", {
    p_match_id: matchId,
    p_expected_revision: expectedRevision
  });

  if (error) throw error;
}

export async function startSecondInnings(
  matchId: string,
  expectedRevision: number
): Promise<void> {
  const { error } = await supabase.rpc("start_second_innings", {
    p_match_id: matchId,
    p_expected_revision: expectedRevision
  });

  if (error) throw error;
}

export async function setMatchPlayerOfMatch(
  matchId: string,
  playerId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "set_match_player_of_match",
    {
      p_match_id: matchId,
      p_player_id: playerId,
      p_reason: reason.trim()
    }
  );

  if (error) throw error;
}

export type {
  BattingScorecard,
  BowlingScorecard,
  FallOfWicket
};
