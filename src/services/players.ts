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
  categoryId: string;
  playerNumber: number | null;
  fullName: string;
  nickname: string;
  battingStyle: string;
  bowlingStyle: string;
  preferredPosition: string;
  basePrice: number;
  previousMatches: number;
  previousRuns: number;
  previousWickets: number;
  catches: number;
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
      category_id: input.categoryId,
      player_number: input.playerNumber,
      full_name: input.fullName.trim(),
      nickname: input.nickname.trim() || null,
      batting_style: input.battingStyle.trim() || null,
      bowling_style: input.bowlingStyle.trim() || null,
      preferred_position:
        input.preferredPosition.trim() || null,
      base_price: input.basePrice,
      previous_matches: input.previousMatches,
      previous_runs: input.previousRuns,
      previous_wickets: input.previousWickets,
      catches: input.catches,
      achievements: input.achievements.trim() || null,
      availability_notes:
        input.availabilityNotes.trim() || null,
      status: "available"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!input.photoFile) {
    return player;
  }

  try {
    const photoPath = await uploadPlayerPhoto(
      input.tournamentId,
      player.id,
      input.photoFile
    );

    const { data: updatedPlayer, error: updateError } =
      await supabase
        .from("players")
        .update({
          photo_path: photoPath
        })
        .eq("id", player.id)
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    return updatedPlayer;
  } catch (photoError) {
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
  let photoPath = existingPhotoPath;

  if (input.photoFile) {
    photoPath = await uploadPlayerPhoto(
      input.tournamentId,
      playerId,
      input.photoFile
    );
  }

  const { data, error } = await supabase
    .from("players")
    .update({
      category_id: input.categoryId,
      player_number: input.playerNumber,
      full_name: input.fullName.trim(),
      nickname: input.nickname.trim() || null,
      batting_style: input.battingStyle.trim() || null,
      bowling_style: input.bowlingStyle.trim() || null,
      preferred_position:
        input.preferredPosition.trim() || null,
      base_price: input.basePrice,
      previous_matches: input.previousMatches,
      previous_runs: input.previousRuns,
      previous_wickets: input.previousWickets,
      catches: input.catches,
      achievements: input.achievements.trim() || null,
      availability_notes:
        input.availabilityNotes.trim() || null,
      photo_path: photoPath
    })
    .eq("id", playerId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePlayer(
  player: Player
): Promise<void> {
  if (player.status === "sold") {
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