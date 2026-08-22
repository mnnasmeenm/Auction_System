import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import QualificationAdvicePoster from
  "../components/standings/QualificationAdvicePoster";

import {
  getQualificationAdvice,
  type QualificationAdviceSection
} from "../services/qualificationAdvisor";
import { getTournament } from "../services/tournaments";

import type { Tournament } from "../types/database";

import "./QualificationAdvisorPage.css";

export default function QualificationAdvisorPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [sections, setSections] = useState<QualificationAdviceSection[]>([]);
  const [selectedSectionKey, setSelectedSectionKey] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [referenceRuns, setReferenceRuns] = useState("50");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedSection = useMemo(
    () => sections.find(
      (section) => section.key === selectedSectionKey
    ) ?? sections[0] ?? null,
    [sections, selectedSectionKey]
  );

  const selectedAdvice = useMemo(
    () => selectedSection?.advice.find(
      (advice) => advice.row.team_id === selectedTeamId
    ) ?? selectedSection?.advice[0] ?? null,
    [selectedSection, selectedTeamId]
  );

  const load = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const planningRuns = Math.max(1, Number(referenceRuns) || 50);
      const [tournamentRecord, adviceSections] = await Promise.all([
        getTournament(tournamentId),
        getQualificationAdvice(tournamentId, planningRuns)
      ]);

      setTournament(tournamentRecord);
      setSections(adviceSections);
      setSelectedSectionKey((current) =>
        adviceSections.some((section) => section.key === current)
          ? current
          : adviceSections[0]?.key ?? ""
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Qualification advice could not be calculated."
      );
    } finally {
      setLoading(false);
    }
  }, [referenceRuns, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSection) {
      setSelectedTeamId("");
      return;
    }

    setSelectedTeamId((current) =>
      selectedSection.advice.some(
        (advice) => advice.row.team_id === current
      )
        ? current
        : selectedSection.advice[0]?.row.team_id ?? ""
    );
  }, [selectedSection]);

  if (!tournamentId) {
    return (
      <main className="qualification-page">
        <section className="qualification-message">
          Select a tournament first.
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="qualification-page">
        <section className="qualification-message">
          Calculating qualification paths…
        </section>
      </main>
    );
  }

  return (
    <main className="qualification-page">
      <header className="qualification-page-header">
        <div>
          <p className="page-label">SECTION 6</p>
          <h1>Qualification &amp; NRR advisor</h1>
          <p>
            Rule-based qualification status and exact variable-format NRR scenarios for {tournament?.tournament_name}.
          </p>
        </div>

        <button type="button" onClick={() => void load()}>
          Recalculate
        </button>
      </header>

      {errorMessage && (
        <div className="qualification-alert">
          {errorMessage}
        </div>
      )}

      <section className="qualification-explanation">
        <article>
          <strong>Q</strong>
          <div>
            <h2>Qualified</h2>
            <p>No remaining points combination can push the team below the qualifying places.</p>
          </div>
        </article>
        <article>
          <strong>LIVE</strong>
          <div>
            <h2>In contention</h2>
            <p>The team can still qualify. Points and NRR guidance updates from completed matches.</p>
          </div>
        </article>
        <article>
          <strong>E</strong>
          <div>
            <h2>Eliminated</h2>
            <p>The maximum reachable points can no longer enter a qualifying position.</p>
          </div>
        </article>
      </section>

      {sections.length === 0 ? (
        <section className="qualification-message">
          Create divisions, fixtures and a points table first.
        </section>
      ) : (
        <>
          <section className="qualification-controls">
            <label>
              Division or group
              <select
                value={selectedSection?.key ?? ""}
                onChange={(event) =>
                  setSelectedSectionKey(event.target.value)
                }
              >
                {sections.map((section) => (
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
                onChange={(event) =>
                  setSelectedTeamId(event.target.value)
                }
              >
                {selectedSection?.advice.map((advice) => (
                  <option
                    key={advice.row.team_id}
                    value={advice.row.team_id}
                  >
                    {advice.row.position}. {advice.row.team_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              NRR planning score
              <input
                type="number"
                min="1"
                value={referenceRuns}
                onChange={(event) => setReferenceRuns(event.target.value)}
              />
              <small>
                Used for the bat-first and chase examples.
              </small>
            </label>
          </section>

          <section className="qualification-table">
            <header>
              <span>TEAM</span>
              <span>PTS</span>
              <span>MAX</span>
              <span>LEFT</span>
              <span>NRR</span>
              <span>STATUS</span>
            </header>

            {selectedSection?.advice.map((advice) => (
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
                <strong>{advice.row.team_name}</strong>
                <span>{advice.row.points}</span>
                <span>{advice.maximumPoints}</span>
                <span>{advice.remainingMatches}</span>
                <span>
                  {advice.row.net_run_rate >= 0 ? "+" : ""}
                  {advice.row.net_run_rate.toFixed(3)}
                </span>
                <b className={`status-${advice.state}`}>
                  {advice.state === "qualified"
                    ? "Q"
                    : advice.state === "eliminated"
                      ? "E"
                      : "LIVE"}
                </b>
              </button>
            ))}
          </section>

          {tournament && selectedSection && selectedAdvice && (
            <QualificationAdvicePoster
              tournament={tournament}
              division={selectedSection.division}
              group={selectedSection.group}
              advice={selectedAdvice}
            />
          )}
        </>
      )}
    </main>
  );
}
