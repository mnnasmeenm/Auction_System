import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type {
  PointsTableRow,
  Tournament,
  TournamentDivision,
  TournamentGroup
} from "../../types/database";

import "./PointsTablePoster.css";

interface PointsTablePosterProps {
  tournament: Tournament;
  division: TournamentDivision;
  group: TournamentGroup | null;
  rows: PointsTableRow[];
  qualifiersCount: number;
  eliminatedTeamIds?: string[];
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function PointsTablePoster({
  tournament,
  division,
  group,
  rows,
  qualifiersCount,
  eliminatedTeamIds = []
}: PointsTablePosterProps) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);

  async function downloadPoster() {
    if (!posterRef.current || downloading) return;
    setDownloading(true);

    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(posterRef.current.querySelectorAll("img"))
          .map((image) => image.decode?.().catch(() => undefined))
      );

      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#061329"
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${safeName(tournament.tournament_name)}-${safeName(
        group?.name ?? division.name
      )}-points-table.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="points-poster-showcase">
      <div
        ref={posterRef}
        className="points-poster"
        style={{
          "--points-division": division.division_color,
          "--points-poster-min-height": `${
            390 + Math.max(rows.length, 1) * 72
          }px`
        } as CSSProperties}
      >
        <div className="points-poster-grid" />
        <div className="points-poster-light" />

        <header>
          <div className="points-poster-logos">
            {societyLogo && <img src={societyLogo} alt="" />}
            {tournamentLogo && <img src={tournamentLogo} alt="" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h1>{tournament.tournament_name}</h1>
            <p>{division.name}{group ? ` · ${group.name}` : ""}</p>
          </div>
          <strong>POINTS TABLE</strong>
        </header>

        <main>
          <div className="points-poster-heading">
            <span>POS</span><span>TEAM</span><span>M</span><span>W</span>
            <span>L</span><span>T</span><span>NR</span><span>PTS</span><span>NRR</span>
          </div>

          {rows.map((row) => {
            const logo = getTeamLogoUrl(row.logo_path);
            const qualifying = row.position <= qualifiersCount;
            const eliminated = eliminatedTeamIds.includes(row.team_id);

            return (
              <article
                key={row.team_id}
                className={qualifying ? "poster-qualifying" : ""}
                style={{ "--poster-row-color": row.team_color } as CSSProperties}
              >
                <b>{row.position}</b>
                <div>
                  <span>{logo ? <img src={logo} alt="" /> : row.short_name}</span>
                  <strong>{row.team_name}</strong>
                  {eliminated
                    ? <i className="poster-eliminated">E</i>
                    : qualifying && <i>Q</i>}
                </div>
                <span>{row.played}</span>
                <span>{row.won}</span>
                <span>{row.lost}</span>
                <span>{row.tied}</span>
                <span>{row.no_result}</span>
                <strong>{row.points}</strong>
                <em>{row.net_run_rate >= 0 ? "+" : ""}{row.net_run_rate.toFixed(3)}</em>
              </article>
            );
          })}
        </main>

        <footer>
          <span>{tournament.society_name}</span>
          <strong>OFFICIAL STANDINGS · UPDATED LIVE</strong>
        </footer>
      </div>

      <button type="button" onClick={downloadPoster} disabled={downloading}>
        {downloading ? "Preparing poster…" : "Download points-table poster"}
      </button>
    </section>
  );
}
