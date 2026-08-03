import { supabase } from "./supabase";

const BUCKET = "tournament-branding";
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateLogo(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Logo must be a JPG, PNG or WebP image.");
  }

  if (file.size > MAX_SIZE) {
    throw new Error("Logo must be smaller than 2 MB.");
  }
}

export async function uploadTournamentLogo(
  tournamentId: string,
  logoType: "society" | "tournament",
  file: File
): Promise<string> {
  validateLogo(file);

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "png";

  const filePath =
    `${tournamentId}/${logoType}-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) {
    throw error;
  }

  return filePath;
}

export function getTournamentBrandingUrl(
  logoPath: string | null | undefined
): string | null {
  if (!logoPath) {
    return null;
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(logoPath);

  return data.publicUrl;
}

export async function deleteTournamentLogo(
  logoPath: string | null | undefined
): Promise<void> {
  if (!logoPath) {
    return;
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([logoPath]);

  if (error) {
    throw error;
  }
}