import { supabase } from "./supabase";

import type {
  MatchStage,
  Team,
  TournamentDivision,
  TournamentGroup,
  TournamentMatch,
  TournamentScheduleWindow
} from "../types/database";

export interface MatchInput {
  tournamentId: string;
  divisionId: string;
  scheduleWindowId?: string | null;
  groupId?: string | null;
  matchNumber: number;
  roundNumber?: number | null;
  stage: MatchStage;
  teamOneId?: string | null;
  teamTwoId?: string | null;
  teamOnePlaceholder?: string | null;
  teamTwoPlaceholder?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  oversPerInnings: number;
  ballsPerOver: number;
  wicketsPerInnings: number;
  isPublished: boolean;
}

interface MatchRow extends Omit<
  TournamentMatch,
  | "team_one"
  | "team_two"
  | "group"
  | "division"
  | "schedule_window"
> {
  team_one: Team | Team[] | null;
  team_two: Team | Team[] | null;
  group:
    | TournamentGroup
    | TournamentGroup[]
    | null;
  division:
    | TournamentDivision
    | TournamentDivision[]
    | null;
  schedule_window:
    | TournamentScheduleWindow
    | TournamentScheduleWindow[]
    | null;
}

function one<T>(
  value: T | T[] | null
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function normalizeMatch(
  row: MatchRow
): TournamentMatch {
  return {
    ...row,
    team_one: one(row.team_one),
    team_two: one(row.team_two),
    group: one(row.group),
    division: one(row.division),
    schedule_window:
      one(row.schedule_window)
  };
}

const matchSelect = `
  *,
  group:tournament_groups(*),
  division:tournament_divisions(*),
  schedule_window:tournament_schedule_windows(*),
  team_one:teams!matches_team_one_id_fkey(*),
  team_two:teams!matches_team_two_id_fkey(*)
`;

export async function getTournamentMatches(
  tournamentId: string
): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(matchSelect)
    .eq("tournament_id", tournamentId)
    .order("match_number");

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as unknown as MatchRow[]
  ).map(normalizeMatch);
}

export async function assertScheduleReplaceable(
  tournamentId: string
): Promise<void> {
  const { count, error } = await supabase
    .from("matches")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("tournament_id", tournamentId)
    .in("status", [
      "live",
      "innings_break",
      "completed",
      "no_result"
    ]);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "The generated schedule cannot replace matches after scoring has started. Edit the remaining fixtures manually."
    );
  }
}

function toRecord(input: MatchInput) {
  return {
    tournament_id: input.tournamentId,
    division_id: input.divisionId,
    schedule_window_id:
      input.scheduleWindowId ?? null,
    group_id: input.groupId ?? null,
    match_number: input.matchNumber,
    round_number:
      input.roundNumber ?? null,
    stage: input.stage,
    team_one_id:
      input.teamOneId ?? null,
    team_two_id:
      input.teamTwoId ?? null,
    team_one_placeholder:
      input.teamOnePlaceholder?.trim() ||
      null,
    team_two_placeholder:
      input.teamTwoPlaceholder?.trim() ||
      null,
    scheduled_at:
      input.scheduledAt || null,
    venue:
      input.venue?.trim() || null,
    overs_per_innings:
      input.oversPerInnings,
    balls_per_over:
      input.ballsPerOver,
    wickets_per_innings:
      input.wicketsPerInnings,
    is_published:
      input.isPublished,
    status: "scheduled"
  };
}

export async function replaceGeneratedSchedule(
  tournamentId: string,
  matches: MatchInput[]
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_tournament_schedule",
    {
      p_tournament_id: tournamentId,
      p_matches:
        matches.map(toRecord)
    }
  );

  if (error) {
    throw error;
  }
}

export async function createMatch(
  input: MatchInput
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .insert(toRecord(input));

  if (error) {
    throw error;
  }
}

export async function updateScheduledMatch(
  matchId: string,
  input: MatchInput
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update(toRecord(input))
    .eq("id", matchId)
    .eq("status", "scheduled");

  if (error) {
    throw error;
  }
}

export async function deleteScheduledMatch(
  matchId: string
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("status", "scheduled");

  if (error) {
    throw error;
  }
}

export async function setMatchPublished(
  matchId: string,
  isPublished: boolean
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({
      is_published: isPublished
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}