import { supabase } from "./supabase";

export interface SaleHistoryPlayer {
  id: string;
  full_name: string;
  player_number: number | null;
  photo_path: string | null;
  status: string;
}

export interface SaleHistoryTeam {
  id: string;
  name: string;
  short_name: string;
  team_color: string;
  logo_path: string | null;
}

export interface SaleHistoryRecord {
  id: string;
  tournament_id: string;
  player_id: string;
  team_id: string;
  sold_price: number;
  sold_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
  revoke_reason: string | null;
  player: SaleHistoryPlayer;
  team: SaleHistoryTeam;
}

export async function getSaleHistory(
  tournamentId: string
): Promise<SaleHistoryRecord[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id,
      tournament_id,
      player_id,
      team_id,
      sold_price,
      sold_at,
      is_revoked,
      revoked_at,
      revoke_reason,

      player:players (
        id,
        full_name,
        player_number,
        photo_path,
        status
      ),

      team:teams (
        id,
        name,
        short_name,
        team_color,
        logo_path
      )
    `)
    .eq("tournament_id", tournamentId)
    .order("sold_at", {
      ascending: false
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as SaleHistoryRecord[];
}

export async function revokeSale(
  tournamentId: string,
  saleId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "revoke_player_sale",
    {
      p_tournament_id: tournamentId,
      p_sale_id: saleId,
      p_reason: reason
    }
  );

  if (error) {
    throw error;
  }
}