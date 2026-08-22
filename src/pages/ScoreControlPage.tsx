import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { useSearchParams } from "react-router-dom";

import {
  completeCurrentInnings,
  formatCricketOvers,
  getMatchScoringBundle,
  recordMatchBall,
  resetMatchScoringData,
  saveManualInningsScore,
  setMatchPlayerOfMatch,
  startMatchScoring,
  startSecondInnings,
  undoLastMatchBall,
  type ManualBattingInput,
  type ManualBowlingInput,
  type ManualFieldingInput,
  type MatchScoringBundle
} from "../services/scoring";

import MatchSummaryCard from
  "../components/scoring/MatchSummaryCard";

import CompletedScoreCorrection from
  "../components/scoring/CompletedScoreCorrection";

import ScorecardTables from
  "../components/scoring/ScorecardTables";

import { getTournamentMatches } from "../services/matches";
import { getTournament } from "../services/tournaments";

import type {
  BallExtraType,
  DismissalType,
  Player,
  Tournament,
  TournamentMatch
} from "../types/database";

import "./ScoreControlPage.css";

const dismissalOptions: Array<{
  value: DismissalType;
  label: string;
}> = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "run_out", label: "Run out" },
  { value: "stumped", label: "Stumped" },
  { value: "hit_wicket", label: "Hit wicket" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" }
];

function numeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function teamName(match: TournamentMatch, teamId: string | null) {
  if (teamId === match.team_one_id) return match.team_one?.name ?? "Team one";
  if (teamId === match.team_two_id) return match.team_two?.name ?? "Team two";
  return "Team";
}

function playerName(players: Player[], playerId: string) {
  return players.find((player) => player.id === playerId)?.full_name ?? "";
}

function statusLabel(status: TournamentMatch["status"]) {
  return status.replaceAll("_", " ");
}

function newBattingRow(position: number): ManualBattingInput {
  return {
    playerId: null,
    playerName: "",
    battingPosition: position,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissalType: "not_out",
    dismissalText: ""
  };
}

function newBowlingRow(): ManualBowlingInput {
  return {
    playerId: null,
    playerName: "",
    legalBalls: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    dotBalls: 0,
    foursConceded: 0,
    sixesConceded: 0
  };
}

function newFieldingRow(): ManualFieldingInput {
  return {
    playerId: null,
    playerName: "",
    catches: 0,
    stumpings: 0,
    directRunOuts: 0,
    assistedRunOuts: 0
  };
}

export default function ScoreControlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";
  const selectedMatchId = searchParams.get("match") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [bundle, setBundle] = useState<MatchScoringBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [scoringMode, setScoringMode] = useState<"live" | "manual">("live");
  const [tossWinnerId, setTossWinnerId] = useState("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [battingTeamId, setBattingTeamId] = useState("");
  const [overs, setOvers] = useState("5");
  const [ballsPerOver, setBallsPerOver] = useState("6");
  const [wickets, setWickets] = useState("10");

  const [batterId, setBatterId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const [runsOffBat, setRunsOffBat] = useState(0);
  const [extraType, setExtraType] = useState<BallExtraType | "">("");
  const [extraRuns, setExtraRuns] = useState("0");
  const [isWicket, setIsWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState<DismissalType>("bowled");
  const [dismissedPlayerId, setDismissedPlayerId] = useState("");
  const [fielderId, setFielderId] = useState("");
  const [wicketCounts, setWicketCounts] = useState(true);
  const [creditedBowlerWicket, setCreditedBowlerWicket] = useState(true);
  const [runOutKind, setRunOutKind] = useState<"direct" | "assisted">("direct");
  const [ballNote, setBallNote] = useState("");
  const [undoReason, setUndoReason] = useState("");
  const [playerOfMatchId, setPlayerOfMatchId] = useState("");
  const [playerOfMatchReason, setPlayerOfMatchReason] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");

  const [manualRuns, setManualRuns] = useState("0");
  const [manualWickets, setManualWickets] = useState("0");
  const [manualLegalBalls, setManualLegalBalls] = useState("0");
  const [manualWides, setManualWides] = useState("0");
  const [manualNoBalls, setManualNoBalls] = useState("0");
  const [manualByes, setManualByes] = useState("0");
  const [manualLegByes, setManualLegByes] = useState("0");
  const [manualPenalty, setManualPenalty] = useState("0");
  const [manualAllOut, setManualAllOut] = useState(false);
  const [battingRows, setBattingRows] = useState<ManualBattingInput[]>([]);
  const [bowlingRows, setBowlingRows] = useState<ManualBowlingInput[]>([]);
  const [fieldingRows, setFieldingRows] = useState<ManualFieldingInput[]>([]);

  const loadPage = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [tournamentRecord, matchRecords] = await Promise.all([
        getTournament(tournamentId),
        getTournamentMatches(tournamentId)
      ]);

      setTournament(tournamentRecord);
      setMatches(matchRecords);

      if (selectedMatchId) {
        const scoringBundle = await getMatchScoringBundle(
          tournamentId,
          selectedMatchId
        );
        setBundle(scoringBundle);
      } else {
        setBundle(null);
      }
    } catch (error) {
      console.error("Scoring page load error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Match scoring could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedMatchId, tournamentId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!bundle) return;

    const match = bundle.match;
    setOvers(String(match.overs_per_innings));
    setBallsPerOver(String(match.balls_per_over));
    setWickets(String(match.wickets_per_innings));
    setTossWinnerId(match.toss_winner_id ?? match.team_one_id ?? "");
    setBattingTeamId(match.team_one_id ?? "");
    setScoringMode(match.scoring_mode === "manual" ? "manual" : "live");
    setPlayerOfMatchId(match.player_of_match_id ?? "");
    setPlayerOfMatchReason(match.player_of_match_reason ?? "");

    const current = bundle.innings.find(
      (innings) => innings.id === bundle.liveState?.current_innings_id
    );

    if (!current) return;

    setBatterId(bundle.liveState?.striker_player_id ?? "");
    setNonStrikerId(bundle.liveState?.non_striker_player_id ?? "");
    setBowlerId(bundle.liveState?.bowler_player_id ?? "");

    setManualRuns(String(current.runs));
    setManualWickets(String(current.wickets));
    setManualLegalBalls(String(current.legal_balls));
    setManualWides(String(current.wides));
    setManualNoBalls(String(current.no_balls));
    setManualByes(String(current.byes));
    setManualLegByes(String(current.leg_byes));
    setManualPenalty(String(current.penalty_runs));
    setManualAllOut(current.is_all_out);
    setBattingRows(
      current.batting_scorecards?.length
        ? current.batting_scorecards.map((row, index) => ({
            playerId: row.player_id,
            playerName: row.player_name,
            battingPosition: row.batting_position ?? index + 1,
            runs: row.runs,
            balls: row.balls,
            fours: row.fours,
            sixes: row.sixes,
            dismissalType: row.dismissal_type,
            dismissalText: row.dismissal_text
          }))
        : []
    );
    setBowlingRows(
      current.bowling_scorecards?.length
        ? current.bowling_scorecards.map((row) => ({
            playerId: row.player_id,
            playerName: row.player_name,
            legalBalls: row.legal_balls,
            maidens: row.maidens,
            runsConceded: row.runs_conceded,
            wickets: row.wickets,
            wides: row.wides,
            noBalls: row.no_balls,
            dotBalls: row.dot_balls,
            foursConceded: row.fours_conceded,
            sixesConceded: row.sixes_conceded
          }))
        : []
    );
    setFieldingRows(
      bundle.fielding
        .filter((row) => row.team_id === current.bowling_team_id)
        .map((row) => ({
          playerId: row.player_id,
          playerName: row.player_name,
          catches: row.catches,
          stumpings: row.stumpings,
          directRunOuts: row.direct_run_outs,
          assistedRunOuts: row.assisted_run_outs
        }))
    );
  }, [bundle]);

  const currentInnings = useMemo(
    () => bundle?.innings.find(
      (innings) => innings.id === bundle.liveState?.current_innings_id
    ) ?? null,
    [bundle]
  );

  const battingPlayers = useMemo(
    () => bundle?.players.filter(
      (player) => player.sold_team_id === currentInnings?.batting_team_id
    ) ?? [],
    [bundle, currentInnings]
  );

  const bowlingPlayers = useMemo(
    () => bundle?.players.filter(
      (player) => player.sold_team_id === currentInnings?.bowling_team_id
    ) ?? [],
    [bundle, currentInnings]
  );

  const dismissedBatterIds = useMemo(
    () => new Set(
      (currentInnings?.fall_of_wickets ?? [])
        .map((wicket) => wicket.player_id)
        .filter((id): id is string => Boolean(id))
    ),
    [currentInnings]
  );

  const availableLiveBatters = useMemo(
    () => battingPlayers.filter(
      (player) => !dismissedBatterIds.has(player.id)
    ),
    [battingPlayers, dismissedBatterIds]
  );

  const strikerScore = useMemo(
    () => currentInnings?.batting_scorecards?.find(
      (row) => row.player_id === batterId
    ) ?? null,
    [batterId, currentInnings]
  );

  const nonStrikerScore = useMemo(
    () => currentInnings?.batting_scorecards?.find(
      (row) => row.player_id === nonStrikerId
    ) ?? null,
    [currentInnings, nonStrikerId]
  );

  const currentBowlerScore = useMemo(
    () => currentInnings?.bowling_scorecards?.find(
      (row) => row.player_id === bowlerId
    ) ?? null,
    [bowlerId, currentInnings]
  );

  const selectedPlayerOfMatch = useMemo(
    () => bundle?.players.find((player) => player.id === bundle.match.player_of_match_id) ?? null,
    [bundle]
  );

  function selectMatch(matchId: string) {
    const next = new URLSearchParams(searchParams);
    if (matchId) next.set("match", matchId);
    else next.delete("match");
    setSearchParams(next);
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await action();
      setSuccessMessage(success);
      await loadPage();
    } catch (error) {
      console.error("Scoring action error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "The score update failed."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleStart(event: FormEvent) {
    event.preventDefault();
    if (!bundle) return;
    await runAction(
      () => startMatchScoring({
        matchId: bundle.match.id,
        scoringMode,
        tossWinnerId,
        tossDecision,
        battingTeamId,
        overs: numeric(overs),
        ballsPerOver: numeric(ballsPerOver),
        wickets: numeric(wickets)
      }),
      "Match scoring started."
    );
  }

  async function handleBall(event: FormEvent) {
    event.preventDefault();
    if (!bundle?.liveState || !batterId || !nonStrikerId || !bowlerId) {
      setErrorMessage(
        "Select the striker, non-striker and bowler before recording the ball."
      );
      return;
    }

    if (
      dismissedBatterIds.has(batterId) ||
      dismissedBatterIds.has(nonStrikerId)
    ) {
      setErrorMessage(
        "A dismissed player cannot be selected again in this innings."
      );
      return;
    }

    await runAction(
      () => recordMatchBall(bundle.match.id, bundle.liveState!.revision, {
        batterPlayerId: batterId,
        batterName: playerName(battingPlayers, batterId),
        nonStrikerPlayerId: nonStrikerId || null,
        nonStrikerName: playerName(battingPlayers, nonStrikerId) || null,
        bowlerPlayerId: bowlerId,
        bowlerName: playerName(bowlingPlayers, bowlerId),
        runsOffBat,
        extraType: extraType || null,
        extraRuns: numeric(extraRuns),
        isWicket,
        dismissalType: isWicket ? dismissalType : null,
        dismissedPlayerId: isWicket ? dismissedPlayerId || batterId : null,
        dismissedPlayerName: isWicket
          ? playerName(battingPlayers, dismissedPlayerId || batterId)
          : null,
        fielderPlayerId: isWicket ? fielderId || null : null,
        wicketCounts,
        creditedBowlerWicket,
        runOutKind: dismissalType === "run_out" ? runOutKind : null,
        note: ballNote
      }),
      "Delivery recorded."
    );

    setRunsOffBat(0);
    setExtraType("");
    setExtraRuns("0");
    setIsWicket(false);
    setBallNote("");
  }

  function chooseExtra(type: BallExtraType | "") {
    setExtraType(type);
    setRunsOffBat(0);
    setExtraRuns(type === "wide" || type === "no_ball" ? "1" : "0");
  }

  async function savePlayerOfMatch(event: FormEvent) {
    event.preventDefault();
    if (!bundle || !playerOfMatchId) {
      setErrorMessage("Select the player of the match.");
      return;
    }

    await runAction(
      () => setMatchPlayerOfMatch(
        bundle.match.id,
        playerOfMatchId,
        playerOfMatchReason
      ),
      "Player of the match saved."
    );
  }

  async function handleResetScoring() {
    if (!bundle || resetConfirmation !== "RESET") {
      setErrorMessage("Type RESET exactly before deleting the test score data.");
      return;
    }

    const accepted = window.confirm(
      "Delete all scoring data and score history for this match? " +
      "The scheduled match, teams and players will remain."
    );

    if (!accepted) return;

    await runAction(
      () => resetMatchScoringData(bundle.match.id, resetConfirmation),
      "Test scoring data deleted. The match is ready to score again."
    );
    setResetConfirmation("");
  }

  async function handleManualSave(event: FormEvent) {
    event.preventDefault();
    if (!bundle?.liveState) return;

    const cleanBatting = battingRows.filter((row) => row.playerName.trim());
    const cleanBowling = bowlingRows.filter((row) => row.playerName.trim());
    const cleanFielding = fieldingRows.filter((row) => row.playerName.trim());

    await runAction(
      () => saveManualInningsScore(bundle.match.id, bundle.liveState!.revision, {
        runs: numeric(manualRuns),
        wickets: numeric(manualWickets),
        legalBalls: numeric(manualLegalBalls),
        wides: numeric(manualWides),
        noBalls: numeric(manualNoBalls),
        byes: numeric(manualByes),
        legByes: numeric(manualLegByes),
        penaltyRuns: numeric(manualPenalty),
        isAllOut: manualAllOut,
        batting: cleanBatting,
        bowling: cleanBowling,
        fielding: cleanFielding,
        fallOfWickets: []
      }),
      "Manual innings score saved."
    );
  }

  function setBattingPlayer(index: number, id: string) {
    setBattingRows((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, playerId: id || null, playerName: playerName(battingPlayers, id) }
        : row
    ));
  }

  function setBowlingPlayer(index: number, id: string) {
    setBowlingRows((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, playerId: id || null, playerName: playerName(bowlingPlayers, id) }
        : row
    ));
  }

  function setFieldingPlayer(index: number, id: string) {
    setFieldingRows((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, playerId: id || null, playerName: playerName(bowlingPlayers, id) }
        : row
    ));
  }

  if (!tournamentId) {
    return <main className="score-control-page"><p>Select a tournament first.</p></main>;
  }

  if (loading) {
    return <main className="score-control-page"><p>Loading score control…</p></main>;
  }

  return (
    <main className="score-control-page">
      <header className="score-page-header">
        <div>
          <p className="page-label">MATCH OPERATIONS</p>
          <h1>Score control</h1>
          <p>{tournament?.tournament_name}</p>
        </div>
        <button type="button" onClick={() => void loadPage()} disabled={working}>
          Refresh scores
        </button>
      </header>

      {errorMessage && <div className="score-alert score-error">{errorMessage}</div>}
      {successMessage && <div className="score-alert score-success">{successMessage}</div>}

      <section className="score-match-selector">
        <label>
          Match to score
          <select value={selectedMatchId} onChange={(event) => selectMatch(event.target.value)}>
            <option value="">Select a scheduled match</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                Match {match.match_number} — {match.team_one?.name ?? match.team_one_placeholder} vs {match.team_two?.name ?? match.team_two_placeholder} ({statusLabel(match.status)})
              </option>
            ))}
          </select>
        </label>
      </section>

      {!bundle ? (
        <section className="score-empty-state">
          <h2>Select a match</h2>
          <p>Scheduled, live, innings-break and completed matches remain available here.</p>
        </section>
      ) : (
        <>
          <section className="score-match-banner">
            <div className="score-team">
              <strong>{bundle.match.team_one?.name ?? bundle.match.team_one_placeholder}</strong>
            </div>
            <div>
              <span>MATCH {bundle.match.match_number}</span>
              <b>VS</b>
              <small>{statusLabel(bundle.match.status)}</small>
            </div>
            <div className="score-team score-team-right">
              <strong>{bundle.match.team_two?.name ?? bundle.match.team_two_placeholder}</strong>
            </div>
          </section>

          {bundle.match.status === "scheduled" && (
            <form className="score-panel score-start-form" onSubmit={handleStart}>
              <div className="score-section-title">
                <div><span>01</span><h2>Start match</h2></div>
                <p>Confirm the toss and exact playing conditions before the first innings.</p>
              </div>
              <div className="score-form-grid">
                <label>Entry mode<select value={scoringMode} onChange={(e) => setScoringMode(e.target.value as "live" | "manual")}><option value="live">Live ball-by-ball</option><option value="manual">Quick manual innings</option></select></label>
                <label>Toss winner<select value={tossWinnerId} onChange={(e) => setTossWinnerId(e.target.value)}><option value="">Select team</option><option value={bundle.match.team_one_id ?? ""}>{bundle.match.team_one?.name}</option><option value={bundle.match.team_two_id ?? ""}>{bundle.match.team_two?.name}</option></select></label>
                <label>Toss decision<select value={tossDecision} onChange={(e) => setTossDecision(e.target.value as "bat" | "bowl")}><option value="bat">Bat</option><option value="bowl">Bowl</option></select></label>
                <label>Batting first<select value={battingTeamId} onChange={(e) => setBattingTeamId(e.target.value)}><option value="">Select team</option><option value={bundle.match.team_one_id ?? ""}>{bundle.match.team_one?.name}</option><option value={bundle.match.team_two_id ?? ""}>{bundle.match.team_two?.name}</option></select></label>
                <label>Overs<input type="number" min="1" value={overs} onChange={(e) => setOvers(e.target.value)} /></label>
                <label>Balls per over<input type="number" min="1" max="12" value={ballsPerOver} onChange={(e) => setBallsPerOver(e.target.value)} /></label>
                <label>Maximum wickets<input type="number" min="1" value={wickets} onChange={(e) => setWickets(e.target.value)} /></label>
              </div>
              <button className="score-primary-button" disabled={working || !tossWinnerId || !battingTeamId}>Start scoring</button>
            </form>
          )}

          {currentInnings && bundle.liveState && (
            <>
              <section className="score-live-summary">
                <div>
                  <span>INNINGS {currentInnings.innings_number}</span>
                  <h2>{teamName(bundle.match, currentInnings.batting_team_id)}</h2>
                </div>
                <strong>{currentInnings.runs}/{currentInnings.wickets}</strong>
                <div>
                  <span>OVERS</span>
                  <h2>{formatCricketOvers(currentInnings.legal_balls, currentInnings.balls_per_over)} / {currentInnings.maximum_overs}</h2>
                </div>
                {currentInnings.target_runs && <div><span>TARGET</span><h2>{currentInnings.target_runs}</h2></div>}
                <small>Revision {bundle.liveState.revision}</small>
              </section>

              {bundle.match.scoring_mode !== "manual" ? (
                <form className="score-panel" onSubmit={handleBall}>
                  <div className="score-section-title">
                    <div><span>02</span><h2>Record delivery</h2></div>
                    <p>Strike, over changes and free hits are controlled automatically.</p>
                  </div>

                  {bundle.liveState.free_hit && (
                    <div className="score-free-hit-banner">FREE HIT — active for the next valid delivery</div>
                  )}

                  {bundle.liveState.next_bowler_required && (
                    <div className="score-over-complete-banner">
                      Over complete. Select a different bowler for the next over.
                    </div>
                  )}

                  <div className="score-live-players">
                    <article className="score-live-player striker-card">
                      <span>STRIKER *</span>
                      <select
                        value={batterId}
                        onChange={(event) => setBatterId(event.target.value)}
                        disabled={Boolean(bundle.liveState.striker_player_id)}
                      >
                        <option value="">Select striker</option>
                        {availableLiveBatters
                          .filter((player) => player.id !== nonStrikerId)
                          .map((player) => (
                            <option key={player.id} value={player.id}>
                              #{player.player_number ?? "—"} {player.full_name}
                            </option>
                          ))}
                      </select>
                      <strong>{strikerScore?.runs ?? 0}<small> ({strikerScore?.balls ?? 0})</small></strong>
                      <p>{strikerScore?.fours ?? 0} fours · {strikerScore?.sixes ?? 0} sixes</p>
                    </article>

                    <article className="score-live-player">
                      <span>NON-STRIKER</span>
                      <select
                        value={nonStrikerId}
                        onChange={(event) => setNonStrikerId(event.target.value)}
                        disabled={Boolean(bundle.liveState.non_striker_player_id)}
                      >
                        <option value="">Select non-striker</option>
                        {availableLiveBatters
                          .filter((player) => player.id !== batterId)
                          .map((player) => (
                            <option key={player.id} value={player.id}>{player.full_name}</option>
                          ))}
                      </select>
                      <strong>{nonStrikerScore?.runs ?? 0}<small> ({nonStrikerScore?.balls ?? 0})</small></strong>
                      <p>{nonStrikerScore?.fours ?? 0} fours · {nonStrikerScore?.sixes ?? 0} sixes</p>
                    </article>

                    <article className="score-live-player bowler-card">
                      <span>{bundle.liveState.next_bowler_required ? "SELECT NEXT BOWLER" : "CURRENT BOWLER"}</span>
                      <select
                        value={bowlerId}
                        onChange={(event) => setBowlerId(event.target.value)}
                        disabled={Boolean(bundle.liveState.bowler_player_id)}
                      >
                        <option value="">Select bowler</option>
                        {bowlingPlayers
                          .filter((player) =>
                            !bundle.liveState?.next_bowler_required ||
                            player.id !== bundle.liveState.last_over_bowler_player_id
                          )
                          .map((player) => (
                            <option key={player.id} value={player.id}>{player.full_name}</option>
                          ))}
                      </select>
                      <strong>
                        {currentBowlerScore
                          ? formatCricketOvers(
                              currentBowlerScore.legal_balls,
                              currentInnings.balls_per_over
                            )
                          : "0.0"}
                        <small> overs</small>
                      </strong>
                      <p>{currentBowlerScore?.runs_conceded ?? 0} runs · {currentBowlerScore?.wickets ?? 0} wickets</p>
                    </article>
                  </div>

                  <fieldset className="score-run-picker">
                    <legend>Runs from the bat</legend>
                    {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                      <button
                        key={run}
                        type="button"
                        className={runsOffBat === run ? "selected" : ""}
                        disabled={extraType !== "" && extraType !== "no_ball"}
                        onClick={() => setRunsOffBat(run)}
                      >
                        {run}
                      </button>
                    ))}
                  </fieldset>

                  <fieldset className="score-extra-picker">
                    <legend>Extras</legend>
                    {([
                      ["", "NORMAL"],
                      ["wide", "WIDE"],
                      ["no_ball", "NO-BALL"],
                      ["bye", "BYE"],
                      ["leg_bye", "LEG BYE"],
                      ["penalty", "PENALTY"]
                    ] as Array<[BallExtraType | "", string]>).map(([type, label]) => (
                      <button
                        key={label}
                        type="button"
                        className={extraType === type ? "selected" : ""}
                        onClick={() => chooseExtra(type)}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>

                  {extraType && (
                    <div className="score-extra-total">
                      <div>
                        <span>Total {extraType.replace("_", " ")} extras</span>
                        <small>
                          {extraType === "wide" || extraType === "no_ball"
                            ? "The automatic one run is already included."
                            : "Enter all completed extra runs."}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExtraRuns(String(Math.max(
                          extraType === "wide" || extraType === "no_ball" ? 1 : 0,
                          numeric(extraRuns) - 1
                        )))}
                      >−</button>
                      <strong>{extraRuns}</strong>
                      <button type="button" onClick={() => setExtraRuns(String(numeric(extraRuns) + 1))}>+</button>
                    </div>
                  )}

                  {extraType === "no_ball" && (
                    <p className="score-delivery-total">
                      Delivery total: <strong>{runsOffBat + numeric(extraRuns)}</strong> — batter {runsOffBat}, extras {numeric(extraRuns)}
                    </p>
                  )}

                  <label className="score-operator-note">
                    Operator note
                    <input value={ballNote} onChange={(event) => setBallNote(event.target.value)} placeholder="Optional correction context" />
                  </label>
                  <label className="score-check"><input type="checkbox" checked={isWicket} onChange={(e) => setIsWicket(e.target.checked)} /><span>Wicket on this delivery</span></label>
                  {isWicket && <div className="score-wicket-box">
                    <label>Dismissal<select value={dismissalType} onChange={(e) => setDismissalType(e.target.value as DismissalType)}>{dismissalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label>Dismissed player<select value={dismissedPlayerId} onChange={(e) => setDismissedPlayerId(e.target.value)}><option value="">Use striker</option>{availableLiveBatters.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
                    <label>Fielder<select value={fielderId} onChange={(e) => setFielderId(e.target.value)}><option value="">No fielder</option>{bowlingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
                    {dismissalType === "run_out" && (
                      <label>Run-out type<select value={runOutKind} onChange={(event) => setRunOutKind(event.target.value as "direct" | "assisted")}><option value="direct">Direct run-out</option><option value="assisted">Assisted run-out</option></select></label>
                    )}
                    <label className="score-check"><input type="checkbox" checked={wicketCounts} disabled={bundle.liveState.free_hit && dismissalType !== "run_out"} onChange={(e) => setWicketCounts(e.target.checked)} /><span>Counts as team wicket</span></label>
                    <label className="score-check"><input type="checkbox" checked={creditedBowlerWicket} disabled={dismissalType === "run_out" || bundle.liveState.free_hit} onChange={(e) => setCreditedBowlerWicket(e.target.checked)} /><span>Credit bowler</span></label>
                  </div>}
                  <button className="score-primary-button" disabled={working || !batterId || !nonStrikerId || !bowlerId}>
                    {working ? "Saving delivery…" : "Record delivery"}
                  </button>
                </form>
              ) : (
                <form className="score-panel" onSubmit={handleManualSave}>
                  <div className="score-section-title"><div><span>02</span><h2>Quick innings entry</h2></div><p>Enter the innings summary, then add the available batting, bowling and fielding details.</p></div>
                  <div className="score-form-grid score-total-grid">
                    <label>Runs<input type="number" min="0" value={manualRuns} onChange={(e) => setManualRuns(e.target.value)} /></label>
                    <label>Wickets<input type="number" min="0" value={manualWickets} onChange={(e) => setManualWickets(e.target.value)} /></label>
                    <label>Legal balls<input type="number" min="0" value={manualLegalBalls} onChange={(e) => setManualLegalBalls(e.target.value)} /></label>
                    <label>Wides<input type="number" min="0" value={manualWides} onChange={(e) => setManualWides(e.target.value)} /></label>
                    <label>No-balls<input type="number" min="0" value={manualNoBalls} onChange={(e) => setManualNoBalls(e.target.value)} /></label>
                    <label>Byes<input type="number" min="0" value={manualByes} onChange={(e) => setManualByes(e.target.value)} /></label>
                    <label>Leg byes<input type="number" min="0" value={manualLegByes} onChange={(e) => setManualLegByes(e.target.value)} /></label>
                    <label>Penalty<input type="number" min="0" value={manualPenalty} onChange={(e) => setManualPenalty(e.target.value)} /></label>
                  </div>
                  <label className="score-check"><input type="checkbox" checked={manualAllOut} onChange={(e) => setManualAllOut(e.target.checked)} /><span>Team was all out</span></label>

                  <div className="score-table-block"><header><h3>Batting</h3><button type="button" onClick={() => setBattingRows((rows) => [...rows, newBattingRow(rows.length + 1)])}>+ Batter</button></header>
                    {battingRows.map((row, index) => <div className="score-entry-row batting-entry-row" key={`bat-${index}`}>
                      <select value={row.playerId ?? ""} onChange={(e) => setBattingPlayer(index, e.target.value)}><option value="">Select batter</option>{battingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
                      {(["runs", "balls", "fours", "sixes"] as const).map((field) => <label key={field}><span>{field}</span><input type="number" min="0" value={row[field]} onChange={(e) => setBattingRows((rows) => rows.map((item, i) => i === index ? { ...item, [field]: numeric(e.target.value) } : item))} /></label>)}
                      <select value={row.dismissalType} onChange={(e) => setBattingRows((rows) => rows.map((item, i) => i === index ? { ...item, dismissalType: e.target.value as DismissalType } : item))}><option value="not_out">Not out</option>{dismissalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                      <button type="button" className="score-remove" onClick={() => setBattingRows((rows) => rows.filter((_, i) => i !== index))}>×</button>
                    </div>)}
                  </div>

                  <div className="score-table-block"><header><h3>Bowling</h3><button type="button" onClick={() => setBowlingRows((rows) => [...rows, newBowlingRow()])}>+ Bowler</button></header>
                    {bowlingRows.map((row, index) => <div className="score-entry-row bowling-entry-row" key={`bowl-${index}`}>
                      <select value={row.playerId ?? ""} onChange={(e) => setBowlingPlayer(index, e.target.value)}><option value="">Select bowler</option>{bowlingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
                      {(["legalBalls", "runsConceded", "wickets", "wides", "noBalls"] as const).map((field) => <label key={field}><span>{field.replaceAll(/([A-Z])/g, " $1")}</span><input type="number" min="0" value={row[field]} onChange={(e) => setBowlingRows((rows) => rows.map((item, i) => i === index ? { ...item, [field]: numeric(e.target.value) } : item))} /></label>)}
                      <button type="button" className="score-remove" onClick={() => setBowlingRows((rows) => rows.filter((_, i) => i !== index))}>×</button>
                    </div>)}
                  </div>

                  <div className="score-table-block"><header><h3>Fielding</h3><button type="button" onClick={() => setFieldingRows((rows) => [...rows, newFieldingRow()])}>+ Fielder</button></header>
                    {fieldingRows.map((row, index) => <div className="score-entry-row fielding-entry-row" key={`field-${index}`}>
                      <select value={row.playerId ?? ""} onChange={(e) => setFieldingPlayer(index, e.target.value)}><option value="">Select fielder</option>{bowlingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
                      {(["catches", "stumpings", "directRunOuts", "assistedRunOuts"] as const).map((field) => <label key={field}><span>{field.replaceAll(/([A-Z])/g, " $1")}</span><input type="number" min="0" value={row[field]} onChange={(e) => setFieldingRows((rows) => rows.map((item, i) => i === index ? { ...item, [field]: numeric(e.target.value) } : item))} /></label>)}
                      <button type="button" className="score-remove" onClick={() => setFieldingRows((rows) => rows.filter((_, i) => i !== index))}>×</button>
                    </div>)}
                  </div>
                  <button className="score-primary-button" disabled={working}>Save innings score</button>
                </form>
              )}

              <section className="score-panel score-operator-protection">
                <div><h2>Operator protections</h2><p>Undo requires a reason and is written to the permanent score audit.</p></div>
                {bundle.match.scoring_mode !== "manual" && <div className="score-undo-row"><input value={undoReason} onChange={(e) => setUndoReason(e.target.value)} placeholder="Reason for undo" /><button type="button" disabled={working || !undoReason.trim() || bundle.recentEvents.length === 0} onClick={() => void runAction(() => undoLastMatchBall(bundle.match.id, bundle.liveState!.revision, undoReason), "Last delivery undone.").then(() => setUndoReason(""))}>Undo last ball</button></div>}
                <button type="button" className="score-complete-button" disabled={working} onClick={() => {
                  if (window.confirm("Complete this innings? Check the score before continuing.")) void runAction(() => completeCurrentInnings(bundle.match.id, bundle.liveState!.revision), currentInnings.innings_number === 1 ? "First innings completed." : "Match completed.");
                }}>{currentInnings.innings_number === 1 ? "Complete first innings" : "Complete match"}</button>
              </section>

              {bundle.match.scoring_mode !== "manual" && <section className="score-panel"><div className="score-section-title"><div><span>03</span><h2>Recent deliveries</h2></div></div><div className="score-event-list">{bundle.recentEvents.length === 0 ? <p>No deliveries recorded yet.</p> : bundle.recentEvents.map((event) => <article key={event.id}><strong>{event.over_number}.{event.ball_in_over}</strong><span>{event.batter_name} — {event.runs_off_bat + event.extra_runs} run{event.runs_off_bat + event.extra_runs === 1 ? "" : "s"}{event.extra_type ? ` (${event.extra_type.replace("_", " ")})` : ""}</span>{event.is_wicket && <b>WICKET</b>}</article>)}</div></section>}
            </>
          )}

          {bundle.match.status === "innings_break" && bundle.liveState && (
            <section className="score-panel score-break-panel"><span>INNINGS BREAK</span><h2>Target: {bundle.liveState.target_runs}</h2><p>Confirm the second-innings conditions and start when both teams are ready.</p><button className="score-primary-button" disabled={working} onClick={() => void runAction(() => startSecondInnings(bundle.match.id, bundle.liveState!.revision), "Second innings started.")}>Start second innings</button></section>
          )}

          {bundle.match.status === "completed" && (
            <>
              <section className="score-panel score-result-panel">
                <span>FINAL RESULT</span>
                <h2>{bundle.match.result_summary}</h2>
                <div>{bundle.innings.map((innings) => <article key={innings.id}><strong>{teamName(bundle.match, innings.batting_team_id)}</strong><b>{innings.runs}/{innings.wickets}</b><small>{formatCricketOvers(innings.legal_balls, innings.balls_per_over)} overs</small></article>)}</div>
              </section>

              <CompletedScoreCorrection
                bundle={bundle}
                onCorrected={loadPage}
              />

              <form className="score-panel score-pom-form" onSubmit={savePlayerOfMatch}>
                <div>
                  <span>POST-MATCH AWARD</span>
                  <h2>Player of the match</h2>
                  <p>Select the player after reviewing batting, bowling and fielding performance.</p>
                </div>
                <label>
                  Player
                  <select value={playerOfMatchId} onChange={(event) => setPlayerOfMatchId(event.target.value)}>
                    <option value="">Select player</option>
                    {bundle.players
                      .filter((player) => player.sold_team_id === bundle.match.team_one_id || player.sold_team_id === bundle.match.team_two_id)
                      .map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
                <label>
                  Performance reason
                  <input value={playerOfMatchReason} onChange={(event) => setPlayerOfMatchReason(event.target.value)} placeholder="Example: 42 runs and 2 wickets" />
                </label>
                <button className="score-primary-button" disabled={working || !playerOfMatchId}>Save award</button>
              </form>
            </>
          )}

          {bundle.innings.length > 0 && (
            <section className="score-panel score-reset-panel">
              <div>
                <span>TESTING CLEANUP</span>
                <h2>Reset this match’s scoring data</h2>
                <p>
                  Deletes both innings, deliveries, scorecards and score audit
                  history. The scheduled match, teams and registered players
                  are not deleted.
                </p>
              </div>

              <div className="score-reset-confirmation">
                <label>
                  Type RESET to confirm
                  <input
                    value={resetConfirmation}
                    onChange={(event) =>
                      setResetConfirmation(event.target.value)
                    }
                    placeholder="RESET"
                    autoComplete="off"
                  />
                </label>

                <button
                  type="button"
                  disabled={working || resetConfirmation !== "RESET"}
                  onClick={() => void handleResetScoring()}
                >
                  Delete test score data
                </button>
              </div>
            </section>
          )}

          {bundle.innings.length > 0 && (
            <section className="score-complete-scorecard">
              <div className="score-section-title">
                <div><span>04</span><h2>Full match scorecard</h2></div>
                <p>Legal balls are retained separately for future NRR calculation.</p>
              </div>
              <ScorecardTables
                match={bundle.match}
                innings={bundle.innings}
                fielding={bundle.fielding}
              />
            </section>
          )}

          {tournament && bundle.innings.length > 0 && (
            <MatchSummaryCard
              tournament={tournament}
              match={bundle.match}
              innings={bundle.innings}
              playerOfMatch={selectedPlayerOfMatch}
            />
          )}
        </>
      )}
    </main>
  );
}
