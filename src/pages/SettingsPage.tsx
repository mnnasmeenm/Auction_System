import {
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import {
  deleteCategories,
  getTournamentConfiguration,
  saveCategory,
  updateTournamentConfiguration,
  validateCategoryDeletion
} from "../services/settings";

import {
  deleteTournamentLogo,
  getTournamentBrandingUrl,
  uploadTournamentLogo
} from "../services/tournamentBranding";

import "./SettingsPage.css";

interface EditableCategory {
  key: string;
  id?: string;
  name: string;
  minimumRequired: string;
}

const DEFAULT_BID_INCREMENTS = [
  "100",
  "250",
  "500"
];

function createKey() {
  return (
    Date.now().toString() +
    Math.random().toString(36).slice(2)
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [societyName, setSocietyName] =
    useState("");

  const [tournamentName, setTournamentName] =
    useState("");

  const [publicSlug, setPublicSlug] =
    useState("");

  const [isPublic, setIsPublic] =
    useState(false);

  const [societyLogoPath, setSocietyLogoPath] =
    useState<string | null>(null);

  const [tournamentLogoPath, setTournamentLogoPath] =
    useState<string | null>(null);

  const [societyLogoFile, setSocietyLogoFile] =
    useState<File | null>(null);

  const [tournamentLogoFile, setTournamentLogoFile] =
    useState<File | null>(null);

  const [startingBudget, setStartingBudget] =
    useState("");

  const [maximumSquadSize, setMaximumSquadSize] =
    useState("");

  const [allowSaleRevocation, setAllowSaleRevocation] =
    useState(true);

  const [
    requireRevocationReason,
    setRequireRevocationReason
  ] = useState(true);

  const [
    applyDefaultsToUnusedTeams,
    setApplyDefaultsToUnusedTeams
  ] = useState(false);

  const [categories, setCategories] =
    useState<EditableCategory[]>([]);

  const [originalCategoryIds, setOriginalCategoryIds] =
    useState<string[]>([]);

  const [bidIncrements, setBidIncrements] =
    useState<string[]>(DEFAULT_BID_INCREMENTS);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadSettings();
  }, [tournamentId]);

  async function loadSettings() {
    setLoading(true);
    setErrorMessage("");

    try {
      const configuration =
        await getTournamentConfiguration(
          tournamentId
        );

      const tournament =
        configuration.tournament;

      setSocietyName(
        tournament.society_name
      );

      setTournamentName(
        tournament.tournament_name
      );

      setPublicSlug(
        tournament.public_slug ?? ""
      );

      setIsPublic(
        tournament.is_public ?? false
      );

      setSocietyLogoPath(
        tournament.society_logo_path ?? null
      );

      setTournamentLogoPath(
        tournament.tournament_logo_path ?? null
      );

      setSocietyLogoFile(null);
      setTournamentLogoFile(null);

      setStartingBudget(
        String(tournament.starting_budget)
      );

      setMaximumSquadSize(
        String(
          tournament.maximum_squad_size
        )
      );

      setAllowSaleRevocation(
        tournament.allow_sale_revocation
      );

      setRequireRevocationReason(
        tournament.require_revocation_reason
      );

      setCategories(
        configuration.categories.map(
          (category) => ({
            key: category.id,
            id: category.id,
            name: category.name,
            minimumRequired: String(
              category.minimum_required
            )
          })
        )
      );

      setOriginalCategoryIds(
        configuration.categories.map(
          (category) => category.id
        )
      );

      const loadedBidIncrements =
        configuration.bidIncrements
          .map((increment) =>
            String(increment.amount)
          )
          .filter((increment) =>
            Number(increment) > 0
          );

      setBidIncrements(
        loadedBidIncrements.length > 0
          ? loadedBidIncrements
          : DEFAULT_BID_INCREMENTS
      );
    } catch (error) {
      console.error(
        "Settings loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournament settings could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function addCategory() {
    setCategories((current) => [
      ...current,
      {
        key: createKey(),
        name: "",
        minimumRequired: "0"
      }
    ]);
  }

  function updateCategory(
    key: string,
    field: "name" | "minimumRequired",
    value: string
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.key === key
          ? {
              ...category,
              [field]: value
            }
          : category
      )
    );
  }

  function removeCategory(key: string) {
    setCategories((current) =>
      current.filter(
        (category) =>
          category.key !== key
      )
    );
  }

  function addIncrement() {
    setBidIncrements((current) => [
      ...current,
      ""
    ]);
  }

  function updateIncrement(
    index: number,
    value: string
  ) {
    setBidIncrements((current) =>
      current.map(
        (increment, incrementIndex) =>
          incrementIndex === index
            ? value
            : increment
      )
    );
  }

  function removeIncrement(index: number) {
    setBidIncrements((current) =>
      current.filter(
        (_, incrementIndex) =>
          incrementIndex !== index
      )
    );
  }

  const deletedCategoryIds =
    useMemo(() => {
      const retainedIds = new Set(
        categories
          .map((category) => category.id)
          .filter(
            (id): id is string =>
              Boolean(id)
          )
      );

      return originalCategoryIds.filter(
        (id) => !retainedIds.has(id)
      );
    }, [
      categories,
      originalCategoryIds
    ]);

  function validateForm(): string | null {
    if (!societyName.trim()) {
      return "Society name is required.";
    }

    if (!tournamentName.trim()) {
      return "Tournament name is required.";
    }

    if (isPublic && !publicSlug.trim()) {
      return "Enter a public URL name before publishing the tournament.";
    }

    if (
      publicSlug.trim() &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug.trim())
    ) {
      return "The public URL may contain lowercase letters, numbers and single hyphens only.";
    }

    if (Number(startingBudget) <= 0) {
      return "Starting points must be greater than zero.";
    }

    if (Number(maximumSquadSize) <= 0) {
      return "Squad size must be greater than zero.";
    }

    const validCategories =
      categories.filter(
        (category) =>
          category.name.trim()
      );

    if (validCategories.length === 0) {
      return "At least one player category is required.";
    }

    const normalizedNames =
      validCategories.map(
        (category) =>
          category.name
            .trim()
            .toLowerCase()
      );

    if (
      new Set(normalizedNames).size !==
      normalizedNames.length
    ) {
      return "Category names cannot be duplicated.";
    }

    const totalMinimum =
      validCategories.reduce(
        (total, category) =>
          total +
          Number(
            category.minimumRequired || 0
          ),
        0
      );

    if (
      totalMinimum >
      Number(maximumSquadSize)
    ) {
      return (
        "The total minimum category requirement " +
        "cannot exceed the squad size."
      );
    }

    const validIncrements =
      bidIncrements
        .map(Number)
        .filter(
          (increment) =>
            increment > 0
        );

    if (validIncrements.length === 0) {
      return "At least one bid increment is required.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await validateCategoryDeletion(
        deletedCategoryIds
      );

      const uniqueIncrements = [
        ...new Set(
          bidIncrements
            .map(Number)
            .filter(
              (increment) =>
                increment > 0
            )
        )
      ].sort(
        (first, second) =>
          first - second
      );

      let nextSocietyLogoPath = societyLogoPath;
      let nextTournamentLogoPath = tournamentLogoPath;

      if (societyLogoFile) {
        nextSocietyLogoPath = await uploadTournamentLogo(
          tournamentId,
          "society",
          societyLogoFile
        );
      }

      if (tournamentLogoFile) {
        nextTournamentLogoPath = await uploadTournamentLogo(
          tournamentId,
          "tournament",
          tournamentLogoFile
        );
      }

      await updateTournamentConfiguration({
        tournamentId,
        societyName:
          societyName.trim(),
        tournamentName:
          tournamentName.trim(),
        societyLogoPath: nextSocietyLogoPath,
        tournamentLogoPath: nextTournamentLogoPath,
        publicSlug: publicSlug.trim() || null,
        isPublic,
        startingBudget:
          Number(startingBudget),
        maximumSquadSize:
          Number(maximumSquadSize),
        allowSaleRevocation,
        requireRevocationReason:
          allowSaleRevocation &&
          requireRevocationReason,
        bidIncrements:
          uniqueIncrements,
        applyDefaultsToUnusedTeams
      });

      if (
        societyLogoFile &&
        societyLogoPath &&
        societyLogoPath !== nextSocietyLogoPath
      ) {
        await deleteTournamentLogo(societyLogoPath).catch(
          (cleanupError) => console.warn(
            "Old society logo cleanup failed:",
            cleanupError
          )
        );
      }

      if (
        tournamentLogoFile &&
        tournamentLogoPath &&
        tournamentLogoPath !== nextTournamentLogoPath
      ) {
        await deleteTournamentLogo(tournamentLogoPath).catch(
          (cleanupError) => console.warn(
            "Old tournament logo cleanup failed:",
            cleanupError
          )
        );
      }

      const validCategories =
        categories.filter(
          (category) =>
            category.name.trim()
        );

      for (
        let index = 0;
        index < validCategories.length;
        index += 1
      ) {
        const category =
          validCategories[index];

        await saveCategory({
          id: category.id,
          tournamentId,
          name: category.name,
          minimumRequired:
            Number(
              category.minimumRequired || 0
            ),
          displayOrder: index
        });
      }

      await deleteCategories(
        deletedCategoryIds
      );

      setSuccessMessage(
        "Tournament settings updated successfully."
      );

      await loadSettings();
    } catch (error) {
      console.error(
        "Settings update error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournament settings could not be updated."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!tournamentId) {
    return (
      <main className="settings-page">
        <section className="settings-message">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/admin/tournaments"
              )
            }
          >
            Return to tournaments
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="settings-page">
        <section className="settings-message">
          Loading settings…
        </section>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <button
          type="button"
          className="settings-back-button"
          onClick={() =>
            navigate(
              `/admin/tournaments/${tournamentId}`
            )
          }
        >
          ← Tournament dashboard
        </button>

        <p className="page-label">
          TOURNAMENT SETTINGS
        </p>

        <h1>Edit configuration</h1>

        <p>
          Changes apply only to this tournament.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="settings-success">
          {successMessage}
        </div>
      )}

      <form
        className="settings-form"
        onSubmit={handleSubmit}
      >
        <section className="settings-panel">
          <h2>Event information</h2>

          <div className="settings-branding-grid">
            <label className="settings-logo-field">
              <span>Society logo</span>

              <div className="settings-logo-preview">
                {societyLogoPath ? (
                  <img
                    src={getTournamentBrandingUrl(societyLogoPath) ?? ""}
                    alt="Society logo"
                  />
                ) : (
                  <strong>AW</strong>
                )}
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setSocietyLogoFile(event.target.files?.[0] ?? null)
                }
              />

              <small>
                {societyLogoFile
                  ? `Selected: ${societyLogoFile.name}`
                  : "JPG, PNG or WebP. Maximum 2 MB."}
              </small>
            </label>

            <label className="settings-logo-field">
              <span>Tournament logo</span>

              <div className="settings-logo-preview">
                {tournamentLogoPath ? (
                  <img
                    src={getTournamentBrandingUrl(tournamentLogoPath) ?? ""}
                    alt="Tournament logo"
                  />
                ) : (
                  <strong>TC</strong>
                )}
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setTournamentLogoFile(event.target.files?.[0] ?? null)
                }
              />

              <small>
                {tournamentLogoFile
                  ? `Selected: ${tournamentLogoFile.name}`
                  : "JPG, PNG or WebP. Maximum 2 MB."}
              </small>
            </label>
          </div>

          <div className="settings-form-grid">
            <label>
              Society name

              <input
                value={societyName}
                onChange={(event) =>
                  setSocietyName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Tournament name

              <input
                value={tournamentName}
                onChange={(event) =>
                  setTournamentName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Default team points

              <input
                type="number"
                min="1"
                value={startingBudget}
                onChange={(event) =>
                  setStartingBudget(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Default squad limit

              <input
                type="number"
                min="1"
                value={maximumSquadSize}
                onChange={(event) =>
                  setMaximumSquadSize(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={
                applyDefaultsToUnusedTeams
              }
              onChange={(event) =>
                setApplyDefaultsToUnusedTeams(
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Apply new defaults to unused teams
              </strong>

              <small>
                Teams that already own players will not be
                changed.
              </small>
            </span>
          </label>
        </section>

        <section className="settings-panel settings-public-panel">
          <div className="settings-section-heading">
            <div>
              <h2>Public match centre</h2>
              <p>
                Publish scheduled matches, live scores and completed
                scorecards without requiring a login.
              </p>
            </div>

            {isPublic && publicSlug && (
              <a
                href={`/t/${publicSlug}`}
                target="_blank"
                rel="noreferrer"
              >
                Open public page ↗
              </a>
            )}
          </div>

          <div className="settings-form-grid">
            <label>
              Public URL name

              <input
                value={publicSlug}
                onChange={(event) =>
                  setPublicSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-/, "")
                  )
                }
                placeholder="arakyala-super-league"
              />

              <small>
                Public address: /t/{publicSlug || "your-tournament"}
              </small>
            </label>
          </div>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />

            <span>
              <strong>Make this tournament public</strong>
              <small>
                Only matches separately marked Published in Schedule are
                visible to the public.
              </small>
            </span>
          </label>
        </section>

        <section className="settings-panel">
          <div className="settings-section-heading">
            <div>
              <h2>Player categories</h2>

              <p>
                A category assigned to players cannot be
                deleted.
              </p>
            </div>

            <button
              type="button"
              onClick={addCategory}
            >
              + Add category
            </button>
          </div>

          <div className="settings-category-list">
            {categories.map(
              (category) => (
                <div
                  className="settings-category-row"
                  key={category.key}
                >
                  <label>
                    Category name

                    <input
                      value={category.name}
                      onChange={(event) =>
                        updateCategory(
                          category.key,
                          "name",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Minimum required

                    <input
                      type="number"
                      min="0"
                      value={
                        category.minimumRequired
                      }
                      onChange={(event) =>
                        updateCategory(
                          category.key,
                          "minimumRequired",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="settings-remove-button"
                    onClick={() =>
                      removeCategory(
                        category.key
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-section-heading">
            <div>
              <h2>Bid increments</h2>

              <p>
                Available to the administrator during player
                allocation.
              </p>
            </div>

            <button
              type="button"
              onClick={addIncrement}
            >
              + Add increment
            </button>
          </div>

          <div className="settings-increment-list">
            {bidIncrements.map(
              (increment, index) => (
                <div key={index}>
                  <input
                    type="number"
                    min="1"
                    value={increment}
                    onChange={(event) =>
                      updateIncrement(
                        index,
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    className="settings-remove-button"
                    onClick={() =>
                      removeIncrement(index)
                    }
                  >
                    Remove
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        <section className="settings-panel">
          <h2>Sale revocation</h2>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={allowSaleRevocation}
              onChange={(event) => {
                const allowed =
                  event.target.checked;

                setAllowSaleRevocation(
                  allowed
                );

                if (!allowed) {
                  setRequireRevocationReason(
                    false
                  );
                }
              }}
            />

            <span>
              <strong>
                Allow sale revocation
              </strong>

              <small>
                Administrators may release a sold player and
                refund the team’s points.
              </small>
            </span>
          </label>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              disabled={!allowSaleRevocation}
              checked={
                requireRevocationReason
              }
              onChange={(event) =>
                setRequireRevocationReason(
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Require a revocation reason
              </strong>

              <small>
                The reason remains in tournament history.
              </small>
            </span>
          </label>
        </section>

        <div className="settings-submit-area">
          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Saving settings…"
              : "Save settings"}
          </button>
        </div>
      </form>
    </main>
  );
}
