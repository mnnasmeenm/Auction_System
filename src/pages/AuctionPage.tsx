import {
  type CSSProperties,
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
  type AuctionBidHistoryEntry,
  type AuctionData,
  getActiveBidHistory,
  getAuctionData,
  markActivePlayerUnsold,
  placePlayerBid,
  sellActivePlayer,
  startPlayerAuction,
  undoLastPlayerBid
} from "../services/auction";

import {
  getSaleHistory,
  type SaleHistoryRecord
} from "../services/history";

import {
  getTournament
} from "../services/tournaments";

import SoldPlayerPoster from
  "../components/sales/SoldPlayerPoster";

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
    incrementRules: []
  });

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [bidHistory, setBidHistory] =
    useState<AuctionBidHistoryEntry[]>([]);

  const [soldPosterSale, setSoldPosterSale] =
    useState<SaleHistoryRecord | null>(null);

  const [selectedIncrement, setSelectedIncrement] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [playerNumberSearch, setPlayerNumberSearch] =
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
      const [data, tournamentRecord] =
        await Promise.all([
          getAuctionData(tournamentId),
          getTournament(tournamentId)
        ]);

      const currentBidHistory =
        await getActiveBidHistory(
          tournamentId,
          data.auctionState?.active_player_id
        );

      setAuctionData(data);
      setTournament(tournamentRecord);
      setBidHistory(currentBidHistory);

      setSelectedIncrement((currentIncrement) => {
        if (currentIncrement > 0) {
          return currentIncrement;
        }

        return data.incrementRules[0]?.increment_amount ?? 0;
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

  const filteredAvailablePlayers = useMemo(() => {
    const searchedNumber = playerNumberSearch
      .trim()
      .replace(/^#/, "");

    if (!searchedNumber) {
      return availablePlayers;
    }

    return availablePlayers.filter(
      (player) =>
        String(player.player_number ?? "") ===
        searchedNumber
    );
  }, [availablePlayers, playerNumberSearch]);

  async function runAction<TResult>(
    action: () => Promise<TResult>,
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

    setSoldPosterSale(null);

    runAction(
      async () => {
        await startPlayerAuction(
          tournamentId,
          player.id
        );
      },
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
    const remainingPoints =
      team.starting_budget - team.amount_spent;

    // Normally this is prevented by the disabled button.
    // This extra guard protects against a stale or rapid click.
    if (remainingPoints < nextBid) {
      return;
    }

    runAction(async () => {
      await placePlayerBid(
        tournamentId,
        team.id
      );
    });
  }

  async function handleSell() {
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

    const soldPlayerId = activePlayer.id;
    const soldTeamId = leadingTeam.id;

    setActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let posterWarning = "";

      await sellActivePlayer(tournamentId);

      setSuccessMessage(
        `${activePlayer.full_name} sold to ${leadingTeam.name}.`
      );

      try {
        const records =
          await getSaleHistory(tournamentId);

        const completedSale =
          records.find(
            (sale) =>
              sale.player_id === soldPlayerId &&
              sale.team_id === soldTeamId &&
              !sale.is_revoked
          ) ?? null;

        setSoldPosterSale(completedSale);
      } catch (posterError) {
        console.error(
          "Sale poster loading error:",
          posterError
        );

        posterWarning =
          "The sale was completed, but its poster could not " +
          "be opened automatically. You can download it from History.";
      }

      await loadAuction();

      if (posterWarning) {
        setErrorMessage(posterWarning);
      }
    } catch (error) {
      console.error("Auction sale error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The player sale could not be completed."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleUndoBid() {
    const latestBid = bidHistory[0];

    if (!activePlayer || !latestBid) {
      setErrorMessage("There is no bid to undo.");
      return;
    }

    const bidTeam = auctionData.teams.find(
      (team) => team.id === latestBid.team_id
    );

    const restoredTeam = auctionData.teams.find(
      (team) =>
        team.id === latestBid.previous_team_id
    );

    const restoredState = restoredTeam
      ? `${restoredTeam.name} at ${formatPoints(
          latestBid.previous_bid_amount
        )} points`
      : `no leading team at ${formatPoints(
          latestBid.previous_bid_amount
        )} points`;

    const confirmed = window.confirm(
      `Undo the latest bid from ${
        bidTeam?.name ?? "the current team"
      } at ${formatPoints(latestBid.bid_amount)} points?\n\n` +
      `The auction will return to ${restoredState}.`
    );

    if (!confirmed) {
      return;
    }

    runAction(
      async () => {
        await undoLastPlayerBid(tournamentId);
      },
      `Latest bid reversed. Restored ${restoredState}.`
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
      async () => {
        await markActivePlayerUnsold(tournamentId);
      },
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

          <div className="auction-bid-safety-row">
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
                {auctionData.incrementRules.map(
                  (increment) => (
                    <option
                      value={increment.increment_amount}
                      key={increment.id}
                    >
                      + {formatPoints(increment.increment_amount)}
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              type="button"
              className="undo-bid-button"
              disabled={
                actionLoading ||
                !activePlayer ||
                activePlayer.status === "sold" ||
                bidHistory.length === 0
              }
              onClick={handleUndoBid}
              title={
                bidHistory.length > 0
                  ? "Restore the immediately previous bid state"
                  : "No recorded bid is available to undo"
              }
            >
              ↶ Undo last bid
            </button>
          </div>

          <div className="team-bid-buttons">
            {auctionData.teams.map((team) => {
              const remainingPoints =
                team.starting_budget -
                team.amount_spent;

              const nextBid =
                calculateNextBid();

              const cannotAffordNextBid =
                Boolean(activePlayer) &&
                remainingPoints < nextBid;

              const teamLogoUrl =
                getTeamLogoUrl(team.logo_path);

              return (
                <button
                  type="button"
                  key={team.id}
                  disabled={
                    actionLoading ||
                    !activePlayer ||
                    activePlayer.status === "sold" ||
                    cannotAffordNextBid
                  }
                  title={
                    cannotAffordNextBid
                      ? `Insufficient balance. Next bid requires ${formatPoints(nextBid)}.`
                      : `Place bid for ${team.name}`
                  }
                  style={{
                    "--team-bid-color":
                      team.team_color
                  } as CSSProperties}
                  onClick={() =>
                    handleTeamBid(team)
                  }
                >
                  {teamLogoUrl ? (
                    <img
                      className="team-bid-logo"
                      src={teamLogoUrl}
                      alt={`${team.name} logo`}
                    />
                  ) : (
                    <strong
                      style={{
                        color: team.team_color
                      }}
                    >
                      {team.short_name}
                    </strong>
                  )}

                  <span>{team.name}</span>

                  <small>
                    {cannotAffordNextBid
                      ? `${formatPoints(remainingPoints)} left — unavailable`
                      : `${formatPoints(remainingPoints)} left`}
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
        <div className="auction-queue-heading">
          <div>
            <h2>Available-player queue</h2>

            <p>
              Select the next player to open bidding.
            </p>
          </div>

          <label className="auction-player-number-search">
            <span>Search by player number</span>

            <div>
              <input
                type="search"
                inputMode="numeric"
                value={playerNumberSearch}
                onChange={(event) =>
                  setPlayerNumberSearch(
                    event.target.value.replace(
                      /[^0-9#]/g,
                      ""
                    )
                  )
                }
                placeholder="Example: 25"
                aria-label="Search available player by number"
              />

              {playerNumberSearch && (
                <button
                  type="button"
                  onClick={() =>
                    setPlayerNumberSearch("")
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </label>
        </div>

        {availablePlayers.length === 0 ? (
          <div className="auction-message">
            No available players remain.
          </div>
        ) : filteredAvailablePlayers.length === 0 ? (
          <div className="auction-message auction-search-empty">
            No available player was found with number
            {" "}
            <strong>
              #{playerNumberSearch.replace(/^#/, "")}
            </strong>
            .
          </div>
        ) : (
          <div className="auction-player-queue">
            {filteredAvailablePlayers.map((player) => (
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

      {soldPosterSale && tournament && (
        <div
          className="auction-sold-poster-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Completed sale poster"
        >
          <div className="auction-sold-poster-dialog">
            <header>
              <div>
                <span>SALE RECORDED</span>
                <h2>Player SOLD poster</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSoldPosterSale(null)
                }
              >
                Close
              </button>
            </header>

            <SoldPlayerPoster
              tournament={tournament}
              sale={soldPosterSale}
            />
          </div>
        </div>
      )}
    </main>
  );
}