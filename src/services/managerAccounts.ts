import { supabase } from "./supabase";
import {
  deleteManagerPhoto,
  uploadManagerPhoto
} from "./managerPhotos";

export interface ManagerAccountTeam {
  id: string;
  name: string;
  short_name: string;
  team_color: string;
  logo_path: string | null;
  is_active: boolean;
}

export interface ManagerAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "manager";
  is_active: boolean;
  team_id: string | null;
  managed_tournament_id: string;
  manager_photo_path: string | null;
  must_change_password: boolean;
  temporary_password_created_at: string | null;
}

export interface ManagerAccountData {
  tournament: {
    id: string;
    tournament_name: string;
  };
  teams: ManagerAccountTeam[];
  managers: ManagerAccount[];
}

export interface TemporaryCredentials {
  success: boolean;
  message: string;
  managerId: string;
  email: string;
  temporaryPassword: string;
}

interface FunctionResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

async function invokeManagerFunction<TResult>(
  body: Record<string, unknown>
): Promise<TResult> {
  const { data, error } = await supabase.functions.invoke(
    "manager-accounts",
    { body }
  );

  if (error) {
    let message = error.message;

    try {
      const details = await error.context.json();
      message = details?.error ?? message;
    } catch {
      // The function did not return a JSON error body.
    }

    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data as TResult;
}

export function getManagerAccounts(tournamentId: string) {
  return invokeManagerFunction<ManagerAccountData>({
    action: "list",
    tournamentId
  });
}

export async function createManagerAccount(input: {
  tournamentId: string;
  fullName: string;
  email: string;
  teamId: string;
  photoFile: File;
}): Promise<TemporaryCredentials> {
  const photoPath = await uploadManagerPhoto(
    input.tournamentId,
    input.photoFile
  );

  try {
    return await invokeManagerFunction<TemporaryCredentials>({
      action: "create",
      tournamentId: input.tournamentId,
      fullName: input.fullName,
      email: input.email,
      teamId: input.teamId,
      photoPath
    });
  } catch (error) {
    try {
      await deleteManagerPhoto(photoPath);
    } catch (cleanupError) {
      console.error("Manager photo cleanup error:", cleanupError);
    }

    throw error;
  }
}

export function assignManagerTeam(input: {
  tournamentId: string;
  managerId: string;
  teamId: string | null;
}) {
  return invokeManagerFunction<FunctionResponse>({
    action: "assign",
    ...input
  });
}

export function setManagerActive(input: {
  tournamentId: string;
  managerId: string;
  active: boolean;
}) {
  return invokeManagerFunction<FunctionResponse>({
    action: "set-active",
    ...input
  });
}

export function resetManagerTemporaryPassword(input: {
  tournamentId: string;
  managerId: string;
}) {
  return invokeManagerFunction<TemporaryCredentials>({
    action: "reset-password",
    ...input
  });
}

export async function updateManagerPhoto(input: {
  tournamentId: string;
  managerId: string;
  existingPhotoPath: string | null;
  photoFile: File;
}) {
  const photoPath = await uploadManagerPhoto(
    input.tournamentId,
    input.photoFile
  );

  try {
    const response = await invokeManagerFunction<FunctionResponse>({
      action: "set-photo",
      tournamentId: input.tournamentId,
      managerId: input.managerId,
      photoPath
    });

    if (input.existingPhotoPath) {
      try {
        await deleteManagerPhoto(input.existingPhotoPath);
      } catch (cleanupError) {
        console.error("Old manager photo cleanup error:", cleanupError);
      }
    }

    return response;
  } catch (error) {
    try {
      await deleteManagerPhoto(photoPath);
    } catch (cleanupError) {
      console.error("Manager photo cleanup error:", cleanupError);
    }

    throw error;
  }
}