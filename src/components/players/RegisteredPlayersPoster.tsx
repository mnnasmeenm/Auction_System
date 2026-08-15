import {
  useMemo,
  useRef,
  useState
} from "react";

import {
  toPng
} from "html-to-image";

import {
  getPlayerPhotoUrl
} from "../../services/playerPhotos";

import {
  getTournamentBrandingUrl
} from "../../services/tournamentBranding";

import type {
  Player,
  Tournament
} from "../../types/database";

import "./RegisteredPlayersPoster.css";

const PLAYERS_PER_POSTER = 20;

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

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tournament";
}

function splitPlayers(players: Player[]) {
  const pages: Player[][] = [];

  for (
    let index = 0;
    index < players.length;
    index += PLAYERS_PER_POSTER
  ) {
    pages.push(
      players.slice(
        index,
        index + PLAYERS_PER_POSTER
      )
    );
  }

  return pages;
}

async function waitForImages(
  element: HTMLElement
) {
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
        await image
          .decode()
          .catch(() => undefined);
      }
    })
  );
}

export default function RegisteredPlayersPoster({
  tournament,
  players
}: {
  tournament: Tournament;
  players: Player[];
}) {
  const posterRefs = useRef<
    Array<HTMLDivElement | null>
  >([]);

  const [downloadingPage, setDownloadingPage] =
    useState<number | "all" | null>(null);

  const registeredPlayers = useMemo(
    () =>
      players
        .filter(
          (player) =>
            player.status !== "withdrawn"
        )
        .sort((first, second) => {
          const firstNumber =
            first.player_number ??
            Number.MAX_SAFE_INTEGER;

          const secondNumber =
            second.player_number ??
            Number.MAX_SAFE_INTEGER;

          return (
            firstNumber - secondNumber ||
            first.full_name.localeCompare(
              second.full_name
            )
          );
        }),
    [players]
  );

  const posterPages = useMemo(
    () => splitPlayers(registeredPlayers),
    [registeredPlayers]
  );

  const societyLogoUrl =
    getTournamentBrandingUrl(
      tournament.society_logo_path
    );

  const tournamentLogoUrl =
    getTournamentBrandingUrl(
      tournament.tournament_logo_path
    );

  async function createPosterImage(
    pageIndex: number
  ) {
    const poster =
      posterRefs.current[pageIndex];

    if (!poster) {
      throw new Error(
        "The selected poster page is unavailable."
      );
    }

    await document.fonts.ready;
    await waitForImages(poster);

    return toPng(poster, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#050a16"
    });
  }

  function triggerDownload(
    image: string,
    pageIndex: number
  ) {
    const link = document.createElement("a");
    const pageSuffix =
      posterPages.length > 1
        ? `-page-${pageIndex + 1}`
        : "";

    link.download =
      `${safeFileName(
        tournament.tournament_name
      )}-registered-players${pageSuffix}.png`;

    link.href = image;
    link.click();
  }

  async function downloadPage(
    pageIndex: number
  ) {
    if (downloadingPage !== null) {
      return;
    }

    setDownloadingPage(pageIndex);

    try {
      const image = await createPosterImage(
        pageIndex
      );

      triggerDownload(image, pageIndex);
    } finally {
      setDownloadingPage(null);
    }
  }

  async function downloadAllPages() {
    if (
      downloadingPage !== null ||
      posterPages.length === 0
    ) {
      return;
    }

    setDownloadingPage("all");

    try {
      for (
        let pageIndex = 0;
        pageIndex < posterPages.length;
        pageIndex += 1
      ) {
        const image = await createPosterImage(
          pageIndex
        );

        triggerDownload(image, pageIndex);
      }
    } finally {
      setDownloadingPage(null);
    }
  }

  if (posterPages.length === 0) {
    return (
      <section className="registered-poster-empty">
        No registered players are available for the
        poster.
      </section>
    );
  }

  return (
    <section className="registered-poster-showcase">
      <div className="registered-poster-actions">
        <button
          type="button"
          onClick={downloadAllPages}
          disabled={downloadingPage !== null}
        >
          {downloadingPage === "all"
            ? "Preparing all posters…"
            : posterPages.length === 1
              ? "Download poster"
              : `Download all ${posterPages.length} posters`}
        </button>

        <span>
          {registeredPlayers.length} registered
          players • {posterPages.length} poster
          {posterPages.length === 1 ? "" : "s"}
        </span>
      </div>

      {posterPages.map(
        (pagePlayers, pageIndex) => (
          <article
            className="registered-poster-page-wrap"
            key={`poster-page-${pageIndex + 1}`}
          >
            <div
              ref={(element) => {
                posterRefs.current[pageIndex] =
                  element;
              }}
              className="registered-players-poster"
            >
              <div className="registered-poster-grid" />
              <div className="registered-poster-light registered-poster-light-one" />
              <div className="registered-poster-light registered-poster-light-two" />

              {tournamentLogoUrl && (
                <img
                  className="registered-poster-watermark"
                  src={tournamentLogoUrl}
                  alt=""
                  aria-hidden="true"
                />
              )}

              <header className="registered-poster-brand">
                <div className="registered-poster-logos">
                  {societyLogoUrl && (
                    <img
                      src={societyLogoUrl}
                      alt="Society logo"
                    />
                  )}

                  {tournamentLogoUrl && (
                    <img
                      src={tournamentLogoUrl}
                      alt="Tournament logo"
                    />
                  )}
                </div>

                <div>
                  <small>
                    {tournament.society_name}
                  </small>

                  <strong>
                    {tournament.tournament_name}
                  </strong>
                </div>

                <span>REGISTERED PLAYERS</span>
              </header>

              <section className="registered-poster-title">
                <p>PLAYER REGISTRATION • OFFICIAL LIST</p>

                <h1>
                  the registered players for
                  {" "}
                  <em>
                    {tournament.tournament_name}
                  </em>
                </h1>

                <div>
                  <strong>
                    {registeredPlayers.length}
                  </strong>
                  <span>TOTAL PLAYERS</span>
                </div>
              </section>

              <section className="registered-poster-roster">
                <div className="registered-poster-roster-heading">
                  <span>MEET THE PLAYERS</span>

                  <strong>
                    PAGE {pageIndex + 1} / {posterPages.length}
                  </strong>
                </div>

                <div className="registered-poster-player-grid">
                  {pagePlayers.map((player) => {
                    const photoUrl =
                      getPlayerPhotoUrl(
                        player.photo_path
                      );

                    return (
                      <article
                        className="registered-poster-player"
                        key={player.id}
                      >
                        <div className="registered-poster-player-photo">
                          <b>
                            {player.player_number !== null
                              ? `#${player.player_number}`
                              : "#—"}
                          </b>

                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={player.full_name}
                            />
                          ) : (
                            <strong>
                              {initials(
                                player.full_name
                              )}
                            </strong>
                          )}
                        </div>

                        <h2>{player.full_name}</h2>
                      </article>
                    );
                  })}
                </div>
              </section>

              <footer className="registered-poster-footer">
                <span>
                  {tournament.society_name}
                </span>

                <strong>
                  {tournament.tournament_name} •
                  REGISTERED PLAYERS
                </strong>
              </footer>
            </div>

            <button
              type="button"
              className="registered-poster-page-download"
              onClick={() => downloadPage(pageIndex)}
              disabled={downloadingPage !== null}
            >
              {downloadingPage === pageIndex
                ? `Preparing page ${pageIndex + 1}…`
                : `Download page ${pageIndex + 1}`}
            </button>
          </article>
        )
      )}
    </section>
  );
}