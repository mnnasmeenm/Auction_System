declare const Deno: {
  serve: (handler: (request: Request) => Promise<Response>) => void;
  env: {
    get(name: string): string | undefined;
  };
};

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface CleanupRequest {
  tournamentId: string;
  confirmationName: string;
  acknowledgePermanentDeletion: boolean;
}

interface CleanupWarning {
  area: string;
  message: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Only POST requests are allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Cleanup service is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return json({ error: "Authentication required." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  try {
    const {
      data: { user },
      error: userError
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Your login session is invalid or expired." }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, is_active")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      profile.is_active === false
    ) {
      return json({ error: "Active administrator access is required." }, 403);
    }

    let body: CleanupRequest;

    try {
      body = await request.json() as CleanupRequest;
    } catch {
      return json({ error: "A valid JSON request body is required." }, 400);
    }

    const tournamentId = body.tournamentId?.trim();
    const confirmationName = body.confirmationName?.trim();

    if (!tournamentId || !confirmationName) {
      return json({ error: "Tournament and confirmation name are required." }, 400);
    }

    if (body.acknowledgePermanentDeletion !== true) {
      return json({ error: "Permanent-deletion acknowledgement is required." }, 400);
    }

    const { data: tournament, error: tournamentError } = await adminClient
      .from("tournaments")
      .select("id, tournament_name, status")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return json({ error: "Tournament not found." }, 404);
    }

    if (tournament.status !== "paused") {
      return json({ error: "Pause the tournament before permanent cleanup." }, 409);
    }

    if (confirmationName !== tournament.tournament_name) {
      return json({ error: "Tournament-name confirmation does not match." }, 400);
    }

    const { data: managerIds, error: purgeError } = await callerClient.rpc(
      "purge_test_tournament_database",
      {
        p_tournament_id: tournamentId,
        p_confirmation_name: confirmationName
      }
    );

    if (purgeError) {
      throw new Error(purgeError.message);
    }

    const warnings: CleanupWarning[] = [];
    let deletedManagerAccounts = 0;
    let deletedStorageObjects = 0;

    for (const managerId of (managerIds ?? []) as string[]) {
      const { error } = await adminClient.auth.admin.deleteUser(managerId);

      if (error) {
        warnings.push({
          area: "manager-account",
          message: `${managerId}: ${error.message}`
        });
      } else {
        deletedManagerAccounts += 1;
      }
    }

    async function removeTournamentFolder(bucket: string) {
      const paths: string[] = [];
      const pageSize = 100;
      let offset = 0;

      while (true) {
        const { data, error } = await adminClient.storage
          .from(bucket)
          .list(tournamentId, {
            limit: pageSize,
            offset,
            sortBy: { column: "name", order: "asc" }
          });

        if (error) {
          warnings.push({ area: bucket, message: error.message });
          return;
        }

        const objects = (data ?? []).filter((item) => item.id);

        paths.push(
          ...objects.map((item) => `${tournamentId}/${item.name}`)
        );

        if ((data ?? []).length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      for (let index = 0; index < paths.length; index += 100) {
        const batch = paths.slice(index, index + 100);
        const { error } = await adminClient.storage
          .from(bucket)
          .remove(batch);

        if (error) {
          warnings.push({ area: bucket, message: error.message });
        } else {
          deletedStorageObjects += batch.length;
        }
      }
    }

    for (const bucket of [
      "player-photos",
      "team-logos",
      "manager-photos",
      "tournament-branding"
    ]) {
      await removeTournamentFolder(bucket);
    }

    return json({
      success: true,
      message: warnings.length === 0
        ? "Testing tournament and associated files were permanently removed."
        : "Tournament data was removed, but some external cleanup items need review.",
      tournamentId,
      deletedManagerAccounts,
      deletedStorageObjects,
      warnings
    });
  } catch (error) {
    console.error("Testing cleanup error:", error);

    return json({
      error: error instanceof Error
        ? error.message
        : "Testing data could not be cleaned up."
    }, 400);
  }
});