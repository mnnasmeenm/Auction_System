import { supabase } from "./supabase";
import {
  deletePlayerPhoto,
  uploadPlayerPhoto
} from "./playerPhotos";

import type {
  Player,
  PlayerCategory
} from "../types/database";

export interface PlayerInput {
  tournamentId: string;
  divisionId: string;
  allocationSource: "auction" | "manual";
  assignedTeamId: string | null;
  categoryId: string | null;
  playerNumber: number | null;
  fullName: string;
  nickname: string;
  battingStyle: string;
  bowlingStyle: string;
  preferredPosition: string;
  basePrice: number;
  achievements: string;
  availabilityNotes: string;
  photoFile?: File | null;
}

export async function getPlayerCategories(
  tournamentId: string
): Promise<PlayerCategory[]> {
  const { data, error } = await supabase
    .from("player_categories")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("display_order");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPlayers(
  tournamentId: string
): Promise<Player[]> {
  const { data, error } = await supabase
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
    .order("full_name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Player[];
}

export async function createPlayer(
  input: PlayerInput
): Promise<Player> {
  const { data: player, error } = await supabase
    .from("players")
    .insert({
      tournament_id: input.tournamentId,
      division_id: input.divisionId,
      category_id: input.categoryId,
      player_number: input.playerNumber,
      full_name: input.fullName.trim(),
      nickname: input.nickname.trim() || null,
      batting_style: input.battingStyle.trim() || null,
      bowling_style: input.bowlingStyle.trim() || null,
      preferred_position:
        input.preferredPosition.trim() || null,
      base_price: input.basePrice,
      previous_matches: 0,
      previous_runs: 0,
      previous_wickets: 0,
      catches: 0,
      achievements: input.achievements.trim() || null,
      availability_notes:
        input.availabilityNotes.trim() || null,
      status: input.allocationSource === "manual"
        ? "sold"
        : "available",
      sold_team_id: input.allocationSource === "manual"
        ? input.assignedTeamId
        : null,
      sold_price: input.allocationSource === "manual"
        ? 0
        : null,
      allocation_source: input.allocationSource,
      counts_toward_budget: input.allocationSource !== "manual"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!input.photoFile) {
    return player;
  }

  let uploadedPhotoPath: string | null = null;

  try {
    uploadedPhotoPath = await uploadPlayerPhoto(
      input.tournamentId,
      player.id,
      input.photoFile
    );

    const { data: updatedPlayer, error: updateError } =
      await supabase
        .from("players")
        .update({
          photo_path: uploadedPhotoPath
        })
        .eq("id", player.id)
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    return updatedPlayer;
  } catch (photoError) {
    if (uploadedPhotoPath) {
      await deletePlayerPhoto(uploadedPhotoPath).catch(
        (cleanupError) => {
          console.error(
            "New player photo cleanup error:",
            cleanupError
          );
        }
      );
    }

    await supabase
      .from("players")
      .delete()
      .eq("id", player.id);

    throw photoError;
  }
}

export async function updatePlayer(
  playerId: string,
  existingPhotoPath: string | null,
  input: PlayerInput
): Promise<Player> {
  const { data: existingPlayer, error: existingPlayerError } =
    await supabase
      .from("players")
      .select(`
        status,
        sold_team_id,
        sold_price,
        allocation_source,
        counts_toward_budget
      `)
      .eq("id", playerId)
      .single();

  if (existingPlayerError) {
    throw existingPlayerError;
  }

  const protectedAuctionSale =
    existingPlayer.allocation_source !== "manual" &&
    existingPlayer.status === "sold";
  let photoPath = existingPhotoPath;
  let uploadedPhotoPath: string | null = null;

  if (input.photoFile) {
    uploadedPhotoPath = await uploadPlayerPhoto(
      input.tournamentId,
      playerId,
      input.photoFile
    );

    photoPath = uploadedPhotoPath;
  }

  const { data, error } = await supabase
    .from("players")
    .update({
      division_id: protectedAuctionSale
        ? undefined
        : input.divisionId,
      category_id: input.categoryId,
      player_number: input.playerNumber,
      full_name: input.fullName.trim(),
      nickname: input.nickname.trim() || null,
      batting_style: input.battingStyle.trim() || null,
      bowling_style: input.bowlingStyle.trim() || null,
      preferred_position:
        input.preferredPosition.trim() || null,
      base_price: input.basePrice,
      achievements: input.achievements.trim() || null,
      availability_notes:
        input.availabilityNotes.trim() || null,
      photo_path: photoPath,
      status: protectedAuctionSale
        ? existingPlayer.status
        : input.allocationSource === "manual"
          ? "sold"
          : "available",
      sold_team_id: protectedAuctionSale
        ? existingPlayer.sold_team_id
        : input.allocationSource === "manual"
          ? input.assignedTeamId
          : null,
      sold_price: protectedAuctionSale
        ? existingPlayer.sold_price
        : input.allocationSource === "manual"
          ? 0
          : null,
      allocation_source: protectedAuctionSale
        ? existingPlayer.allocation_source
        : input.allocationSource,
      counts_toward_budget: protectedAuctionSale
        ? existingPlayer.counts_toward_budget
        : input.allocationSource !== "manual"
    })
    .eq("id", playerId)
    .select("*")
    .single();

  if (error) {
    if (
      uploadedPhotoPath &&
      uploadedPhotoPath !== existingPhotoPath
    ) {
      await deletePlayerPhoto(uploadedPhotoPath).catch(
        (cleanupError) => {
          console.error(
            "Failed player photo cleanup error:",
            cleanupError
          );
        }
      );
    }

    throw error;
  }

  if (
    uploadedPhotoPath &&
    existingPhotoPath &&
    existingPhotoPath !== uploadedPhotoPath
  ) {
    await deletePlayerPhoto(existingPhotoPath).catch(
      (cleanupError) => {
        console.error(
          "Old player photo cleanup error:",
          cleanupError
        );
      }
    );
  }

  return data;
}

export async function deletePlayer(
  player: Player
): Promise<void> {
  if (
    player.status === "sold" &&
    player.allocation_source !== "manual"
  ) {
    throw new Error(
      "A sold player cannot be deleted. Revoke the sale first."
    );
  }

  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", player.id);

  if (error) {
    throw error;
  }

  if (player.photo_path) {
    await deletePlayerPhoto(player.photo_path);
  }
}
