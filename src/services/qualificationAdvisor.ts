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

export type QualificationState = "qualified" | "eliminated" | "contending";
export type QualificationGoal = "qualify" | "top_two" | "first";
export type DependencyKind = "own_result" | "rival_result" | "nrr";

export interface NrrScenario {
  battingFirst: string;
  chasing: string;
  targetNrr: number;
  referenceRuns: number;
  ballsPerOver: number;
  maximumBalls: number;
}

export interface QualificationDependency {
  kind: DependencyKind;
  title: string;
  requirement: string;
  certainty: "required" | "conditional";
  matchNumber: number | null;
}

export interface TeamQualificationAdvice {
  row: PointsTableRow;
  goal: QualificationGoal;
  targetPosition: number;
  targetLabel: string;
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
  dependencies: QualificationDependency[];
  scenario: NrrScenario | null;
}

export interface QualificationAdviceSection extends StandingsSection {
  advice: TeamQualificationAdvice[];
}

const ACTIVE_MATCH_STATUSES = new Set(["scheduled", "live", "innings_break"]);

function isRegularStage(match: TournamentMatch) {
  return match.stage === "league" || match.stage === "group";
}

function matchesSection(match: TournamentMatch, section: StandingsSection) {
  if (match.division_id !== section.division.id || !isRegularStage(match)) {
    return false;
  }
  return section.group ? match.group_id === section.group.id : true;
}

function teamAppears(match: TournamentMatch, teamId: string) {
  return match.team_one_id === teamId || match.team_two_id === teamId;
}

function opponentId(match: TournamentMatch, teamId: string) {
  return match.team_one_id === teamId ? match.team_two_id : match.team_one_id;
}

function getTargetPosition(
  goal: QualificationGoal,
  qualifierCount: number,
  teamCount: number
) {
  if (goal === "first") return 1;
  if (goal === "top_two") return Math.min(2, Math.max(1, teamCount));
  return Math.min(Math.max(1, qualifierCount), Math.max(1, teamCount));
}

function getTargetLabel(goal: QualificationGoal, targetPosition: number) {
  if (goal === "first") return "FINISH 1ST";
  if (goal === "top_two") return "REACH TOP 2";
  return `QUALIFY · TOP ${targetPosition}`;
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
  const runRateFor = newOversFor > 0 ? (row.runs_for + scored) / newOversFor : 0;
  const runRateAgainst = newOversAgainst > 0
    ? (row.runs_against + conceded) / newOversAgainst
    : 0;
  return runRateFor - runRateAgainst;
}

function cricketOvers(legalBalls: number, ballsPerOver: number) {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

function buildScenario(
  row: PointsTableRow,
  nextMatch: TournamentMatch | null,
  targetNrr: number,
  referenceRuns: number
): NrrScenario | null {
  if (!nextMatch) return null;

  const ballsPerOver = Math.max(1, nextMatch.balls_per_over);
  const maximumBalls = Math.max(1, nextMatch.overs_per_innings) * ballsPerOver;
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
      ? `Scoring ${plannedRuns} in the full quota is not enough to reach this NRR target. Use a higher planning score.`
      : `If batting first, score ${plannedRuns} and restrict the opponent to ${maximumConceded} or fewer in the full quota.`,
    chasing: latestChaseBall === null
      ? `Chasing ${chaseRuns} after conceding ${plannedRuns} cannot reach this NRR target inside the match quota.`
      : `If chasing ${chaseRuns}, complete it by ${cricketOvers(latestChaseBall, ballsPerOver)} overs (${latestChaseBall} legal balls) or earlier.`
  };
}

function buildRivalNrrCondition(
  rival: PointsTableRow,
  match: TournamentMatch,
  targetNrr: number,
  referenceRuns: number
) {
  const ballsPerOver = Math.max(1, match.balls_per_over);
  const maximumBalls = Math.max(1, match.overs_per_innings) * ballsPerOver;
  const benchmark = Math.max(1, Math.floor(referenceRuns));
  let latestChaseBall: number | null = null;

  for (let balls = maximumBalls; balls >= 1; balls -= 1) {
    if (
      projectedNrr(
        rival,
        benchmark,
        maximumBalls,
        benchmark + 1,
        balls,
        ballsPerOver
      ) <= targetNrr
    ) {
      latestChaseBall = balls;
      break;
    }
  }

  if (latestChaseBall === null) {
    return `If ${rival.team_name} loses its next match, recalculate after the result; its present NRR buffer is too large for the ${benchmark}-run example.`;
  }

  return `If ${rival.team_name} scores ${benchmark}, its opponent should chase ${benchmark + 1} by ${cricketOvers(latestChaseBall, ballsPerOver)} overs (${latestChaseBall} legal balls) or earlier.`;
}

function buildAdvice(
  section: StandingsSection,
  matches: TournamentMatch[],
  goal: QualificationGoal,
  winPoints: number,
  maximumAward: number,
  referenceRuns: number
): TeamQualificationAdvice[] {
  const targetPosition = getTargetPosition(
    goal,
    section.qualifiersCount,
    section.rows.length
  );
  const targetLabel = getTargetLabel(goal, targetPosition);
  const cutoff = section.rows[targetPosition - 1] ?? null;
  const relevantMatches = matches.filter((match) => matchesSection(match, section));
  const rowsById = new Map(section.rows.map((row) => [row.team_id, row]));

  const remainingByTeam = new Map<string, TournamentMatch[]>();
  section.rows.forEach((row) => {
    remainingByTeam.set(
      row.team_id,
      relevantMatches
        .filter(
          (match) => ACTIVE_MATCH_STATUSES.has(match.status) && teamAppears(match, row.team_id)
        )
        .sort((first, second) =>
          (first.scheduled_at ?? "").localeCompare(second.scheduled_at ?? "")
        )
    );
  });

  const maximumPoints = new Map(
    section.rows.map((row) => [
      row.team_id,
      row.points + (remainingByTeam.get(row.team_id)?.length ?? 0) * maximumAward
    ])
  );

  return section.rows.map((row) => {
    const remaining = remainingByTeam.get(row.team_id) ?? [];
    const teamMaximum = maximumPoints.get(row.team_id) ?? row.points;
    const completed = remaining.length === 0;
    const rivals = section.rows.filter((other) => other.team_id !== row.team_id);
    const teamsStrictlyBeyondMaximum = rivals.filter(
      (other) => other.points > teamMaximum
    ).length;
    const teamsThatCanPassCurrent = rivals.filter(
      (other) => (maximumPoints.get(other.team_id) ?? other.points) >= row.points
    ).length;

    let state: QualificationState = "contending";
    if (completed) {
      state = row.position <= targetPosition ? "qualified" : "eliminated";
    } else if (teamsStrictlyBeyondMaximum >= targetPosition) {
      state = "eliminated";
    } else if (teamsThatCanPassCurrent < targetPosition) {
      state = "qualified";
    }

    const cutoffPoints = cutoff?.points ?? 0;
    const cutoffNrr = cutoff?.net_run_rate ?? 0;
    const nrrGap = Math.max(0, cutoffNrr - row.net_run_rate);
    const pointsNeededForLead = Math.max(0, cutoffPoints + 1 - row.points);
    const minimumWinsForPointsLead = winPoints > 0
      ? Math.ceil(pointsNeededForLead / winPoints)
      : null;
    const nextMatch = remaining[0] ?? null;
    const targetNrr = Math.max(row.net_run_rate, cutoffNrr + 0.001);
    const scenario = state === "contending"
      ? buildScenario(row, nextMatch, targetNrr, referenceRuns)
      : null;

    const summary = state === "qualified"
      ? completed
        ? `${targetLabel} achieved in the completed table.`
        : `${targetLabel} is mathematically secured against the remaining points combinations.`
      : state === "eliminated"
        ? `${targetLabel} is no longer mathematically reachable from the remaining league/group fixtures.`
        : `${targetLabel} remains possible with ${remaining.length} match${remaining.length === 1 ? "" : "es"} left.`;

    const actions: string[] = [];
    const dependencies: QualificationDependency[] = [];

    if (state === "contending") {
      const winsNeeded = Math.min(
        remaining.length,
        Math.max(0, minimumWinsForPointsLead ?? 0)
      );

      if (winsNeeded > 0) {
        actions.push(
          `Primary route: win at least ${winsNeeded} of ${remaining.length} remaining match${remaining.length === 1 ? "" : "es"}.`
        );
        dependencies.push({
          kind: "own_result",
          title: "CONTROL YOUR RESULTS",
          requirement: `Win at least ${winsNeeded} remaining match${winsNeeded === 1 ? "" : "es"}; winning every remaining match produces a maximum of ${teamMaximum} points.`,
          certainty: "required",
          matchNumber: nextMatch?.match_number ?? null
        });
      } else {
        actions.push("The present points total reaches the target cutoff; protect position and NRR.");
      }

      actions.push(
        nrrGap > 0
          ? `Close the current NRR gap of ${nrrGap.toFixed(3)} and aim above ${targetNrr.toFixed(3)}.`
          : `Keep NRR above ${targetNrr.toFixed(3)} while rival results remain unsettled.`
      );

      const allowedAbove = Math.max(0, targetPosition - 1);
      const lockedAbove = rivals.filter((rival) => rival.points > teamMaximum).length;
      const openAboveSlots = Math.max(0, allowedAbove - lockedAbove);
      const threateningRivals = rivals
        .filter((rival) => {
          const rivalMaximum = maximumPoints.get(rival.team_id) ?? rival.points;
          return rivalMaximum >= teamMaximum || rival.points >= cutoffPoints;
        })
        .sort((first, second) =>
          second.points - first.points || second.net_run_rate - first.net_run_rate
        );
      const resultDependenciesNeeded = Math.max(
        0,
        threateningRivals.length - openAboveSlots
      );

      threateningRivals.slice(0, 4).forEach((rival, index) => {
        const rivalMatches = remainingByTeam.get(rival.team_id) ?? [];
        const rivalMaximum = maximumPoints.get(rival.team_id) ?? rival.points;
        const strictPointCap = teamMaximum - 1;
        const extraPointsAllowed = strictPointCap - rival.points;
        const maxWinsAllowed = winPoints > 0
          ? Math.max(0, Math.floor(extraPointsAllowed / winPoints))
          : 0;
        const lossesNeeded = Math.max(0, rivalMatches.length - maxWinsAllowed);
        const rivalNext = rivalMatches[0] ?? null;
        const rivalOpponent = rivalNext
          ? rowsById.get(opponentId(rivalNext, rival.team_id) ?? "")
          : null;

        if (index < resultDependenciesNeeded && rivalMatches.length > 0) {
          dependencies.push({
            kind: "rival_result",
            title: `${rival.team_name.toUpperCase()} RESULT`,
            requirement: lossesNeeded > 0
              ? `${rival.team_name} must lose at least ${lossesNeeded} of ${rivalMatches.length} remaining match${rivalMatches.length === 1 ? "" : "es"} to stay below ${teamMaximum} points${rivalOpponent ? `; the next useful result is ${rivalOpponent.team_name} beating them in Match ${rivalNext?.match_number}` : ""}.`
              : `${rival.team_name} must finish below ${teamMaximum} points, or the points tie must be won on NRR.`,
            certainty: "required",
            matchNumber: rivalNext?.match_number ?? null
          });
        }

        if (
          rivalMaximum >= teamMaximum &&
          rivalMatches.length > 0 &&
          dependencies.filter((item) => item.kind === "nrr").length < 2
        ) {
          dependencies.push({
            kind: "nrr",
            title: `${rival.team_name.toUpperCase()} NRR WATCH`,
            requirement: buildRivalNrrCondition(
              rival,
              rivalMatches[0],
              targetNrr,
              referenceRuns
            ),
            certainty: "conditional",
            matchNumber: rivalMatches[0].match_number
          });
        }
      });

      if (dependencies.length === 0) {
        dependencies.push({
          kind: "own_result",
          title: "POSITION CONTROLLED",
          requirement: `The team controls the ${targetLabel.toLowerCase()} route. Win the remaining fixture${remaining.length === 1 ? "" : "s"} and protect NRR.`,
          certainty: "required",
          matchNumber: nextMatch?.match_number ?? null
        });
      }
    }

    return {
      row,
      goal,
      targetPosition,
      targetLabel,
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
      dependencies,
      scenario
    };
  });
}

export async function getQualificationAdvice(
  tournamentId: string,
  referenceRuns = 50,
  goal: QualificationGoal = "qualify"
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
      goal,
      settings.win_points,
      maximumAward,
      referenceRuns
    )
  }));
}
