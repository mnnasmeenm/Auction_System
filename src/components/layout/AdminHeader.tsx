import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams
} from "react-router-dom";

import {
  useAuth
} from "../../context/AuthContext";

import {
  getTournament
} from "../../services/tournaments";

import {
  setTournamentPaused
} from "../../services/systemSafety";

import {
  supabase
} from "../../services/supabase";

import type {
  Tournament
} from "../../types/database";

interface NavigationItem {
  label: string;
  path: string;
}

function getTournamentIdFromPath(
  pathname: string
): string {
  const match = pathname.match(
    /^\/admin\/tournaments\/([^/]+)$/
  );

  return match?.[1] ?? "";
}

export default function AdminHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchParams] =
    useSearchParams();

  const {
    user,
    signOut
  } = useAuth();

  const queryTournamentId =
    searchParams.get("tournament") ?? "";

  const pathTournamentId =
    getTournamentIdFromPath(
      location.pathname
    );

  const tournamentId =
    queryTournamentId ||
    pathTournamentId;

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [
    changingStatus,
    setChangingStatus
  ] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [
    headerError,
    setHeaderError
  ] = useState("");

  const loadTournament =
    useCallback(async () => {
      if (!tournamentId) {
        setTournament(null);
        setHeaderError("");

        return;
      }

      try {
        const record =
          await getTournament(
            tournamentId
          );

        setTournament(record);
        setHeaderError("");
      } catch (error) {
        console.error(
          "Header tournament error:",
          error
        );

        setTournament(null);

        setHeaderError(
          "The selected tournament could not be loaded."
        );
      }
    }, [tournamentId]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    if (!tournamentId) {
      return;
    }

    const channel = supabase
      .channel(
        `admin-header-${tournamentId}`
      )

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter:
            `id=eq.${tournamentId}`
        },
        () => {
          loadTournament();
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    tournamentId,
    loadTournament
  ]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navigationItems =
    useMemo<NavigationItem[]>(() => {
      if (!tournamentId) {
        return [];
      }

      return [
        {
          label: "Overview",
          path:
            `/admin/tournaments/${tournamentId}`
        },
        {
          label: "Teams",
          path:
            `/admin/teams?tournament=${tournamentId}`
        },
        {
          label: "Players",
          path:
            `/admin/players?tournament=${tournamentId}`
        },
        {
          label: "Auction",
          path:
            `/admin/auction?tournament=${tournamentId}`
        },
        {
          label: "History",
          path:
            `/admin/history?tournament=${tournamentId}`
        },
        {
          label: "Settings",
          path:
            `/admin/settings?tournament=${tournamentId}`
        },
        {
          label: "Safety",
          path:
            `/admin/safety?tournament=${tournamentId}`
        },
        {
  label: "Managers",
  path:
    `/admin/managers?tournament=${tournamentId}`
},
      ];
    }, [tournamentId]);

  const canControlAuction =
    tournament?.status === "live" ||
    tournament?.status === "paused";

  async function togglePause() {
    if (
      !tournament ||
      changingStatus ||
      !canControlAuction
    ) {
      return;
    }

    const currentlyPaused =
      tournament.status === "paused";

    const actionText =
      currentlyPaused
        ? "resume"
        : "pause";

    const confirmed =
      window.confirm(
        `${actionText
          .charAt(0)
          .toUpperCase() +
          actionText.slice(1)} ` +
        `${tournament.tournament_name}?`
      );

    if (!confirmed) {
      return;
    }

    setChangingStatus(true);
    setHeaderError("");

    try {
      await setTournamentPaused(
        tournament.id,
        !currentlyPaused
      );

      await loadTournament();
    } catch (error) {
      console.error(
        "Tournament status error:",
        error
      );

      setHeaderError(
        error instanceof Error
          ? error.message
          : `The auction could not be ${actionText}d.`
      );
    } finally {
      setChangingStatus(false);
    }
  }

  function openProjector() {
    if (!tournamentId) {
      return;
    }

    window.open(
      `/projector?tournament=${tournamentId}`,
      "aththariq-projector",
      "popup=yes,width=1440,height=900"
    );
  }

  async function handleSignOut() {
    try {
      await signOut();

      navigate(
        "/login",
        {
          replace: true
        }
      );
    } catch (error) {
      console.error(
        "Sign-out error:",
        error
      );

      setHeaderError(
        error instanceof Error
          ? error.message
          : "Sign out failed."
      );
    }
  }

  return (
    <header className="admin-header">
      <div className="admin-header-main">
        <button
          type="button"
          className="admin-brand"
          onClick={() =>
            navigate(
              "/admin/tournaments"
            )
          }
        >
          <span>AT</span>

          <div>
            <strong>
              Auction Control
            </strong>

            <small>
              Administrator
            </small>
          </div>
        </button>

        {tournament ? (
          <div className="header-tournament">
            <div>
              <small>
                ACTIVE TOURNAMENT
              </small>

              <strong>
                {tournament.tournament_name}
              </strong>
            </div>

            <span
              className={
                `header-status ` +
                `header-status-${tournament.status}`
              }
            >
              {tournament.status}
            </span>
          </div>
        ) : (
          <div className="header-no-tournament">
            No tournament selected
          </div>
        )}

        <div className="admin-header-actions">
          {tournament &&
            canControlAuction && (
              <button
                type="button"
                disabled={changingStatus}
                className={
                  tournament.status ===
                  "paused"
                    ? "header-resume-button"
                    : "header-pause-button"
                }
                onClick={togglePause}
              >
                {changingStatus
                  ? "Updating…"
                  : tournament.status ===
                      "paused"
                    ? "Resume auction"
                    : "Pause auction"}
              </button>
            )}

          <button
            type="button"
            className="header-menu-button"
            aria-expanded={
              mobileMenuOpen
            }
            onClick={() =>
              setMobileMenuOpen(
                (current) =>
                  !current
              )
            }
          >
            Menu
          </button>

          <button
            type="button"
            className="header-signout-button"
            title={
              user?.email ??
              "Administrator"
            }
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </div>

      {tournament && (
        <nav
          className={
            mobileMenuOpen
              ? "tournament-navigation tournament-navigation-open"
              : "tournament-navigation"
          }
        >
          {navigationItems.map(
            (item) => (
              <NavLink
                to={item.path}
                key={item.label}
                className={({
                  isActive
                }) =>
                  isActive
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setMobileMenuOpen(
                    false
                  )
                }
              >
                {item.label}
              </NavLink>
            )
          )}

          <button
            type="button"
            onClick={openProjector}
          >
            Projector ↗
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/admin/tournaments"
              )
            }
          >
            Switch tournament
          </button>
        </nav>
      )}

      {tournament?.status ===
        "paused" && (
        <div className="global-paused-banner">
          Auction paused — bidding,
          sales, reversals and tournament
          data changes are locked.
        </div>
      )}

      {headerError && (
        <div className="header-error">
          {headerError}
        </div>
      )}
    </header>
  );
}