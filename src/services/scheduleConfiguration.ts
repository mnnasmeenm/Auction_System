import { supabase } from "./supabase";

import type {
  TournamentDivision,
  TournamentDivisionTeam,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentScheduleBreak,
  TournamentScheduleWindow,
  TournamentScheduleWindowDivision
} from "../types/database";

export interface DivisionInput {
  id?: string;
  tournamentId: string;
  name: string;
  shortName: string;
  divisionColor: string;
  displayOrder: number;
  isActive: boolean;
  format: TournamentDivision["format"];
  groupCount: number;
  qualificationFormat: TournamentDivision["qualification_format"];
  qualifiersCount: number;
  defaultOvers: number;
  defaultBallsPerOver: number;
  defaultWicketsPerInnings: number;
  matchesPerTurn: number;
  avoidTimeFrom: string | null;
  avoidTimeTo: string | null;
}

export interface ScheduleWindowInput {
  id?: string;
  tournamentId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  matchDurationMinutes: number;
  turnaroundMinutes: number;
  displayOrder: number;
}

export interface ScheduleBreakInput {
  id?: string;
  tournamentId: string;
  scheduleWindowId: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

export async function getTournamentDivisions(
  tournamentId: string
): Promise<TournamentDivision[]> {
  const { data, error } = await supabase
    .from("tournament_divisions")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("display_order");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentDivision[];
}

export async function saveTournamentDivision(
  input: DivisionInput
): Promise<TournamentDivision> {
  const record = {
    tournament_id: input.tournamentId,
    name: input.name.trim(),
    short_name: input.shortName.trim().toUpperCase(),
    division_color: input.divisionColor,
    display_order: input.displayOrder,
    is_active: input.isActive,
    format: input.format,
    group_count: input.groupCount,
    qualification_format: input.qualificationFormat,
    qualifiers_count: input.qualifiersCount,
    default_overs: input.defaultOvers,
    default_balls_per_over: input.defaultBallsPerOver,
    default_wickets_per_innings: input.defaultWicketsPerInnings,
    matches_per_turn: input.matchesPerTurn,
    avoid_time_from: input.avoidTimeFrom,
    avoid_time_to: input.avoidTimeTo
  };

  const query = input.id
    ? supabase
        .from("tournament_divisions")
        .update(record)
        .eq("id", input.id)
    : supabase
        .from("tournament_divisions")
        .insert(record);

  const { data, error } = await query
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as TournamentDivision;
}

export async function deleteTournamentDivision(
  divisionId: string
): Promise<void> {
  const [matchResponse, playerResponse] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("division_id", divisionId),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("division_id", divisionId)
  ]);

  if (matchResponse.error) {
    throw matchResponse.error;
  }

  if (playerResponse.error) {
    throw playerResponse.error;
  }

  if ((matchResponse.count ?? 0) > 0) {
    throw new Error(
      "A division containing scheduled or completed matches cannot be deleted."
    );
  }

  if ((playerResponse.count ?? 0) > 0) {
    throw new Error(
      "Move its players to another division before deleting it."
    );
  }

  const { error } = await supabase
    .from("tournament_divisions")
    .delete()
    .eq("id", divisionId);

  if (error) {
    throw error;
  }
}

export async function getDivisionTeamAssignments(
  tournamentId: string
): Promise<TournamentDivisionTeam[]> {
  const { data, error } = await supabase
    .from("tournament_division_teams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("seed_number");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentDivisionTeam[];
}

export async function replaceDivisionTeams(
  divisionId: string,
  teamIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_division_teams",
    {
      p_division_id: divisionId,
      p_team_ids: teamIds
    }
  );

  if (error) {
    throw error;
  }
}

export async function setTeamDivisionAssignments(
  tournamentId: string,
  teamId: string,
  divisionIds: string[]
): Promise<void> {
  const [divisions, assignments] = await Promise.all([
    getTournamentDivisions(tournamentId),
    getDivisionTeamAssignments(tournamentId)
  ]);

  for (const division of divisions) {
    const currentTeamIds = assignments
      .filter((assignment) => assignment.division_id === division.id)
      .map((assignment) => assignment.team_id);
    const shouldInclude = divisionIds.includes(division.id);
    const currentlyIncluded = currentTeamIds.includes(teamId);

    if (shouldInclude === currentlyIncluded) {
      continue;
    }

    await replaceDivisionTeams(
      division.id,
      shouldInclude
        ? [...currentTeamIds, teamId]
        : currentTeamIds.filter((id) => id !== teamId)
    );
  }
}

export async function getDivisionGroups(
  tournamentId: string
): Promise<TournamentGroup[]> {
  const { data, error } = await supabase
    .from("tournament_groups")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("display_order");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentGroup[];
}

export async function getDivisionGroupAssignments(
  tournamentId: string
): Promise<TournamentGroupTeam[]> {
  const { data, error } = await supabase
    .from("tournament_group_teams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("seed_number");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentGroupTeam[];
}

export async function replaceDivisionGroups(
  divisionId: string,
  groupNames: string[],
  assignments: Array<{
    teamId: string;
    groupIndex: number;
    seedNumber: number;
  }>
): Promise<TournamentGroup[]> {
  const { data, error } = await supabase.rpc(
    "replace_division_groups",
    {
      p_division_id: divisionId,
      p_group_names: groupNames,
      p_assignments: assignments.map((assignment) => ({
        team_id: assignment.teamId,
        group_index: assignment.groupIndex,
        seed_number: assignment.seedNumber
      }))
    }
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentGroup[];
}

export async function getScheduleWindows(
  tournamentId: string
): Promise<TournamentScheduleWindow[]> {
  const { data, error } = await supabase
    .from("tournament_schedule_windows")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("starts_at");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentScheduleWindow[];
}

export async function saveScheduleWindow(
  input: ScheduleWindowInput
): Promise<TournamentScheduleWindow> {
  const record = {
    tournament_id: input.tournamentId,
    label: input.label.trim(),
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    venue: input.venue.trim() || null,
    match_duration_minutes: input.matchDurationMinutes,
    turnaround_minutes: input.turnaroundMinutes,
    display_order: input.displayOrder
  };

  const query = input.id
    ? supabase
        .from("tournament_schedule_windows")
        .update(record)
        .eq("id", input.id)
    : supabase
        .from("tournament_schedule_windows")
        .insert(record);

  const { data, error } = await query
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as TournamentScheduleWindow;
}

export async function getScheduleWindowDivisions(
  tournamentId: string
): Promise<TournamentScheduleWindowDivision[]> {
  const { data, error } = await supabase
    .from("tournament_schedule_window_divisions")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("schedule_window_id");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentScheduleWindowDivision[];
}

export async function replaceScheduleWindowDivisions(
  scheduleWindowId: string,
  availability: Array<{
    divisionId: string;
    isAvailable: boolean;
  }>
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_schedule_window_divisions",
    {
      p_schedule_window_id: scheduleWindowId,
      p_division_ids: availability.map((item) => item.divisionId),
      p_is_available: availability.map((item) => item.isAvailable)
    }
  );

  if (error) {
    throw error;
  }
}

export async function deleteScheduleWindow(
  windowId: string
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("schedule_window_id", windowId)
    .in("status", ["live", "innings_break", "completed", "no_result"]);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "An event window used by a started match cannot be deleted."
    );
  }

  const { error } = await supabase
    .from("tournament_schedule_windows")
    .delete()
    .eq("id", windowId);

  if (error) {
    throw error;
  }
}

export async function getScheduleBreaks(
  tournamentId: string
): Promise<TournamentScheduleBreak[]> {
  const { data, error } = await supabase
    .from("tournament_schedule_breaks")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("starts_at");

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentScheduleBreak[];
}

export async function saveScheduleBreak(
  input: ScheduleBreakInput
): Promise<TournamentScheduleBreak> {
  const record = {
    tournament_id: input.tournamentId,
    schedule_window_id: input.scheduleWindowId,
    label: input.label.trim(),
    starts_at: input.startsAt,
    ends_at: input.endsAt
  };

  const query = input.id
    ? supabase
        .from("tournament_schedule_breaks")
        .update(record)
        .eq("id", input.id)
    : supabase
        .from("tournament_schedule_breaks")
        .insert(record);

  const { data, error } = await query
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as TournamentScheduleBreak;
}

export async function deleteScheduleBreak(
  breakId: string
): Promise<void> {
  const { error } = await supabase
    .from("tournament_schedule_breaks")
    .delete()
    .eq("id", breakId);

  if (error) {
    throw error;
  }
}
