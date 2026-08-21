import type { MatchInput } from "../services/matches";

import type {
  Team,
  TournamentDivision,
  TournamentGroup,
  TournamentScheduleBreak,
  TournamentScheduleWindow
} from "../types/database";

export interface DivisionScheduleInput {
  division: TournamentDivision;
  teams: Team[];
  groups: Array<{
    group: TournamentGroup;
    teams: Team[];
  }>;
}

export interface GenerateMultiDivisionScheduleInput {
  tournamentId: string;
  divisions: DivisionScheduleInput[];
  windows: TournamentScheduleWindow[];
  breaks: TournamentScheduleBreak[];
  publishMatches: boolean;
}

interface DivisionFixture {
  divisionId: string;
  groupId?: string | null;
  roundNumber?: number | null;
  stage: MatchInput["stage"];
  teamOneId?: string | null;
  teamTwoId?: string | null;
  teamOnePlaceholder?: string | null;
  teamTwoPlaceholder?: string | null;
}

interface ScheduleSlot {
  windowId: string;
  startsAt: string;
  endsAt: string;
  venue: string;
}

interface Pairing {
  firstTeamId: string;
  secondTeamId: string;
  roundNumber: number;
}

function createRoundRobinPairings(teamIds: string[]): Pairing[] {
  if (teamIds.length < 2) {
    return [];
  }

  const participants = [...teamIds];

  if (participants.length % 2 !== 0) {
    participants.push("");
  }

  const rounds = participants.length - 1;
  const half = participants.length / 2;
  const rotating = [...participants];
  const pairings: Pairing[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const first = rotating[index];
      const second = rotating[rotating.length - 1 - index];

      if (!first || !second) {
        continue;
      }

      const reverse = (round + index) % 2 === 1;

      pairings.push({
        firstTeamId: reverse ? second : first,
        secondTeamId: reverse ? first : second,
        roundNumber: round + 1
      });
    }

    const fixed = rotating[0];
    const rest = rotating.slice(1);
    const last = rest.pop();

    rotating.splice(0, rotating.length, fixed, last ?? "", ...rest);
  }

  return pairings;
}

function qualificationFixtures(
  division: TournamentDivision
): DivisionFixture[] {
  const common = { divisionId: division.id };

  if (
    division.qualification_format === "ipl_playoff" &&
    division.qualifiers_count >= 4
  ) {
    return [
      {
        ...common,
        stage: "qualifier_one",
        teamOnePlaceholder: `${division.name} position 1`,
        teamTwoPlaceholder: `${division.name} position 2`
      },
      {
        ...common,
        stage: "eliminator",
        teamOnePlaceholder: `${division.name} position 3`,
        teamTwoPlaceholder: `${division.name} position 4`
      },
      {
        ...common,
        stage: "qualifier_two",
        teamOnePlaceholder: "Loser of Qualifier 1",
        teamTwoPlaceholder: "Winner of Eliminator"
      },
      {
        ...common,
        stage: "final",
        teamOnePlaceholder: "Winner of Qualifier 1",
        teamTwoPlaceholder: "Winner of Qualifier 2"
      }
    ];
  }

  if (
    division.qualification_format === "semi_final" &&
    division.qualifiers_count >= 4
  ) {
    return [
      {
        ...common,
        stage: "semi_final",
        teamOnePlaceholder: `${division.name} position 1`,
        teamTwoPlaceholder: `${division.name} position 4`
      },
      {
        ...common,
        stage: "semi_final",
        teamOnePlaceholder: `${division.name} position 2`,
        teamTwoPlaceholder: `${division.name} position 3`
      },
      {
        ...common,
        stage: "final",
        teamOnePlaceholder: "Winner of Semi-final 1",
        teamTwoPlaceholder: "Winner of Semi-final 2"
      }
    ];
  }

  if (
    division.qualification_format === "final_only" &&
    division.qualifiers_count >= 2
  ) {
    return [
      {
        ...common,
        stage: "final",
        teamOnePlaceholder: `${division.name} position 1`,
        teamTwoPlaceholder: `${division.name} position 2`
      }
    ];
  }

  return [];
}

function knockoutFixtures(
  division: TournamentDivision,
  teams: Team[]
): DivisionFixture[] {
  if (teams.length < 2) {
    return [];
  }

  if (teams.length % 2 !== 0) {
    throw new Error(
      `${division.name} has an odd number of teams. Add its bye fixture manually or use an even number for automatic knockout generation.`
    );
  }

  const firstRoundCount = teams.length / 2;
  const fixtures: DivisionFixture[] = Array.from(
    { length: firstRoundCount },
    (_, index) => ({
      divisionId: division.id,
      stage: teams.length === 2
        ? "final" as const
        : teams.length <= 4
          ? "semi_final" as const
          : "custom" as const,
      teamOneId: teams[index * 2].id,
      teamTwoId: teams[index * 2 + 1].id
    })
  );

  let labels = fixtures.map(
    (_, index) => `Winner of ${division.short_name} match ${index + 1}`
  );
  let divisionMatchNumber = fixtures.length;

  while (labels.length > 1) {
    const nextLabels: string[] = [];

    for (let index = 0; index < labels.length; index += 2) {
      if (!labels[index + 1]) {
        nextLabels.push(labels[index]);
        continue;
      }

      fixtures.push({
        divisionId: division.id,
        stage: labels.length <= 2 ? "final" : "semi_final",
        teamOnePlaceholder: labels[index],
        teamTwoPlaceholder: labels[index + 1]
      });

      divisionMatchNumber += 1;
      nextLabels.push(
        `Winner of ${division.short_name} match ${divisionMatchNumber}`
      );
    }

    labels = nextLabels;
  }

  return fixtures;
}

function createDivisionFixtures(
  input: DivisionScheduleInput
): DivisionFixture[] {
  const { division, teams } = input;

  if (!division.is_active || division.format === "custom") {
    return [];
  }

  if (teams.length < 2) {
    throw new Error(`${division.name} requires at least two assigned teams.`);
  }

  if (division.format === "knockout") {
    return knockoutFixtures(division, teams);
  }

  if (division.format === "groups") {
    if (input.groups.length < 1) {
      throw new Error(`${division.name} does not have saved groups.`);
    }

    const groupFixtures = input.groups.flatMap(({ group, teams: groupTeams }) => {
      if (groupTeams.length < 2) {
        throw new Error(
          `${division.name} — ${group.name} requires at least two teams.`
        );
      }

      return createRoundRobinPairings(
        groupTeams.map((team) => team.id)
      ).map<DivisionFixture>((pairing) => ({
        divisionId: division.id,
        groupId: group.id,
        stage: "group",
        roundNumber: pairing.roundNumber,
        teamOneId: pairing.firstTeamId,
        teamTwoId: pairing.secondTeamId
      }));
    });

    return [...groupFixtures, ...qualificationFixtures(division)];
  }

  const league = createRoundRobinPairings(
    teams.map((team) => team.id)
  ).map<DivisionFixture>((pairing) => ({
    divisionId: division.id,
    stage: "league",
    roundNumber: pairing.roundNumber,
    teamOneId: pairing.firstTeamId,
    teamTwoId: pairing.secondTeamId
  }));

  return [...league, ...qualificationFixtures(division)];
}

function overlaps(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function buildScheduleSlots(
  windows: TournamentScheduleWindow[],
  breaks: TournamentScheduleBreak[]
): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  const orderedWindows = [...windows].sort(
    (first, second) =>
      new Date(first.starts_at).getTime() -
      new Date(second.starts_at).getTime()
  );

  orderedWindows.forEach((window) => {
    let cursor = new Date(window.starts_at);
    const windowEnd = new Date(window.ends_at);
    const windowBreaks = breaks
      .filter((item) => item.schedule_window_id === window.id)
      .sort(
        (first, second) =>
          new Date(first.starts_at).getTime() -
          new Date(second.starts_at).getTime()
      );

    while (cursor < windowEnd) {
      const matchEnd = new Date(
        cursor.getTime() + window.match_duration_minutes * 60_000
      );

      if (matchEnd > windowEnd) {
        break;
      }

      const conflictingBreak = windowBreaks.find((item) =>
        overlaps(
          cursor,
          matchEnd,
          new Date(item.starts_at),
          new Date(item.ends_at)
        )
      );

      if (conflictingBreak) {
        cursor = new Date(conflictingBreak.ends_at);
        continue;
      }

      slots.push({
        windowId: window.id,
        startsAt: cursor.toISOString(),
        endsAt: matchEnd.toISOString(),
        venue: window.venue ?? ""
      });

      cursor = new Date(
        matchEnd.getTime() + window.turnaround_minutes * 60_000
      );
    }
  });

  return slots;
}

function timeOnDate(reference: Date, value: string) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  const result = new Date(reference);
  result.setHours(hours, minutes, seconds || 0, 0);
  return result;
}

function divisionCanUseSlot(
  division: TournamentDivision,
  slot: ScheduleSlot
) {
  if (!division.avoid_time_from || !division.avoid_time_to) {
    return true;
  }

  const slotStart = new Date(slot.startsAt);
  const slotEnd = new Date(slot.endsAt);
  const avoidStart = timeOnDate(slotStart, division.avoid_time_from);
  let avoidEnd = timeOnDate(slotStart, division.avoid_time_to);

  if (avoidEnd <= avoidStart) {
    avoidEnd = new Date(avoidEnd.getTime() + 24 * 60 * 60_000);
  }

  return !overlaps(slotStart, slotEnd, avoidStart, avoidEnd);
}

function createRotation(divisions: TournamentDivision[]) {
  return divisions.flatMap((division) =>
    Array.from(
      { length: Math.max(1, division.matches_per_turn) },
      () => division.id
    )
  );
}

export function generateMultiDivisionSchedule(
  input: GenerateMultiDivisionScheduleInput
): MatchInput[] {
  const activeInputs = input.divisions
    .filter((item) => item.division.is_active)
    .sort(
      (first, second) =>
        first.division.display_order - second.division.display_order
    );

  if (activeInputs.length === 0) {
    throw new Error("Create at least one active division.");
  }

  if (input.windows.length === 0) {
    throw new Error(
      "Create at least one event date and time window before generating the schedule."
    );
  }

  const fixturesByDivision = new Map<string, DivisionFixture[]>();

  activeInputs.forEach((divisionInput) => {
    fixturesByDivision.set(
      divisionInput.division.id,
      createDivisionFixtures(divisionInput)
    );
  });

  const totalFixtures = Array.from(fixturesByDivision.values()).reduce(
    (total, fixtures) => total + fixtures.length,
    0
  );

  if (totalFixtures === 0) {
    throw new Error(
      "No automatic fixtures were produced. Custom divisions must be scheduled manually."
    );
  }

  const divisionsById = new Map(
    activeInputs.map((item) => [item.division.id, item.division])
  );
  const rotation = createRotation(
    activeInputs.map((item) => item.division)
  );
  const slots = buildScheduleSlots(input.windows, input.breaks);
  const output: MatchInput[] = [];
  let slotIndex = 0;
  let rotationIndex = 0;

  function appendFixture(
    division: TournamentDivision,
    fixture: DivisionFixture,
    slot: ScheduleSlot
  ) {
    output.push({
      tournamentId: input.tournamentId,
      divisionId: division.id,
      scheduleWindowId: slot.windowId,
      groupId: fixture.groupId ?? null,
      matchNumber: output.length + 1,
      roundNumber: fixture.roundNumber ?? null,
      stage: fixture.stage,
      teamOneId: fixture.teamOneId ?? null,
      teamTwoId: fixture.teamTwoId ?? null,
      teamOnePlaceholder: fixture.teamOnePlaceholder ?? null,
      teamTwoPlaceholder: fixture.teamTwoPlaceholder ?? null,
      scheduledAt: slot.startsAt,
      venue: slot.venue,
      oversPerInnings: division.default_overs,
      ballsPerOver: division.default_balls_per_over,
      wicketsPerInnings: division.default_wickets_per_innings,
      isPublished: input.publishMatches
    });
  }

  function remainingCount(queues: Map<string, DivisionFixture[]>) {
    return Array.from(queues.values()).reduce(
      (total, fixtures) => total + fixtures.length,
      0
    );
  }

  function scheduleRotatingPhase(
    queues: Map<string, DivisionFixture[]>
  ) {
    while (remainingCount(queues) > 0 && slotIndex < slots.length) {
      const slot = slots[slotIndex];
      let selectedDivisionId: string | null = null;
      let selectedRotationIndex = rotationIndex;

      for (
        let searchOffset = 0;
        searchOffset < rotation.length;
        searchOffset += 1
      ) {
        const candidateIndex =
          (rotationIndex + searchOffset) % rotation.length;
        const candidateId = rotation[candidateIndex];
        const candidateDivision = divisionsById.get(candidateId);
        const queue = queues.get(candidateId) ?? [];

        if (
          candidateDivision &&
          queue.length > 0 &&
          divisionCanUseSlot(candidateDivision, slot)
        ) {
          selectedDivisionId = candidateId;
          selectedRotationIndex = candidateIndex;
          break;
        }
      }

      slotIndex += 1;

      if (!selectedDivisionId) {
        continue;
      }

      const division = divisionsById.get(selectedDivisionId);
      const fixture = queues.get(selectedDivisionId)?.shift();

      if (!division || !fixture) {
        continue;
      }

      appendFixture(division, fixture, slot);

      rotationIndex = (selectedRotationIndex + 1) % rotation.length;
    }
  }

  const regularQueues = new Map<string, DivisionFixture[]>();
  const playoffQueues = new Map<string, DivisionFixture[]>();

  activeInputs.forEach(({ division }) => {
    const fixtures = fixturesByDivision.get(division.id) ?? [];

    regularQueues.set(
      division.id,
      fixtures.filter((fixture) =>
        ["league", "group", "custom"].includes(fixture.stage)
      )
    );

    playoffQueues.set(
      division.id,
      fixtures.filter((fixture) =>
        !["league", "group", "custom", "final"].includes(fixture.stage)
      )
    );
  });

  scheduleRotatingPhase(regularQueues);
  scheduleRotatingPhase(playoffQueues);

  const defaultDivisionId = activeInputs[0].division.id;
  const orderedFinals = activeInputs
    .flatMap(({ division }) =>
      (fixturesByDivision.get(division.id) ?? [])
        .filter((fixture) => fixture.stage === "final")
        .map((fixture) => ({ division, fixture }))
    )
    .sort((first, second) => {
      const firstIsDefault = first.division.id === defaultDivisionId;
      const secondIsDefault = second.division.id === defaultDivisionId;

      if (firstIsDefault !== secondIsDefault) {
        return firstIsDefault ? 1 : -1;
      }

      return first.division.display_order - second.division.display_order;
    });

  for (const { division, fixture } of orderedFinals) {
    while (slotIndex < slots.length) {
      const slot = slots[slotIndex];
      slotIndex += 1;

      if (!divisionCanUseSlot(division, slot)) {
        continue;
      }

      appendFixture(division, fixture, slot);
      break;
    }
  }

  if (output.length < totalFixtures) {
    const unscheduledByDivision = activeInputs
      .map((item) => ({
        name: item.division.name,
        count: (fixturesByDivision.get(item.division.id)?.length ?? 0) -
          output.filter(
            (match) => match.divisionId === item.division.id
          ).length
      }))
      .filter((item) => item.count > 0)
      .map((item) => `${item.name}: ${item.count}`)
      .join(", ");

    throw new Error(
      `Not enough valid time slots. Unscheduled matches — ${unscheduledByDivision}. Add another event window, shorten match duration, reduce breaks, or adjust heat restrictions.`
    );
  }

  return output;
}
