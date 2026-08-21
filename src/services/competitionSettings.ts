import { supabase } from "./supabase";

import type {
  TournamentCompetitionSettings,
  TournamentGroup,
  TournamentGroupTeam
} from "../types/database";

export async function getCompetitionSettings(
  tournamentId: string
): Promise<TournamentCompetitionSettings> {
  const { data, error } = await supabase
    .from("tournament_competition_settings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .single();

  if (error) {
    throw error;
  }

  return data as TournamentCompetitionSettings;
}

export async function saveCompetitionSettings(
  settings: TournamentCompetitionSettings
): Promise<void> {
  const { error } = await supabase
    .from("tournament_competition_settings")
    .upsert({
      tournament_id: settings.tournament_id,
      format: settings.format,
      qualification_format:
        settings.qualification_format,
      group_count: settings.group_count,
      qualifiers_count: settings.qualifiers_count,
      default_overs: settings.default_overs,
      default_balls_per_over:
        settings.default_balls_per_over,
      default_wickets_per_innings:
        settings.default_wickets_per_innings,
      nrr_display_balls_per_over:
        settings.nrr_display_balls_per_over,
      win_points: settings.win_points,
      tie_points: settings.tie_points,
      no_result_points: settings.no_result_points,
      loss_points: settings.loss_points
    });

  if (error) {
    throw error;
  }
}

export async function getTournamentGroups(
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

export async function getGroupAssignments(
  tournamentId: string
): Promise<TournamentGroupTeam[]> {
  const { data, error } = await supabase
    .from("tournament_group_teams")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (error) {
    throw error;
  }

  return (data ?? []) as TournamentGroupTeam[];
}

export async function replaceGroups(
  tournamentId: string,
  groupNames: string[],
  assignments: Array<{
    teamId: string;
    groupIndex: number;
    seedNumber: number;
  }>
): Promise<{
  groups: TournamentGroup[];
  assignments: TournamentGroupTeam[];
}> {
  const { data: groupData, error } = await supabase.rpc(
    "replace_tournament_groups",
    {
      p_tournament_id: tournamentId,
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

  const groups = (groupData ?? []) as TournamentGroup[];

  const savedAssignments = await getGroupAssignments(
    tournamentId
  );

  return {
    groups,
    assignments: savedAssignments
  };
}
