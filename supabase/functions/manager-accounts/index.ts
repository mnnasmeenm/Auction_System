import {
  createClient
} from "@supabase/supabase-js";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

type ManagerAction =
  | "list"
  | "invite"
  | "assign"
  | "set-active"
  | "send-recovery";

interface ManagerRequestBody {
  action: ManagerAction;
  tournamentId: string;
  managerId?: string;
  teamId?: string | null;
  email?: string;
  fullName?: string;
  active?: boolean;
}

interface AuditDetails {
  [key: string]: unknown;
}

function createJsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
}

function normalizeEmail(
  value?: string
) {
  return (
    value
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function normalizeSiteUrl(
  value?: string | null
) {
  return (
    value
      ?.trim()
      .replace(/\/+$/, "") ?? ""
  );
}

function isValidEmail(
  email: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}

Deno.serve(
  async (
    request: Request
  ): Promise<Response> => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers: corsHeaders
        }
      );
    }

    if (
      request.method !== "POST"
    ) {
      return createJsonResponse(
        {
          error:
            "Only POST requests are allowed."
        },
        405
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const supabaseAnonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const configuredSiteUrl =
      normalizeSiteUrl(
        Deno.env.get(
          "SITE_URL"
        )
      );

    const requestOrigin =
      normalizeSiteUrl(
        request.headers.get(
          "origin"
        )
      );

    /*
     * SITE_URL should contain the deployed
     * Vercel URL.
     *
     * Example:
     * https://auction-system.vercel.app
     *
     * requestOrigin is used only as a fallback
     * for local development.
     */
    const siteUrl =
      configuredSiteUrl ||
      requestOrigin;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Required Supabase environment variables are missing."
      );

      return createJsonResponse(
        {
          error:
            "The manager service is not configured correctly."
        },
        500
      );
    }

    if (!siteUrl) {
      console.error(
        "SITE_URL is not configured."
      );

      return createJsonResponse(
        {
          error:
            "The application URL is not configured."
        },
        500
      );
    }

    const authorizationHeader =
      request.headers.get(
        "Authorization"
      );

    if (
      !authorizationHeader
    ) {
      return createJsonResponse(
        {
          error:
            "Authentication required."
        },
        401
      );
    }

    const authenticatedClient =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                authorizationHeader
            }
          },

          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          }
        }
      );

    const administratorClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          }
        }
      );

    try {
      const {
        data: {
          user
        },
        error: userError
      } =
        await authenticatedClient
          .auth
          .getUser();

      if (
        userError ||
        !user
      ) {
        return createJsonResponse(
          {
            error:
              "Your login session is invalid or expired."
          },
          401
        );
      }

      const {
        data:
          administratorProfile,

        error:
          administratorProfileError
      } =
        await administratorClient
          .from("user_profiles")
          .select(`
            id,
            role,
            is_active
          `)
          .eq(
            "id",
            user.id
          )
          .single();

      if (
        administratorProfileError ||
        !administratorProfile ||
        administratorProfile.role !==
          "admin" ||
        administratorProfile.is_active ===
          false
      ) {
        return createJsonResponse(
          {
            error:
              "Active administrator access is required."
          },
          403
        );
      }

      let body:
        ManagerRequestBody;

      try {
        body =
          await request.json() as
            ManagerRequestBody;
      } catch {
        return createJsonResponse(
          {
            error:
              "A valid JSON request body is required."
          },
          400
        );
      }

      const {
        action,
        tournamentId
      } = body;

      const allowedActions:
        ManagerAction[] = [
          "list",
          "invite",
          "assign",
          "set-active",
          "send-recovery"
        ];

      if (
        !allowedActions.includes(
          action
        )
      ) {
        return createJsonResponse(
          {
            error:
              "Unsupported manager-account action."
          },
          400
        );
      }

      if (
        !tournamentId
      ) {
        return createJsonResponse(
          {
            error:
              "Tournament ID is required."
          },
          400
        );
      }

      const {
        data: tournament,
        error: tournamentError
      } =
        await administratorClient
          .from("tournaments")
          .select(`
            id,
            tournament_name,
            society_name,
            status
          `)
          .eq(
            "id",
            tournamentId
          )
          .single();

      if (
        tournamentError ||
        !tournament
      ) {
        return createJsonResponse(
          {
            error:
              "Tournament not found."
          },
          404
        );
      }

      async function validateTeam(
        teamId: string
      ) {
        const {
          data: team,
          error
        } =
          await administratorClient
            .from("teams")
            .select(`
              id,
              tournament_id,
              name,
              short_name,
              is_active
            `)
            .eq(
              "id",
              teamId
            )
            .eq(
              "tournament_id",
              tournamentId
            )
            .single();

        if (
          error ||
          !team
        ) {
          throw new Error(
            "The selected team does not belong to this tournament."
          );
        }

        return team;
      }

      async function getManager(
        managerId: string
      ) {
        const {
          data: manager,
          error
        } =
          await administratorClient
            .from("user_profiles")
            .select(`
              id,
              full_name,
              email,
              role,
              is_active,
              team_id,
              managed_tournament_id
            `)
            .eq(
              "id",
              managerId
            )
            .eq(
              "role",
              "manager"
            )
            .eq(
              "managed_tournament_id",
              tournamentId
            )
            .single();

        if (
          error ||
          !manager
        ) {
          throw new Error(
            "Manager account not found for this tournament."
          );
        }

        return manager;
      }

      async function recordAudit(
        auditAction: string,
        details: AuditDetails
      ) {
        const actorId =
          user?.id;

        if (!actorId) {
          console.error(
            "Manager audit recording skipped because the authenticated user is unavailable."
          );

          return;
        }

        const {
          error
        } =
          await administratorClient
            .from(
              "operator_events"
            )
            .insert({
              tournament_id:
                tournamentId,

              user_id:
                actorId,

              action:
                auditAction,

              details
            });

        if (error) {
          console.error(
            "Manager audit recording error:",
            error
          );
        }
      }

      /*
       * LIST MANAGERS AND TEAMS
       */
      if (
        action === "list"
      ) {
        const [
          teamsResponse,
          managersResponse
        ] =
          await Promise.all([
            administratorClient
              .from("teams")
              .select(`
                id,
                name,
                short_name,
                team_color,
                is_active
              `)
              .eq(
                "tournament_id",
                tournamentId
              )
              .order(
                "name",
                {
                  ascending: true
                }
              ),

            administratorClient
              .from(
                "user_profiles"
              )
              .select(`
                id,
                full_name,
                email,
                role,
                is_active,
                team_id,
                managed_tournament_id
              `)
              .eq(
                "role",
                "manager"
              )
              .eq(
                "managed_tournament_id",
                tournamentId
              )
              .order(
                "full_name",
                {
                  ascending: true,
                  nullsFirst: false
                }
              )
          ]);

        if (
          teamsResponse.error
        ) {
          throw teamsResponse.error;
        }

        if (
          managersResponse.error
        ) {
          throw managersResponse.error;
        }

        return createJsonResponse({
          tournament: {
            id:
              tournament.id,

            tournament_name:
              tournament
                .tournament_name
          },

          teams:
            teamsResponse.data ??
            [],

          managers:
            managersResponse.data ??
            []
        });
      }

      /*
       * INVITE MANAGER
       */
      if (
        action === "invite"
      ) {
        const email =
          normalizeEmail(
            body.email
          );

        const fullName =
          body.fullName
            ?.trim() ?? "";

        const teamId =
          body.teamId
            ?.trim() ?? "";

        if (
          !fullName
        ) {
          return createJsonResponse(
            {
              error:
                "Manager name is required."
            },
            400
          );
        }

        if (
          fullName.length > 120
        ) {
          return createJsonResponse(
            {
              error:
                "Manager name cannot exceed 120 characters."
            },
            400
          );
        }

        if (
          !email ||
          !isValidEmail(email)
        ) {
          return createJsonResponse(
            {
              error:
                "Enter a valid manager email address."
            },
            400
          );
        }

        if (
          !teamId
        ) {
          return createJsonResponse(
            {
              error:
                "Select a team for the manager."
            },
            400
          );
        }

        const team =
          await validateTeam(
            teamId
          );

        const invitationRedirectUrl =
          `${siteUrl}/manager/set-password`;

        const {
          data:
            invitedUserData,

          error:
            invitationError
        } =
          await administratorClient
            .auth
            .admin
            .inviteUserByEmail(
              email,
              {
                redirectTo:
                  invitationRedirectUrl,

                data: {
                  full_name:
                    fullName,

                  account_role:
                    "manager",

                  tournament_id:
                    tournamentId,

                  team_id:
                    teamId
                }
              }
            );

        if (
          invitationError
        ) {
          throw new Error(
            invitationError.message
          );
        }

        const invitedUser =
          invitedUserData.user;

        if (
          !invitedUser
        ) {
          throw new Error(
            "Supabase did not return the invited user."
          );
        }

        const {
          error:
            managerProfileError
        } =
          await administratorClient
            .from(
              "user_profiles"
            )
            .upsert(
              {
                id:
                  invitedUser.id,

                role:
                  "manager",

                full_name:
                  fullName,

                email,

                team_id:
                  teamId,

                managed_tournament_id:
                  tournamentId,

                is_active:
                  true
              },
              {
                onConflict:
                  "id"
              }
            );

        if (
          managerProfileError
        ) {
          await administratorClient
            .auth
            .admin
            .deleteUser(
              invitedUser.id
            );

          throw managerProfileError;
        }

        await recordAudit(
          "manager_invited",
          {
            manager_user_id:
              invitedUser.id,

            full_name:
              fullName,

            email,

            team_id:
              teamId,

            team_name:
              team.name,

            redirect_url:
              invitationRedirectUrl
          }
        );

        return createJsonResponse({
          success: true,

          message:
            `Invitation sent to ${email}.`
        });
      }

      const managerId =
        body.managerId
          ?.trim() ?? "";

      if (
        !managerId
      ) {
        return createJsonResponse(
          {
            error:
              "Manager ID is required."
          },
          400
        );
      }

      const manager =
        await getManager(
          managerId
        );

      /*
       * ASSIGN OR REMOVE TEAM
       */
      if (
        action === "assign"
      ) {
        const teamId =
          body.teamId
            ?.trim() || null;

        let teamName:
          string | null = null;

        if (
          teamId
        ) {
          const team =
            await validateTeam(
              teamId
            );

          teamName =
            team.name;
        }

        const {
          error
        } =
          await administratorClient
            .from(
              "user_profiles"
            )
            .update({
              team_id:
                teamId
            })
            .eq(
              "id",
              managerId
            );

        if (error) {
          throw error;
        }

        await recordAudit(
          teamId
            ? "manager_team_assigned"
            : "manager_team_removed",
          {
            manager_user_id:
              managerId,

            manager_email:
              manager.email,

            previous_team_id:
              manager.team_id,

            new_team_id:
              teamId,

            new_team_name:
              teamName
          }
        );

        return createJsonResponse({
          success: true,

          message:
            teamId
              ? "Manager assignment updated."
              : "Manager team access removed."
        });
      }

      /*
       * ENABLE OR DISABLE MANAGER
       */
      if (
        action === "set-active"
      ) {
        if (
          typeof body.active !==
          "boolean"
        ) {
          return createJsonResponse(
            {
              error:
                "The account status is required."
            },
            400
          );
        }

        const active =
          body.active;

        const {
          error:
            authenticationUpdateError
        } =
          await administratorClient
            .auth
            .admin
            .updateUserById(
              managerId,
              {
                ban_duration:
                  active
                    ? "none"
                    : "876000h"
              }
            );

        if (
          authenticationUpdateError
        ) {
          throw authenticationUpdateError;
        }

        const {
          error:
            profileUpdateError
        } =
          await administratorClient
            .from(
              "user_profiles"
            )
            .update({
              is_active:
                active
            })
            .eq(
              "id",
              managerId
            );

        if (
          profileUpdateError
        ) {
          throw profileUpdateError;
        }

        await recordAudit(
          active
            ? "manager_enabled"
            : "manager_disabled",
          {
            manager_user_id:
              managerId,

            manager_email:
              manager.email
          }
        );

        return createJsonResponse({
          success: true,

          message:
            active
              ? "Manager account enabled."
              : "Manager account disabled."
        });
      }

      /*
       * SEND PASSWORD RECOVERY
       */
      if (
        action ===
        "send-recovery"
      ) {
        const email =
          normalizeEmail(
            manager.email ??
            undefined
          );

        if (
          !email
        ) {
          return createJsonResponse(
            {
              error:
                "This manager does not have an email address."
            },
            400
          );
        }

        const recoveryRedirectUrl =
          `${siteUrl}/manager/set-password`;

        const {
          error:
            recoveryError
        } =
          await administratorClient
            .auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  recoveryRedirectUrl
              }
            );

        if (
          recoveryError
        ) {
          throw recoveryError;
        }

        await recordAudit(
          "manager_recovery_sent",
          {
            manager_user_id:
              managerId,

            manager_email:
              email,

            redirect_url:
              recoveryRedirectUrl
          }
        );

        return createJsonResponse({
          success: true,

          message:
            `Password recovery email sent to ${email}.`
        });
      }

      return createJsonResponse(
        {
          error:
            "Unsupported manager-account action."
        },
        400
      );
    } catch (error) {
      console.error(
        "Manager account function error:",
        error
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Manager-account request failed."
        },
        400
      );
    }
  }
);