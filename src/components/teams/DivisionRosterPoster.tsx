import { type CSSProperties, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";
import type { TeamPosterData } from "../../services/teamPoster";
import "./DivisionRosterPoster.css";

export default function DivisionRosterPoster({
  data
}: {
  data: TeamPosterData;
}) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { tournament, division, team, players } = data;
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );
  const teamLogo = getTeamLogoUrl(team.logo_path);
  async function downloadPoster() {
    if (!posterRef.current || downloading) return;
    setDownloading(true);

    try {
      await document.fonts.ready;
      const images = Array.from(posterRef.current.querySelectorAll("img"));
      await Promise.all(
        images.map((image) => image.decode?.().catch(() => undefined))
      );

      const image = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050a14"
      });
      const link = document.createElement("a");
      link.download = `${team.short_name}-${division.short_name}-squad-list`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") + ".png";
      link.href = image;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="division-roster-showcase">
      <div
        ref={posterRef}
        className="division-roster-poster"
        style={{ "--roster-team-color": team.team_color } as CSSProperties}
      >
        <div className="division-roster-grid" />
        <div className="division-roster-stripe" />
        {teamLogo && (
          <img
            className="division-roster-watermark"
            src={teamLogo}
            alt=""
            aria-hidden="true"
          />
        )}

        <header className="division-roster-brand">
          <div className="division-roster-logos">
            {societyLogo && <img src={societyLogo} alt="Society logo" />}
            {tournamentLogo && <img src={tournamentLogo} alt="Tournament logo" />}
          </div>

          <div className="division-roster-brand-copy">
            <small>{tournament.society_name}</small>
            <strong>{tournament.tournament_name}</strong>
          </div>
        </header>

        <section className="division-roster-hero">
          {teamLogo && (
            <div className="division-roster-team-logo">
              <img src={teamLogo} alt={`${team.name} logo`} />
            </div>
          )}

          <div className="division-roster-title">
            <p>{division.name} · OFFICIAL SQUAD</p>
            <h1>{team.name}</h1>
          </div>
        </section>

        <section className="division-roster-squad">
          <div className="division-roster-heading">
            <div>
              <small>HERE IS THE</small>
              <strong>{division.name.toUpperCase()} SQUAD</strong>
            </div>
            <span>{players.length} PLAYERS</span>
          </div>

          {players.length === 0 ? (
            <div className="division-roster-empty">
              Add players to this division squad.
            </div>
          ) : (
            <div className="division-roster-player-list">
              {players.map((player, index) => {
                const leadership = player.id === team.captain_player_id
                  ? "C"
                  : player.id === team.vice_captain_player_id
                    ? "VC"
                    : null;

                return (
                  <article
                    className="division-roster-player-row"
                    key={player.id}
                  >
                    <span className="division-roster-list-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2>{player.full_name}</h2>
                      <p>
                        {player.preferred_position ??
                          player.category?.name ??
                          "Player"}
                      </p>
                    </div>

                    {leadership && (
                      <em className="division-roster-leadership">
                        {leadership}
                      </em>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="division-roster-footer">
          <span>{tournament.society_name}</span>
          <strong>{team.name} · {division.name} OFFICIAL SQUAD</strong>
        </footer>
      </div>

      <button
        type="button"
        className="division-roster-download"
        disabled={downloading}
        onClick={downloadPoster}
      >
        {downloading ? "Preparing poster…" : "Download name-list poster"}
      </button>
    </section>
  );
}
