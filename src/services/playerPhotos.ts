import { supabase } from "./supabase";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export async function uploadPlayerPhoto(
  tournamentId: string,
  playerId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Player photograph must be smaller than 2 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

  const allowedExtensions = ["jpg", "jpeg", "png", "webp"];

  if (!allowedExtensions.includes(extension)) {
    throw new Error("Only JPG, PNG and WebP photographs are allowed.");
  }

  const filePath = `${tournamentId}/${playerId}.${extension}`;

  const { error } = await supabase.storage
    .from("player-photos")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) {
    throw error;
  }

  return filePath;
}

export function getPlayerPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) {
    return null;
  }

  const { data } = supabase.storage
    .from("player-photos")
    .getPublicUrl(photoPath);

  return data.publicUrl;
}

export async function deletePlayerPhoto(photoPath: string): Promise<void> {
  const { error } = await supabase.storage
    .from("player-photos")
    .remove([photoPath]);

  if (error) {
    throw error;
  }
}