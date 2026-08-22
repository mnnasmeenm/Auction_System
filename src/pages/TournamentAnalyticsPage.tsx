import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import TournamentAwardPoster from
  "../components/analytics/TournamentAwardPoster";

import { getTournamentDivisions } from
  "../services/scheduleConfiguration";
import {
  getTournamentAnalytics,
  type TournamentAnalyticsSnapshot
} from "../services/tournamentAnalytics";
import { getTournament } from "../services/tournaments";

import type {
  Tournament,
  TournamentDivision
} from "../types/database";

import "./TournamentAnalyticsPage.css";

const EMPTY_ANALYTICS: TournamentAnalyticsSnapshot = {
  players: [],
  awards: [],
  playerOfTournament: null,
  playerOfTournamentReason: "",
  highestTeamScore: null,
  scoredMatches: 0
};

export default function TournamentAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [divisionId, setDivisionId] = useState("");
  const [analytics, setAnalytics] =
    useState<TournamentAnalyticsSnapshot>(EMPTY_ANALYTICS);
  const [selectedAwardId, setSelectedAwardId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedDivision = useMemo(
    () => divisions.find((division) => division.id === divisionId) ?? null,
    [divisionId, divisions]
  );

  const selectedAward = useMemo(
    () => analytics.awards.find(
      (award) => award.id === selectedAwardId
    ) ?? analytics.awards[0] ?? null,
    [analytics.awards, selectedAwardId]
  );

  const loadBase = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    try {
      const [tournamentRecord, divisionRecords] = await Promise.all([
        getTournament(tournamentId),
        getTournamentDivisions(tournamentId)
      ]);
      setTournament(tournamentRecord);
      setDivisions(divisionRecords.filter((division) => division.is_active));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournament analytics could not be opened."
      );
    }
  }, [tournamentId]);

  const loadAnalytics = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const snapshot = await getTournamentAnalytics(
        tournamentId,
        divisionId || null
      );
      setAnalytics(snapshot);
      setSelectedAwardId((current) =>
        snapshot.awards.some((award) => award.id === current)
          ? current
          : snapshot.awards[0]?.id ?? ""
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournament statistics could not be calculated."
      );
    } finally {
      setLoading(false);
    }
  }, [divisionId, tournamentId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (!tournamentId) {
    return (
      <main className="analytics-page">
        <section className="analytics-message">
          Select a tournament first.
        </section>
      </main>
    );
  }

  return (
    <main className="analytics-page">
      <header className="analytics-page-header">
        <div>
          <p className="page-label">SECTION 7</p>
          <h1>Tournament honours</h1>
          <p>
            Live leaderboards, tournament records and downloadable award posters.
          </p>
        </div>

        <button type="button" onClick={() => void loadAnalytics()}>
          Recalculate statistics
        </button>
      </header>

      {errorMessage && (
        <div className="analytics-alert">{errorMessage}</div>
      )}

      <section className="analytics-controls">
        <label>
          Statistics scope
          <select
            value={divisionId}
            onChange={(event) => setDivisionId(event.target.value)}
          >
            <option value="">All tournament divisions</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </label>

        <article>
          <span>SCORED MATCHES</span>
          <strong>{analytics.scoredMatches}</strong>
        </article>

        <article>
          <span>PLAYERS RECORDED</span>
          <strong>{analytics.players.length}</strong>
        </article>

        <article>
          <span>AWARD CATEGORIES</span>
          <strong>{analytics.awards.length}</strong>
        </article>
      </section>

      {loading ? (
        <section className="analytics-message">
          Calculating tournament performances…
        </section>
      ) : analytics.players.length === 0 ? (
        <section className="analytics-message">
          Score at least one match to generate tournament statistics.
        </section>
      ) : (
        <>
          <section className="analytics-leaderboards">
            <article>
              <header><span>BATTING</span><h2>Run leaders</h2></header>
              {analytics.players
                .filter((player) => player.runs > 0)
                .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)
                .slice(0, 8)
                .map((player, index) => (
                  <div key={player.key}>
                    <b>{index + 1}</b>
                    <span><strong>{player.playerName}</strong><small>{player.teamName}</small></span>
                    <em>{player.runs} RUNS</em>
                  </div>
                ))}
            </article>

            <article>
              <header><span>BOWLING</span><h2>Wicket leaders</h2></header>
              {analytics.players
                .filter((player) => player.wickets > 0)
                .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
                .slice(0, 8)
                .map((player, index) => (
                  <div key={player.key}>
                    <b>{index + 1}</b>
                    <span><strong>{player.playerName}</strong><small>{player.teamName}</small></span>
                    <em>{player.wickets} WKTS</em>
                  </div>
                ))}
            </article>

            <article>
              <header><span>FIELDING</span><h2>Fielding leaders</h2></header>
              {analytics.players
                .filter((player) =>
                  player.catches + player.stumpings + player.runOuts > 0
                )
                .sort((a, b) =>
                  (b.catches + b.stumpings + b.runOuts) -
                  (a.catches + a.stumpings + a.runOuts)
                )
                .slice(0, 8)
                .map((player, index) => (
                  <div key={player.key}>
                    <b>{index + 1}</b>
                    <span><strong>{player.playerName}</strong><small>{player.teamName}</small></span>
                    <em>{player.catches + player.stumpings + player.runOuts} DISMISSALS</em>
                  </div>
                ))}
            </article>
          </section>

          <section className="analytics-mvp-panel">
            <div>
              <span>RULE-BASED SUGGESTION</span>
              <h2>Player of the Tournament</h2>
              <p>{analytics.playerOfTournamentReason}</p>
            </div>
            <strong>{analytics.playerOfTournament?.playerName}</strong>
            <small>
              Formula: runs + wickets×25 + catches×8 + stumpings×10 + run-outs×10 + POTM×15 − wides − no-balls×2.
            </small>
          </section>

          <section className="analytics-award-section">
            <header>
              <div>
                <span>SOCIAL MEDIA EXPORT</span>
                <h2>Award posters</h2>
              </div>
              <p>Select an award, review the calculated winner and download its branded poster.</p>
            </header>

            <div className="analytics-award-tabs">
              {analytics.awards.map((award) => (
                <button
                  type="button"
                  key={award.id}
                  className={award.id === selectedAward?.id ? "selected" : ""}
                  onClick={() => setSelectedAwardId(award.id)}
                >
                  <span style={{ background: award.accent }} />
                  <strong>{award.label}</strong>
                  <small>{award.value}</small>
                </button>
              ))}
            </div>

            {tournament && selectedAward && (
              <TournamentAwardPoster
                tournament={tournament}
                division={selectedDivision}
                award={selectedAward}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}
