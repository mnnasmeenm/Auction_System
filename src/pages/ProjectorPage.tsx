import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import type {
  Player,
  Team,
  Tournament
} from "../types/database";

import {
  type AuctionData,
  getAuctionData
} from "../services/auction";

import {
  getTournament
} from "../services/tournaments";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import {
  getTeamLogoUrl
} from "../services/teams";

import {
  supabase
} from "../services/supabase";

import "./ProjectorPage.css";

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-LK").format(value);
}

function getInitials(name: string) {
  return name
    .replaceAll(".", "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProjectorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [auctionData, setAuctionData] =
    useState<AuctionData>({
      auctionState: null,
      players: [],
      teams: [],
      increments: []
    });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const loadProjectorData = useCallback(
    async (showLoading = false) => {
      if (!tournamentId) {
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const [
          tournamentRecord,
          currentAuction
        ] = await Promise.all([
          getTournament(tournamentId),
          getAuctionData(tournamentId)
        ]);

        setTournament(tournamentRecord);
        setAuctionData(currentAuction);
        setErrorMessage("");
      } catch (error) {
        console.error(
          "Projector loading error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Projector information could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadProjectorData(true);

    const realtimeChannel = supabase
      .channel(
        `projector-${tournamentId}`
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_state",
          filter:
            `tournament_id=eq.${tournamentId}`
        },
        () => {
          loadProjectorData();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter:
            `tournament_id=eq.${tournamentId}`
        },
        () => {
          loadProjectorData();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter:
            `tournament_id=eq.${tournamentId}`
        },
        () => {
          loadProjectorData();
        }
      )

      .subscribe((status) => {
        console.log(
          "Projector Realtime status:",
          status
        );
      });

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [
    tournamentId,
    loadProjectorData
  ]);

  const activePlayer: Player | null =
    useMemo(() => {
      const activePlayerId =
        auctionData.auctionState?.active_player_id;

      if (!activePlayerId) {
        return null;
      }

      return (
        auctionData.players.find(
          (player) =>
            player.id === activePlayerId
        ) ?? null
      );
    }, [
      auctionData.players,
      auctionData.auctionState
    ]);

  const leadingTeam: Team | null =
    useMemo(() => {
      const leadingTeamId =
        auctionData.auctionState?.leading_team_id;

      if (!leadingTeamId) {
        return null;
      }

      return (
        auctionData.teams.find(
          (team) =>
            team.id === leadingTeamId
        ) ?? null
      );
    }, [
      auctionData.teams,
      auctionData.auctionState
    ]);

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(
        "Fullscreen request failed:",
        error
      );
    }
  }

  if (!tournamentId) {
    return (
      <main className="projector-error">
        <h1>Tournament not selected</h1>

        <button
          type="button"
          onClick={() =>
            navigate("/admin/tournaments")
          }
        >
          Return to tournaments
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="projector-loading">
        <div className="projector-loading-symbol">
          AW
        </div>

        <h1>Preparing projector…</h1>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="projector-error">
        <h1>Projector could not load</h1>
        <p>{errorMessage}</p>
      </main>
    );
  }

  const playerPhotoUrl =
    getPlayerPhotoUrl(
      activePlayer?.photo_path ?? null
    );

  const leadingTeamLogo =
    getTeamLogoUrl(
      leadingTeam?.logo_path ?? null
    );

  const currentBid =
    auctionData.auctionState?.current_bid ?? 0;

  const lotNumber =
    auctionData.auctionState?.lot_number ?? 0;

  const statusMessage =
    auctionData.auctionState?.message ??
    "Waiting for auction";

  const playerIsSold =
    activePlayer?.status === "sold";

  const playerIsUnsold =
    activePlayer?.status === "unsold";

  return (
    <main
      className={`projector-page ${
        playerIsSold
          ? "projector-sold"
          : ""
      } ${
        playerIsUnsold
          ? "projector-unsold"
          : ""
      }`}
    >
      <header className="projector-header">
        <div className="projector-brand">
          <div className="projector-brand-symbol">
            AW
          </div>

          <div>
            <h1>
              {tournament?.society_name}
            </h1>

            <p>
              {tournament?.tournament_name}
              {" • "}
              PLAYER ALLOCATION
            </p>
          </div>
        </div>

        <div className="projector-header-actions">
          <span className="projector-live">
            <i />
            LIVE
          </span>

          <strong>
            LOT{" "}
            {String(lotNumber).padStart(
              3,
              "0"
            )}
          </strong>

          <button
            type="button"
            onClick={enterFullscreen}
          >
            Fullscreen
          </button>
        </div>
      </header>

      {!activePlayer ? (
        <section className="projector-waiting">
          <div className="waiting-rings">
            <span>AW</span>
          </div>

          <h2>Waiting for next player</h2>

          <p>
            The selected player will appear
            automatically.
          </p>
        </section>
      ) : (
        <section className="projector-stage">
          <article
            className="projector-player-card"
            key={activePlayer.id}
          >
            <div className="projector-card-layer layer-one" />
            <div className="projector-card-layer layer-two" />

            <div className="projector-photo">
              {playerPhotoUrl ? (
                <img
                  src={playerPhotoUrl}
                  alt={activePlayer.full_name}
                />
              ) : (
                <div className="projector-player-initials">
                  {getInitials(
                    activePlayer.full_name
                  )}
                </div>
              )}
            </div>

            <div className="projector-player-information">
              <span className="projector-category">
                {activePlayer.category?.name ??
                  "Uncategorized"}
              </span>

              <h2>
                {activePlayer.full_name}
              </h2>

              {activePlayer.nickname && (
                <p>
                  “{activePlayer.nickname}”
                </p>
              )}

              <div className="projector-statistics">
                <div>
                  <strong>
                    {activePlayer.batting_style ?? "—"}
                  </strong>

                  <span>BATTING</span>
                </div>

                <div>
                  <strong>
                    {activePlayer.bowling_style ?? "—"}
                  </strong>

                  <span>BOWLING</span>
                </div>

                <div>
                  <strong>
                    {activePlayer.preferred_position ?? "—"}
                  </strong>

                  <span>POSITION</span>
                </div>
              </div>
            </div>
          </article>

          <article className="projector-bid-panel">
            <p className="projector-base-label">
              BASE VALUE
            </p>

            <strong className="projector-base-value">
              {formatPoints(
                activePlayer.base_price
              )}{" "}
              LKR
            </strong>

            <div
              className="projector-bid-rings"
              key={currentBid}
            >
              <div>
                <strong>
                  {formatPoints(currentBid)}
                </strong>

                <span>LKR</span>
              </div>
            </div>

            <p className="projector-leading-label">
              LEADING TEAM
            </p>

            <div className="projector-leading-team">
              {leadingTeam ? (
                <>
                  {leadingTeamLogo ? (
                    <img
                      src={leadingTeamLogo}
                      alt={leadingTeam.name}
                    />
                  ) : (
                    <span
                      style={{
                        color:
                          leadingTeam.team_color,
                        borderColor:
                          leadingTeam.team_color
                      }}
                    >
                      {leadingTeam.short_name}
                    </span>
                  )}

                  <strong
                    style={{
                      color:
                        leadingTeam.team_color
                    }}
                  >
                    {leadingTeam.name}
                  </strong>
                </>
              ) : (
                <strong>
                  WAITING FOR FIRST BID
                </strong>
              )}
            </div>

            {playerIsSold && (
              <div className="projector-result sold-result">
                SOLD
              </div>
            )}

            {playerIsUnsold && (
              <div className="projector-result unsold-result">
                UNSOLD
              </div>
            )}
          </article>
        </section>
      )}

      <section className="projector-team-budgets">
        {auctionData.teams.map((team) => {
          const remainingPoints =
            team.starting_budget -
            team.amount_spent;

          const percentage =
            team.starting_budget > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    (
                      remainingPoints /
                      team.starting_budget
                    ) * 100
                  )
                )
              : 0;

          const logoUrl =
            getTeamLogoUrl(team.logo_path);

          return (
            <article
              key={team.id}
              style={{
                borderColor: team.team_color
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={team.name}
                />
              ) : (
                <span
                  style={{
                    color: team.team_color,
                    borderColor:
                      team.team_color
                  }}
                >
                  {team.short_name}
                </span>
              )}

              <div>
                <header>
                  <strong>
                    {team.name}
                  </strong>

                  <b
                    style={{
                      color: team.team_color
                    }}
                  >
                    {formatPoints(
                      remainingPoints
                    )}
                  </b>
                </header>

                <div className="projector-budget-track">
                  <i
                    style={{
                      width: `${percentage}%`,
                      background:
                        team.team_color
                    }}
                  />
                </div>

                <small>LKR REMAINING</small>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="projector-footer">
        <strong>
          {statusMessage.toUpperCase()}
        </strong>

        <span>
          {activePlayer
            ? `${activePlayer.full_name} • ${
                activePlayer.category?.name ??
                "PLAYER"
              }`
            : "WAITING FOR NEXT PLAYER"}
        </span>
      </footer>
    </main>
  );
}