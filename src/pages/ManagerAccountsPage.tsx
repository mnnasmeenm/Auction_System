import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  assignManagerTeam,
  createManagerAccount,
  getManagerAccounts,
  resetManagerTemporaryPassword,
  setManagerActive,
  updateManagerPhoto,
  type ManagerAccountData,
  type TemporaryCredentials
} from "../services/managerAccounts";
import { getManagerPhotoUrl } from "../services/managerPhotos";
import "./ManagerAccountsPage.css";

interface ManagerForm {
  fullName: string;
  email: string;
  teamId: string;
  photoFile: File | null;
}

const emptyForm: ManagerForm = {
  fullName: "",
  email: "",
  teamId: "",
  photoFile: null
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ManagerAccountsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [data, setData] = useState<ManagerAccountData | null>(null);
  const [form, setForm] = useState<ManagerForm>(emptyForm);
  const [photoPreview, setPhotoPreview] = useState("");
  const [credentials, setCredentials] =
    useState<TemporaryCredentials | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadAccounts = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setData(await getManagerAccounts(tournamentId));
      setErrorMessage("");
    } catch (error) {
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

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const filteredManagers = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    if (!query) return data.managers;

    return data.managers.filter((manager) => {
      const team = data.teams.find((item) => item.id === manager.team_id);

      return [manager.full_name, manager.email, team?.name]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [data, search]);

  function updateForm(field: keyof ManagerForm, value: string | File | null) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateForm("photoFile", file);

    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setErrorMessage("Enter the manager name.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Enter the manager email.");
      return;
    }

    if (!form.teamId) {
      setErrorMessage("Select a team.");
      return;
    }

    if (!form.photoFile) {
      setErrorMessage("Select a manager photograph.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await createManagerAccount({
        tournamentId,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        teamId: form.teamId,
        photoFile: form.photoFile
      });

      setCredentials(result);
      setSuccessMessage(result.message);
      setForm(emptyForm);

      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview("");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Manager account could not be created."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignment(managerId: string, teamId: string) {
    setWorkingId(managerId);
    setErrorMessage("");

    try {
      const result = await assignManagerTeam({
        tournamentId,
        managerId,
        teamId: teamId || null
      });

      setSuccessMessage(result.message ?? "Manager assignment updated.");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Assignment failed."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleStatus(managerId: string, isActive: boolean) {
    const active = !isActive;
    const confirmed = window.confirm(
      active
        ? "Enable this manager account?"
        : "Disable this manager account? The manager will lose portal access."
    );

    if (!confirmed) return;
    setWorkingId(managerId);
    setErrorMessage("");

    try {
      const result = await setManagerActive({
        tournamentId,
        managerId,
        active
      });

      setSuccessMessage(result.message ?? "Manager status updated.");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Status update failed."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handlePasswordReset(managerId: string) {
    if (!window.confirm("Generate a new temporary password for this manager?")) {
      return;
    }

    setWorkingId(managerId);
    setErrorMessage("");

    try {
      const result = await resetManagerTemporaryPassword({
        tournamentId,
        managerId
      });

      setCredentials(result);
      setSuccessMessage(result.message);
      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Password reset failed."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleExistingPhoto(
    event: ChangeEvent<HTMLInputElement>,
    managerId: string,
    existingPhotoPath: string | null
  ) {
    const photoFile = event.target.files?.[0];
    event.target.value = "";
    if (!photoFile) return;

    setWorkingId(managerId);
    setErrorMessage("");

    try {
      const result = await updateManagerPhoto({
        tournamentId,
        managerId,
        existingPhotoPath,
        photoFile
      });

      setSuccessMessage(result.message ?? "Manager photograph updated.");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Photo update failed."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;

    await navigator.clipboard.writeText(
      `Ath-Thariq Auction Manager Login\nEmail: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}\nLogin: ${window.location.origin}/login`
    );

    setSuccessMessage("Temporary login details copied.");
  }

  if (!tournamentId) {
    return (
      <main className="manager-accounts-page">
        <section className="manager-accounts-empty">
          <h1>Tournament not selected</h1>
          <button type="button" onClick={() => navigate("/admin/tournaments")}>
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
        <p className="page-label">ACCESS MANAGEMENT</p>
        <h1>Team managers</h1>
        <p>Create manager logins without invitation emails.</p>
      </header>

      {errorMessage && <div className="form-error">{errorMessage}</div>}
      {successMessage && (
        <div className="manager-account-success">{successMessage}</div>
      )}

      <section className="manager-create-panel">
        <div className="manager-create-heading">
          <div>
            <h2>Create manager account</h2>
            <p>A temporary password will be shown once after creation.</p>
          </div>

          <div className="manager-photo-preview">
            {photoPreview ? (
              <img src={photoPreview} alt="Manager preview" />
            ) : (
              <span>PHOTO</span>
            )}
          </div>
        </div>

        <form onSubmit={handleCreate}>
          <label>
            Manager name
            <input
              value={form.fullName}
              onChange={(event) => updateForm("fullName", event.target.value)}
              required
            />
          </label>

          <label>
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              autoComplete="off"
              required
            />
          </label>

          <label>
            Assigned team
            <select
              value={form.teamId}
              onChange={(event) => updateForm("teamId", event.target.value)}
              required
            >
              <option value="">Select team</option>
              {data?.teams.map((team) => (
                <option key={team.id} value={team.id} disabled={!team.is_active}>
                  {team.name}{!team.is_active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Manager photograph
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              required
            />
            <small>JPG, PNG or WebP. Maximum 2 MB.</small>
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? "Creating manager…" : "Create manager"}
          </button>
        </form>
      </section>

      <section className="manager-account-list-panel">
        <div className="manager-account-list-heading">
          <div>
            <h2>Manager accounts</h2>
            <p>{data?.managers.length ?? 0} account(s)</p>
          </div>

          <input
            type="search"
            value={search}
            placeholder="Search managers or teams…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {filteredManagers.length === 0 ? (
          <div className="manager-accounts-empty">No manager accounts found.</div>
        ) : (
          <div className="manager-account-list">
            {filteredManagers.map((manager) => {
              const assignedTeam = data?.teams.find(
                (team) => team.id === manager.team_id
              );
              const photoUrl = getManagerPhotoUrl(manager.manager_photo_path);
              const working = workingId === manager.id;

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
                    <div className="manager-list-photo">
                      {photoUrl ? (
                        <img src={photoUrl} alt={manager.full_name ?? "Manager"} />
                      ) : (
                        <span>{initials(manager.full_name ?? "Manager")}</span>
                      )}
                    </div>

                    <div>
                      <strong>{manager.full_name ?? "Unnamed manager"}</strong>
                      <small>{manager.email ?? "No email"}</small>
                      <label className="manager-photo-update">
                        Change photo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={working}
                          onChange={(event) =>
                            handleExistingPhoto(
                              event,
                              manager.id,
                              manager.manager_photo_path
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="manager-account-team">
                    <label>
                      Assigned team
                      <select
                        value={manager.team_id ?? ""}
                        disabled={working}
                        onChange={(event) =>
                          handleAssignment(manager.id, event.target.value)
                        }
                      >
                        <option value="">No team access</option>
                        {data?.teams.map((team) => (
                          <option
                            key={team.id}
                            value={team.id}
                            disabled={!team.is_active}
                          >
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>{assignedTeam?.short_name ?? "Unassigned"}</small>
                  </div>

                  <div className="manager-account-state">
                    <span className={manager.is_active ? "manager-enabled" : "manager-disabled"}>
                      {manager.is_active ? "Enabled" : "Disabled"}
                    </span>
                    {manager.must_change_password && (
                      <span className="manager-password-pending">Password change pending</span>
                    )}
                  </div>

                  <div className="manager-account-actions">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => handlePasswordReset(manager.id)}
                    >
                      New temporary password
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      className={manager.is_active ? "disable-manager-button" : "enable-manager-button"}
                      onClick={() => handleStatus(manager.id, manager.is_active)}
                    >
                      {working ? "Updating…" : manager.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {credentials && (
        <div className="credentials-overlay" role="presentation">
          <section
            className="credentials-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credentials-title"
          >
            <span className="credentials-lock">ONE-TIME LOGIN</span>
            <h2 id="credentials-title">Temporary manager credentials</h2>
            <p>
              Copy these details now. The password cannot be displayed again.
            </p>

            <div className="credential-row">
              <span>Email</span>
              <strong>{credentials.email}</strong>
            </div>

            <div className="credential-row temporary-password-row">
              <span>Temporary password</span>
              <strong>{credentials.temporaryPassword}</strong>
            </div>

            <small>
              The manager must create a new password immediately after signing in.
            </small>

            <div className="credentials-actions">
              <button type="button" onClick={copyCredentials}>
                Copy login details
              </button>
              <button type="button" onClick={() => setCredentials(null)}>
                I saved the details
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}