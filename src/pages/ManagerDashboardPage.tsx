import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  getManagerPortalData,
  type ManagerPortalData
} from "../services/managerPortal";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import {
  getTeamLogoUrl
} from "../services/teams";

import {
  useAuth
} from "../context/AuthContext";

import "./ManagerPortal.css";

function formatPoints(
  value: number
) {
  return new Intl.NumberFormat(
    "en-LK"
  ).format(value);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function
ManagerDashboardPage() {
  const navigate = useNavigate();

  const {
    signOut
  } = useAuth();

  const [portal, setPortal] =
    useState<
      ManagerPortalData | null
    >(null);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const loadPortal =
    useCallback(async () => {
      try {
        const data =
          await getManagerPortalData();

        setPortal(data);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Team information could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadPortal();

    const refreshTimer =
      window.setInterval(
        loadPortal,
        15000
      );

    return () => {
      window.clearInterval(
        refreshTimer
      );
    };
  }, [loadPortal]);

  const purchasedPlayers =
    useMemo(() => {
      if (!portal) {
        return [];
      }

      return portal.players.filter(
        (player) =>
          player.status === "sold" &&
          player.sold_team_id ===
            portal.team.id
      );
    }, [portal]);

  async function handleSignOut() {
    await signOut();

    navigate(
      "/login",
      {
        replace: true
      }
    );
  }

  if (loading) {
    return (
      <main className="manager-page">
        <section className="manager-empty">
          Loading your team…
        </section>
      </main>
    );
  }

  if (
    errorMessage ||
    !portal
  ) {
    return (
      <main className="manager-page">
        <section className="manager-empty">
          <h1>
            Team could not be loaded
          </h1>

          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const {
    tournament,
    team
  } = portal;

  const remainingPoints =
    team.starting_budget -
    team.amount_spent;

  const squadLimit =
    team.squad_limit ??
    tournament.maximum_squad_size;

  const remainingSlots =
    Math.max(
      0,
      squadLimit -
        purchasedPlayers.length
    );

  const logoUrl =
    getTeamLogoUrl(
      team.logo_path
    );

  return (
    <main className="manager-page">
      <header className="manager-topbar">
        <div>
          <small>
            MANAGER PORTAL
          </small>

          <strong>
            {tournament.tournament_name}
          </strong>
        </div>

        <nav>
          <button
            type="button"
            className="selected"
          >
            My team
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/manager/players"
              )
            }
          >
            Player strategy
          </button>

          <button
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </nav>
      </header>

      <section className="manager-team-heading">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={team.name}
          />
        ) : (
          <span
            style={{
              color:
                team.team_color,
              borderColor:
                team.team_color
            }}
          >
            {team.short_name}
          </span>
        )}

        <div>
          <p>
            {tournament.society_name}
          </p>

          <h1>{team.name}</h1>

          <small>
            Manager:{" "}
            {team.manager_name ??
              "Not specified"}
          </small>
        </div>

        <b
          className={
            `manager-tournament-status ` +
            `status-${tournament.status}`
          }
        >
          {tournament.status}
        </b>
      </section>

      <section className="manager-stat-grid">
        <article>
          <span>
            Starting points
          </span>

          <strong>
            {formatPoints(
              team.starting_budget
            )}
          </strong>

          <small>PTS</small>
        </article>

        <article>
          <span>
            Points spent
          </span>

          <strong>
            {formatPoints(
              team.amount_spent
            )}
          </strong>

          <small>PTS</small>
        </article>

        <article className="remaining-points-card">
          <span>
            Remaining points
          </span>

          <strong>
            {formatPoints(
              remainingPoints
            )}
          </strong>

          <small>PTS</small>
        </article>

        <article>
          <span>
            Squad
          </span>

          <strong>
            {purchasedPlayers.length}
            /{squadLimit}
          </strong>

          <small>
            {remainingSlots} slots left
          </small>
        </article>
      </section>

      <section className="manager-section-heading">
        <div>
          <h2>
            Purchased players
          </h2>

          <p>
            This list updates automatically
            during the auction.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPortal}
        >
          Refresh
        </button>
      </section>

      {purchasedPlayers.length ===
      0 ? (
        <section className="manager-empty">
          No players have been purchased
          by this team yet.
        </section>
      ) : (
        <section className="manager-squad-grid">
          {purchasedPlayers.map(
            (player) => {
              const photoUrl =
                getPlayerPhotoUrl(
                  player.photo_path
                );

              return (
                <article
                  key={player.id}
                  className="manager-player-card"
                >
                  <div className="manager-player-photo">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={
                          player.full_name
                        }
                      />
                    ) : (
                      <span>
                        {initials(
                          player.full_name
                        )}
                      </span>
                    )}
                  </div>

                  <div className="manager-player-info">
                    <small>
                      {player.category
                        ?.name ??
                        "Uncategorized"}
                    </small>

                    <h3>
                      {player.full_name}
                    </h3>

                    <p>
                      {player.preferred_position ??
                        "Player"}
                    </p>

                    <strong>
                      {formatPoints(
                        player.sold_price ??
                          0
                      )}{" "}
                      PTS
                    </strong>
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}
    </main>
  );
}