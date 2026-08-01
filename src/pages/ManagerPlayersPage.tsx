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
  saveManagerStrategy,
  type ManagerPortalData,
  type ManagerStrategy
} from "../services/managerPortal";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import {
  useAuth
} from "../context/AuthContext";

import "./ManagerPortal.css";

interface EditableStrategy {
  shortlisted: boolean;
  priority: number;
  notes: string;
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

function strategyFromRecord(
  strategy?: ManagerStrategy
): EditableStrategy {
  return {
    shortlisted:
      strategy?.is_shortlisted ??
      false,

    priority:
      strategy?.priority ?? 0,

    notes:
      strategy?.notes ?? ""
  };
}

export default function
ManagerPlayersPage() {
  const navigate = useNavigate();

  const {
    signOut
  } = useAuth();

  const [portal, setPortal] =
    useState<
      ManagerPortalData | null
    >(null);

  const [strategies, setStrategies] =
    useState<
      Record<
        string,
        EditableStrategy
      >
    >({});

  const [search, setSearch] =
    useState("");

  const [
    shortlistedOnly,
    setShortlistedOnly
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage
  ] = useState("");

  const loadPlayers =
    useCallback(async () => {
      setLoading(true);

      try {
        const data =
          await getManagerPortalData();

        const strategyMap:
          Record<
            string,
            EditableStrategy
          > = {};

        data.players.forEach(
          (player) => {
            const record =
              data.strategies.find(
                (strategy) =>
                  strategy.player_id ===
                  player.id
              );

            strategyMap[player.id] =
              strategyFromRecord(
                record
              );
          }
        );

        setPortal(data);
        setStrategies(
          strategyMap
        );

        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Players could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const filteredPlayers =
    useMemo(() => {
      if (!portal) {
        return [];
      }

      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return portal.players.filter(
        (player) => {
          const strategy =
            strategies[player.id];

          const matchesSearch =
            !normalizedSearch ||
            player.full_name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (
              player.category
                ?.name ?? ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesShortlist =
            !shortlistedOnly ||
            strategy?.shortlisted;

          return (
            matchesSearch &&
            matchesShortlist
          );
        }
      );
    }, [
      portal,
      search,
      shortlistedOnly,
      strategies
    ]);

  function updateStrategy(
    playerId: string,
    changes:
      Partial<EditableStrategy>
  ) {
    setStrategies(
      (current) => ({
        ...current,

        [playerId]: {
          ...current[playerId],
          ...changes
        }
      })
    );
  }

  async function saveStrategy(
    playerId: string
  ) {
    const strategy =
      strategies[playerId];

    if (!strategy) {
      return;
    }

    setSavingId(playerId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await saveManagerStrategy({
        playerId,

        isShortlisted:
          strategy.shortlisted,

        priority:
          strategy.priority,

        notes:
          strategy.notes
      });

      setSuccessMessage(
        "Private strategy saved."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Strategy could not be saved."
      );
    } finally {
      setSavingId(null);
    }
  }

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
          Loading players…
        </section>
      </main>
    );
  }

  if (
    errorMessage &&
    !portal
  ) {
    return (
      <main className="manager-page">
        <section className="manager-empty">
          <h1>
            Players could not be loaded
          </h1>

          <p>{errorMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="manager-page">
      <header className="manager-topbar">
        <div>
          <small>
            PRIVATE TEAM STRATEGY
          </small>

          <strong>
            {portal?.team.name}
          </strong>
        </div>

        <nav>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/manager"
              )
            }
          >
            My team
          </button>

          <button
            type="button"
            className="selected"
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

      <header className="strategy-header">
        <p className="page-label">
          PLAYER RESEARCH
        </p>

        <h1>
          Plan your squad
        </h1>

        <p>
          Shortlists and notes are private
          to your manager account.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="manager-success">
          {successMessage}
        </div>
      )}

      <section className="strategy-controls">
        <input
          type="search"
          value={search}
          placeholder={
            "Search players or categories…"
          }
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />

        <label>
          <input
            type="checkbox"
            checked={
              shortlistedOnly
            }
            onChange={(event) =>
              setShortlistedOnly(
                event.target.checked
              )
            }
          />

          Shortlisted only
        </label>
      </section>

      <section className="strategy-player-list">
        {filteredPlayers.map(
          (player) => {
            const strategy =
              strategies[player.id] ??
              strategyFromRecord();

            const photoUrl =
              getPlayerPhotoUrl(
                player.photo_path
              );

            return (
              <article
                className="strategy-player-card"
                key={player.id}
              >
                <div className="strategy-player-main">
                  <div className="strategy-player-photo">
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

                  <div>
                    <small>
                      {player.category
                        ?.name ??
                        "Uncategorized"}
                    </small>

                    <h2>
                      {player.full_name}
                    </h2>

                    <p>
                      {player.preferred_position ??
                        "Player"}
                    </p>

                    <div className="strategy-stat-row">
                      <span>
                        {
                          player.previous_matches
                        }{" "}
                        matches
                      </span>

                      <span>
                        {
                          player.previous_runs
                        }{" "}
                        runs
                      </span>

                      <span>
                        {
                          player.previous_wickets
                        }{" "}
                        wickets
                      </span>

                      <span>
                        Base:{" "}
                        {player.base_price
                          .toLocaleString()}{" "}
                        PTS
                      </span>
                    </div>
                  </div>
                </div>

                <div className="strategy-fields">
                  <label className="shortlist-control">
                    <input
                      type="checkbox"
                      checked={
                        strategy.shortlisted
                      }
                      onChange={(event) =>
                        updateStrategy(
                          player.id,
                          {
                            shortlisted:
                              event
                                .target
                                .checked
                          }
                        )
                      }
                    />

                    Shortlist player
                  </label>

                  <label>
                    Priority

                    <select
                      value={
                        strategy.priority
                      }
                      onChange={(event) =>
                        updateStrategy(
                          player.id,
                          {
                            priority:
                              Number(
                                event
                                  .target
                                  .value
                              )
                          }
                        )
                      }
                    >
                      <option value={0}>
                        No priority
                      </option>

                      <option value={1}>
                        Low
                      </option>

                      <option value={2}>
                        Medium
                      </option>

                      <option value={3}>
                        High
                      </option>
                    </select>
                  </label>

                  <label>
                    Private notes

                    <textarea
                      value={
                        strategy.notes
                      }
                      maxLength={1000}
                      placeholder={
                        "Role, preferred bid range, strengths or team fit…"
                      }
                      onChange={(event) =>
                        updateStrategy(
                          player.id,
                          {
                            notes:
                              event
                                .target
                                .value
                          }
                        )
                      }
                    />
                  </label>

                  <button
                    type="button"
                    disabled={
                      savingId ===
                      player.id
                    }
                    onClick={() =>
                      saveStrategy(
                        player.id
                      )
                    }
                  >
                    {savingId ===
                    player.id
                      ? "Saving…"
                      : "Save strategy"}
                  </button>
                </div>
              </article>
            );
          }
        )}
      </section>
    </main>
  );
}