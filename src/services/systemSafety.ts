import { supabase } from "./supabase";

export interface OperatorEvent {
  id: string;
  tournament_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}

export async function setTournamentPaused(
  tournamentId: string,
  paused: boolean
): Promise<void> {
  const { error } = await supabase.rpc(
    "set_tournament_auction_paused",
    {
      p_tournament_id:
        tournamentId,

      p_paused:
        paused
    }
  );

  if (error) {
    throw error;
  }
}

export async function getOperatorEvents(
  tournamentId: string
): Promise<OperatorEvent[]> {
  const { data, error } = await supabase
    .from("operator_events")
    .select(`
      id,
      tournament_id,
      action,
      details,
      created_at,
      user_id
    `)
    .eq("tournament_id", tournamentId)
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as OperatorEvent[];
}

export async function createTournamentBackup(
  tournamentId: string
): Promise<string> {
  const tables = [
    "tournaments",
    "player_categories",
    "bid_increments",
    "teams",
    "players",
    "auction_state",
    "sales",
    "operator_events"
  ] as const;

  const entries = await Promise.all(
    tables.map(async (table) => {
      const query = supabase
        .from(table)
        .select("*");

      const { data, error } =
        table === "tournaments"
          ? await query.eq(
              "id",
              tournamentId
            )
          : await query.eq(
              "tournament_id",
              tournamentId
            );

      if (error) {
        throw error;
      }

      return [
        table,
        data ?? []
      ] as const;
    })
  );

  const backup = {
    format:
      "aththariq-tournament-backup-v1",

    createdAt:
      new Date().toISOString(),

    tournamentId,

    data:
      Object.fromEntries(entries)
  };

  return JSON.stringify(
    backup,
    null,
    2
  );
}

export function downloadBackup(
  contents: string,
  tournamentName: string
) {
  const safeName =
    tournamentName
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      ) || "tournament";

  const blob = new Blob(
    [contents],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;

  anchor.download =
    `${safeName}-backup-` +
    `${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

  anchor.click();

  URL.revokeObjectURL(url);
}