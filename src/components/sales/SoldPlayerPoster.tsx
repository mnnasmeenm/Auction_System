import {
  forwardRef,
  type CSSProperties,
  useImperativeHandle,
  useRef,
  useState
} from "react";

import {
  toPng
} from "html-to-image";

import type {
  Tournament
} from "../../types/database";

import type {
  SaleHistoryRecord
} from "../../services/history";

import {
  getPlayerPhotoUrl
} from "../../services/playerPhotos";

import {
  getTeamLogoUrl
} from "../../services/teams";

import {
  getTournamentBrandingUrl
} from "../../services/tournamentBranding";

import "./SoldPlayerPoster.css";

function formatLkr(value: number) {
  return new Intl.NumberFormat("en-LK").format(value);
}

function initials(name: string) {
  return name
    .replaceAll(".", "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function safeSoldPosterFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";
}

export function getSoldPosterFileName(
  sale: SaleHistoryRecord
) {
  const playerNumber =
    sale.player.player_number !== null
      ? `-${sale.player.player_number}`
      : "";

  return (
    `${safeSoldPosterFileName(sale.player.full_name)}` +
    `${playerNumber}-sold.png`
  );
}

async function waitForImages(element: HTMLElement) {
  const images = Array.from(
    element.querySelectorAll("img")
  );

  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener(
            "load",
            () => resolve(),
            { once: true }
          );

          image.addEventListener(
            "error",
            () => resolve(),
            { once: true }
          );
        });
      }

      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }
    })
  );
}

export interface SoldPlayerPosterHandle {
  generatePng: () => Promise<string>;
  getFileName: () => string;
}

interface SoldPlayerPosterProps {
  tournament: Tournament;
  sale: SaleHistoryRecord;
  showDownloadButton?: boolean;
}

const SoldPlayerPoster = forwardRef<
  SoldPlayerPosterHandle,
  SoldPlayerPosterProps
>(function SoldPlayerPoster({
  tournament,
  sale,
  showDownloadButton = true
}, forwardedRef) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const playerPhoto = getPlayerPhotoUrl(
    sale.player.photo_path
  );

  const teamLogo = getTeamLogoUrl(
    sale.team.logo_path
  );

  const societyLogo = getTournamentBrandingUrl(
    tournament.society_logo_path
  );

  const tournamentLogo = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );

  async function generatePosterPng() {
    if (!posterRef.current) {
      throw new Error("The SOLD poster is not ready yet.");
    }

    await document.fonts.ready;
    await waitForImages(posterRef.current);

    return toPng(
      posterRef.current,
      {
        cacheBust: true,
        pixelRatio: 1.6,
        backgroundColor: "#030817",
        width: 1200,
        height: 675,
        style: {
          width: "1200px",
          height: "675px",
          maxWidth: "none"
        }
      }
    );
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      generatePng: generatePosterPng,
      getFileName: () => getSoldPosterFileName(sale)
    }),
    [sale]
  );

  async function downloadPoster() {
    if (downloading) {
      return;
    }

    setDownloading(true);
    setDownloadError("");

    try {
      const image = await generatePosterPng();

      const link = document.createElement("a");
      link.download = getSoldPosterFileName(sale);

      link.href = image;
      link.click();
    } catch (error) {
      console.error("Sold poster download error:", error);

      setDownloadError(
        error instanceof Error
          ? error.message
          : "The SOLD poster could not be downloaded."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="sold-poster-showcase">
      <div className="sold-poster-preview-scroll">
        <div
          ref={posterRef}
          className="sold-player-poster"
          style={{
            "--sold-team-color": sale.team.team_color
          } as CSSProperties}
        >
          <div className="sold-poster-grid" />
          <div className="sold-poster-slash sold-poster-slash-one" />
          <div className="sold-poster-slash sold-poster-slash-two" />
          <div className="sold-poster-glow" />

          {teamLogo && (
            <img
              className="sold-poster-watermark"
              src={teamLogo}
              alt=""
              aria-hidden="true"
            />
          )}

          <header className="sold-poster-header">
            <div className="sold-poster-brand">
              <div className="sold-poster-brand-logos">
                {societyLogo && (
                  <img
                    src={societyLogo}
                    alt={`${tournament.society_name} logo`}
                  />
                )}

                {tournamentLogo && (
                  <img
                    src={tournamentLogo}
                    alt={`${tournament.tournament_name} logo`}
                  />
                )}
              </div>

              <div>
                <strong>{tournament.society_name}</strong>
                <span>
                  {tournament.tournament_name} • PLAYER AUCTION
                </span>
              </div>
            </div>

            <b>OFFICIAL SALE</b>
          </header>

          <div className="sold-poster-content">
            <article className="sold-poster-player-card">
              <div className="sold-poster-player-photo">
                {playerPhoto ? (
                  <img
                    src={playerPhoto}
                    alt={sale.player.full_name}
                  />
                ) : (
                  <span>
                    {initials(sale.player.full_name)}
                  </span>
                )}

                {sale.player.player_number !== null && (
                  <b>
                    PLAYER NO. {sale.player.player_number}
                  </b>
                )}
              </div>

              <div className="sold-poster-player-copy">
                <span className="sold-poster-category">
                  {sale.player.category?.name ?? "PLAYER"}
                </span>

                <h1>{sale.player.full_name}</h1>

                {sale.player.nickname && (
                  <p>“{sale.player.nickname}”</p>
                )}

                <div className="sold-poster-statistics">
                  <div>
                    <strong>
                      {sale.player.batting_style ?? "—"}
                    </strong>
                    <span>BATTING</span>
                  </div>

                  <div>
                    <strong>
                      {sale.player.bowling_style ?? "—"}
                    </strong>
                    <span>BOWLING</span>
                  </div>

                  <div>
                    <strong>
                      {sale.player.preferred_position ?? "—"}
                    </strong>
                    <span>POSITION</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="sold-poster-result-panel">
              <div className="sold-poster-base-value">
                <span>BASE VALUE</span>
                <strong>
                  {formatLkr(sale.player.base_price)} LKR
                </strong>
              </div>

              <div className="sold-poster-price-ring">
                <small>SOLD FOR</small>
                <div>
                  <strong>{formatLkr(sale.sold_price)}</strong>
                  <span>LKR</span>
                </div>
              </div>

              <div className="sold-poster-team-label">
                PURCHASED BY
              </div>

              <div className="sold-poster-team">
                <div>
                  {teamLogo ? (
                    <img
                      src={teamLogo}
                      alt={`${sale.team.name} logo`}
                    />
                  ) : (
                    <strong>{sale.team.short_name}</strong>
                  )}
                </div>

                <h2>{sale.team.name}</h2>
              </div>

              <div className="sold-poster-stamp">
                SOLD
              </div>
            </article>
          </div>

          <footer className="sold-poster-footer">
            <span>{tournament.society_name}</span>
            <strong>
              {sale.player.full_name} • {sale.team.name}
            </strong>
          </footer>
        </div>
      </div>

      {showDownloadButton && downloadError && (
        <p className="sold-poster-download-error">
          {downloadError}
        </p>
      )}

      {showDownloadButton && (
        <button
          type="button"
          className="sold-poster-download-button"
          onClick={downloadPoster}
          disabled={downloading}
        >
          {downloading
            ? "Preparing 1920 × 1080 poster…"
            : "Download SOLD poster"}
        </button>
      )}
    </section>
  );
});

export default SoldPlayerPoster;
