import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import PointsTable from "../components/standings/PointsTable";
import PointsTablePoster from "../components/standings/PointsTablePoster";

import {
  getCompetitionSettings,
  saveCompetitionSettings
} from "../services/competitionSettings";
import {
  addPointsAdjustment,
  deletePointsAdjustment,
  getPointsAdjustments,
  getTournamentStandingsSections,
  type StandingsSection
} from "../services/standings";
import {
  getQualificationAdvice,
  type QualificationAdviceSection
} from "../services/qualificationAdvisor";
import { getTournament } from "../services/tournaments";

import type {
  PointsTableAdjustment,
  Tournament,
  TournamentCompetitionSettings
} from "../types/database";

import "./PointsTablePage.css";

export default function PointsTablePage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [sections, setSections] = useState<StandingsSection[]>([]);
  const [qualificationSections, setQualificationSections] =
    useState<QualificationAdviceSection[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [settings, setSettings] = useState<TournamentCompetitionSettings | null>(null);
  const [adjustments, setAdjustments] = useState<PointsTableAdjustment[]>([]);
  const [teamId, setTeamId] = useState("");
  const [pointsAdjustment, setPointsAdjustment] = useState("0");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedSection = useMemo(
    () => sections.find((section) => section.key === selectedKey) ?? sections[0] ?? null,
    [sections, selectedKey]
  );

  const load = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        tournamentRecord,
        standingSections,
        competition,
        qualificationAdvice
      ] = await Promise.all([
        getTournament(tournamentId),
        getTournamentStandingsSections(tournamentId),
        getCompetitionSettings(tournamentId),
        getQualificationAdvice(tournamentId)
      ]);

      setTournament(tournamentRecord);
      setSections(standingSections);
      setSettings(competition);
      setQualificationSections(qualificationAdvice);
      setSelectedKey((current) =>
        standingSections.some((section) => section.key === current)
          ? current
          : standingSections[0]?.key ?? ""
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Points table could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const eliminatedTeamIds = useMemo(
    () => qualificationSections
      .find((section) => section.key === selectedSection?.key)
      ?.advice
      .filter((advice) => advice.state === "eliminated")
      .map((advice) => advice.row.team_id) ?? [],
    [qualificationSections, selectedSection]
  );

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedSection) {
      setAdjustments([]);
      return;
    }

    void getPointsAdjustments(
      tournamentId,
      selectedSection.division.id,
      selectedSection.group?.id ?? null
    ).then(setAdjustments).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Adjustments could not be loaded.");
    });
  }, [selectedSection, tournamentId]);

  async function runAction(action: () => Promise<void>, message: string) {
    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await action();
      setSuccessMessage(message);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The update failed.");
    } finally {
      setWorking(false);
    }
  }

  async function saveRules(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;

    await runAction(
      () => saveCompetitionSettings(settings),
      "Points rules saved. The table has been recalculated."
    );
  }

  async function addAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!selectedSection || !teamId || reason.trim().length < 3) {
      setErrorMessage("Select a team and enter a reason for the adjustment.");
      return;
    }

    await runAction(
      () => addPointsAdjustment({
        tournamentId,
        divisionId: selectedSection.division.id,
        groupId: selectedSection.group?.id ?? null,
        teamId,
        points: Number(pointsAdjustment),
        reason
      }),
      "Points adjustment saved."
    );

    setTeamId("");
    setPointsAdjustment("0");
    setReason("");
  }

  if (!tournamentId) {
    return <main className="points-page"><section className="points-message">Select a tournament first.</section></main>;
  }

  if (loading) {
    return <main className="points-page"><section className="points-message">Calculating standings…</section></main>;
  }

  return (
    <main className="points-page">
      <header className="points-page-header">
        <div>
          <p className="page-label">TOURNAMENT STANDINGS</p>
          <h1>Points table</h1>
          <p>{tournament?.tournament_name}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={working}>Refresh table</button>
      </header>

      {errorMessage && <div className="points-alert points-error">{errorMessage}</div>}
      {successMessage && <div className="points-alert points-success">{successMessage}</div>}

      {sections.length === 0 ? (
        <section className="points-message">Create a tournament division and assign teams before calculating standings.</section>
      ) : (
        <>
          <section className="points-scope-tabs">
            {sections.map((section) => (
              <button
                type="button"
                key={section.key}
                className={section.key === selectedSection?.key ? "selected" : ""}
                onClick={() => setSelectedKey(section.key)}
              >
                <span style={{ background: section.division.division_color }} />
                {section.division.name}{section.group ? ` · ${section.group.name}` : ""}
              </button>
            ))}
          </section>

          {selectedSection && (
            <>
              <section className="points-panel">
                <header>
                  <div>
                    <span>LIVE CALCULATION</span>
                    <h2>{selectedSection.division.name}{selectedSection.group ? ` · ${selectedSection.group.name}` : ""}</h2>
                  </div>
                  <p>Completed league/group matches only · Q marks current qualification places</p>
                </header>
                <PointsTable
                  rows={selectedSection.rows}
                  qualifiersCount={selectedSection.qualifiersCount}
                  eliminatedTeamIds={eliminatedTeamIds}
                />
              </section>

              {settings && (
                <form className="points-panel points-rules" onSubmit={saveRules}>
                  <header><div><span>POINTS RULES</span><h2>Result points</h2></div><p>Changing these values recalculates every table automatically.</p></header>
                  <div>
                    <label>Win<input type="number" value={settings.win_points} onChange={(event) => setSettings({ ...settings, win_points: Number(event.target.value) })} /></label>
                    <label>Tie<input type="number" value={settings.tie_points} onChange={(event) => setSettings({ ...settings, tie_points: Number(event.target.value) })} /></label>
                    <label>No result<input type="number" value={settings.no_result_points} onChange={(event) => setSettings({ ...settings, no_result_points: Number(event.target.value) })} /></label>
                    <label>Loss<input type="number" value={settings.loss_points} onChange={(event) => setSettings({ ...settings, loss_points: Number(event.target.value) })} /></label>
                  </div>
                  <button type="submit" disabled={working}>Save points rules</button>
                </form>
              )}

              <form className="points-panel points-adjustment-form" onSubmit={addAdjustment}>
                <header><div><span>ADMIN CORRECTION</span><h2>Points adjustment</h2></div><p>Use only for an approved bonus, penalty or correction. The reason remains recorded.</p></header>
                <div>
                  <label>Team<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Select team</option>{selectedSection.rows.map((row) => <option key={row.team_id} value={row.team_id}>{row.team_name}</option>)}</select></label>
                  <label>Points<input type="number" value={pointsAdjustment} onChange={(event) => setPointsAdjustment(event.target.value)} /></label>
                  <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Approved reason" /></label>
                  <button type="submit" disabled={working}>Add adjustment</button>
                </div>

                {adjustments.length > 0 && (
                  <div className="points-adjustment-list">
                    {adjustments.map((adjustment) => {
                      const team = selectedSection.rows.find((row) => row.team_id === adjustment.team_id);
                      return <article key={adjustment.id}><div><strong>{team?.team_name ?? "Team"} · {adjustment.points_adjustment >= 0 ? "+" : ""}{adjustment.points_adjustment} points</strong><span>{adjustment.reason}</span></div><button type="button" disabled={working} onClick={() => void runAction(() => deletePointsAdjustment(adjustment.id), "Adjustment removed.")}>Remove</button></article>;
                    })}
                  </div>
                )}
              </form>

              {tournament && (
                <PointsTablePoster
                  tournament={tournament}
                  division={selectedSection.division}
                  group={selectedSection.group}
                  rows={selectedSection.rows}
                  qualifiersCount={selectedSection.qualifiersCount}
                  eliminatedTeamIds={eliminatedTeamIds}
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
