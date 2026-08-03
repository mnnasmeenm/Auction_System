import { supabase } from "./supabase";
import type { Player, Team, Tournament } from "../types/database";

export interface TeamPosterManager {
  id: string;
  full_name: string | null;
  manager_photo_path: string | null;
}

export interface TeamPosterData {
  tournament: Tournament;
  team: Team;
  players: Player[];
  managers: TeamPosterManager[];
}

export async function getTeamPosterData(
  teamId?: string
): Promise<TeamPosterData> {
  const { data, error } = await supabase.rpc(
    "get_team_poster_data",
    {
      p_team_id: teamId || null
    }
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Team poster information was not returned.");
  }

  return data as TeamPosterData;
}

export async function setTeamLeadership(input: {
  teamId: string;
  captainPlayerId: string;
  viceCaptainPlayerId: string;
}): Promise<void> {
  const { error } = await supabase.rpc(
    "set_team_leadership",
    {
      p_team_id: input.teamId,
      p_captain_player_id: input.captainPlayerId,
      p_vice_captain_player_id: input.viceCaptainPlayerId
    }
  );

  if (error) {
    throw error;
  }
}