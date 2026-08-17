import { supabase } from "./supabase";

import type {
  Player,
  Team
} from "../types/database";

import type {
  BidIncrementRule
} from "./bidRules";

export interface AuctionState {
  tournament_id: string;
  active_player_id: string | null;
  current_bid: number;
  leading_team_id: string | null;
  message: string;
  lot_number: number;
  updated_at: string;
}

export interface AuctionData {
  auctionState: AuctionState | null;
  players: Player[];
  teams: Team[];
  incrementRules: BidIncrementRule[];
}

export interface AuctionBidHistoryEntry {
  id: string;
  tournament_id: string;
  player_id: string;
  team_id: string;
  bid_amount: number;
  previous_team_id: string | null;
  previous_bid_amount: number;
  bid_sequence: number;
  is_undone: boolean;
  created_at: string;
}

export async function getAuctionData(
  tournamentId: string
): Promise<AuctionData> {
  const [
    stateResponse,
    playerResponse,
    teamResponse,
    incrementResponse
  ] = await Promise.all([
    supabase
      .from("auction_state")
      .select("*")
      .eq("tournament_id", tournamentId)
      .maybeSingle(),

    supabase
      .from("players")
      .select(`
        *,
        category:player_categories (
          id,
          tournament_id,
          name,
          minimum_required,
          display_order
        )
      `)
      .eq("tournament_id", tournamentId)
      .order("player_number", {
        ascending: true,
        nullsFirst: false
      })
      .order("full_name"),

    supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("created_at"),

    supabase
      .from("bid_increment_rules")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order")
  ]);

  if (stateResponse.error) {
    throw stateResponse.error;
  }

  if (playerResponse.error) {
    throw playerResponse.error;
  }

  if (teamResponse.error) {
    throw teamResponse.error;
  }

  if (incrementResponse.error) {
    throw incrementResponse.error;
  }

  return {
    auctionState:
      stateResponse.data as AuctionState | null,

    players:
      (playerResponse.data ?? []) as Player[],

    teams:
      (teamResponse.data ?? []) as Team[],

    incrementRules:
      (incrementResponse.data ?? []) as BidIncrementRule[]
  };
}

export async function startPlayerAuction(
  tournamentId: string,
  playerId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "start_player_auction",
    {
      p_tournament_id: tournamentId,
      p_player_id: playerId
    }
  );

  if (error) {
    throw error;
  }
}

export async function placePlayerBid(
  tournamentId: string,
  teamId: string
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "place_player_bid_auto",
    {
      p_tournament_id: tournamentId,
      p_team_id: teamId
    }
  );

  if (error) {
    throw error;
  }

  return data as number;
}

export async function sellActivePlayer(
  tournamentId: string
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "sell_active_player",
    {
      p_tournament_id: tournamentId
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
}

export async function markActivePlayerUnsold(
  tournamentId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "mark_active_player_unsold",
    {
      p_tournament_id: tournamentId
    }
  );

  if (error) {
    throw error;
  }
}

export async function getActiveBidHistory(
  tournamentId: string,
  playerId: string | null | undefined
): Promise<AuctionBidHistoryEntry[]> {
  if (!playerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("auction_bid_history")
    .select(`
      id,
      tournament_id,
      player_id,
      team_id,
      bid_amount,
      previous_team_id,
      previous_bid_amount,
      bid_sequence,
      is_undone,
      created_at
    `)
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .eq("is_undone", false)
    .order("bid_sequence", {
      ascending: false
    });

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as AuctionBidHistoryEntry[];
}

export async function undoLastPlayerBid(
  tournamentId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "undo_last_player_bid",
    {
      p_tournament_id: tournamentId
    }
  );

  if (error) {
    throw error;
  }
}