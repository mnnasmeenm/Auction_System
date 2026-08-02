import { supabase } from "./supabase";

const BUCKET = "manager-photos";
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateManagerPhoto(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Manager photograph must be JPG, PNG or WebP.");
  }

  if (file.size > MAX_SIZE) {
    throw new Error("Manager photograph must be smaller than 2 MB.");
  }
}

export async function uploadManagerPhoto(
  tournamentId: string,
  file: File
): Promise<string> {
  validateManagerPhoto(file);

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const filePath =
    `${tournamentId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;
  return filePath;
}

export function getManagerPhotoUrl(
  photoPath: string | null
): string | null {
  if (!photoPath) return null;

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(photoPath);

  return data.publicUrl;
}

export async function deleteManagerPhoto(photoPath: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([photoPath]);

  if (error) throw error;
}