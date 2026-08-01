import { supabase } from "./supabase";

export interface CategoryInput {
  name: string;
  minimumRequired: number;
}

export interface TournamentSetupInput {
  societyName: string;
  tournamentName: string;
  startingBudget: number;
  maximumSquadSize: number;
  allowSaleRevocation: boolean;
  requireRevocationReason: boolean;
  categories: CategoryInput[];
  bidIncrements: number[];
}

export async function createTournamentSetup(
  input: TournamentSetupInput
): Promise<string> {
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .insert({
      society_name: input.societyName,
      tournament_name: input.tournamentName,
      starting_budget: input.startingBudget,
      maximum_squad_size: input.maximumSquadSize,
      allow_sale_revocation: input.allowSaleRevocation,
      require_revocation_reason: input.requireRevocationReason,
      status: "draft"
    })
    .select("id")
    .single();

  if (tournamentError) {
    throw tournamentError;
  }

  const tournamentId = tournament.id;

  try {
    const categoryRecords = input.categories.map((category, index) => ({
      tournament_id: tournamentId,
      name: category.name,
      minimum_required: category.minimumRequired,
      display_order: index
    }));

    const { error: categoryError } = await supabase
      .from("player_categories")
      .insert(categoryRecords);

    if (categoryError) {
      throw categoryError;
    }

    const incrementRecords = input.bidIncrements.map((amount, index) => ({
      tournament_id: tournamentId,
      amount,
      display_order: index
    }));

    const { error: incrementError } = await supabase
      .from("bid_increments")
      .insert(incrementRecords);

    if (incrementError) {
      throw incrementError;
    }

    const { error: stateError } = await supabase
      .from("auction_state")
      .insert({
        tournament_id: tournamentId,
        current_bid: 0,
        message: "Auction not started",
        lot_number: 0
      });

    if (stateError) {
      throw stateError;
    }

    return tournamentId;
  } catch (error) {
    // Remove the partially created tournament.
    // Cascading foreign keys remove its categories and increments.
    await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournamentId);

    throw error;
  }
}