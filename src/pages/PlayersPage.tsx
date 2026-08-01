import {
  type ChangeEvent,
  type FormEvent,
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
  PlayerCategory
} from "../types/database";

import {
  createPlayer,
  deletePlayer,
  getPlayerCategories,
  getPlayers,
  type PlayerInput,
  updatePlayer
} from "../services/players";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import "./PlayersPage.css";

interface PlayerFormState {
  categoryId: string;
  playerNumber: string;
  fullName: string;
  nickname: string;
  battingStyle: string;
  bowlingStyle: string;
  preferredPosition: string;
  basePrice: string;
  previousMatches: string;
  previousRuns: string;
  previousWickets: string;
  catches: string;
  achievements: string;
  availabilityNotes: string;
  photoFile: File | null;
}

const emptyForm: PlayerFormState = {
  categoryId: "",
  playerNumber: "",
  fullName: "",
  nickname: "",
  battingStyle: "",
  bowlingStyle: "",
  preferredPosition: "",
  basePrice: "",
  previousMatches: "0",
  previousRuns: "0",
  previousWickets: "0",
  catches: "0",
  achievements: "",
  availabilityNotes: "",
  photoFile: null
};

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

export default function PlayersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] =
    useState<PlayerCategory[]>([]);

  const [form, setForm] =
    useState<PlayerFormState>(emptyForm);

  const [editingPlayer, setEditingPlayer] =
    useState<Player | null>(null);

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadPageData();
  }, [tournamentId]);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        playerRecords,
        categoryRecords
      ] = await Promise.all([
        getPlayers(tournamentId),
        getPlayerCategories(tournamentId)
      ]);

      setPlayers(playerRecords);
      setCategories(categoryRecords);

      setForm((currentForm) => ({
        ...currentForm,
        categoryId:
          currentForm.categoryId ||
          categoryRecords[0]?.id ||
          ""
      }));
    } catch (error) {
      console.error("Player page loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Player information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateForm(
    field: keyof PlayerFormState,
    value: string | File | null
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    updateForm(
      "photoFile",
      event.target.files?.[0] ?? null
    );
  }

  function validateForm(): string | null {
    if (!form.fullName.trim()) {
      return "Enter the player’s full name.";
    }

    if (!form.categoryId) {
      return "Select a player category.";
    }

    if (Number(form.basePrice) < 0) {
      return "Base points cannot be negative.";
    }

    if (
      form.playerNumber &&
      Number(form.playerNumber) <= 0
    ) {
      return "Player number must be greater than zero.";
    }

    return null;
  }

  function buildPlayerInput(): PlayerInput {
    return {
      tournamentId,
      categoryId: form.categoryId,

      playerNumber: form.playerNumber
        ? Number(form.playerNumber)
        : null,

      fullName: form.fullName,
      nickname: form.nickname,
      battingStyle: form.battingStyle,
      bowlingStyle: form.bowlingStyle,
      preferredPosition: form.preferredPosition,
      basePrice: Number(form.basePrice || 0),

      previousMatches:
        Number(form.previousMatches || 0),

      previousRuns:
        Number(form.previousRuns || 0),

      previousWickets:
        Number(form.previousWickets || 0),

      catches:
        Number(form.catches || 0),

      achievements: form.achievements,
      availabilityNotes: form.availabilityNotes,
      photoFile: form.photoFile
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const input = buildPlayerInput();

      if (editingPlayer) {
        await updatePlayer(
          editingPlayer.id,
          editingPlayer.photo_path,
          input
        );

        setSuccessMessage(
          "Player updated successfully."
        );
      } else {
        await createPlayer(input);

        setSuccessMessage(
          "Player registered successfully."
        );
      }

      resetForm();
      await loadPageData();
    } catch (error) {
      console.error("Player saving error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The player could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function beginEditing(player: Player) {
    setEditingPlayer(player);

    setForm({
      categoryId: player.category_id ?? "",
      playerNumber:
        player.player_number?.toString() ?? "",
      fullName: player.full_name,
      nickname: player.nickname ?? "",
      battingStyle: player.batting_style ?? "",
      bowlingStyle: player.bowling_style ?? "",
      preferredPosition:
        player.preferred_position ?? "",
      basePrice: player.base_price.toString(),
      previousMatches:
        player.previous_matches.toString(),
      previousRuns:
        player.previous_runs.toString(),
      previousWickets:
        player.previous_wickets.toString(),
      catches: player.catches.toString(),
      achievements: player.achievements ?? "",
      availabilityNotes:
        player.availability_notes ?? "",
      photoFile: null
    });

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function resetForm() {
    setEditingPlayer(null);

    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? ""
    });
  }

  async function handleDelete(player: Player) {
    const confirmed = window.confirm(
      `Delete ${player.full_name}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deletePlayer(player);

      setSuccessMessage(
        "Player deleted successfully."
      );

      if (editingPlayer?.id === player.id) {
        resetForm();
      }

      await loadPageData();
    } catch (error) {
      console.error("Player deletion error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The player could not be deleted."
      );
    }
  }

  const filteredPlayers = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return players.filter((player) => {
      const matchesCategory =
        categoryFilter === "all" ||
        player.category_id === categoryFilter;

      const matchesSearch =
        !normalizedSearch ||
        player.full_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (player.nickname ?? "")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [
    players,
    searchText,
    categoryFilter
  ]);

  if (!tournamentId) {
    return (
      <main className="players-page">
        <section className="players-message">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() => navigate("/admin/setup")}
          >
            Return to tournament setup
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="players-page">
      <header className="players-header">
        <div>
          <p className="page-label">
            PLAYER REGISTRATION
          </p>

          <h1>Registered players</h1>

          <p>
            Register players, upload photographs and organize
            them by playing category.
          </p>
        </div>

        <div className="player-count">
          <strong>{players.length}</strong>
          <span>registered players</span>
        </div>
      </header>

      <section className="player-form-panel">
        <div className="player-form-heading">
          <div>
            <h2>
              {editingPlayer
                ? "Edit player"
                : "Register player"}
            </h2>

            <p>
              Enter verified information for this tournament.
            </p>
          </div>

          {editingPlayer && (
            <button
              type="button"
              className="cancel-player-edit"
              onClick={resetForm}
            >
              Cancel editing
            </button>
          )}
        </div>

        <form
          className="player-form"
          onSubmit={handleSubmit}
        >
          <label>
            Player number

            <input
              type="number"
              min="1"
              value={form.playerNumber}
              onChange={(event) =>
                updateForm(
                  "playerNumber",
                  event.target.value
                )
              }
              placeholder="Optional"
            />
          </label>

          <label>
            Full name

            <input
              value={form.fullName}
              onChange={(event) =>
                updateForm(
                  "fullName",
                  event.target.value
                )
              }
              required
            />
          </label>

          <label>
            Nickname

            <input
              value={form.nickname}
              onChange={(event) =>
                updateForm(
                  "nickname",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Category

            <select
              value={form.categoryId}
              onChange={(event) =>
                updateForm(
                  "categoryId",
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select category
              </option>

              {categories.map((category) => (
                <option
                  value={category.id}
                  key={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batting style

            <input
              value={form.battingStyle}
              onChange={(event) =>
                updateForm(
                  "battingStyle",
                  event.target.value
                )
              }
              placeholder="Example: Right-handed"
            />
          </label>

          <label>
            Bowling style

            <input
              value={form.bowlingStyle}
              onChange={(event) =>
                updateForm(
                  "bowlingStyle",
                  event.target.value
                )
              }
              placeholder="Example: Right-arm medium"
            />
          </label>

          <label>
            Preferred position

            <input
              value={form.preferredPosition}
              onChange={(event) =>
                updateForm(
                  "preferredPosition",
                  event.target.value
                )
              }
              placeholder="Example: Opening batsman"
            />
          </label>

          <label>
            Base points

            <input
              type="number"
              min="0"
              value={form.basePrice}
              onChange={(event) =>
                updateForm(
                  "basePrice",
                  event.target.value
                )
              }
              required
            />
          </label>

          <label>
            Previous matches

            <input
              type="number"
              min="0"
              value={form.previousMatches}
              onChange={(event) =>
                updateForm(
                  "previousMatches",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Previous runs

            <input
              type="number"
              min="0"
              value={form.previousRuns}
              onChange={(event) =>
                updateForm(
                  "previousRuns",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Previous wickets

            <input
              type="number"
              min="0"
              value={form.previousWickets}
              onChange={(event) =>
                updateForm(
                  "previousWickets",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Catches

            <input
              type="number"
              min="0"
              value={form.catches}
              onChange={(event) =>
                updateForm(
                  "catches",
                  event.target.value
                )
              }
            />
          </label>

          <label className="player-wide-field">
            Achievements

            <textarea
              value={form.achievements}
              onChange={(event) =>
                updateForm(
                  "achievements",
                  event.target.value
                )
              }
            />
          </label>

          <label className="player-wide-field">
            Availability notes

            <textarea
              value={form.availabilityNotes}
              onChange={(event) =>
                updateForm(
                  "availabilityNotes",
                  event.target.value
                )
              }
            />
          </label>

          <label className="player-wide-field">
            Player photograph

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />

            <small>
              JPG, PNG or WebP. Maximum size: 2 MB.
            </small>
          </label>

          <div className="player-submit-area">
            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Saving player…"
                : editingPlayer
                  ? "Update player"
                  : "Register player"}
            </button>
          </div>
        </form>
      </section>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="player-success">
          {successMessage}
        </div>
      )}

      <section className="player-directory">
        <div className="player-directory-heading">
          <div>
            <h2>Player directory</h2>

            <p>
              Browse registered players by category.
            </p>
          </div>

          <button
            type="button"
            className="continue-button"
            disabled={players.length === 0}
            onClick={() =>
              navigate(
                `/admin/auction?tournament=${tournamentId}`
              )
            }
          >
            Continue to auction
          </button>
        </div>

        <div className="player-filters">
          <input
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Search player…"
          />

          <button
            type="button"
            className={
              categoryFilter === "all"
                ? "selected-filter"
                : ""
            }
            onClick={() => setCategoryFilter("all")}
          >
            All · {players.length}
          </button>

          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={
                categoryFilter === category.id
                  ? "selected-filter"
                  : ""
              }
              onClick={() =>
                setCategoryFilter(category.id)
              }
            >
              {category.name} ·{" "}
              {
                players.filter(
                  (player) =>
                    player.category_id === category.id
                ).length
              }
            </button>
          ))}
        </div>

        {loading ? (
          <div className="players-message">
            Loading players…
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="players-message">
            No matching players found.
          </div>
        ) : (
          <div className="players-grid">
            {filteredPlayers.map((player) => {
              const photoUrl =
                getPlayerPhotoUrl(player.photo_path);

              return (
                <article
                  className="clean-player-card"
                  key={player.id}
                >
                  <div className="player-photo-area">
                    <span className="player-number">
                      {player.player_number
                        ? `#${player.player_number}`
                        : "PLAYER"}
                    </span>

                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={player.full_name}
                      />
                    ) : (
                      <div className="player-initials">
                        {getInitials(player.full_name)}
                      </div>
                    )}
                  </div>

                  <div className="player-card-content">
                    <span className="player-category">
                      {player.category?.name ??
                        "Uncategorized"}
                    </span>

                    <h3>{player.full_name}</h3>

                    {player.nickname && (
                      <p className="player-nickname">
                        “{player.nickname}”
                      </p>
                    )}

                    <div className="player-statistics">
                      <div>
                        <strong>
                          {player.previous_matches}
                        </strong>
                        <span>Matches</span>
                      </div>

                      <div>
                        <strong>
                          {player.previous_runs}
                        </strong>
                        <span>Runs</span>
                      </div>

                      <div>
                        <strong>
                          {player.previous_wickets}
                        </strong>
                        <span>Wickets</span>
                      </div>
                    </div>

                    <div className="player-base-price">
                      <span>Base value</span>

                      <strong>
                        {player.base_price.toLocaleString()}
                        <small> PTS</small>
                      </strong>
                    </div>

                    <div className="player-card-actions">
                      <button
                        type="button"
                        onClick={() =>
                          beginEditing(player)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-player-button"
                        onClick={() =>
                          handleDelete(player)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}