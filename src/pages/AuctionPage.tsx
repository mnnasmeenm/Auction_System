import {
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
  Team
} from "../types/database";

import {
  type AuctionData,
  getAuctionData,
  markActivePlayerUnsold,
  placePlayerBid,
  sellActivePlayer,
  startPlayerAuction
} from "../services/auction";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import {
  getTeamLogoUrl
} from "../services/teams";

import "./AuctionPage.css";

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

export default function AuctionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [auctionData, setAuctionData] =
    useState<AuctionData>({
      auctionState: null,
      players: [],
      teams: [],
      increments: []
    });

  const [selectedIncrement, setSelectedIncrement] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadAuction();
  }, [tournamentId]);

  async function loadAuction() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getAuctionData(tournamentId);

      setAuctionData(data);

      setSelectedIncrement((currentIncrement) => {
        if (currentIncrement > 0) {
          return currentIncrement;
        }

        return data.increments[0]?.amount ?? 0;
      });
    } catch (error) {
      console.error("Auction loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Auction information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const activePlayer = useMemo(() => {
    const activePlayerId =
      auctionData.auctionState?.active_player_id;

    if (!activePlayerId) {
      return null;
    }

    return (
      auctionData.players.find(
        (player) => player.id === activePlayerId
      ) ?? null
    );
  }, [
    auctionData.players,
    auctionData.auctionState
  ]);

  const leadingTeam = useMemo(() => {
    const leadingTeamId =
      auctionData.auctionState?.leading_team_id;

    if (!leadingTeamId) {
      return null;
    }

    return (
      auctionData.teams.find(
        (team) => team.id === leadingTeamId
      ) ?? null
    );
  }, [
    auctionData.teams,
    auctionData.auctionState
  ]);

  const availablePlayers = useMemo(
    () =>
      auctionData.players.filter((player) =>
        [
          "registered",
          "available",
          "unsold",
          "reauction"
        ].includes(player.status)
      ),
    [auctionData.players]
  );

  async function runAction(
    action: () => Promise<void>,
    successText?: string
  ) {
    setActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await action();

      if (successText) {
        setSuccessMessage(successText);
      }

      await loadAuction();
    } catch (error) {
      console.error("Auction action error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The auction action could not be completed."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleSelectPlayer(player: Player) {
    if (player.status === "sold") {
      setErrorMessage(
        "This player is already sold."
      );

      return;
    }

    const confirmed = window.confirm(
      `Open bidding for ${player.full_name}?`
    );

    if (!confirmed) {
      return;
    }

    runAction(
      () =>
        startPlayerAuction(
          tournamentId,
          player.id
        ),
      `Bidding opened for ${player.full_name}.`
    );
  }

  function calculateNextBid() {
    const currentBid =
      auctionData.auctionState?.current_bid ?? 0;

    const hasLeadingTeam = Boolean(
      auctionData.auctionState?.leading_team_id
    );

    if (!hasLeadingTeam) {
      return currentBid;
    }

    return currentBid + selectedIncrement;
  }

  function handleTeamBid(team: Team) {
    if (!activePlayer) {
      setErrorMessage(
        "Select a player before entering a bid."
      );

      return;
    }

    if (activePlayer.status === "sold") {
      setErrorMessage(
        "This player is already sold."
      );

      return;
    }

    const nextBid = calculateNextBid();

    runAction(() =>
      placePlayerBid(
        tournamentId,
        team.id,
        nextBid
      )
    );
  }

  function handleSell() {
    if (!activePlayer) {
      setErrorMessage("No active player selected.");
      return;
    }

    if (!leadingTeam) {
      setErrorMessage(
        "At least one team must bid before selling."
      );

      return;
    }

    const confirmed = window.confirm(
      `Sell ${activePlayer.full_name} to ` +
      `${leadingTeam.name} for ` +
      `${formatPoints(
        auctionData.auctionState?.current_bid ?? 0
      )} points?`
    );

    if (!confirmed) {
      return;
    }

    runAction(
      async () => {
        await sellActivePlayer(tournamentId);
      },
      `${activePlayer.full_name} sold to ${leadingTeam.name}.`
    );
  }

  function handleUnsold() {
    if (!activePlayer) {
      setErrorMessage("No active player selected.");
      return;
    }

    const confirmed = window.confirm(
      `Mark ${activePlayer.full_name} as unsold?`
    );

    if (!confirmed) {
      return;
    }

    runAction(
      () =>
        markActivePlayerUnsold(tournamentId),
      `${activePlayer.full_name} marked unsold.`
    );
  }

  if (!tournamentId) {
    return (
      <main className="auction-page">
        <section className="auction-message">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() => navigate("/admin/setup")}
          >
            Return to setup
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="auction-page">
        <section className="auction-message">
          Loading auction…
        </section>
      </main>
    );
  }

  const currentBid =
    auctionData.auctionState?.current_bid ?? 0;

  return (
    <main className="auction-page">
      <header className="auction-header">
        <div>
          <p className="auction-label">
            LIVE AUCTION CONTROL
          </p>

          <h1>Player allocation</h1>

          <p>
            All values use tournament points. Confirm every
            accepted bid before recording it.
          </p>
        </div>

        <button
          type="button"
          className="open-projector-button"
          onClick={() =>
            navigate(
              `/projector?tournament=${tournamentId}`
            )
          }
        >
          Open projector
        </button>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="auction-success">
          {successMessage}
        </div>
      )}

      <section className="auction-control-grid">
        <article
          className="active-player-panel"
          key={activePlayer?.id ?? "no-player"}
        >
          {activePlayer ? (
            <>
              <div className="active-player-photo">
                {getPlayerPhotoUrl(
                  activePlayer.photo_path
                ) ? (
                  <img
                    src={
                      getPlayerPhotoUrl(
                        activePlayer.photo_path
                      ) ?? ""
                    }
                    alt={activePlayer.full_name}
                  />
                ) : (
                  <div className="active-player-initials">
                    {getInitials(
                      activePlayer.full_name
                    )}
                  </div>
                )}

                <span>
                  LOT{" "}
                  {String(
                    auctionData.auctionState
                      ?.lot_number ?? 0
                  ).padStart(3, "0")}
                </span>
              </div>

              <div className="active-player-details">
                <span className="active-player-category">
                  {activePlayer.category?.name ??
                    "Uncategorized"}
                </span>

                <h2>{activePlayer.full_name}</h2>

                <div className="active-player-stats">
                  <div>
                    <strong>
                      {activePlayer.batting_style ?? "—"}
                    </strong>
                    <span>Batting</span>
                  </div>

                  <div>
                    <strong>
                      {activePlayer.bowling_style ?? "—"}
                    </strong>
                    <span>Bowling</span>
                  </div>

                  <div>
                    <strong>
                      {activePlayer.preferred_position ?? "—"}
                    </strong>
                    <span>Position</span>
                  </div>
                </div>

                <div className="base-value">
                  <span>Base value</span>

                  <strong>
                    {formatPoints(
                      activePlayer.base_price
                    )}{" "}
                    PTS
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="no-active-player">
              <h2>No active player</h2>

              <p>
                Select a player from the available-player
                queue.
              </p>
            </div>
          )}
        </article>

        <article className="live-bid-panel">
          <p>CURRENT BID</p>

          <div className="current-bid">
            {formatPoints(currentBid)}
            <small>PTS</small>
          </div>

          <p>LEADING TEAM</p>

          <div className="leading-team">
            {leadingTeam ? (
              <>
                {getTeamLogoUrl(
                  leadingTeam.logo_path
                ) ? (
                  <img
                    src={
                      getTeamLogoUrl(
                        leadingTeam.logo_path
                      ) ?? ""
                    }
                    alt={leadingTeam.name}
                  />
                ) : (
                  <span
                    style={{
                      color: leadingTeam.team_color,
                      borderColor:
                        leadingTeam.team_color
                    }}
                  >
                    {leadingTeam.short_name}
                  </span>
                )}

                <strong
                  style={{
                    color: leadingTeam.team_color
                  }}
                >
                  {leadingTeam.name}
                </strong>
              </>
            ) : (
              <strong>Waiting for first bid</strong>
            )}
          </div>

          <label className="increment-control">
            Bid increment

            <select
              value={selectedIncrement}
              onChange={(event) =>
                setSelectedIncrement(
                  Number(event.target.value)
                )
              }
            >
              {auctionData.increments.map(
                (increment) => (
                  <option
                    value={increment.amount}
                    key={increment.id}
                  >
                    + {formatPoints(increment.amount)}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="team-bid-buttons">
            {auctionData.teams.map((team) => {
              const remainingPoints =
                team.starting_budget -
                team.amount_spent;

              return (
                <button
                  type="button"
                  key={team.id}
                  disabled={
                    actionLoading ||
                    !activePlayer ||
                    activePlayer.status === "sold"
                  }
                  style={{
                    borderColor: team.team_color
                  }}
                  onClick={() =>
                    handleTeamBid(team)
                  }
                >
                  <strong
                    style={{
                      color: team.team_color
                    }}
                  >
                    {team.short_name}
                  </strong>

                  <span>{team.name}</span>

                  <small>
                    {formatPoints(remainingPoints)} left
                  </small>
                </button>
              );
            })}
          </div>

          <div className="auction-result-buttons">
            <button
              type="button"
              className="sell-button"
              disabled={
                actionLoading ||
                !activePlayer ||
                !leadingTeam ||
                activePlayer.status === "sold"
              }
              onClick={handleSell}
            >
              Confirm sold
            </button>

            <button
              type="button"
              className="unsold-control-button"
              disabled={
                actionLoading ||
                !activePlayer ||
                activePlayer.status === "sold"
              }
              onClick={handleUnsold}
            >
              Mark unsold
            </button>
          </div>
        </article>
      </section>

      <section className="available-player-section">
        <div>
          <h2>Available-player queue</h2>

          <p>
            Select the next player to open bidding.
          </p>
        </div>

        {availablePlayers.length === 0 ? (
          <div className="auction-message">
            No available players remain.
          </div>
        ) : (
          <div className="auction-player-queue">
            {availablePlayers.map((player) => (
              <button
                type="button"
                key={player.id}
                className={
                  player.id === activePlayer?.id
                    ? "selected-queue-player"
                    : ""
                }
                disabled={actionLoading}
                onClick={() =>
                  handleSelectPlayer(player)
                }
              >
                <span>
                  {player.player_number
                    ? `#${player.player_number}`
                    : "—"}
                </span>

                <strong>{player.full_name}</strong>

                <small>
                  {player.category?.name ??
                    "Uncategorized"}
                </small>

                <b>
                  {formatPoints(player.base_price)} PTS
                </b>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}