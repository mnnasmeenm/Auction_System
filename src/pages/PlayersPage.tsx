import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PlayerCard from "../components/players/PlayerCard";
import type {
  Player,
  PlayerCategory,
  Team,
  Tournament,
  TournamentDivision,
  TournamentDivisionTeam
} from "../types/database";
import {
  createPlayer,
  deletePlayer,
  getPlayerCategories,
  getPlayers,
  type PlayerInput,
  updatePlayer
} from "../services/players";
import { getTournament } from "../services/tournaments";
import { getTeams } from "../services/teams";
import {
  getDivisionTeamAssignments,
  getTournamentDivisions
} from "../services/scheduleConfiguration";
import "./PlayersPage.css";

interface PlayerFormState {
  divisionId: string;
  allocationSource: "auction" | "manual";
  assignedTeamId: string;
  categoryId: string;
  playerNumber: string;
  fullName: string;
  nickname: string;
  battingStyle: string;
  bowlingStyle: string;
  preferredPosition: string;
  basePrice: string;
  achievements: string;
  availabilityNotes: string;
  photoFile: File | null;
}

const battingStyles = [
  "Right-handed batter",
  "Left-handed batter",
  "Switch hitter",
  "Not applicable"
];

const bowlingStyles = [
  "Right-arm fast",
  "Right-arm fast-medium",
  "Right-arm medium",
  "Right-arm off-spin",
  "Right-arm leg-spin",
  "Left-arm fast",
  "Left-arm fast-medium",
  "Left-arm medium",
  "Left-arm orthodox spin",
  "Left-arm wrist spin",
  "Does not bowl",
  "Not applicable"
];

const positions = [
  "Opening batter",
  "Top-order batter",
  "Middle-order batter",
  "Finisher",
  "Pace bowler",
  "Spin bowler",
  "Wicketkeeper",
  "Utility player"
];

const emptyForm: PlayerFormState = {
  divisionId: "",
  allocationSource: "auction",
  assignedTeamId: "",
  categoryId: "",
  playerNumber: "",
  fullName: "",
  nickname: "",
  battingStyle: "",
  bowlingStyle: "",
  preferredPosition: "",
  basePrice: "5000",
  achievements: "",
  availabilityNotes: "",
  photoFile: null
};

export default function PlayersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<PlayerCategory[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [divisionTeams, setDivisionTeams] =
    useState<TournamentDivisionTeam[]>([]);
  const [form, setForm] = useState<PlayerFormState>(emptyForm);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        categoryRecords,
        tournamentRecord,
        teamRecords,
        divisionRecords,
        divisionTeamRecords
      ] =
        await Promise.all([
          getPlayers(tournamentId),
          getPlayerCategories(tournamentId),
          getTournament(tournamentId),
          getTeams(tournamentId),
          getTournamentDivisions(tournamentId),
          getDivisionTeamAssignments(tournamentId)
        ]);

      setPlayers(playerRecords);
      setCategories(categoryRecords);
      setTournament(tournamentRecord);
      setTeams(teamRecords.filter((team) => team.is_active));
      setDivisions(divisionRecords.filter((division) => division.is_active));
      setDivisionTeams(divisionTeamRecords);
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || categoryRecords[0]?.id || ""
      }));
    } catch (error) {
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
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    updateForm("photoFile", event.target.files?.[0] ?? null);
  }

  function validateForm() {
    if (!form.fullName.trim()) return "Enter the player’s full name.";
    if (form.allocationSource === "manual" && !form.assignedTeamId) {
      return "Select the team receiving this manually allocated player.";
    }
    if (form.allocationSource === "manual") return null;
    if (!form.categoryId) return "Select a player category.";
    if (!form.battingStyle) return "Select a batting style.";
    if (!form.bowlingStyle) return "Select a bowling style.";
    if (!form.preferredPosition) return "Select a preferred position.";
    if (Number(form.basePrice) < 0) return "Base price cannot be negative.";
    if (form.playerNumber && Number(form.playerNumber) <= 0) {
      return "Player number must be greater than zero.";
    }
    return null;
  }

  function buildPlayerInput(): PlayerInput {
    return {
      tournamentId,
      divisionId: form.divisionId || null,
      allocationSource: form.allocationSource,
      assignedTeamId:
        form.allocationSource === "manual"
          ? form.assignedTeamId
          : null,
      categoryId:
        form.allocationSource === "manual"
          ? null
          : form.categoryId,
      playerNumber: form.playerNumber ? Number(form.playerNumber) : null,
      fullName: form.fullName,
      nickname: form.nickname,
      battingStyle: form.battingStyle,
      bowlingStyle: form.bowlingStyle,
      preferredPosition: form.preferredPosition,
      basePrice: Number(form.basePrice || 0),
      achievements: form.achievements,
      availabilityNotes: form.availabilityNotes,
      photoFile: form.photoFile
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
        await updatePlayer(editingPlayer.id, editingPlayer.photo_path, input);
        setSuccessMessage("Player updated successfully.");
      } else {
        await createPlayer(input);
        setSuccessMessage("Player registered successfully.");
      }

      if (!editingPlayer && form.allocationSource === "manual") {
        setForm({
          ...emptyForm,
          divisionId: form.divisionId,
          allocationSource: "manual",
          assignedTeamId: "",
          categoryId: "",
          basePrice: "0"
        });
      } else {
        resetForm();
      }
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The player could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function beginEditing(player: Player) {
    setEditingPlayer(player);
    setForm({
      divisionId: player.division_id ?? "",
      allocationSource: player.allocation_source ?? "auction",
      assignedTeamId: player.sold_team_id ?? "",
      categoryId: player.category_id ?? "",
      playerNumber: player.player_number?.toString() ?? "",
      fullName: player.full_name,
      nickname: player.nickname ?? "",
      battingStyle: player.batting_style ?? "",
      bowlingStyle: player.bowling_style ?? "",
      preferredPosition: player.preferred_position ?? "",
      basePrice: player.base_price.toString(),
      achievements: player.achievements ?? "",
      availabilityNotes: player.availability_notes ?? "",
      photoFile: null
    });
    setErrorMessage("");
    setSuccessMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingPlayer(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? ""
    });
  }

  async function handleDelete(player: Player) {
    if (!window.confirm(`Delete ${player.full_name}?`)) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deletePlayer(player);
      setSuccessMessage("Player deleted successfully.");
      if (editingPlayer?.id === player.id) resetForm();
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The player could not be deleted."
      );
    }
  }

  const filteredPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return players.filter((player) => {
      const categoryMatch =
        categoryFilter === "all" || player.category_id === categoryFilter;
      const divisionMatch =
        divisionFilter === "all" || player.division_id === divisionFilter;
      const searchMatch =
        !query ||
        player.full_name.toLowerCase().includes(query) ||
        (player.nickname ?? "").toLowerCase().includes(query);

      return categoryMatch && divisionMatch && searchMatch;
    });
  }, [players, searchText, categoryFilter, divisionFilter]);

  const availableTeamsForDivision = form.divisionId
    ? teams.filter((team) =>
        divisionTeams.some(
          (assignment) =>
            assignment.division_id === form.divisionId &&
            assignment.team_id === team.id
        )
      )
    : teams;

  const orderedDivisions = [...divisions].sort(
    (first, second) => first.display_order - second.display_order
  );
  function selectAuctionPool() {
    setEditingPlayer(null);
    setForm({
      ...emptyForm,
      divisionId: form.divisionId,
      allocationSource: "auction",
      categoryId: categories[0]?.id ?? "",
      basePrice: "5000"
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function selectManualPool() {
    setEditingPlayer(null);
    setForm({
      ...emptyForm,
      divisionId: form.divisionId,
      allocationSource: "manual",
      assignedTeamId: "",
      categoryId: "",
      basePrice: "0"
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  if (!tournamentId) {
    return (
      <main className="players-page">
        <section className="players-message">
          <h1>Tournament not selected</h1>
          <button type="button" onClick={() => navigate("/admin/tournaments")}>
            Choose tournament
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="players-page">
      <header className="players-header">
        <div>
          <p className="page-label">PLAYER REGISTRATION</p>
          <h1>Registered players</h1>
          <p>
            Add players to an auction pool or allocate them directly to a
            division team without changing its auction budget.
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
            <h2>{editingPlayer ? "Edit player" : "Register player"}</h2>
            <p>Previous-match statistics are no longer required.</p>
          </div>
          {editingPlayer && (
            <button type="button" className="cancel-player-edit" onClick={resetForm}>
              Cancel editing
            </button>
          )}
        </div>

        <form className="player-form" onSubmit={handleSubmit}>
          <div className="player-registration-pools player-wide-field">
            <button
              type="button"
              className={
                form.allocationSource === "auction"
                  ? "selected-registration-pool"
                  : ""
              }
              onClick={selectAuctionPool}
              disabled={
                editingPlayer?.allocation_source !== "manual" &&
                editingPlayer?.status === "sold"
              }
            >
              <strong>Auction pool</strong>
              <span>
                Register players for bidding and auction allocation.
              </span>
            </button>

            <button
              type="button"
              className={
                form.allocationSource === "manual"
                  ? "selected-registration-pool"
                  : ""
              }
              onClick={selectManualPool}
              disabled={
                editingPlayer?.allocation_source !== "manual" &&
                editingPlayer?.status === "sold"
              }
            >
              <strong>Direct team assignment</strong>
              <span>Add a name and place the player directly in a team.</span>
            </button>
          </div>

          <label className="player-wide-field">
            Tournament division (optional)
            <select
              value={form.divisionId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  divisionId: event.target.value,
                  assignedTeamId: ""
                }))
              }
            >
              <option value="">No division / whole tournament</option>
              {orderedDivisions.map((division) => (
                <option value={division.id} key={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
            <small>
              Use this only when the tournament has separate competitions.
            </small>
          </label>

          {form.allocationSource === "manual" && (
            <>
              <label>
                Player name
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  placeholder="Enter player name"
                  autoFocus
                  required
                />
              </label>

              <label>
                Assigned team
                <select
                  value={form.assignedTeamId}
                  onChange={(event) =>
                    updateForm("assignedTeamId", event.target.value)
                  }
                  required
                >
                  <option value="">Select team</option>
                  {availableTeamsForDivision.map((team) => (
                    <option value={team.id} key={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <small>
                  {form.divisionId
                    ? "Only teams assigned to this division are shown."
                    : "All active tournament teams are shown."}
                </small>
              </label>

              <div className="manual-allocation-note player-wide-field">
                <strong>Quick non-auction entry</strong>
                <span>
                  Save this player, then the same division stays selected for
                  the next name. The team selection resets to prevent an
                  accidental assignment.
                </span>
              </div>
            </>
          )}

          {form.allocationSource === "auction" && (
            <>
              <label>
                Player number
                <input
                  type="number"
                  min="1"
                  value={form.playerNumber}
                  onChange={(event) =>
                    updateForm("playerNumber", event.target.value)
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Full name
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  required
                />
              </label>

              <label>
            Nickname
            <input
              value={form.nickname}
              onChange={(event) => updateForm("nickname", event.target.value)}
            />
              </label>

              <label>
            Category
            <select
              value={form.categoryId}
              onChange={(event) => updateForm("categoryId", event.target.value)}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>{category.name}</option>
              ))}
            </select>
              </label>

              <label>
            Batting style
            <select
              value={form.battingStyle}
              onChange={(event) => updateForm("battingStyle", event.target.value)}
              required
            >
              <option value="">Select batting style</option>
              {battingStyles.map((style) => <option key={style}>{style}</option>)}
            </select>
              </label>

              <label>
            Bowling style
            <select
              value={form.bowlingStyle}
              onChange={(event) => updateForm("bowlingStyle", event.target.value)}
              required
            >
              <option value="">Select bowling style</option>
              {bowlingStyles.map((style) => <option key={style}>{style}</option>)}
            </select>
              </label>

              <label>
            Preferred position
            <select
              value={form.preferredPosition}
              onChange={(event) => updateForm("preferredPosition", event.target.value)}
              required
            >
              <option value="">Select position</option>
              {positions.map((position) => <option key={position}>{position}</option>)}
            </select>
              </label>

            <label>
              Base price (LKR)
              <input
                type="number"
                min="0"
                value={form.basePrice}
                onChange={(event) =>
                  updateForm("basePrice", event.target.value)
                }
                required
              />
            </label>

              <label className="player-wide-field">
            Achievements
            <textarea
              value={form.achievements}
              onChange={(event) => updateForm("achievements", event.target.value)}
            />
              </label>

              <label className="player-wide-field">
            Availability notes
            <textarea
              value={form.availabilityNotes}
              onChange={(event) => updateForm("availabilityNotes", event.target.value)}
            />
              </label>

              <label className="player-wide-field">
            Player photograph
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
            <small>JPG, PNG or WebP. Maximum size: 2 MB.</small>
              </label>
            </>
          )}

          <div className="player-submit-area">
            <button type="submit" disabled={submitting}>
              {submitting
                ? "Saving player…"
                : editingPlayer
                  ? "Update player"
                  : form.allocationSource === "manual"
                    ? "Add player to team"
                    : "Register player"}
            </button>
          </div>
        </form>
      </section>

      {errorMessage && <div className="form-error">{errorMessage}</div>}
      {successMessage && <div className="player-success">{successMessage}</div>}

      <section className="player-directory">
        <div className="player-directory-heading">
          <div>
            <h2>Player social cards</h2>
            <p>Animated in the app and downloadable as high-resolution PNG cards.</p>
          </div>
           <button
    type="button"
    className="registered-poster-button"
    disabled={players.length === 0}
    onClick={() =>
      navigate(
        `/admin/registered-players-poster?tournament=${tournamentId}`
      )
    }
  >
    Registered-player posters
  </button>

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
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search player…"
          />
          <button
            type="button"
            className={categoryFilter === "all" ? "selected-filter" : ""}
            onClick={() => setCategoryFilter("all")}
          >
            All · {players.length}
          </button>
          <select
            value={divisionFilter}
            onChange={(event) => setDivisionFilter(event.target.value)}
            aria-label="Filter players by division"
          >
            <option value="all">All divisions</option>
            {divisions.map((division) => (
              <option value={division.id} key={division.id}>
                {division.name}
              </option>
            ))}
          </select>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={categoryFilter === category.id ? "selected-filter" : ""}
              onClick={() => setCategoryFilter(category.id)}
            >
              {category.name} · {players.filter((player) => player.category_id === category.id).length}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="players-message">Loading players…</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="players-message">No matching players found.</div>
        ) : (
          <div className="players-grid">
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                societyName={tournament?.society_name ?? "Ath-Thariq Welfare Society"}
                tournamentName={tournament?.tournament_name ?? "Player Auction"}
                societyLogoPath={tournament?.society_logo_path ?? null}
                tournamentLogoPath={tournament?.tournament_logo_path ?? null}
                onEdit={beginEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
