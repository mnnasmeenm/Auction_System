import { supabase } from "./supabase";
import type { Team } from "../types/database";

export interface TeamInput {
  tournamentId: string;
  name: string;
  shortName: string;
  managerName: string;
  teamColor: string;
  startingBudget: number;
  squadLimit: number;
  logoFile?: File | null;
}

function validateLogo(file: File) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Team logo must be JPG, PNG or WebP.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Team logo must be smaller than 2 MB.");
  }
}

export function getTeamLogoUrl(
  logoPath: string | null
): string | null {
  if (!logoPath) {
    return null;
  }

  const { data } = supabase.storage
    .from("team-logos")
    .getPublicUrl(logoPath);

  return data.publicUrl;
}

async function uploadTeamLogo(
  tournamentId: string,
  teamId: string,
  file: File
): Promise<string> {
  validateLogo(file);

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "png";

  const filePath =
    `${tournamentId}/${teamId}.${extension}`;

  const { error } = await supabase.storage
    .from("team-logos")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) {
    throw error;
  }

  return filePath;
}

async function deleteTeamLogo(
  logoPath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from("team-logos")
    .remove([logoPath]);

  if (error) {
    throw error;
  }
}

export async function getTeams(
  tournamentId: string
): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createTeam(
  input: TeamInput
): Promise<Team> {
  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      tournament_id: input.tournamentId,
      name: input.name.trim(),
      short_name: input.shortName.trim().toUpperCase(),
      manager_name: input.managerName.trim() || null,
      team_color: input.teamColor,
      starting_budget: input.startingBudget,
      amount_spent: 0,
      squad_limit: input.squadLimit,
      is_active: true
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!input.logoFile) {
    return team;
  }

  let uploadedLogoPath: string | null = null;

  try {
    uploadedLogoPath = await uploadTeamLogo(
      input.tournamentId,
      team.id,
      input.logoFile
    );

    const { data: updatedTeam, error: updateError } =
      await supabase
        .from("teams")
        .update({
          logo_path: uploadedLogoPath
        })
        .eq("id", team.id)
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    return updatedTeam;
  } catch (uploadError) {
    if (uploadedLogoPath) {
      await deleteTeamLogo(uploadedLogoPath).catch(
        (cleanupError) => {
          console.error(
            "New team logo cleanup error:",
            cleanupError
          );
        }
      );
    }

    await supabase
      .from("teams")
      .delete()
      .eq("id", team.id);

    throw uploadError;
  }
}

export async function updateTeam(
  teamId: string,
  input: TeamInput
): Promise<Team> {
  let logoPath: string | undefined;
  let existingLogoPath: string | null = null;

  if (input.logoFile) {
    const { data: existingTeam, error: existingTeamError } =
      await supabase
        .from("teams")
        .select("logo_path")
        .eq("id", teamId)
        .single();

    if (existingTeamError) {
      throw existingTeamError;
    }

    existingLogoPath = existingTeam.logo_path;

    logoPath = await uploadTeamLogo(
      input.tournamentId,
      teamId,
      input.logoFile
    );
  }

  const updateData: Record<string, unknown> = {
    name: input.name.trim(),
    short_name: input.shortName.trim().toUpperCase(),
    manager_name: input.managerName.trim() || null,
    team_color: input.teamColor,
    starting_budget: input.startingBudget,
    squad_limit: input.squadLimit
  };

  if (logoPath) {
    updateData.logo_path = logoPath;
  }

  const { data, error } = await supabase
    .from("teams")
    .update(updateData)
    .eq("id", teamId)
    .select("*")
    .single();

  if (error) {
    if (logoPath && logoPath !== existingLogoPath) {
      await deleteTeamLogo(logoPath).catch(
        (cleanupError) => {
          console.error(
            "Failed team logo cleanup error:",
            cleanupError
          );
        }
      );
    }

    throw error;
  }

  if (
    logoPath &&
    existingLogoPath &&
    existingLogoPath !== logoPath
  ) {
    await deleteTeamLogo(existingLogoPath).catch(
      (cleanupError) => {
        console.error(
          "Old team logo cleanup error:",
          cleanupError
        );
      }
    );
  }

  return data;
}

export async function setTeamActiveStatus(
  teamId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("teams")
    .update({
      is_active: isActive
    })
    .eq("id", teamId);

  if (error) {
    throw error;
  }
}

export async function deleteTeam(
  teamId: string
): Promise<void> {
  const { data: team, error: teamError } =
    await supabase
      .from("teams")
      .select("logo_path")
      .eq("id", teamId)
      .single();

  if (teamError) {
    throw teamError;
  }

  const { count: salesCount, error: salesError } =
    await supabase
      .from("sales")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("team_id", teamId);

  if (salesError) {
    throw salesError;
  }

  if ((salesCount ?? 0) > 0) {
    throw new Error(
      "This team has auction sales and cannot be deleted. Disable it instead."
    );
  }

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId);

  if (error) {
    throw error;
  }

  if (team.logo_path) {
    await deleteTeamLogo(team.logo_path).catch(
      (cleanupError) => {
        console.error(
          "Deleted team logo cleanup error:",
          cleanupError
        );
      }
    );
  }
}