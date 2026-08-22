import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  correctCompletedMatchInnings,
  type ManualBattingInput,
  type ManualBowlingInput,
  type ManualFieldingInput
} from "../../services/scoring";

import type {
  DismissalType,
  MatchInnings,
  Player
} from "../../types/database";
import type { MatchScoringBundle } from "../../services/scoring";

import "./CompletedScoreCorrection.css";

const dismissalOptions: Array<{
  value: DismissalType;
  label: string;
}> = [
  { value: "not_out", label: "Not out" },
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "run_out", label: "Run out" },
  { value: "stumped", label: "Stumped" },
  { value: "hit_wicket", label: "Hit wicket" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" }
];

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function playerName(players: Player[], id: string) {
  return players.find((player) => player.id === id)?.full_name ?? "";
}

function inningsTeamName(bundle: MatchScoringBundle, innings: MatchInnings) {
  if (innings.batting_team_id === bundle.match.team_one_id) {
    return bundle.match.team_one?.name ?? "Team one";
  }
  return bundle.match.team_two?.name ?? "Team two";
}

function emptyBatting(position: number): ManualBattingInput {
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

function emptyBowling(): ManualBowlingInput {
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

function emptyFielding(): ManualFieldingInput {
  return {
    playerId: null,
    playerName: "",
    catches: 0,
    stumpings: 0,
    directRunOuts: 0,
    assistedRunOuts: 0
  };
}

export default function CompletedScoreCorrection({
  bundle,
  onCorrected
}: {
  bundle: MatchScoringBundle;
  onCorrected: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [inningsId, setInningsId] = useState(
    bundle.innings[0]?.id ?? ""
  );
  const [reason, setReason] = useState("");
  const [runs, setRuns] = useState("0");
  const [wickets, setWickets] = useState("0");
  const [legalBalls, setLegalBalls] = useState("0");
  const [wides, setWides] = useState("0");
  const [noBalls, setNoBalls] = useState("0");
  const [byes, setByes] = useState("0");
  const [legByes, setLegByes] = useState("0");
  const [penaltyRuns, setPenaltyRuns] = useState("0");
  const [allOut, setAllOut] = useState(false);
  const [batting, setBatting] = useState<ManualBattingInput[]>([]);
  const [bowling, setBowling] = useState<ManualBowlingInput[]>([]);
  const [fielding, setFielding] = useState<ManualFieldingInput[]>([]);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedInnings = useMemo(
    () => bundle.innings.find((record) => record.id === inningsId) ?? null,
    [bundle.innings, inningsId]
  );

  const battingPlayers = useMemo(
    () => bundle.players.filter(
      (player) => player.sold_team_id === selectedInnings?.batting_team_id
    ),
    [bundle.players, selectedInnings]
  );

  const bowlingPlayers = useMemo(
    () => bundle.players.filter(
      (player) => player.sold_team_id === selectedInnings?.bowling_team_id
    ),
    [bundle.players, selectedInnings]
  );

  useEffect(() => {
    if (!selectedInnings) return;

    setRuns(String(selectedInnings.runs));
    setWickets(String(selectedInnings.wickets));
    setLegalBalls(String(selectedInnings.legal_balls));
    setWides(String(selectedInnings.wides));
    setNoBalls(String(selectedInnings.no_balls));
    setByes(String(selectedInnings.byes));
    setLegByes(String(selectedInnings.leg_byes));
    setPenaltyRuns(String(selectedInnings.penalty_runs));
    setAllOut(selectedInnings.is_all_out);
    setBatting(
      (selectedInnings.batting_scorecards ?? []).map((row, index) => ({
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
    );
    setBowling(
      (selectedInnings.bowling_scorecards ?? []).map((row) => ({
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
    );
    setFielding(
      bundle.fielding
        .filter((row) => row.team_id === selectedInnings.bowling_team_id)
        .map((row) => ({
          playerId: row.player_id,
          playerName: row.player_name,
          catches: row.catches,
          stumpings: row.stumpings,
          directRunOuts: row.direct_run_outs,
          assistedRunOuts: row.assisted_run_outs
        }))
    );
    setReason("");
    setErrorMessage("");
    setSuccessMessage("");
  }, [bundle.fielding, selectedInnings]);

  function setBattingPlayer(index: number, id: string) {
    setBatting((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            playerId: id || null,
            playerName: playerName(battingPlayers, id)
          }
        : row
    ));
  }

  function setBowlingPlayer(index: number, id: string) {
    setBowling((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            playerId: id || null,
            playerName: playerName(bowlingPlayers, id)
          }
        : row
    ));
  }

  function setFieldingPlayer(index: number, id: string) {
    setFielding((rows) => rows.map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            playerId: id || null,
            playerName: playerName(bowlingPlayers, id)
          }
        : row
    ));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedInnings) return;

    if (reason.trim().length < 3) {
      setErrorMessage("Enter a short reason explaining the correction.");
      return;
    }

    const accepted = window.confirm(
      "Save this completed-match correction? The result, points table and NRR will be recalculated."
    );
    if (!accepted) return;

    setWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await correctCompletedMatchInnings(
        bundle.match.id,
        selectedInnings.id,
        {
          runs: numeric(runs),
          wickets: numeric(wickets),
          legalBalls: numeric(legalBalls),
          wides: numeric(wides),
          noBalls: numeric(noBalls),
          byes: numeric(byes),
          legByes: numeric(legByes),
          penaltyRuns: numeric(penaltyRuns),
          isAllOut: allOut,
          batting: batting.filter((row) => row.playerName.trim()),
          bowling: bowling.filter((row) => row.playerName.trim()),
          fielding: fielding.filter((row) => row.playerName.trim()),
          fallOfWickets: (selectedInnings.fall_of_wickets ?? []).map((row) => ({
            wicketNumber: row.wicket_number,
            teamRuns: row.team_runs,
            legalBalls: row.legal_balls,
            playerId: row.player_id,
            playerName: row.player_name
          }))
        },
        reason
      );

      setSuccessMessage(
        "Correction saved. Result, public scorecard, points and NRR were refreshed."
      );
      await onCorrected();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The completed score could not be corrected."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="completed-correction score-panel">
      <header className="completed-correction-heading">
        <div>
          <span>SAFE CORRECTION</span>
          <h2>Edit completed match score</h2>
          <p>
            Correct totals and player scorecards without deleting the original
            delivery history. Every correction is recorded in the score audit.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)}>
          {open ? "Close correction" : "Open correction editor"}
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="completed-correction-form">
          {errorMessage && <div className="score-alert score-error">{errorMessage}</div>}
          {successMessage && <div className="score-alert score-success">{successMessage}</div>}

          <div className="completed-correction-top">
            <label>
              Innings to correct
              <select value={inningsId} onChange={(event) => setInningsId(event.target.value)}>
                {bundle.innings.map((record) => (
                  <option value={record.id} key={record.id}>
                    Innings {record.innings_number} — {inningsTeamName(bundle, record)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Correction reason
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: scorer entered 48 instead of 43"
              />
            </label>
          </div>

          <div className="score-form-grid score-total-grid">
            <label>Runs<input type="number" min="0" value={runs} onChange={(event) => setRuns(event.target.value)} /></label>
            <label>Wickets<input type="number" min="0" value={wickets} onChange={(event) => setWickets(event.target.value)} /></label>
            <label>Legal balls<input type="number" min="0" value={legalBalls} onChange={(event) => setLegalBalls(event.target.value)} /></label>
            <label>Wides<input type="number" min="0" value={wides} onChange={(event) => setWides(event.target.value)} /></label>
            <label>No-balls<input type="number" min="0" value={noBalls} onChange={(event) => setNoBalls(event.target.value)} /></label>
            <label>Byes<input type="number" min="0" value={byes} onChange={(event) => setByes(event.target.value)} /></label>
            <label>Leg byes<input type="number" min="0" value={legByes} onChange={(event) => setLegByes(event.target.value)} /></label>
            <label>Penalty<input type="number" min="0" value={penaltyRuns} onChange={(event) => setPenaltyRuns(event.target.value)} /></label>
          </div>

          <label className="score-check">
            <input type="checkbox" checked={allOut} onChange={(event) => setAllOut(event.target.checked)} />
            <span>Team was all out</span>
          </label>

          <div className="score-table-block">
            <header><h3>Batting</h3><button type="button" onClick={() => setBatting((rows) => [...rows, emptyBatting(rows.length + 1)])}>+ Batter</button></header>
            {batting.map((row, index) => (
              <div className="score-entry-row batting-entry-row" key={`correction-bat-${index}`}>
                <select value={row.playerId ?? ""} onChange={(event) => setBattingPlayer(index, event.target.value)}><option value="">Select batter</option>{battingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}</select>
                {(["runs", "balls", "fours", "sixes"] as const).map((field) => <label key={field}><span>{field}</span><input type="number" min="0" value={row[field]} onChange={(event) => setBatting((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: numeric(event.target.value) } : item))} /></label>)}
                <select value={row.dismissalType} onChange={(event) => setBatting((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, dismissalType: event.target.value as DismissalType } : item))}>{dismissalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <button type="button" className="score-remove" onClick={() => setBatting((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button>
              </div>
            ))}
          </div>

          <div className="score-table-block">
            <header><h3>Bowling</h3><button type="button" onClick={() => setBowling((rows) => [...rows, emptyBowling()])}>+ Bowler</button></header>
            {bowling.map((row, index) => (
              <div className="score-entry-row bowling-entry-row" key={`correction-bowl-${index}`}>
                <select value={row.playerId ?? ""} onChange={(event) => setBowlingPlayer(index, event.target.value)}><option value="">Select bowler</option>{bowlingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}</select>
                {(["legalBalls", "runsConceded", "wickets", "wides", "noBalls"] as const).map((field) => <label key={field}><span>{field.replaceAll(/([A-Z])/g, " $1")}</span><input type="number" min="0" value={row[field]} onChange={(event) => setBowling((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: numeric(event.target.value) } : item))} /></label>)}
                <button type="button" className="score-remove" onClick={() => setBowling((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button>
              </div>
            ))}
          </div>

          <div className="score-table-block">
            <header><h3>Fielding</h3><button type="button" onClick={() => setFielding((rows) => [...rows, emptyFielding()])}>+ Fielder</button></header>
            {fielding.map((row, index) => (
              <div className="score-entry-row fielding-entry-row" key={`correction-field-${index}`}>
                <select value={row.playerId ?? ""} onChange={(event) => setFieldingPlayer(index, event.target.value)}><option value="">Select fielder</option>{bowlingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}</select>
                {(["catches", "stumpings", "directRunOuts", "assistedRunOuts"] as const).map((field) => <label key={field}><span>{field.replaceAll(/([A-Z])/g, " $1")}</span><input type="number" min="0" value={row[field]} onChange={(event) => setFielding((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: numeric(event.target.value) } : item))} /></label>)}
                <button type="button" className="score-remove" onClick={() => setFielding((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button>
              </div>
            ))}
          </div>

          <button className="score-primary-button" disabled={working || reason.trim().length < 3}>
            {working ? "Saving correction…" : "Save completed-match correction"}
          </button>
        </form>
      )}
    </section>
  );
}
