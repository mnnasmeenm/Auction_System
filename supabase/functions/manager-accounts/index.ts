import {
  createClient
} from "@supabase/supabase-js";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response> | Response): void;
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
  | "create"
  | "assign"
  | "set-active"
  | "reset-password"
  | "set-photo";

interface ManagerRequestBody {
  action: ManagerAction;
  tournamentId: string;
  managerId?: string;
  teamId?: string | null;
  email?: string;
  fullName?: string;
  active?: boolean;
  photoPath?: string | null;
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

        "Content-Type":
          "application/json"
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

function isValidEmail(
  email: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}

function randomCharacter(
  characters: string
) {
  const random =
    new Uint32Array(1);

  crypto.getRandomValues(
    random
  );

  return characters[
    random[0] %
    characters.length
  ];
}

function generateTemporaryPassword() {
  const uppercase =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const lowercase =
    "abcdefghijkmnopqrstuvwxyz";

  const numbers =
    "23456789";

  const symbols =
    "!@#$%*-_";

  const allCharacters =
    uppercase +
    lowercase +
    numbers +
    symbols;

  const characters = [
    randomCharacter(uppercase),
    randomCharacter(lowercase),
    randomCharacter(numbers),
    randomCharacter(symbols)
  ];

  while (
    characters.length < 16
  ) {
    characters.push(
      randomCharacter(
        allCharacters
      )
    );
  }

  /*
   * Securely shuffle the generated password.
   */
  for (
    let index =
      characters.length - 1;

    index > 0;

    index -= 1
  ) {
    const random =
      new Uint32Array(1);

    crypto.getRandomValues(
      random
    );

    const target =
      random[0] %
      (index + 1);

    [
      characters[index],
      characters[target]
    ] = [
      characters[target],
      characters[index]
    ];
  }

  return characters.join("");
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
          headers:
            corsHeaders
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

    /*
     * Client representing the currently
     * logged-in administrator.
     */
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
            autoRefreshToken:
              false,

            persistSession:
              false,

            detectSessionInUrl:
              false
          }
        }
      );

    /*
     * Protected server-side administrator
     * client.
     */
    const administratorClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,

            detectSessionInUrl:
              false
          }
        }
      );

    try {
      /*
       * Validate the calling user's token.
       */
      const {
        data: {
          user
        },

        error:
          userError
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

      /*
       * Confirm that the user is an active
       * administrator.
       */
      const {
        data:
          administratorProfile,

        error:
          administratorProfileError
      } =
        await administratorClient
          .from(
            "user_profiles"
          )
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

      const allowedActions:
        ManagerAction[] = [
          "list",
          "create",
          "assign",
          "set-active",
          "reset-password",
          "set-photo"
        ];

      if (
        !allowedActions.includes(
          body.action
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

      const tournamentId =
        body.tournamentId
          ?.trim() ?? "";

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

      /*
       * Validate the tournament.
       */
      const {
        data:
          tournament,

        error:
          tournamentError
      } =
        await administratorClient
          .from(
            "tournaments"
          )
          .select(`
            id,
            tournament_name
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

      /*
       * Validate that a selected team belongs
       * to the current tournament.
       */
      async function validateTeam(
        teamId: string
      ) {
        const {
          data: team,
          error
        } =
          await administratorClient
            .from(
              "teams"
            )
            .select(`
              id,
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

      /*
       * Load a manager assigned to the
       * current tournament.
       */
      async function getManager(
        managerId: string
      ) {
        const {
          data: manager,
          error
        } =
          await administratorClient
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
              managed_tournament_id,
              manager_photo_path,
              must_change_password
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

      /*
       * Save protected manager operations
       * in the operator audit table.
       */
      async function recordAudit(
        auditAction: string,
        details:
          Record<string, unknown>
      ) {
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
                user!.id,

              action:
                auditAction,

              details
            });

        /*
         * Audit failure should be logged,
         * but it should not reverse an
         * already-completed manager action.
         */
        if (error) {
          console.error(
            "Manager audit recording error:",
            error
          );
        }
      }

      /*
       * =====================================
       * LIST MANAGERS AND TEAMS
       * =====================================
       */
      if (
        body.action === "list"
      ) {
        const [
          teamsResponse,
          managersResponse
        ] =
          await Promise.all([
            administratorClient
              .from(
                "teams"
              )
              .select(`
                id,
                name,
                short_name,
                team_color,
                logo_path,
                is_active
              `)
              .eq(
                "tournament_id",
                tournamentId
              )
              .order(
                "name"
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
                managed_tournament_id,
                manager_photo_path,
                must_change_password,
                temporary_password_created_at
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
                  nullsFirst:
                    false
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
          tournament,

          teams:
            teamsResponse.data ??
            [],

          managers:
            managersResponse.data ??
            []
        });
      }

      /*
       * =====================================
       * CREATE MANAGER
       * =====================================
       */
      if (
        body.action === "create"
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

        const photoPath =
          body.photoPath
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
          !isValidEmail(
            email
          )
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

        /*
         * The photo path must belong to the
         * selected tournament folder.
         */
        if (
          !photoPath ||
          !photoPath.startsWith(
            `${tournamentId}/`
          )
        ) {
          return createJsonResponse(
            {
              error:
                "A valid manager photograph is required."
            },
            400
          );
        }

        const team =
          await validateTeam(
            teamId
          );

        if (
          !team.is_active
        ) {
          return createJsonResponse(
            {
              error:
                "A manager cannot be assigned to an inactive team."
            },
            400
          );
        }

        const temporaryPassword =
          generateTemporaryPassword();

        /*
         * Create a confirmed email/password
         * account without sending an email.
         */
        const {
          data:
            createdUserData,

          error:
            createUserError
        } =
          await administratorClient
            .auth
            .admin
            .createUser({
              email,

              password:
                temporaryPassword,

              email_confirm:
                true,

              user_metadata: {
                full_name:
                  fullName,

                account_role:
                  "manager",

                tournament_id:
                  tournamentId,

                team_id:
                  teamId
              }
            });

        if (
          createUserError
        ) {
          throw new Error(
            createUserError.message
          );
        }

        const createdUser =
          createdUserData.user;

        if (
          !createdUser
        ) {
          throw new Error(
            "Supabase did not return the created manager."
          );
        }

        /*
         * The Auth trigger may already have
         * created a profile. Upsert safely
         * converts it into a manager.
         */
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
                  createdUser.id,

                role:
                  "manager",

                full_name:
                  fullName,

                email,

                team_id:
                  teamId,

                managed_tournament_id:
                  tournamentId,

                manager_photo_path:
                  photoPath,

                must_change_password:
                  true,

                temporary_password_created_at:
                  new Date()
                    .toISOString(),

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
          /*
           * Remove the incomplete Auth user
           * if profile creation fails.
           */
          await administratorClient
            .auth
            .admin
            .deleteUser(
              createdUser.id
            );

          throw managerProfileError;
        }

        await recordAudit(
          "manager_created",
          {
            manager_user_id:
              createdUser.id,

            full_name:
              fullName,

            email,

            team_id:
              teamId,

            team_name:
              team.name
          }
        );

        /*
         * The temporary password is returned
         * once. It is never stored as readable
         * text in the database.
         */
        return createJsonResponse({
          success: true,

          message:
            "Manager account created successfully.",

          managerId:
            createdUser.id,

          email,

          temporaryPassword
        });
      }

      /*
       * All remaining actions require a
       * manager ID.
       */
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
       * =====================================
       * ASSIGN OR REMOVE TEAM
       * =====================================
       */
      if (
        body.action === "assign"
      ) {
        const teamId =
          body.teamId
            ?.trim() ||
          null;

        let teamName:
          string | null =
            null;

        if (
          teamId
        ) {
          const team =
            await validateTeam(
              teamId
            );

          if (
            !team.is_active
          ) {
            return createJsonResponse(
              {
                error:
                  "An inactive team cannot be assigned."
              },
              400
            );
          }

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
            "Manager assignment updated."
        });
      }

      /*
       * =====================================
       * ENABLE OR DISABLE MANAGER
       * =====================================
       */
      if (
        body.action ===
        "set-active"
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

        /*
         * Disable the account at Supabase
         * Auth level.
         */
        const {
          error:
            authenticationError
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
          authenticationError
        ) {
          throw authenticationError;
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
       * =====================================
       * GENERATE NEW TEMPORARY PASSWORD
       * =====================================
       */
      if (
        body.action ===
        "reset-password"
      ) {
        const temporaryPassword =
          generateTemporaryPassword();

        const {
          error:
            authenticationError
        } =
          await administratorClient
            .auth
            .admin
            .updateUserById(
              managerId,
              {
                password:
                  temporaryPassword
              }
            );

        if (
          authenticationError
        ) {
          throw authenticationError;
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
              must_change_password:
                true,

              temporary_password_created_at:
                new Date()
                  .toISOString()
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
          "manager_temporary_password_reset",
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
            "A new temporary password was generated.",

          managerId,

          email:
            manager.email,

          temporaryPassword
        });
      }

      /*
       * =====================================
       * UPDATE MANAGER PHOTOGRAPH
       * =====================================
       */
      if (
        body.action ===
        "set-photo"
      ) {
        const photoPath =
          body.photoPath
            ?.trim() ?? "";

        if (
          !photoPath ||
          !photoPath.startsWith(
            `${tournamentId}/`
          )
        ) {
          return createJsonResponse(
            {
              error:
                "A valid manager photograph is required."
            },
            400
          );
        }

        const {
          error
        } =
          await administratorClient
            .from(
              "user_profiles"
            )
            .update({
              manager_photo_path:
                photoPath
            })
            .eq(
              "id",
              managerId
            );

        if (error) {
          throw error;
        }

        await recordAudit(
          "manager_photo_updated",
          {
            manager_user_id:
              managerId,

            previous_photo_path:
              manager.manager_photo_path,

            new_photo_path:
              photoPath
          }
        );

        return createJsonResponse({
          success: true,

          message:
            "Manager photograph updated."
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