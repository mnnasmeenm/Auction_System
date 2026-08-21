import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import type {
  Team,
  TournamentDivision,
  TournamentDivisionTeam
} from "../types/database";

import {
  createTeam,
  deleteTeam,
  getTeamLogoUrl,
  getTeams,
  setTeamActiveStatus,
  type TeamInput,
  updateTeam
} from "../services/teams";
import {
  getDivisionTeamAssignments,
  getTournamentDivisions,
  setTeamDivisionAssignments
} from "../services/scheduleConfiguration";

import "./TeamsPage.css";

interface TeamFormState {
  name: string;
  shortName: string;
  managerName: string;
  teamColor: string;
  startingBudget: string;
  squadLimit: string;
  logoFile: File | null;
  divisionIds: string[];
}

const emptyForm: TeamFormState = {
  name: "",
  shortName: "",
  managerName: "",
  teamColor: "#1646b8",
  startingBudget: "",
  squadLimit: "",
  logoFile: null,
  divisionIds: []
};

export default function TeamsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [divisionTeams, setDivisionTeams] =
    useState<TournamentDivisionTeam[]>([]);
  const [form, setForm] =
    useState<TeamFormState>(emptyForm);

  const [editingTeamId, setEditingTeamId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadTeams();
  }, [tournamentId]);

  async function loadTeams() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [teamRecords, divisionRecords, assignmentRecords] =
        await Promise.all([
          getTeams(tournamentId),
          getTournamentDivisions(tournamentId),
          getDivisionTeamAssignments(tournamentId)
        ]);
      setTeams(teamRecords);
      setDivisions(divisionRecords.filter((division) => division.is_active));
      setDivisionTeams(assignmentRecords);
      setForm((current) => ({
        ...current,
        divisionIds:
          current.divisionIds.length > 0
            ? current.divisionIds
            : divisionRecords[0]
              ? [divisionRecords[0].id]
              : []
      }));
    } catch (error) {
      console.error("Team loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Teams could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateForm(
    field: keyof TeamFormState,
    value: string | string[] | File | null
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0] ?? null;

    updateForm("logoFile", selectedFile);
  }

  function validateForm(): string | null {
    if (!form.name.trim()) {
      return "Enter the team name.";
    }

    if (!form.shortName.trim()) {
      return "Enter the team short name.";
    }

    if (form.shortName.trim().length > 5) {
      return "The team short name cannot exceed five characters.";
    }

    if (Number(form.startingBudget) <= 0) {
      return "The team budget must be greater than zero.";
    }

    if (Number(form.squadLimit) <= 0) {
      return "The squad limit must be greater than zero.";
    }

    if (form.divisionIds.length === 0) {
      return "Select at least one tournament division.";
    }

    return null;
  }

  function buildTeamInput(): TeamInput {
    return {
      tournamentId,
      name: form.name,
      shortName: form.shortName,
      managerName: form.managerName,
      teamColor: form.teamColor,
      startingBudget: Number(form.startingBudget),
      squadLimit: Number(form.squadLimit),
      logoFile: form.logoFile
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
      const input = buildTeamInput();

      if (editingTeamId) {
        await updateTeam(editingTeamId, input);
        await setTeamDivisionAssignments(
          tournamentId,
          editingTeamId,
          form.divisionIds
        );
        setSuccessMessage("Team updated successfully.");
      } else {
        const createdTeam = await createTeam(input);
        await setTeamDivisionAssignments(
          tournamentId,
          createdTeam.id,
          form.divisionIds
        );
        setSuccessMessage("Team created successfully.");
      }

      setForm({
        ...emptyForm,
        divisionIds: divisions[0] ? [divisions[0].id] : []
      });
      setEditingTeamId(null);

      await loadTeams();
    } catch (error) {
      console.error("Team saving error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The team could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function beginEditing(team: Team) {
    setEditingTeamId(team.id);

    setForm({
      name: team.name,
      shortName: team.short_name,
      managerName: team.manager_name ?? "",
      teamColor: team.team_color,
      startingBudget: String(team.starting_budget),
      squadLimit: String(team.squad_limit ?? ""),
      logoFile: null,
      divisionIds: divisionTeams
        .filter((assignment) => assignment.team_id === team.id)
        .map((assignment) => assignment.division_id)
    });

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function cancelEditing() {
    setEditingTeamId(null);
    setForm({
      ...emptyForm,
      divisionIds: divisions[0] ? [divisions[0].id] : []
    });
    setErrorMessage("");
  }

  async function handleStatusChange(team: Team) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setTeamActiveStatus(
        team.id,
        !team.is_active
      );

      setSuccessMessage(
        team.is_active
          ? "Team disabled."
          : "Team activated."
      );

      await loadTeams();
    } catch (error) {
      console.error("Team status error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The team status could not be changed."
      );
    }
  }

  async function handleDelete(team: Team) {
    const confirmed = window.confirm(
      `Delete ${team.name}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteTeam(team.id);
      setSuccessMessage("Team deleted successfully.");

      if (editingTeamId === team.id) {
        cancelEditing();
      }

      await loadTeams();
    } catch (error) {
      console.error("Team deletion error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The team could not be deleted."
      );
    }
  }

  if (!tournamentId) {
    return (
      <main className="teams-page">
        <section className="teams-message">
          <h1>Tournament not selected</h1>

          <p>
            Create or select a tournament before adding teams.
          </p>

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
    <main className="teams-page">
      <header className="teams-header">
        <div>
          <p className="page-label">TEAM SETUP</p>
          <h1>Participating teams</h1>

          <p>
            Add, edit or disable the teams participating in
            this tournament.
          </p>
        </div>

        <div className="team-count">
          <strong>{teams.length}</strong>
          <span>teams created</span>
        </div>
      </header>

      <section className="team-form-panel">
        <div className="team-form-heading">
          <div>
            <h2>
              {editingTeamId
                ? "Edit team"
                : "Add team"}
            </h2>

            <p>
              Create auction or manual-squad teams and assign
              them to one or more tournament divisions.
            </p>
          </div>

          {editingTeamId && (
            <button
              type="button"
              className="cancel-edit-button"
              onClick={cancelEditing}
            >
              Cancel editing
            </button>
          )}
        </div>

        <form
          className="team-form"
          onSubmit={handleSubmit}
        >
          <label>
            Team name

            <input
              value={form.name}
              onChange={(event) =>
                updateForm("name", event.target.value)
              }
              placeholder="Example: Blue Warriors"
              required
            />
          </label>

          <label>
            Short name

            <input
              value={form.shortName}
              onChange={(event) =>
                updateForm(
                  "shortName",
                  event.target.value.toUpperCase()
                )
              }
              maxLength={5}
              placeholder="Example: BW"
              required
            />
          </label>

          <label>
            Manager name

            <input
              value={form.managerName}
              onChange={(event) =>
                updateForm(
                  "managerName",
                  event.target.value
                )
              }
              placeholder="Manager name"
            />
          </label>

          <label>
            Team colour

            <div className="colour-input">
              <input
                type="color"
                value={form.teamColor}
                onChange={(event) =>
                  updateForm(
                    "teamColor",
                    event.target.value
                  )
                }
              />

              <span>{form.teamColor}</span>
            </div>
          </label>

          <label>
            Starting budget (LKR)

            <input
              type="number"
              min="1"
              value={form.startingBudget}
              onChange={(event) =>
                updateForm(
                  "startingBudget",
                  event.target.value
                )
              }
              placeholder="Example: 50000"
              required
            />
          </label>

          <label>
            Squad limit

            <input
              type="number"
              min="1"
              value={form.squadLimit}
              onChange={(event) =>
                updateForm(
                  "squadLimit",
                  event.target.value
                )
              }
              placeholder="Example: 12"
              required
            />
          </label>

          <label className="logo-field">
            Team logo

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoChange}
            />

            <small>
              JPG, PNG or WebP. Maximum size: 2 MB.
            </small>
          </label>

          <fieldset className="team-division-field">
            <legend>Tournament divisions</legend>
            <p>
              Select every division in which this team participates.
            </p>

            <div>
              {divisions.map((division) => {
                const checked = form.divisionIds.includes(division.id);

                return (
                  <label
                    key={division.id}
                    className={checked ? "selected" : ""}
                    style={{ borderColor: checked ? division.division_color : undefined }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        updateForm(
                          "divisionIds",
                          event.target.checked
                            ? [...form.divisionIds, division.id]
                            : form.divisionIds.filter(
                                (id) => id !== division.id
                              )
                        )
                      }
                    />
                    <span style={{ background: division.division_color }}>
                      {division.short_name}
                    </span>
                    <strong>{division.name}</strong>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="team-submit-area">
            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Saving team…"
                : editingTeamId
                  ? "Update team"
                  : "Create team"}
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
        <div className="team-success">
          {successMessage}
        </div>
      )}

      <section className="team-list-section">
        <div className="team-list-heading">
          <div>
            <h2>Created teams</h2>
            <p>
              No sample teams are added automatically.
            </p>
          </div>

          {teams.length > 0 && (
            <button
              type="button"
              className="continue-button"
              onClick={() =>
                navigate(
                  `/admin/players?tournament=${tournamentId}`
                )
              }
            >
              Continue to players
            </button>
          )}
        </div>

        {loading ? (
          <div className="teams-message">
            Loading teams…
          </div>
        ) : teams.length === 0 ? (
          <div className="teams-message">
            <h3>No teams created</h3>

            <p>
              Use the form above to add the first team.
            </p>
          </div>
        ) : (
          <div className="teams-grid">
            {teams.map((team) => {
              const logoUrl =
                getTeamLogoUrl(team.logo_path);

              return (
                <article
                  className={`team-card ${
                    team.is_active
                      ? ""
                      : "team-card-disabled"
                  }`}
                  key={team.id}
                  style={{
                    borderTopColor: team.team_color
                  }}
                >
                  <div className="team-card-header">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${team.name} logo`}
                      />
                    ) : (
                      <div
                        className="team-initials"
                        style={{
                          color: team.team_color,
                          borderColor: team.team_color
                        }}
                      >
                        {team.short_name}
                      </div>
                    )}

                    <div>
                      <h3>{team.name}</h3>
                      <p>{team.short_name}</p>
                    </div>

                    <span
                      className={
                        team.is_active
                          ? "active-status"
                          : "disabled-status"
                      }
                    >
                      {team.is_active
                        ? "Active"
                        : "Disabled"}
                    </span>
                  </div>

                  <dl className="team-information">
                    <div>
                      <dt>Manager</dt>
                      <dd>
                        {team.manager_name ||
                          "Not assigned"}
                      </dd>
                    </div>

                    <div>
                      <dt>Starting budget</dt>
                      <dd>
                        {team.starting_budget.toLocaleString()}
                      </dd>
                    </div>

                    <div>
                      <dt>Squad limit</dt>
                      <dd>
                        {team.squad_limit ?? "Not set"}
                      </dd>
                    </div>

                    <div>
                      <dt>Team colour</dt>
                      <dd>
                        <span
                          className="team-colour-sample"
                          style={{
                            background: team.team_color
                          }}
                        />

                        {team.team_color}
                      </dd>
                    </div>
                  </dl>

                  <div className="team-card-actions">
                    {divisions
                      .filter((division) =>
                        divisionTeams.some(
                          (assignment) =>
                            assignment.team_id === team.id &&
                            assignment.division_id === division.id
                        )
                      )
                      .map((division) => (
                        <button
                          type="button"
                          className="team-poster-button"
                          key={division.id}
                          onClick={() =>
                            navigate(
                              `/admin/team-poster?tournament=${tournamentId}&team=${team.id}&division=${division.id}`
                            )
                          }
                        >
                          {division.short_name} poster
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={() => beginEditing(team)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(team)
                      }
                    >
                      {team.is_active
                        ? "Disable"
                        : "Activate"}
                    </button>

                    <button
                      type="button"
                      className="delete-team-button"
                      onClick={() => handleDelete(team)}
                    >
                      Delete
                    </button>
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
