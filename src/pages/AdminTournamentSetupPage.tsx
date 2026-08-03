import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  type CategoryInput,
  createTournamentSetup
} from "../services/tournamentSetup";

const initialCategories: CategoryInput[] = [
  {
    name: "Batsman",
    minimumRequired: 0
  },
  {
    name: "Bowler",
    minimumRequired: 0
  },
  {
    name: "All-rounder",
    minimumRequired: 0
  },
  {
    name: "Wicketkeeper",
    minimumRequired: 0
  }
];

export default function AdminTournamentSetupPage() {
  const navigate = useNavigate();

  const [societyName, setSocietyName] = useState(
    "Aththariq Welfare Society"
  );

  const [tournamentName, setTournamentName] = useState("");
  const [startingBudget, setStartingBudget] = useState("");
  const [maximumSquadSize, setMaximumSquadSize] = useState("");

  const [categories, setCategories] =
    useState<CategoryInput[]>(initialCategories);

  const [bidIncrements, setBidIncrements] =
    useState<string[]>(["100", "250", "500"]);

  const [allowSaleRevocation, setAllowSaleRevocation] =
    useState(true);

  const [requireRevocationReason, setRequireRevocationReason] =
    useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdTournamentId, setCreatedTournamentId] =
    useState("");

  function updateCategory(
    index: number,
    field: keyof CategoryInput,
    value: string
  ) {
    setCategories((currentCategories) =>
      currentCategories.map((category, categoryIndex) => {
        if (categoryIndex !== index) {
          return category;
        }

        if (field === "minimumRequired") {
          return {
            ...category,
            minimumRequired: Math.max(0, Number(value))
          };
        }

        return {
          ...category,
          name: value
        };
      })
    );
  }

  function addCategory() {
    setCategories((currentCategories) => [
      ...currentCategories,
      {
        name: "",
        minimumRequired: 0
      }
    ]);
  }

  function removeCategory(index: number) {
    setCategories((currentCategories) =>
      currentCategories.filter(
        (_, categoryIndex) => categoryIndex !== index
      )
    );
  }

  function updateIncrement(index: number, value: string) {
    setBidIncrements((currentIncrements) =>
      currentIncrements.map(
        (increment, incrementIndex) =>
          incrementIndex === index ? value : increment
      )
    );
  }

  function addIncrement() {
    setBidIncrements((currentIncrements) => [
      ...currentIncrements,
      ""
    ]);
  }

  function removeIncrement(index: number) {
    setBidIncrements((currentIncrements) =>
      currentIncrements.filter(
        (_, incrementIndex) => incrementIndex !== index
      )
    );
  }

  function validateForm(): string | null {
    if (!societyName.trim()) {
      return "Enter the society name.";
    }

    if (!tournamentName.trim()) {
      return "Enter the tournament name.";
    }

    if (Number(startingBudget) <= 0) {
      return "Starting budget must be greater than zero.";
    }

    if (Number(maximumSquadSize) <= 0) {
      return "Maximum squad size must be greater than zero.";
    }

    const validCategories = categories.filter((category) =>
      category.name.trim()
    );

    if (validCategories.length === 0) {
      return "Add at least one player category.";
    }

    const categoryNames = validCategories.map((category) =>
      category.name.trim().toLowerCase()
    );

    if (new Set(categoryNames).size !== categoryNames.length) {
      return "Player categories cannot contain duplicate names.";
    }

    const totalMinimumPlayers = validCategories.reduce(
      (total, category) =>
        total + Number(category.minimumRequired),
      0
    );

    if (
      totalMinimumPlayers >
      Number(maximumSquadSize)
    ) {
      return (
        "The total minimum category requirement cannot " +
        "exceed the maximum squad size."
      );
    }

    const validIncrements = bidIncrements
      .map(Number)
      .filter((increment) => increment > 0);

    if (validIncrements.length === 0) {
      return "Add at least one valid bid increment.";
    }

    return null;
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
    setCreatedTournamentId("");

    try {
      const tournamentId = await createTournamentSetup({
        societyName: societyName.trim(),
        tournamentName: tournamentName.trim(),
        startingBudget: Number(startingBudget),
        maximumSquadSize: Number(maximumSquadSize),

        categories: categories
          .filter((category) => category.name.trim())
          .map((category) => ({
            name: category.name.trim(),
            minimumRequired:
              Number(category.minimumRequired)
          })),

        bidIncrements: [
          ...new Set(
            bidIncrements
              .map(Number)
              .filter((increment) => increment > 0)
          )
        ].sort(
          (firstIncrement, secondIncrement) =>
            firstIncrement - secondIncrement
        ),

        allowSaleRevocation,
        requireRevocationReason:
          allowSaleRevocation &&
          requireRevocationReason
      });

      setCreatedTournamentId(tournamentId);
    } catch (error) {
      console.error("Tournament creation error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The tournament could not be created."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (createdTournamentId) {
    return (
      <main className="setup-page">
        <section className="success-panel">
          <span>✓</span>

          <div>
            <h2>Tournament created successfully</h2>

            <p>
              The tournament settings, categories and bid
              increments have been saved.
            </p>

            <button
              type="button"
              className="continue-button"
              onClick={() =>
                navigate(
                  `/admin/teams?tournament=${createdTournamentId}`
                )
              }
            >
              Continue to team setup
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="setup-page">
      <header className="setup-header">
        <div>
          <p className="page-label">ADMIN SETUP</p>

          <h1>Create tournament</h1>

          <p>
            Configure the tournament before adding teams and
            registered players.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="setup-form">
        <section className="setup-panel">
          <div className="section-heading">
            <p>01</p>

            <div>
              <h2>Event information</h2>
              <span>Name and identify the tournament.</span>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Society name

              <input
                value={societyName}
                onChange={(event) =>
                  setSocietyName(event.target.value)
                }
                required
              />
            </label>

            <label>
              Tournament name

              <input
                value={tournamentName}
                onChange={(event) =>
                  setTournamentName(event.target.value)
                }
                placeholder="Example: Village Premier League 2026"
                required
              />
            </label>
          </div>
        </section>

        <section className="setup-panel">
          <div className="section-heading">
            <p>02</p>

            <div>
              <h2>Budget and squad</h2>

              <span>
                Configure team budgets and squad limitations.
              </span>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Starting budget per team (LKR)

              <input
                type="number"
                min="1"
                value={startingBudget}
                onChange={(event) =>
                  setStartingBudget(event.target.value)
                }
                placeholder="Example: 50000"
                required
              />
            </label>

            <label>
              Maximum players per team

              <input
                type="number"
                min="1"
                value={maximumSquadSize}
                onChange={(event) =>
                  setMaximumSquadSize(event.target.value)
                }
                placeholder="Example: 12"
                required
              />
            </label>
          </div>
        </section>

        <section className="setup-panel">
          <div className="section-heading">
            <p>03</p>

            <div>
              <h2>Player categories</h2>

              <span>
                Add, remove or rename categories and configure
                minimum requirements.
              </span>
            </div>
          </div>

          <div className="editable-list">
            {categories.map((category, index) => (
              <div
                className="category-entry"
                key={`category-${index}`}
              >
                <label>
                  Category name

                  <input
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(
                        index,
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Example: Bowler"
                  />
                </label>

                <label>
                  Minimum required per team

                  <input
                    type="number"
                    min="0"
                    value={category.minimumRequired}
                    onChange={(event) =>
                      updateCategory(
                        index,
                        "minimumRequired",
                        event.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeCategory(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-button"
            onClick={addCategory}
          >
            + Add category
          </button>
        </section>

        <section className="setup-panel">
          <div className="section-heading">
            <p>04</p>

            <div>
              <h2>Bid increments</h2>

              <span>
                These point increments will be available to the
                auction operator.
              </span>
            </div>
          </div>

          <div className="increment-list">
            {bidIncrements.map((increment, index) => (
              <div
                className="increment-entry"
                key={`increment-${index}`}
              >
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
                  placeholder="Increment"
                />

                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeIncrement(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-button"
            onClick={addIncrement}
          >
            + Add increment
          </button>
        </section>

        <section className="setup-panel">
          <div className="section-heading">
            <p>05</p>

            <div>
              <h2>Sale revocation</h2>

              <span>
                Configure whether administrators may release a
                previously sold player.
              </span>
            </div>
          </div>

          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={allowSaleRevocation}
              onChange={(event) => {
                const allowed = event.target.checked;

                setAllowSaleRevocation(allowed);

                if (!allowed) {
                  setRequireRevocationReason(false);
                }
              }}
            />

            <span>
              <strong>Allow sale revocation</strong>

              <small>
                Administrators can return a sold player for
                re-auction and refund the team’s balance.
              </small>
            </span>
          </label>

          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={requireRevocationReason}
              disabled={!allowSaleRevocation}
              onChange={(event) =>
                setRequireRevocationReason(
                  event.target.checked
                )
              }
            />

            <span>
              <strong>Require a reason</strong>

              <small>
                The administrator must record why the sale was
                revoked.
              </small>
            </span>
          </label>
        </section>

        {errorMessage && (
          <div className="form-error">
            {errorMessage}
          </div>
        )}

        <div className="submit-area">
          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Creating tournament…"
              : "Create tournament"}
          </button>
        </div>
      </form>
    </main>
  );
}