import {
  supabase
} from "./supabase";

import type {
  Player,
  Team,
  Tournament
} from "../types/database";

export interface ManagerStrategy {
  id: string;
  tournament_id: string;
  team_id: string;
  manager_user_id: string;
  player_id: string;
  is_shortlisted: boolean;
  priority: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ManagerPortalData {
  tournament: Tournament;
  team: Team;
  players: Player[];
  strategies: ManagerStrategy[];
}

export interface ManagerStrategyInput {
  playerId: string;
  isShortlisted: boolean;
  priority: number;
  notes: string;
}

export async function
getManagerPortalData():
Promise<ManagerPortalData> {
  const {
    data,
    error
  } = await supabase.rpc(
    "get_my_manager_portal"
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Manager information was not returned."
    );
  }

  return data as ManagerPortalData;
}

export async function
saveManagerStrategy(
  input: ManagerStrategyInput
): Promise<void> {
  const { error } =
    await supabase.rpc(
      "save_manager_player_strategy",
      {
        p_player_id:
          input.playerId,

        p_is_shortlisted:
          input.isShortlisted,

        p_priority:
          input.priority,

        p_notes:
          input.notes
      }
    );

  if (error) {
    throw error;
  }
}