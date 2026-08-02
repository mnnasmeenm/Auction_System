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
  manager: {
    id: string;
    full_name: string | null;
    email: string | null;
    manager_photo_path: string | null;
  };
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
    data: {
      user
    },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error(
      "Manager authentication required."
    );
  }

  const [
    portalResponse,
    managerResponse
  ] = await Promise.all([
    supabase.rpc(
      "get_my_manager_portal"
    ),

    supabase
      .from("user_profiles")
      .select(`
        id,
        full_name,
        email,
        manager_photo_path
      `)
      .eq("id", user.id)
      .single()
  ]);

  if (portalResponse.error) {
    throw portalResponse.error;
  }

  if (managerResponse.error) {
    throw managerResponse.error;
  }

  if (!portalResponse.data) {
    throw new Error(
      "Manager information was not returned."
    );
  }

  return {
    ...(portalResponse.data as Omit<
      ManagerPortalData,
      "manager"
    >),

    manager:
      managerResponse.data
  } as ManagerPortalData;
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