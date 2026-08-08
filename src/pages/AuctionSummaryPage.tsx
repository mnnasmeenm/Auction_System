import {
  type CSSProperties,
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
  getTeamLogoUrl
} from "../services/teams";

import {
  getTournamentBrandingUrl
} from "../services/tournamentBranding";

import {
  supabase
} from "../services/supabase";

import "./AuctionSummaryPage.css";

const REQUIRED_SQUAD_SIZE = 11;

function formatLkr(value: number) {
  return new Intl.NumberFormat("en-LK").format(value);
}

function initials(name: string) {
  return name
    .replaceAll(".", "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export default function AuctionSummaryPage() {
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
      incrementRules: []
    });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const loadSummary = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    try {
      const [record, liveAuction] = await Promise.all([
        getTournament(tournamentId),
        getAuctionData(tournamentId)
      ]);

      setTournament(record);
      setAuctionData(liveAuction);
      setErrorMessage("");
    } catch (error) {
      console.error("Auction summary loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Auction summary could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadSummary();

    if (!tournamentId) {
      return;
    }

    const channel = supabase
      .channel(`auction-summary-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `tournament_id=eq.${tournamentId}`
        },
        loadSummary
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${tournamentId}`
        },
        loadSummary
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_state",
          filter: `tournament_id=eq.${tournamentId}`
        },
        loadSummary
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, loadSummary]);

  const teamRows = useMemo(
    () =>
      auctionData.teams.map((team) => {
        const boughtPlayers =
          auctionData.players.filter(
            (player) =>
              player.status === "sold" &&
              player.sold_team_id === team.id
          ).length;

        const remainingBudget = Math.max(
          0,
          team.starting_budget - team.amount_spent
        );

        const minimumStillNeeded = Math.max(
          0,
          REQUIRED_SQUAD_SIZE - boughtPlayers
        );

        const completionPercentage = Math.min(
          100,
          (boughtPlayers / REQUIRED_SQUAD_SIZE) * 100
        );

        return {
          team,
          boughtPlayers,
          remainingBudget,
          minimumStillNeeded,
          completionPercentage,
          logoUrl: getTeamLogoUrl(team.logo_path)
        };
      }),
    [auctionData.teams, auctionData.players]
  );

  const totalSold = auctionData.players.filter(
    (player) => player.status === "sold"
  ).length;

  const playersStillAvailable = auctionData.players.filter(
    (player) =>
      player.status === "registered" ||
      player.status === "available" ||
      player.status === "reauction"
  ).length;

  const societyLogoUrl = getTournamentBrandingUrl(
    tournament?.society_logo_path
  );

  const tournamentLogoUrl = getTournamentBrandingUrl(
    tournament?.tournament_logo_path
  );

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error("Fullscreen request failed:", error);
    }
  }

  if (!tournamentId) {
    return (
      <main className="auction-summary-message">
        <h1>Tournament not selected</h1>
        <button
          type="button"
          onClick={() => navigate("/admin/tournaments")}
        >
          Return to tournaments
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="auction-summary-message">
        Preparing live auction summary…
      </main>
    );
  }

  if (errorMessage || !tournament) {
    return (
      <main className="auction-summary-message">
        <h1>Summary could not load</h1>
        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="auction-summary-page">
      <div className="summary-background-grid" />
      <div className="summary-orb summary-orb-one" />
      <div className="summary-orb summary-orb-two" />

      <header className="auction-summary-header">
        <div className="summary-branding">
          <div className="summary-brand-logos">
            {societyLogoUrl ? (
              <img
                src={societyLogoUrl}
                alt={`${tournament.society_name} logo`}
              />
            ) : (
              <span>{initials(tournament.society_name)}</span>
            )}

            {tournamentLogoUrl ? (
              <img
                src={tournamentLogoUrl}
                alt={`${tournament.tournament_name} logo`}
              />
            ) : (
              <span>{initials(tournament.tournament_name)}</span>
            )}
          </div>

          <div>
            <p>{tournament.society_name}</p>
            <h1>{tournament.tournament_name}</h1>
            <strong>LIVE AUCTION SUMMARY</strong>
          </div>
        </div>

        <div className="summary-header-actions">
          <span className="summary-live-indicator">
            <i /> LIVE
          </span>

          <button
            type="button"
            onClick={enterFullscreen}
          >
            Fullscreen
          </button>
        </div>
      </header>

      <section className="summary-overall-statistics">
        <article>
          <span>ACTIVE TEAMS</span>
          <strong>{teamRows.length}</strong>
        </article>

        <article>
          <span>PLAYERS SOLD</span>
          <strong>{totalSold}</strong>
        </article>

        <article>
          <span>PLAYERS AVAILABLE</span>
          <strong>{playersStillAvailable}</strong>
        </article>

        <article>
          <span>REQUIRED SQUAD</span>
          <strong>{REQUIRED_SQUAD_SIZE}</strong>
        </article>
      </section>

      <section className="summary-table-shell">
        <div className="summary-table-heading">
          <span>TEAM</span>
          <span>AVAILABLE BUDGET</span>
          <span>PLAYERS BOUGHT</span>
          <span>MINIMUM STILL NEEDED</span>
        </div>

        <div
          className="summary-team-list"
          style={{
            "--summary-team-count": Math.max(1, teamRows.length)
          } as CSSProperties}
        >
          {teamRows.map((row, index) => (
            <article
              className="summary-team-row"
              key={row.team.id}
              style={{
                "--summary-team-color": row.team.team_color,
                "--summary-row-delay": `${index * 80}ms`
              } as CSSProperties}
            >
              <div className="summary-team-identity">
                {row.logoUrl ? (
                  <img
                    src={row.logoUrl}
                    alt={`${row.team.name} logo`}
                  />
                ) : (
                  <span>{row.team.short_name}</span>
                )}

                <div>
                  <strong>{row.team.name}</strong>
                  <small>{row.team.short_name}</small>
                </div>
              </div>

              <div className="summary-budget-value">
                <strong>
                  {formatLkr(row.remainingBudget)}
                </strong>
                <span>LKR REMAINING</span>
              </div>

              <div className="summary-player-count">
                <strong>{row.boughtPlayers}</strong>
                <div>
                  <i
                    style={{
                      width: `${row.completionPercentage}%`
                    }}
                  />
                </div>
                <span>OF {REQUIRED_SQUAD_SIZE}</span>
              </div>

              <div
                className={
                  row.minimumStillNeeded === 0
                    ? "summary-needed complete"
                    : "summary-needed"
                }
              >
                <strong>{row.minimumStillNeeded}</strong>
                <span>
                  {row.minimumStillNeeded === 0
                    ? "SQUAD COMPLETE"
                    : "PLAYERS NEEDED"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="auction-summary-footer">
        <strong>
          {tournament.tournament_name} • TEAM STATUS
        </strong>

        <span>
          Automatically updated from live auction results
        </span>
      </footer>
    </main>
  );
}