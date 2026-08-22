import { supabase } from "./supabase";

import type {
  PointsTableAdjustment,
  PointsTableRow,
  TournamentDivision,
  TournamentGroup
} from "../types/database";

export interface StandingsSection {
  key: string;
  division: TournamentDivision;
  group: TournamentGroup | null;
  rows: PointsTableRow[];
  qualifiersCount: number;
}

export async function getDivisionStandings(
  tournamentId: string,
  divisionId: string,
  groupId: string | null = null
): Promise<PointsTableRow[]> {
  const { data, error } = await supabase.rpc(
    "calculate_division_standings",
    {
      p_tournament_id: tournamentId,
      p_division_id: divisionId,
      p_group_id: groupId
    }
  );

  if (error) throw error;

  return (data ?? []).map((row: unknown) => {
    const record = row as Record<string, unknown>;

    return {
      ...record,
      position: Number(record.position ?? 0),
      played: Number(record.played ?? 0),
      won: Number(record.won ?? 0),
      lost: Number(record.lost ?? 0),
      tied: Number(record.tied ?? 0),
      no_result: Number(record.no_result ?? 0),
      points: Number(record.points ?? 0),
      runs_for: Number(record.runs_for ?? 0),
      overs_for: Number(record.overs_for ?? 0),
      runs_against: Number(record.runs_against ?? 0),
      overs_against: Number(record.overs_against ?? 0),
      net_run_rate: Number(record.net_run_rate ?? 0)
    } as PointsTableRow;
  });
}

export async function getPointsAdjustments(
  tournamentId: string,
  divisionId: string,
  groupId: string | null
): Promise<PointsTableAdjustment[]> {
  let query = supabase
    .from("points_table_adjustments")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("division_id", divisionId);

  query = groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null);

  const { data, error } = await query.order("created_at", {
    ascending: false
  });

  if (error) throw error;
  return (data ?? []) as PointsTableAdjustment[];
}

export async function addPointsAdjustment(input: {
  tournamentId: string;
  divisionId: string;
  groupId: string | null;
  teamId: string;
  points: number;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc(
    "add_points_table_adjustment",
    {
      p_tournament_id: input.tournamentId,
      p_division_id: input.divisionId,
      p_group_id: input.groupId,
      p_team_id: input.teamId,
      p_points_adjustment: input.points,
      p_reason: input.reason.trim()
    }
  );

  if (error) throw error;
}

export async function deletePointsAdjustment(
  adjustmentId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "delete_points_table_adjustment",
    { p_adjustment_id: adjustmentId }
  );

  if (error) throw error;
}

export async function getTournamentStandingsSections(
  tournamentId: string
): Promise<StandingsSection[]> {
  const [divisionResponse, groupResponse] = await Promise.all([
    supabase
      .from("tournament_divisions")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("tournament_groups")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order")
  ]);

  if (divisionResponse.error) throw divisionResponse.error;
  if (groupResponse.error) throw groupResponse.error;

  const divisions = (divisionResponse.data ?? []) as TournamentDivision[];
  const groups = (groupResponse.data ?? []) as TournamentGroup[];

  const scopes: Array<Omit<StandingsSection, "rows">> = [];

  divisions.forEach((division) => {
    const divisionGroups = groups.filter(
      (group) => group.division_id === division.id
    );

    if (division.format === "groups" && divisionGroups.length > 0) {
      const qualifiersPerGroup = Math.max(
        1,
        Math.floor(division.qualifiers_count / divisionGroups.length)
      );

      divisionGroups.forEach((group) => {
        scopes.push({
          key: `${division.id}:${group.id}`,
          division,
          group,
          qualifiersCount: qualifiersPerGroup
        });
      });

      return;
    }

    scopes.push({
      key: `${division.id}:all`,
      division,
      group: null,
      qualifiersCount: division.qualifiers_count
    });
  });

  return Promise.all(scopes.map(async (scope) => ({
    ...scope,
    rows: await getDivisionStandings(
      tournamentId,
      scope.division.id,
      scope.group?.id ?? null
    )
  })));
}
