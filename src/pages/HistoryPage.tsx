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
  getSaleHistory,
  revokeSale,
  type SaleHistoryRecord
} from "../services/history";

import {
  getPlayerPhotoUrl
} from "../services/playerPhotos";

import {
  getTeamLogoUrl
} from "../services/teams";

import "./HistoryPage.css";

type HistoryFilter =
  | "all"
  | "active"
  | "revoked";

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-LK").format(value);
}

function formatDate(date: string | null) {
  if (!date) {
    return "Not available";
  }

  return new Date(date).toLocaleString(
    "en-LK",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

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

export default function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tournamentId =
    searchParams.get("tournament") ?? "";

  const [sales, setSales] =
    useState<SaleHistoryRecord[]>([]);

  const [filter, setFilter] =
    useState<HistoryFilter>("all");

  const [searchText, setSearchText] =
    useState("");

  const [selectedSale, setSelectedSale] =
    useState<SaleHistoryRecord | null>(null);

  const [revokeReason, setRevokeReason] =
    useState("");

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

    loadHistory();
  }, [tournamentId]);

  async function loadHistory() {
    setLoading(true);
    setErrorMessage("");

    try {
      const records =
        await getSaleHistory(tournamentId);

      setSales(records);
    } catch (error) {
      console.error(
        "History loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sale history could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredSales = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          !sale.is_revoked) ||
        (filter === "revoked" &&
          sale.is_revoked);

      const matchesSearch =
        !normalizedSearch ||
        sale.player.full_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        sale.team.name
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [
    sales,
    filter,
    searchText
  ]);

  const totalActiveValue = useMemo(
    () =>
      sales
        .filter((sale) => !sale.is_revoked)
        .reduce(
          (total, sale) =>
            total + sale.sold_price,
          0
        ),
    [sales]
  );

  function openRevocation(
    sale: SaleHistoryRecord
  ) {
    setSelectedSale(sale);
    setRevokeReason("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeRevocation() {
    if (submitting) {
      return;
    }

    setSelectedSale(null);
    setRevokeReason("");
  }

  async function handleRevocation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedSale) {
      return;
    }

    if (!revokeReason.trim()) {
      setErrorMessage(
        "Enter the reason for revoking this sale."
      );

      return;
    }

    const confirmed = window.confirm(
      `Release ${selectedSale.player.full_name} ` +
      `from ${selectedSale.team.name} and refund ` +
      `${formatPoints(
        selectedSale.sold_price
      )} points?`
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await revokeSale(
        tournamentId,
        selectedSale.id,
        revokeReason.trim()
      );

      setSuccessMessage(
        `${selectedSale.player.full_name} was released. ` +
        `${formatPoints(
          selectedSale.sold_price
        )} points were refunded to ` +
        `${selectedSale.team.name}.`
      );

      setSelectedSale(null);
      setRevokeReason("");

      await loadHistory();
    } catch (error) {
      console.error(
        "Revocation error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The sale could not be revoked."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!tournamentId) {
    return (
      <main className="history-page">
        <section className="history-empty">
          <h1>Tournament not selected</h1>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/tournaments")
            }
          >
            Return to tournaments
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="history-page">
      <header className="history-header">
        <div>
          <button
            type="button"
            className="history-back-button"
            onClick={() =>
              navigate(
                `/admin/tournaments/${tournamentId}`
              )
            }
          >
            ← Tournament dashboard
          </button>

          <p className="page-label">
            ALLOCATION HISTORY
          </p>

          <h1>Sales and revocations</h1>

          <p>
            Review completed player allocations and approved
            releases.
          </p>
        </div>
      </header>

      <section className="history-statistics">
        <article>
          <span>Total sale records</span>
          <strong>{sales.length}</strong>
        </article>

        <article>
          <span>Active allocations</span>

          <strong>
            {
              sales.filter(
                (sale) => !sale.is_revoked
              ).length
            }
          </strong>
        </article>

        <article>
          <span>Revoked allocations</span>

          <strong>
            {
              sales.filter(
                (sale) => sale.is_revoked
              ).length
            }
          </strong>
        </article>

        <article>
          <span>Current allocated value</span>

          <strong>
            {formatPoints(totalActiveValue)}
            <small> PTS</small>
          </strong>
        </article>
      </section>

      {errorMessage && (
        <div className="form-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="history-success">
          {successMessage}
        </div>
      )}

      <section className="history-controls">
        <input
          value={searchText}
          onChange={(event) =>
            setSearchText(event.target.value)
          }
          placeholder="Search player or team…"
        />

        <button
          type="button"
          className={
            filter === "all"
              ? "selected-history-filter"
              : ""
          }
          onClick={() => setFilter("all")}
        >
          All
        </button>

        <button
          type="button"
          className={
            filter === "active"
              ? "selected-history-filter"
              : ""
          }
          onClick={() => setFilter("active")}
        >
          Active
        </button>

        <button
          type="button"
          className={
            filter === "revoked"
              ? "selected-history-filter"
              : ""
          }
          onClick={() => setFilter("revoked")}
        >
          Revoked
        </button>
      </section>

      {loading ? (
        <section className="history-empty">
          Loading history…
        </section>
      ) : filteredSales.length === 0 ? (
        <section className="history-empty">
          <h2>No matching sale records</h2>

          <p>
            Completed sales will appear here.
          </p>
        </section>
      ) : (
        <section className="history-list">
          {filteredSales.map((sale) => {
            const playerPhoto =
              getPlayerPhotoUrl(
                sale.player.photo_path
              );

            const teamLogo =
              getTeamLogoUrl(
                sale.team.logo_path
              );

            return (
              <article
                className={`history-record ${
                  sale.is_revoked
                    ? "revoked-history-record"
                    : ""
                }`}
                key={sale.id}
              >
                <div className="history-player">
                  {playerPhoto ? (
                    <img
                      src={playerPhoto}
                      alt={sale.player.full_name}
                    />
                  ) : (
                    <span>
                      {getInitials(
                        sale.player.full_name
                      )}
                    </span>
                  )}

                  <div>
                    <small>PLAYER</small>

                    <strong>
                      {sale.player.full_name}
                    </strong>

                    {sale.player.player_number && (
                      <p>
                        #{sale.player.player_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="history-arrow">
                  →
                </div>

                <div className="history-team">
                  {teamLogo ? (
                    <img
                      src={teamLogo}
                      alt={sale.team.name}
                    />
                  ) : (
                    <span
                      style={{
                        color:
                          sale.team.team_color,
                        borderColor:
                          sale.team.team_color
                      }}
                    >
                      {sale.team.short_name}
                    </span>
                  )}

                  <div>
                    <small>TEAM</small>

                    <strong>
                      {sale.team.name}
                    </strong>
                  </div>
                </div>

                <div className="history-value">
                  <small>FINAL VALUE</small>

                  <strong>
                    {formatPoints(
                      sale.sold_price
                    )}
                    <span> PTS</span>
                  </strong>

                  <p>{formatDate(sale.sold_at)}</p>
                </div>

                <div className="history-status">
                  <span
                    className={
                      sale.is_revoked
                        ? "revoked-status"
                        : "active-sale-status"
                    }
                  >
                    {sale.is_revoked
                      ? "Revoked"
                      : "Active"}
                  </span>

                  {sale.is_revoked ? (
                    <>
                      <p>
                        {sale.revoke_reason}
                      </p>

                      <small>
                        {formatDate(
                          sale.revoked_at
                        )}
                      </small>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openRevocation(sale)
                      }
                    >
                      Revoke sale
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedSale && (
        <div className="revocation-overlay">
          <form
            className="revocation-dialog"
            onSubmit={handleRevocation}
          >
            <h2>Revoke player sale</h2>

            <p>
              Release{" "}
              <strong>
                {selectedSale.player.full_name}
              </strong>{" "}
              from{" "}
              <strong>
                {selectedSale.team.name}
              </strong>
              .
            </p>

            <div className="revocation-refund">
              <span>Points to refund</span>

              <strong>
                {formatPoints(
                  selectedSale.sold_price
                )}{" "}
                PTS
              </strong>
            </div>

            <label>
              Reason for revocation

              <textarea
                value={revokeReason}
                onChange={(event) =>
                  setRevokeReason(
                    event.target.value
                  )
                }
                placeholder="Explain why the player is being released…"
                required
              />
            </label>

            <div className="revocation-actions">
              <button
                type="button"
                onClick={closeRevocation}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Revoking…"
                  : "Confirm revocation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}