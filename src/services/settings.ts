import { supabase } from "./supabase";

import type {
  PlayerCategory,
  Tournament
} from "../types/database";

export interface SettingsBidIncrement {
  id: string;
  tournament_id: string;
  amount: number;
  display_order: number;
}

export interface TournamentConfiguration {
  tournament: Tournament;
  categories: PlayerCategory[];
  bidIncrements: SettingsBidIncrement[];
}

export interface TournamentConfigurationInput {
  tournamentId: string;
  societyName: string;
  tournamentName: string;
  societyLogoPath: string | null;
  tournamentLogoPath: string | null;
  publicSlug: string | null;
  isPublic: boolean;
  startingBudget: number;
  maximumSquadSize: number;
  allowSaleRevocation: boolean;
  requireRevocationReason: boolean;
  bidIncrements: number[];
  applyDefaultsToUnusedTeams: boolean;
}

export interface CategoryInput {
  id?: string;
  tournamentId: string;
  name: string;
  minimumRequired: number;
  displayOrder: number;
}

export async function getTournamentConfiguration(
  tournamentId: string
): Promise<TournamentConfiguration> {
  const [
    tournamentResponse,
    categoryResponse,
    incrementResponse
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single(),

    supabase
      .from("player_categories")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order"),

    supabase
      .from("bid_increments")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order")
  ]);

  if (tournamentResponse.error) {
    throw tournamentResponse.error;
  }

  if (categoryResponse.error) {
    throw categoryResponse.error;
  }

  if (incrementResponse.error) {
    throw incrementResponse.error;
  }

  return {
    tournament:
      tournamentResponse.data as Tournament,

    categories:
      (categoryResponse.data ?? []) as PlayerCategory[],

    bidIncrements:
      (incrementResponse.data ??
        []) as SettingsBidIncrement[]
  };
}

export async function updateTournamentConfiguration(
  input: TournamentConfigurationInput
): Promise<void> {
  const { error } = await supabase.rpc(
    "update_tournament_configuration",
    {
      p_tournament_id: input.tournamentId,
      p_society_name: input.societyName,
      p_tournament_name: input.tournamentName,
      p_starting_budget: input.startingBudget,
      p_maximum_squad_size: input.maximumSquadSize,
      p_allow_sale_revocation:
        input.allowSaleRevocation,
      p_require_revocation_reason:
        input.requireRevocationReason,
      p_bid_increments: input.bidIncrements,
      p_apply_defaults_to_unused_teams:
        input.applyDefaultsToUnusedTeams
    }
  );

  if (error) {
    throw error;
  }

  const { error: brandingError } = await supabase
    .from("tournaments")
    .update({
      society_logo_path: input.societyLogoPath,
      tournament_logo_path: input.tournamentLogoPath,
      public_slug: input.publicSlug,
      is_public: input.isPublic
    })
    .eq("id", input.tournamentId);

  if (brandingError) {
    throw brandingError;
  }
}

export async function saveCategory(
  input: CategoryInput
): Promise<void> {
  if (input.id) {
    const { error } = await supabase
      .from("player_categories")
      .update({
        name: input.name.trim(),
        minimum_required:
          input.minimumRequired,
        display_order:
          input.displayOrder
      })
      .eq("id", input.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("player_categories")
    .insert({
      tournament_id: input.tournamentId,
      name: input.name.trim(),
      minimum_required:
        input.minimumRequired,
      display_order:
        input.displayOrder
    });

  if (error) {
    throw error;
  }
}

export async function validateCategoryDeletion(
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length === 0) {
    return;
  }

  const { count, error } = await supabase
    .from("players")
    .select("id", {
      count: "exact",
      head: true
    })
    .in("category_id", categoryIds);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "A category assigned to registered players cannot be deleted. Move those players to another category first."
    );
  }
}

export async function deleteCategories(
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("player_categories")
    .delete()
    .in("id", categoryIds);

  if (error) {
    throw error;
  }
}
