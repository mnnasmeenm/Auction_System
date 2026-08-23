import { supabase } from "./supabase";

export interface CleanupWarning {
  area: string;
  message: string;
}

export interface CleanupResult {
  success: boolean;
  message: string;
  tournamentId: string;
  deletedManagerAccounts: number;
  deletedStorageObjects: number;
  warnings: CleanupWarning[];
}

export async function cleanupTestingTournament(input: {
  tournamentId: string;
  confirmationName: string;
}): Promise<CleanupResult> {
  const { data, error } = await supabase.functions.invoke(
    "cleanup-test-tournament",
    {
      body: {
        tournamentId: input.tournamentId,
        confirmationName: input.confirmationName,
        acknowledgePermanentDeletion: true
      }
    }
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

  return data as CleanupResult;
}

export async function resetTournamentMatchTestingData(
  tournamentId: string
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "reset_tournament_match_testing_data",
    {
      p_tournament_id: tournamentId,
      p_confirmation: "RESET MATCHES"
    }
  );

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}
