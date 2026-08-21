import { type CSSProperties, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getManagerPhotoUrl } from "../../services/managerPhotos";
import { getPlayerPhotoUrl } from "../../services/playerPhotos";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";
import type { TeamPosterData } from "../../services/teamPoster";
import "./TeamSquadPoster.css";

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

export default function TeamSquadPoster({
  data
}: {
  data: TeamPosterData;
}) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { tournament, team, players } = data;

  const managers = data.managers.length > 0
    ? data.managers.slice(0, 2)
    : [{
        id: "fallback-manager",
        full_name: team.manager_name ?? "Team Owner",
        manager_photo_path: null
      }];

  const societyLogoUrl = getTournamentBrandingUrl(
    tournament.society_logo_path
  );
  const tournamentLogoUrl = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );
  const teamLogoUrl = getTeamLogoUrl(team.logo_path);
  const teamNameWordCount = team.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
  const teamNameSizeClass =
    team.name.trim().length > 22 || teamNameWordCount >= 3
      ? "poster-team-name-long"
      : team.name.trim().length > 14
        ? "poster-team-name-medium"
        : "poster-team-name-short";

  async function downloadPoster() {
    if (!posterRef.current || downloading) {
      return;
    }

    setDownloading(true);

    try {
      await document.fonts.ready;

      const posterImages = Array.from(
        posterRef.current.querySelectorAll("img")
      );

      await Promise.all(
        posterImages.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            });
          }

          if (typeof image.decode === "function") {
            await image.decode().catch(() => undefined);
          }
        })
      );

      const image = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050a14"
      });

      const link = document.createElement("a");
      link.download = `${team.short_name.toLowerCase()}-official-squad.png`;
      link.href = image;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="team-poster-showcase">
      <div
        ref={posterRef}
        className="team-squad-poster"
        style={{ "--poster-team-color": team.team_color } as CSSProperties}
      >
        <div className="poster-light poster-light-one" />
        <div className="poster-light poster-light-two" />
        <div className="poster-grid-texture" />
        {teamLogoUrl && (
          <img
            className="poster-team-watermark"
            src={teamLogoUrl}
            alt=""
            aria-hidden="true"
          />
        )}

        <header className="poster-brand-row">
          <div className="poster-brand-logos">
            {societyLogoUrl && (
              <img src={societyLogoUrl} alt="Society logo" />
            )}
            {tournamentLogoUrl && (
              <img src={tournamentLogoUrl} alt="Tournament logo" />
            )}
          </div>

          <div className="poster-brand-copy">
            <small>{tournament.society_name}</small>
            <strong>{tournament.tournament_name}</strong>
          </div>

          <span>{data.division.short_name} · OFFICIAL SQUAD</span>
        </header>

        <section className="poster-team-hero">
          <div className="poster-team-title">
            <div className="poster-team-logo">
              {teamLogoUrl ? (
                <img src={teamLogoUrl} alt={`${team.name} logo`} />
              ) : (
                <strong>{team.short_name}</strong>
              )}
            </div>

            <div>
              <p>{tournament.tournament_name} · {data.division.name}</p>
              <h1 className={teamNameSizeClass}>{team.name}</h1>
              <span>TEAM • {team.short_name}</span>
            </div>
          </div>

          <div className={`poster-owner-list owner-count-${managers.length}`}>
            {managers.map((manager) => {
              const managerName = manager.full_name ?? "Team Owner";
              const photoUrl = getManagerPhotoUrl(
                manager.manager_photo_path
              );

              return (
                <article className="poster-owner" key={manager.id}>
                  <div className="poster-owner-photo">
                    {photoUrl ? (
                      <img src={photoUrl} alt={managerName} />
                    ) : (
                      <strong>{initials(managerName)}</strong>
                    )}
                  </div>
                  <div>
                    <span>OWNER</span>
                    <h2>{managerName}</h2>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="poster-squad-section">
          <div className="poster-squad-heading">
            <span>MEET THE SQUAD</span>
            <strong>{players.length} PLAYERS</strong>
          </div>

          {players.length === 0 ? (
            <div className="poster-no-players">
              Add auction or manually allocated players to create this squad.
            </div>
          ) : (
            <div
              className={`poster-player-grid poster-player-count-${players.length}`}
            >
              {players.map((player) => {
                const playerPhotoUrl = getPlayerPhotoUrl(player.photo_path);
                const leadership = player.id === team.captain_player_id
                  ? "C"
                  : player.id === team.vice_captain_player_id
                    ? "VC"
                    : null;

                return (
                  <article className="poster-player" key={player.id}>
                    <div className="poster-player-photo">
                      {leadership && (
                        <b className={`poster-leadership poster-${leadership.toLowerCase()}`}>
                          {leadership}
                        </b>
                      )}

                      {playerPhotoUrl ? (
                        <img src={playerPhotoUrl} alt={player.full_name} />
                      ) : (
                        <strong>{initials(player.full_name)}</strong>
                      )}
                    </div>

                    <h3>{player.full_name}</h3>
                    <span>{player.preferred_position ?? player.category?.name ?? "Player"}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="poster-footer">
          <span>{tournament.society_name}</span>
          <strong>{team.name} • {data.division.name} SQUAD</strong>
        </footer>
      </div>

      <button
        type="button"
        className="team-poster-download"
        onClick={downloadPoster}
        disabled={downloading}
      >
        {downloading ? "Preparing poster…" : "Download team poster"}
      </button>
    </section>
  );
}
