import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { getPlayerPhotoUrl } from "../../services/playerPhotos";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type { TournamentAward } from "../../services/tournamentAnalytics";
import type {
  Tournament,
  TournamentDivision
} from "../../types/database";

import "./TournamentAwardPoster.css";

interface TournamentAwardPosterProps {
  tournament: Tournament;
  division: TournamentDivision | null;
  award: TournamentAward;
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function TournamentAwardPoster({
  tournament,
  division,
  award
}: TournamentAwardPosterProps) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const societyLogo = getTournamentBrandingUrl(
    tournament.society_logo_path
  );
  const tournamentLogo = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );
  const playerPhoto = getPlayerPhotoUrl(
    award.player?.photoPath ?? null
  );
  const teamLogo = getTeamLogoUrl(
    award.player?.teamLogoPath ?? award.team?.teamLogoPath ?? null
  );
  const subjectName = award.player?.playerName ?? award.team?.teamName ?? "Tournament record";
  const teamName = award.player?.teamName ?? award.team?.teamName ?? "";

  async function download() {
    if (!posterRef.current || downloading) return;
    setDownloading(true);

    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(posterRef.current.querySelectorAll("img"))
          .map((image) => image.decode?.().catch(() => undefined))
      );

      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#040b18"
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${safeName(tournament.tournament_name)}-${safeName(
        award.id
      )}.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="award-poster-showcase">
      <div
        ref={posterRef}
        className="tournament-award-poster"
        style={{
          "--award-accent": award.accent,
          "--award-team": award.player?.teamColor ?? award.team?.teamColor ?? award.accent
        } as CSSProperties}
      >
        <div className="award-poster-grid" />
        <div className="award-poster-glow" />
        {teamLogo && (
          <img className="award-team-watermark" src={teamLogo} alt="" />
        )}

        <header>
          <div className="award-brand-logos">
            {societyLogo && <img src={societyLogo} alt="" />}
            {tournamentLogo && <img src={tournamentLogo} alt="" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h1>{tournament.tournament_name}</h1>
            <p>{division?.name ?? "All divisions"} · Tournament honours</p>
          </div>
          <strong>OFFICIAL</strong>
        </header>

        <main>
          <section className="award-title-block">
            <span>{award.label}</span>
            <h2>{award.title}</h2>
          </section>

          <section className="award-subject">
            <div className="award-subject-image">
              {playerPhoto
                ? <img src={playerPhoto} alt="" />
                : teamLogo
                  ? <img src={teamLogo} alt="" />
                  : <strong>{subjectName.slice(0, 2).toUpperCase()}</strong>}
            </div>

            <div className="award-subject-copy">
              <small>{teamName}</small>
              <h3>{subjectName}</h3>
              <strong>{award.value}</strong>
              <p>{award.detail}</p>
            </div>
          </section>

          {teamLogo && (
            <div className="award-team-lockup">
              <img src={teamLogo} alt="" />
              <span>{teamName}</span>
            </div>
          )}
        </main>

        <footer>
          <span>{tournament.society_name}</span>
          <strong>OFFICIAL TOURNAMENT STATISTICS</strong>
        </footer>
      </div>

      <button type="button" onClick={download} disabled={downloading}>
        {downloading ? "Preparing image…" : `Download ${award.label} poster`}
      </button>
    </section>
  );
}
