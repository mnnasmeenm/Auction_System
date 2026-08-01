import {
  supabase
} from "./supabase";

export interface ManagerAccountTeam {
  id: string;
  name: string;
  short_name: string;
  team_color: string;
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
}

export interface ManagerAccountData {
  tournament: {
    id: string;
    tournament_name: string;
  };

  teams: ManagerAccountTeam[];
  managers: ManagerAccount[];
}

interface FunctionResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

async function invokeManagerFunction<
  TResult
>(
  body: Record<string, unknown>
): Promise<TResult> {
  const {
    data,
    error
  } =
    await supabase.functions.invoke(
      "manager-accounts",
      {
        body
      }
    );

  if (error) {
    throw error;
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error
  ) {
    throw new Error(
      String(data.error)
    );
  }

  return data as TResult;
}

export async function
getManagerAccounts(
  tournamentId: string
): Promise<ManagerAccountData> {
  return invokeManagerFunction<
    ManagerAccountData
  >({
    action: "list",
    tournamentId
  });
}

export async function
inviteManager(input: {
  tournamentId: string;
  fullName: string;
  email: string;
  teamId: string;
}): Promise<FunctionResponse> {
  return invokeManagerFunction<
    FunctionResponse
  >({
    action: "invite",

    tournamentId:
      input.tournamentId,

    fullName:
      input.fullName,

    email:
      input.email,

    teamId:
      input.teamId
  });
}

export async function
assignManagerTeam(input: {
  tournamentId: string;
  managerId: string;
  teamId: string | null;
}): Promise<FunctionResponse> {
  return invokeManagerFunction<
    FunctionResponse
  >({
    action: "assign",

    tournamentId:
      input.tournamentId,

    managerId:
      input.managerId,

    teamId:
      input.teamId
  });
}

export async function
setManagerActive(input: {
  tournamentId: string;
  managerId: string;
  active: boolean;
}): Promise<FunctionResponse> {
  return invokeManagerFunction<
    FunctionResponse
  >({
    action: "set-active",

    tournamentId:
      input.tournamentId,

    managerId:
      input.managerId,

    active:
      input.active
  });
}

export async function
sendManagerRecovery(input: {
  tournamentId: string;
  managerId: string;
}): Promise<FunctionResponse> {
  return invokeManagerFunction<
    FunctionResponse
  >({
    action: "send-recovery",

    tournamentId:
      input.tournamentId,

    managerId:
      input.managerId
  });
}