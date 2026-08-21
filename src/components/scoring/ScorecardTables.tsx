import type {
  FieldingScorecard,
  MatchInnings,
  TournamentMatch
} from "../../types/database";

import { formatCricketOvers } from "../../services/scoring";

import "./ScorecardTables.css";

interface ScorecardTablesProps {
  match: TournamentMatch;
  innings: MatchInnings[];
  fielding: FieldingScorecard[];
  compact?: boolean;
}

function teamName(match: TournamentMatch, teamId: string) {
  if (teamId === match.team_one_id) return match.team_one?.name ?? "Team one";
  if (teamId === match.team_two_id) return match.team_two?.name ?? "Team two";
  return "Team";
}

function dismissalText(value: string | null, type: string) {
  if (value) return value.replaceAll("_", " ");
  return type === "not_out" ? "not out" : type.replaceAll("_", " ");
}

export default function ScorecardTables({
  match,
  innings,
  fielding,
  compact = false
}: ScorecardTablesProps) {
  return (
    <div className={`full-scorecard ${compact ? "compact-scorecard" : ""}`}>
      {innings.map((record) => {
        const batting = record.batting_scorecards ?? [];
        const bowling = record.bowling_scorecards ?? [];
        const inningsFielding = fielding.filter(
          (row) => row.team_id === record.bowling_team_id
        );

        return (
          <section className="scorecard-innings" key={record.id}>
            <header>
              <div>
                <span>INNINGS {record.innings_number}</span>
                <h2>{teamName(match, record.batting_team_id)}</h2>
              </div>
              <strong>{record.runs}/{record.wickets}</strong>
              <small>
                {formatCricketOvers(record.legal_balls, record.balls_per_over)} overs
              </small>
            </header>

            <div className="scorecard-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Batter</th><th>Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
                  </tr>
                </thead>
                <tbody>
                  {batting.length === 0 ? (
                    <tr><td colSpan={7}>Batting details are not available yet.</td></tr>
                  ) : batting.map((row) => (
                    <tr key={row.id}>
                      <td><b>{row.player_name}</b></td>
                      <td>{dismissalText(row.dismissal_text, row.dismissal_type)}</td>
                      <td><strong>{row.runs}</strong></td>
                      <td>{row.balls}</td>
                      <td>{row.fours}</td>
                      <td>{row.sixes}</td>
                      <td>{row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(1) : "0.0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="scorecard-extras">
              <span>Extras <b>{record.extras}</b></span>
              <small>WD {record.wides} · NB {record.no_balls} · B {record.byes} · LB {record.leg_byes} · P {record.penalty_runs}</small>
            </div>

            <div className="scorecard-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>WD</th><th>NB</th><th>ECON</th>
                  </tr>
                </thead>
                <tbody>
                  {bowling.length === 0 ? (
                    <tr><td colSpan={8}>Bowling details are not available yet.</td></tr>
                  ) : bowling.map((row) => {
                    const overs = row.legal_balls / record.balls_per_over;
                    return (
                      <tr key={row.id}>
                        <td><b>{row.player_name}</b></td>
                        <td>{formatCricketOvers(row.legal_balls, record.balls_per_over)}</td>
                        <td>{row.maidens}</td>
                        <td>{row.runs_conceded}</td>
                        <td><strong>{row.wickets}</strong></td>
                        <td>{row.wides}</td>
                        <td>{row.no_balls}</td>
                        <td>{overs > 0 ? (row.runs_conceded / overs).toFixed(2) : "0.00"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {inningsFielding.length > 0 && (
              <div className="scorecard-fielding">
                <h3>Fielding — {teamName(match, record.bowling_team_id)}</h3>
                <div>
                  {inningsFielding.map((row) => (
                    <span key={row.id}>
                      <b>{row.player_name}</b>: C {row.catches}, ST {row.stumpings}, RO {row.direct_run_outs + row.assisted_run_outs}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(record.fall_of_wickets?.length ?? 0) > 0 && (
              <div className="scorecard-fow">
                <b>Fall of wickets:</b>{" "}
                {record.fall_of_wickets?.map((wicket) =>
                  `${wicket.team_runs}/${wicket.wicket_number} (${wicket.player_name}, ${formatCricketOvers(wicket.legal_balls, record.balls_per_over)})`
                ).join(" · ")}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
