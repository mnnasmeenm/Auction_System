import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import {
  assignManagerTeam,
  getManagerAccounts,
  inviteManager,
  sendManagerRecovery,
  setManagerActive,
  type ManagerAccountData
} from "../services/managerAccounts";

import "./ManagerAccountsPage.css";

interface InvitationForm {
  fullName: string;
  email: string;
  teamId: string;
}

const emptyForm: InvitationForm = {
  fullName: "",
  email: "",
  teamId: ""
};

export default function
ManagerAccountsPage() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [data, setData] =
    useState<
      ManagerAccountData | null
    >(null);

  const [form, setForm] =
    useState<InvitationForm>(
      emptyForm
    );

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [workingId, setWorkingId] =
    useState<string | null>(null);

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage
  ] = useState("");

  const loadAccounts =
    useCallback(async () => {
      if (!tournamentId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const managerData =
          await getManagerAccounts(
            tournamentId
          );

        setData(managerData);
        setErrorMessage("");
      } catch (error) {
        console.error(
          "Manager account loading error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Manager accounts could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, [tournamentId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredManagers =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return data.managers;
      }

      return data.managers.filter(
        (manager) => {
          const team =
            data.teams.find(
              (record) =>
                record.id ===
                manager.team_id
            );

          return (
            (
              manager.full_name ??
              ""
            )
              .toLowerCase()
              .includes(query) ||

            (
              manager.email ??
              ""
            )
              .toLowerCase()
              .includes(query) ||

            (
              team?.name ??
              ""
            )
              .toLowerCase()
              .includes(query)
          );
        }
      );
    }, [
      data,
      search
    ]);

  function updateForm(
    field: keyof InvitationForm,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value
      })
    );
  }

  async function handleInvite(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setErrorMessage(
        "Enter the manager name."
      );
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage(
        "Enter the manager email."
      );
      return;
    }

    if (!form.teamId) {
      setErrorMessage(
        "Select a team."
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await inviteManager({
          tournamentId,

          fullName:
            form.fullName.trim(),

          email:
            form.email
              .trim()
              .toLowerCase(),

          teamId:
            form.teamId
        });

      setSuccessMessage(
        response.message ??
        "Manager invitation sent."
      );

      setForm(emptyForm);

      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Manager invitation failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignment(
    managerId: string,
    teamId: string
  ) {
    setWorkingId(managerId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await assignManagerTeam({
          tournamentId,
          managerId,
          teamId:
            teamId || null
        });

      setSuccessMessage(
        response.message ??
        "Manager assignment updated."
      );

      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Assignment could not be updated."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleStatus(
    managerId: string,
    currentlyActive: boolean
  ) {
    const nextActive =
      !currentlyActive;

    const confirmed =
      window.confirm(
        nextActive
          ? "Enable this manager account?"
          : "Disable this manager account? The manager will lose portal access."
      );

    if (!confirmed) {
      return;
    }

    setWorkingId(managerId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await setManagerActive({
          tournamentId,
          managerId,
          active: nextActive
        });

      setSuccessMessage(
        response.message ??
        "Manager status updated."
      );

      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Manager status could not be updated."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleRecovery(
    managerId: string,
    managerEmail: string | null
  ) {
    if (!managerEmail) {
      setErrorMessage(
        "This manager has no email address."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Send a password recovery email to ${managerEmail}?`
      );

    if (!confirmed) {
      return;
    }

    setWorkingId(managerId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await sendManagerRecovery({
          tournamentId,
          managerId
        });

      setSuccessMessage(
        response.message ??
        "Recovery email sent."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Recovery email could not be sent."
      );
    } finally {
      setWorkingId(null);
    }
  }

  if (!tournamentId) {
    return (
      <main className="manager-accounts-page">
        <section className="manager-accounts-empty">
          <h1>
            Tournament not selected
          </h1>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/admin/tournaments"
              )
            }
          >
            Choose tournament
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="manager-accounts-page">
        <section className="manager-accounts-empty">
          Loading manager accounts…
        </section>
      </main>
    );
  }

  return (
    <main className="manager-accounts-page">
      <header className="manager-accounts-header">
        <p className="page-label">
          ACCESS MANAGEMENT
        </p>

        <h1>
          Team managers
        </h1>

        <p>
          Invite managers and control
          access to this tournament.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="manager-account-success">
          {successMessage}
        </div>
      )}

      <section className="manager-invitation-panel">
        <div>
          <h2>
            Invite a manager
          </h2>

          <p>
            The manager receives an email
            for setting up their account.
          </p>
        </div>

        <form onSubmit={handleInvite}>
          <label>
            Manager name

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
            Email address

            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                updateForm(
                  "email",
                  event.target.value
                )
              }
              required
            />
          </label>

          <label>
            Assigned team

            <select
              value={form.teamId}
              onChange={(event) =>
                updateForm(
                  "teamId",
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select team
              </option>

              {data?.teams.map(
                (team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                    {!team.is_active
                      ? " (inactive)"
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Sending invitation…"
              : "Invite manager"}
          </button>
        </form>
      </section>

      <section className="manager-account-list-panel">
        <div className="manager-account-list-heading">
          <div>
            <h2>
              Manager accounts
            </h2>

            <p>
              {data?.managers.length ??
                0}{" "}
              account(s)
            </p>
          </div>

          <input
            type="search"
            value={search}
            placeholder={
              "Search managers or teams…"
            }
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        {filteredManagers.length ===
        0 ? (
          <div className="manager-accounts-empty">
            No manager accounts found.
          </div>
        ) : (
          <div className="manager-account-list">
            {filteredManagers.map(
              (manager) => {
                const assignedTeam =
                  data?.teams.find(
                    (team) =>
                      team.id ===
                      manager.team_id
                  );

                const working =
                  workingId ===
                  manager.id;

                return (
                  <article
                    key={manager.id}
                    className={
                      manager.is_active
                        ? "manager-account-record"
                        : "manager-account-record disabled-manager-account"
                    }
                  >
                    <div className="manager-account-identity">
                      <span>
                        {(manager.full_name ??
                          manager.email ??
                          "M")
                          .charAt(0)
                          .toUpperCase()}
                      </span>

                      <div>
                        <strong>
                          {manager.full_name ??
                            "Unnamed manager"}
                        </strong>

                        <small>
                          {manager.email ??
                            "No email"}
                        </small>
                      </div>
                    </div>

                    <div className="manager-account-team">
                      <label>
                        Assigned team

                        <select
                          value={
                            manager.team_id ??
                            ""
                          }
                          disabled={working}
                          onChange={(
                            event
                          ) =>
                            handleAssignment(
                              manager.id,
                              event.target
                                .value
                            )
                          }
                        >
                          <option value="">
                            No team access
                          </option>

                          {data?.teams.map(
                            (team) => (
                              <option
                                key={
                                  team.id
                                }
                                value={
                                  team.id
                                }
                              >
                                {team.name}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <small>
                        {assignedTeam
                          ? assignedTeam
                              .short_name
                          : "Unassigned"}
                      </small>
                    </div>

                    <div className="manager-account-state">
                      <span
                        className={
                          manager.is_active
                            ? "manager-enabled"
                            : "manager-disabled"
                        }
                      >
                        {manager.is_active
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>

                    <div className="manager-account-actions">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          handleRecovery(
                            manager.id,
                            manager.email
                          )
                        }
                      >
                        Send recovery
                      </button>

                      <button
                        type="button"
                        disabled={working}
                        className={
                          manager.is_active
                            ? "disable-manager-button"
                            : "enable-manager-button"
                        }
                        onClick={() =>
                          handleStatus(
                            manager.id,
                            manager.is_active
                          )
                        }
                      >
                        {working
                          ? "Updating…"
                          : manager.is_active
                            ? "Disable"
                            : "Enable"}
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}