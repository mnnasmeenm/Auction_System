import type { CSSProperties } from "react";

import { getTeamLogoUrl } from "../../services/teams";

import type { PointsTableRow } from "../../types/database";

import "./PointsTable.css";

interface PointsTableProps {
  rows: PointsTableRow[];
  qualifiersCount?: number;
  eliminatedTeamIds?: string[];
}

function formatNrr(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

export default function PointsTable({
  rows,
  qualifiersCount = 0,
  eliminatedTeamIds = []
}: PointsTableProps) {
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>POS</th>
            <th>TEAM</th>
            <th>M</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>NR</th>
            <th>PTS</th>
            <th>NRR</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const logo = getTeamLogoUrl(row.logo_path);
            const qualifying = qualifiersCount > 0 &&
              row.position <= qualifiersCount;
            const eliminated = eliminatedTeamIds.includes(row.team_id);

            return (
              <tr
                key={row.team_id}
                className={qualifying ? "qualifying-row" : ""}
                style={{ "--standing-team": row.team_color } as CSSProperties}
              >
                <td data-label="Position">
                  <strong className="standing-position">
                    {row.position}
                  </strong>
                </td>
                <td data-label="Team">
                  <div className="standing-team">
                    <span>
                      {logo ? (
                        <img src={logo} alt="" />
                      ) : row.short_name.slice(0, 3)}
                    </span>
                    <strong>{row.team_name}</strong>
                    {eliminated
                      ? <small className="standing-eliminated">E</small>
                      : qualifying && <small>Q</small>}
                  </div>
                </td>
                <td data-label="Played">{row.played}</td>
                <td data-label="Won">{row.won}</td>
                <td data-label="Lost">{row.lost}</td>
                <td data-label="Tied">{row.tied}</td>
                <td data-label="No result">{row.no_result}</td>
                <td data-label="Points"><b>{row.points}</b></td>
                <td data-label="NRR" className={row.net_run_rate >= 0 ? "positive-nrr" : "negative-nrr"}>
                  {formatNrr(row.net_run_rate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
