import { getCompetitionSettings } from "./competitionSettings";
import { getTournamentMatches } from "./matches";
import {
  getTournamentStandingsSections,
  type StandingsSection
} from "./standings";

import type {
  PointsTableRow,
  TournamentMatch
} from "../types/database";

export type QualificationState =
  | "qualified"
  | "eliminated"
  | "contending";

export interface NrrScenario {
  battingFirst: string;
  chasing: string;
  targetNrr: number;
  referenceRuns: number;
  ballsPerOver: number;
  maximumBalls: number;
}

export interface TeamQualificationAdvice {
  row: PointsTableRow;
  state: QualificationState;
  remainingMatches: number;
  maximumPoints: number;
  minimumWinsForPointsLead: number | null;
  cutoffPoints: number;
  cutoffNrr: number;
  nrrGap: number;
  nextMatch: TournamentMatch | null;
  summary: string;
  actions: string[];
  scenario: NrrScenario | null;
}

export interface QualificationAdviceSection
  extends StandingsSection {
  advice: TeamQualificationAdvice[];
}

const ACTIVE_MATCH_STATUSES = new Set([
  "scheduled",
  "live",
  "innings_break"
]);

function isRegularStage(match: TournamentMatch) {
  return match.stage === "league" || match.stage === "group";
}

function matchesSection(
  match: TournamentMatch,
  section: StandingsSection
) {
  if (match.division_id !== section.division.id) return false;
  if (!isRegularStage(match)) return false;

  return section.group
    ? match.group_id === section.group.id
    : true;
}

function teamAppears(match: TournamentMatch, teamId: string) {
  return match.team_one_id === teamId || match.team_two_id === teamId;
}

function projectedNrr(
  row: PointsTableRow,
  scored: number,
  ballsFaced: number,
  conceded: number,
  ballsBowled: number,
  ballsPerOver: number
) {
  const newOversFor = row.overs_for + ballsFaced / ballsPerOver;
  const newOversAgainst = row.overs_against + ballsBowled / ballsPerOver;
  const runRateFor = newOversFor > 0
    ? (row.runs_for + scored) / newOversFor
    : 0;
  const runRateAgainst = newOversAgainst > 0
    ? (row.runs_against + conceded) / newOversAgainst
    : 0;

  return runRateFor - runRateAgainst;
}

function cricketOvers(legalBalls: number, ballsPerOver: number) {
  return `${Math.floor(legalBalls / ballsPerOver)}.${
    legalBalls % ballsPerOver
  }`;
}

function buildScenario(
  row: PointsTableRow,
  nextMatch: TournamentMatch | null,
  targetNrr: number,
  referenceRuns: number
): NrrScenario | null {
  if (!nextMatch) return null;

  const ballsPerOver = nextMatch.balls_per_over;
  const maximumBalls =
    nextMatch.overs_per_innings * ballsPerOver;
  const plannedRuns = Math.max(1, Math.floor(referenceRuns));

  let maximumConceded: number | null = null;
  for (let conceded = plannedRuns - 1; conceded >= 0; conceded -= 1) {
    if (
      projectedNrr(
        row,
        plannedRuns,
        maximumBalls,
        conceded,
        maximumBalls,
        ballsPerOver
      ) >= targetNrr
    ) {
      maximumConceded = conceded;
      break;
    }
  }

  const chaseRuns = plannedRuns + 1;
  let latestChaseBall: number | null = null;
  for (let balls = maximumBalls; balls >= 1; balls -= 1) {
    if (
      projectedNrr(
        row,
        chaseRuns,
        balls,
        plannedRuns,
        maximumBalls,
        ballsPerOver
      ) >= targetNrr
    ) {
      latestChaseBall = balls;
      break;
    }
  }

  return {
    targetNrr,
    referenceRuns: plannedRuns,
    ballsPerOver,
    maximumBalls,
    battingFirst: maximumConceded === null
      ? `Scoring ${plannedRuns} in the full quota is not enough to reach the present NRR target. Increase the planning score.`
      : `If batting first, score ${plannedRuns} and restrict the opponent to ${maximumConceded} or fewer in the full quota.`,
    chasing: latestChaseBall === null
      ? `Chasing ${chaseRuns} after conceding ${plannedRuns} cannot reach the present NRR target inside this match quota.`
      : `If chasing ${chaseRuns}, complete the chase by ${cricketOvers(latestChaseBall, ballsPerOver)} overs (${latestChaseBall} legal balls) or earlier.`
  };
}

function buildAdvice(
  section: StandingsSection,
  matches: TournamentMatch[],
  maximumAward: number,
  referenceRuns: number
): TeamQualificationAdvice[] {
  const qualifiers = Math.min(
    Math.max(section.qualifiersCount, 1),
    section.rows.length
  );
  const cutoff = section.rows[qualifiers - 1] ?? null;
  const relevantMatches = matches.filter((match) =>
    matchesSection(match, section)
  );

  const remainingByTeam = new Map<string, TournamentMatch[]>();
  section.rows.forEach((row) => {
    remainingByTeam.set(
      row.team_id,
      relevantMatches.filter(
        (match) =>
          ACTIVE_MATCH_STATUSES.has(match.status) &&
          teamAppears(match, row.team_id)
      )
    );
  });

  const maximumPoints = new Map(
    section.rows.map((row) => [
      row.team_id,
      row.points +
        (remainingByTeam.get(row.team_id)?.length ?? 0) * maximumAward
    ])
  );

  return section.rows.map((row) => {
    const remaining = remainingByTeam.get(row.team_id) ?? [];
    const teamMaximum = maximumPoints.get(row.team_id) ?? row.points;
    const completed = remaining.length === 0;
    const teamsStrictlyBeyondMaximum = section.rows.filter(
      (other) =>
        other.team_id !== row.team_id &&
        other.points > teamMaximum
    ).length;
    const teamsThatCanReachCurrent = section.rows.filter(
      (other) =>
        other.team_id !== row.team_id &&
        (maximumPoints.get(other.team_id) ?? other.points) >= row.points
    ).length;

    let state: QualificationState = "contending";

    if (completed) {
      state = row.position <= qualifiers
        ? "qualified"
        : "eliminated";
    } else if (teamsStrictlyBeyondMaximum >= qualifiers) {
      state = "eliminated";
    } else if (teamsThatCanReachCurrent < qualifiers) {
      state = "qualified";
    }

    const cutoffPoints = cutoff?.points ?? 0;
    const cutoffNrr = cutoff?.net_run_rate ?? 0;
    const nrrGap = Math.max(0, cutoffNrr - row.net_run_rate);
    const pointsNeededForLead = Math.max(
      0,
      cutoffPoints + 1 - row.points
    );
    const minimumWinsForPointsLead = maximumAward > 0
      ? Math.ceil(pointsNeededForLead / maximumAward)
      : null;
    const nextMatch = remaining[0] ?? null;
    const targetNrr = Math.max(
      row.net_run_rate,
      cutoffNrr + 0.001
    );
    const scenario = state === "contending"
      ? buildScenario(
          row,
          nextMatch,
          targetNrr,
          referenceRuns
        )
      : null;

    const summary = state === "qualified"
      ? "Mathematically qualified with the current results and remaining points envelope."
      : state === "eliminated"
        ? "Mathematically eliminated: the team cannot enter the qualifying places on points from its remaining league/group matches."
        : `Still in contention with ${remaining.length} match${remaining.length === 1 ? "" : "es"} remaining.`;

    const actions: string[] = [];

    if (state === "contending") {
      if (
        minimumWinsForPointsLead !== null &&
        minimumWinsForPointsLead > 0
      ) {
        actions.push(
          `Win at least ${minimumWinsForPointsLead} remaining match${minimumWinsForPointsLead === 1 ? "" : "es"} to move above the present cutoff on points.`
        );
      } else {
        actions.push(
          "Points are level with or above the present cutoff; protect the NRR advantage."
        );
      }

      if (nrrGap > 0) {
        actions.push(
          `Close an NRR gap of ${nrrGap.toFixed(3)} and finish above ${targetNrr.toFixed(3)} based on the current cutoff.`
        );
      } else {
        actions.push(
          `Keep NRR at or above ${targetNrr.toFixed(3)} while other results remain unsettled.`
        );
      }
    }

    return {
      row,
      state,
      remainingMatches: remaining.length,
      maximumPoints: teamMaximum,
      minimumWinsForPointsLead,
      cutoffPoints,
      cutoffNrr,
      nrrGap,
      nextMatch,
      summary,
      actions,
      scenario
    };
  });
}

export async function getQualificationAdvice(
  tournamentId: string,
  referenceRuns = 50
): Promise<QualificationAdviceSection[]> {
  const [sections, matches, settings] = await Promise.all([
    getTournamentStandingsSections(tournamentId),
    getTournamentMatches(tournamentId),
    getCompetitionSettings(tournamentId)
  ]);

  const maximumAward = Math.max(
    settings.win_points,
    settings.tie_points,
    settings.no_result_points,
    settings.loss_points
  );

  return sections.map((section) => ({
    ...section,
    advice: buildAdvice(
      section,
      matches,
      maximumAward,
      referenceRuns
    )
  }));
}
