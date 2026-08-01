import { supabase } from "./supabase";
import type { Tournament } from "../types/database";

export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getTournament(
  tournamentId: string
): Promise<Tournament> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: Tournament["status"]
): Promise<void> {
  const { error } = await supabase
    .from("tournaments")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", tournamentId);

  if (error) {
    throw error;
  }
}

export async function deleteTournament(
  tournamentId: string
): Promise<void> {
  const { count: salesCount, error: salesError } =
    await supabase
      .from("sales")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("tournament_id", tournamentId);

  if (salesError) {
    throw salesError;
  }

  if ((salesCount ?? 0) > 0) {
    throw new Error(
      "A tournament containing completed sales cannot be deleted."
    );
  }

  const { error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);

  if (error) {
    throw error;
  }
}