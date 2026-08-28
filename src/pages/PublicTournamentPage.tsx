import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import PointsTable from "../components/standings/PointsTable";
import PointsTablePoster from "../components/standings/PointsTablePoster";
import QualificationAdvicePoster from
  "../components/standings/QualificationAdvicePoster";

import {
  getPublicTournament,
  getPublicTournamentMatches
} from "../services/publicScoring";

import { getTeamLogoUrl } from "../services/teams";
import { getTournamentBrandingUrl } from "../services/tournamentBranding";

import {
  getTournamentStandingsSections,
  type StandingsSection
} from "../services/standings";
import {
  getQualificationAdvice,
  type QualificationAdviceSection,
  type QualificationGoal
} from "../services/qualificationAdvisor";

import type { Tournament, TournamentMatch } from "../types/database";

import "./PublicScores.css";

function MatchTile({ match, slug }: { match: TournamentMatch; slug: string }) {
  const firstName = match.team_one?.name ?? match.team_one_placeholder ?? "TBA";
  const secondName = match.team_two?.name ?? match.team_two_placeholder ?? "TBA";
  const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
  const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);

  return (
    <Link className="public-match-tile" to={`/t/${slug}/match/${match.id}`}>
      <header>
        <span>MATCH {match.match_number}</span>
        <b className={`public-status status-${match.status}`}>{match.status.replaceAll("_", " ")}</b>
      </header>
      <div className="public-match-team">
        <div>{firstLogo ? <img src={firstLogo} alt="" /> : firstName.slice(0, 2)}</div>
        <strong>{firstName}</strong>
      </div>
      <div className="public-match-team">
        <div>{secondLogo ? <img src={secondLogo} alt="" /> : secondName.slice(0, 2)}</div>
        <strong>{secondName}</strong>
      </div>
      <footer>
        <span>{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Time TBA"}</span>
        <b>{match.result_summary ?? match.venue ?? "Venue TBA"}</b>
      </footer>
    </Link>
  );
}

function qualificationStateLabel(state: "qualified" | "eliminated" | "contending") {
  if (state === "qualified") return "Qualified";
  if (state === "eliminated") return "Eliminated";
  return "In contention";
}

export default function PublicTournamentPage() {
  const { publicSlug = "" } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [standings, setStandings] = useState<StandingsSection[]>([]);
  const [qualificationSections, setQualificationSections] =
    useState<QualificationAdviceSection[]>([]);
  const [selectedQualificationKey, setSelectedQualificationKey] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [qualificationGoal, setQualificationGoal] =
    useState<QualificationGoal>("qualify");
  const [referenceRuns, setReferenceRuns] = useState("50");
  const [planningRuns, setPlanningRuns] = useState(50);
  const [qualificationLoading, setQualificationLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const record = await getPublicTournament(publicSlug);
      setQualificationLoading(true);
      const [fixtures, standingSections, adviceSections] = await Promise.all([
        getPublicTournamentMatches(record.id),
        getTournamentStandingsSections(record.id),
        getQualificationAdvice(
          record.id,
          planningRuns,
          qualificationGoal,
          true
        )
      ]);
      setTournament(record);
      setMatches(fixtures);
      setStandings(standingSections);
      setQualificationSections(adviceSections);
      setSelectedQualificationKey((current) =>
        adviceSections.some((section) => section.key === current)
          ? current
          : adviceSections[0]?.key ?? ""
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tournament could not be loaded.");
    } finally {
      setQualificationLoading(false);
      setLoading(false);
    }
  }, [planningRuns, publicSlug, qualificationGoal]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const groups = useMemo(() => ({
    live: matches.filter((match) => match.status === "live" || match.status === "innings_break"),
    upcoming: matches.filter((match) => match.status === "scheduled"),
    recent: matches.filter((match) => match.status === "completed" || match.status === "no_result")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
  }), [matches]);

  const selectedQualificationSection = useMemo(
    () => qualificationSections.find(
      (section) => section.key === selectedQualificationKey
    ) ?? qualificationSections[0] ?? null,
    [qualificationSections, selectedQualificationKey]
  );

  const selectedAdvice = useMemo(
    () => selectedQualificationSection?.advice.find(
      (advice) => advice.row.team_id === selectedTeamId
    ) ?? selectedQualificationSection?.advice[0] ?? null,
    [selectedQualificationSection, selectedTeamId]
  );

  useEffect(() => {
    if (!selectedQualificationSection) {
      setSelectedTeamId("");
      return;
    }

    setSelectedTeamId((current) =>
      selectedQualificationSection.advice.some(
        (advice) => advice.row.team_id === current
      )
        ? current
        : selectedQualificationSection.advice[0]?.row.team_id ?? ""
    );
  }, [selectedQualificationSection]);

  function calculateQualification() {
    const nextRuns = Math.max(1, Math.floor(Number(referenceRuns) || 50));
    setReferenceRuns(String(nextRuns));

    if (nextRuns === planningRuns) {
      void load();
      return;
    }

    setPlanningRuns(nextRuns);
  }

  if (loading) return <main className="public-score-page"><section className="public-message">Loading match centre…</section></main>;
  if (!tournament || errorMessage) return <main className="public-score-page"><section className="public-message public-error">{errorMessage || "Tournament not found."}</section></main>;

  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);

  return (
    <main className="public-score-page">
      <header className="public-tournament-header">
        <Link to="/">← Tournaments</Link>
        <div className="public-tournament-logos">
          {societyLogo && <img src={societyLogo} alt="" />}
          {tournamentLogo && <img src={tournamentLogo} alt="" />}
        </div>
        <div>
          <span>{tournament.society_name}</span>
          <h1>{tournament.tournament_name}</h1>
          <p>Official public match centre</p>
        </div>
      </header>

      {([
        ["LIVE NOW", groups.live],
        ["UPCOMING MATCHES", groups.upcoming],
        ["RECENT RESULTS", groups.recent]
      ] as Array<[string, TournamentMatch[]]>).map(([title, records]) => (
        <section className="public-match-section" key={title}>
          <header><h2>{title}</h2><span>{records.length} MATCH{records.length === 1 ? "" : "ES"}</span></header>
          {records.length === 0 ? <p className="public-no-matches">No matches in this section.</p> : (
            <div className="public-match-grid">
              {records.map((match) => <MatchTile key={match.id} match={match} slug={publicSlug} />)}
            </div>
          )}
        </section>
      ))}

      {standings.map((section) => (
        <section className="public-match-section public-standings-section" key={section.key}>
          <header>
            <div>
              <span>OFFICIAL STANDINGS</span>
              <h2>
                {section.division.name}
                {section.group ? ` · ${section.group.name}` : ""}
              </h2>
            </div>
            <span>Q = QUALIFICATION POSITION</span>
          </header>

          <PointsTable
            rows={section.rows}
            qualifiersCount={section.qualifiersCount}
          />

          <details className="public-poster-download">
            <summary>Download branded points-table poster</summary>
            <PointsTablePoster
              tournament={tournament}
              division={section.division}
              group={section.group}
              rows={section.rows}
              qualifiersCount={section.qualifiersCount}
            />
          </details>
        </section>
      ))}

      <section className="public-match-section public-qualification-section">
        <header>
          <div>
            <span>LIVE QUALIFICATION CALCULATOR</span>
            <h2>What does each team need?</h2>
            <p>
              Explore qualification, Top 2 and first-place paths using the
              current points, NRR and remaining published fixtures.
            </p>
          </div>
          <span aria-live="polite">
            {qualificationLoading ? "UPDATING…" : "LIVE CALCULATION"}
          </span>
        </header>

        {qualificationSections.length === 0 ? (
          <p className="public-no-matches">
            Qualification calculations will appear after divisions, teams and
            league/group fixtures are available.
          </p>
        ) : (
          <>
            <div className="public-qualification-controls">
              <label>
                Division or group
                <select
                  value={selectedQualificationSection?.key ?? ""}
                  onChange={(event) =>
                    setSelectedQualificationKey(event.target.value)
                  }
                >
                  {qualificationSections.map((section) => (
                    <option key={section.key} value={section.key}>
                      {section.division.name}
                      {section.group ? ` — ${section.group.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Team
                <select
                  value={selectedAdvice?.row.team_id ?? ""}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                >
                  {selectedQualificationSection?.advice.map((advice) => (
                    <option key={advice.row.team_id} value={advice.row.team_id}>
                      {advice.row.position}. {advice.row.team_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Target
                <select
                  value={qualificationGoal}
                  onChange={(event) =>
                    setQualificationGoal(event.target.value as QualificationGoal)
                  }
                >
                  <option value="qualify">Qualify for next stage</option>
                  <option value="top_two">Reach the Top 2</option>
                  <option value="first">Finish first</option>
                </select>
              </label>

              <label>
                NRR planning score
                <span className="public-qualification-run-input">
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={referenceRuns}
                    onChange={(event) => setReferenceRuns(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") calculateQualification();
                    }}
                  />
                  <button type="button" onClick={calculateQualification}>
                    Calculate
                  </button>
                </span>
              </label>
            </div>

            <div className="public-qualification-team-grid">
              {selectedQualificationSection?.advice.map((advice) => (
                <button
                  type="button"
                  key={advice.row.team_id}
                  className={
                    advice.row.team_id === selectedAdvice?.row.team_id
                      ? "selected"
                      : ""
                  }
                  onClick={() => setSelectedTeamId(advice.row.team_id)}
                >
                  <span>#{advice.row.position}</span>
                  <strong>{advice.row.team_name}</strong>
                  <small>{advice.row.points} pts · max {advice.maximumPoints}</small>
                  <b className={`status-${advice.state}`}>
                    {qualificationStateLabel(advice.state)}
                  </b>
                </button>
              ))}
            </div>

            {selectedAdvice && (
              <article className="public-qualification-result">
                <header>
                  <div>
                    <span>{selectedAdvice.targetLabel}</span>
                    <h3>{selectedAdvice.row.team_name}</h3>
                    <p>{selectedAdvice.summary}</p>
                  </div>
                  <b className={`status-${selectedAdvice.state}`}>
                    {qualificationStateLabel(selectedAdvice.state)}
                  </b>
                </header>

                <div className="public-qualification-stats">
                  <div><span>Position</span><strong>{selectedAdvice.row.position}</strong></div>
                  <div><span>Points</span><strong>{selectedAdvice.row.points}</strong></div>
                  <div><span>Maximum</span><strong>{selectedAdvice.maximumPoints}</strong></div>
                  <div><span>NRR</span><strong>{selectedAdvice.row.net_run_rate >= 0 ? "+" : ""}{selectedAdvice.row.net_run_rate.toFixed(3)}</strong></div>
                </div>

                {selectedAdvice.actions.length > 0 && (
                  <section>
                    <h4>Your team’s route</h4>
                    <ul>
                      {selectedAdvice.actions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                  </section>
                )}

                {selectedAdvice.dependencies.length > 0 && (
                  <section>
                    <h4>Other results and dependencies</h4>
                    <div className="public-dependency-grid">
                      {selectedAdvice.dependencies.map((dependency, index) => (
                        <div key={`${dependency.kind}-${dependency.title}-${index}`}>
                          <span>
                            {dependency.certainty === "required" ? "Required" : "Conditional NRR"}
                            {dependency.matchNumber ? ` · Match ${dependency.matchNumber}` : ""}
                          </span>
                          <strong>{dependency.title}</strong>
                          <p>{dependency.requirement}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedAdvice.scenario && (
                  <section>
                    <h4>NRR planning example</h4>
                    <div className="public-nrr-scenarios">
                      <p><strong>Bat first:</strong> {selectedAdvice.scenario.battingFirst}</p>
                      <p><strong>Chase:</strong> {selectedAdvice.scenario.chasing}</p>
                    </div>
                    <small>
                      Uses {selectedAdvice.scenario.ballsPerOver} balls per over
                      and the current table. Recalculate after every completed match.
                    </small>
                  </section>
                )}
              </article>
            )}

            {tournament && selectedQualificationSection && selectedAdvice && (
              <details className="public-poster-download public-qualification-poster">
                <summary>Open or download qualification guide</summary>
                <QualificationAdvicePoster
                  tournament={tournament}
                  division={selectedQualificationSection.division}
                  group={selectedQualificationSection.group}
                  advice={selectedAdvice}
                />
              </details>
            )}
          </>
        )}
      </section>
    </main>
  );
}
