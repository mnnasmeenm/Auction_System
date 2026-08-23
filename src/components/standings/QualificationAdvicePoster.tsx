import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type { TeamQualificationAdvice } from "../../services/qualificationAdvisor";
import type {
  Tournament,
  TournamentDivision,
  TournamentGroup
} from "../../types/database";

import "./QualificationAdvicePoster.css";

interface QualificationAdvicePosterProps {
  tournament: Tournament;
  division: TournamentDivision;
  group: TournamentGroup | null;
  advice: TeamQualificationAdvice;
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stateLabel(advice: TeamQualificationAdvice) {
  if (advice.state === "qualified") return "TARGET SECURED";
  if (advice.state === "eliminated") return "TARGET UNREACHABLE";
  return "TARGET POSSIBLE";
}

export default function QualificationAdvicePoster({
  tournament,
  division,
  group,
  advice
}: QualificationAdvicePosterProps) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const societyLogo = getTournamentBrandingUrl(
    tournament.society_logo_path
  );
  const tournamentLogo = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );
  const teamLogo = getTeamLogoUrl(advice.row.logo_path);

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
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#050d1d"
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${safeName(tournament.tournament_name)}-${safeName(
        advice.row.team_name
      )}-qualification-guide.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="qualification-poster-showcase">
      <div
        ref={posterRef}
        className={`qualification-poster qualification-${advice.state}`}
        style={{
          "--qualification-team": advice.row.team_color,
          "--qualification-division": division.division_color
        } as CSSProperties}
      >
        <div className="qualification-poster-grid" />
        <div className="qualification-poster-light" />

        <header>
          <div className="qualification-poster-logos">
            {societyLogo && <img src={societyLogo} alt="" />}
            {tournamentLogo && <img src={tournamentLogo} alt="" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h1>{tournament.tournament_name}</h1>
            <p>
              {division.name}
              {group ? ` · ${group.name}` : ""}
            </p>
          </div>
          <strong>{advice.targetLabel}</strong>
        </header>

        <main>
          <section className="qualification-team-hero">
            <div className="qualification-team-logo">
              {teamLogo
                ? <img src={teamLogo} alt="" />
                : <strong>{advice.row.short_name}</strong>}
            </div>
            <div>
              <small>TEAM POSITION {advice.row.position}</small>
              <h2>{advice.row.team_name}</h2>
              <span className="qualification-state">
                {stateLabel(advice)}
              </span>
            </div>
          </section>

          <section className="qualification-stat-grid">
            <article><small>POINTS</small><strong>{advice.row.points}</strong></article>
            <article><small>MAX POINTS</small><strong>{advice.maximumPoints}</strong></article>
            <article><small>REMAINING</small><strong>{advice.remainingMatches}</strong></article>
            <article>
              <small>CURRENT NRR</small>
              <strong>
                {advice.row.net_run_rate >= 0 ? "+" : ""}
                {advice.row.net_run_rate.toFixed(3)}
              </strong>
            </article>
          </section>

          <section className="qualification-summary">
            <h3>{advice.summary}</h3>
            {advice.actions.map((action) => (
              <p key={action}>{action}</p>
            ))}
          </section>

          {advice.dependencies.length > 0 && (
            <section className="qualification-dependencies">
              <header>
                <div>
                  <small>RESULT DEPENDENCY MAP</small>
                  <h3>What must happen elsewhere</h3>
                </div>
                <strong>{advice.targetLabel}</strong>
              </header>

              <div>
                {advice.dependencies.map((dependency, index) => (
                  <article
                    key={`${dependency.kind}-${dependency.title}-${index}`}
                    className={`dependency-${dependency.kind}`}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <small>
                        {dependency.certainty === "required"
                          ? "REQUIRED"
                          : "CONDITIONAL NRR EXAMPLE"}
                        {dependency.matchNumber
                          ? ` · MATCH ${dependency.matchNumber}`
                          : ""}
                      </small>
                      <h4>{dependency.title}</h4>
                      <p>{dependency.requirement}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {advice.scenario && (
            <section className="qualification-scenarios">
              <header>
                <div>
                  <small>EXACT NRR PLANNING EXAMPLE</small>
                  <h3>Target NRR {advice.scenario.targetNrr.toFixed(3)}</h3>
                </div>
                <strong>
                  {advice.nextMatch?.overs_per_innings} overs · {advice.scenario.ballsPerOver} balls/over
                </strong>
              </header>
              <article>
                <span>BAT FIRST</span>
                <p>{advice.scenario.battingFirst}</p>
              </article>
              <article>
                <span>CHASE</span>
                <p>{advice.scenario.chasing}</p>
              </article>
              <small>
                Scenario uses the current table and a {advice.scenario.referenceRuns}-run planning score. Other match results can move the final cutoff.
              </small>
            </section>
          )}
        </main>

        <footer>
          <span>{tournament.society_name}</span>
          <strong>RULE-BASED · VARIABLE-FORMAT NRR</strong>
        </footer>
      </div>

      <button type="button" onClick={download} disabled={downloading}>
        {downloading ? "Preparing image…" : `Download ${advice.row.short_name} guide`}
      </button>
    </section>
  );
}
