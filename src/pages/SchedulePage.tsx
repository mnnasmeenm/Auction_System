import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import SchedulePoster, {
  type SchedulePosterItem
} from "../components/schedules/SchedulePoster";

import {
  assertScheduleReplaceable,
  createMatch,
  deleteScheduledMatch,
  getTournamentMatches,
  type MatchInput,
  replaceGeneratedSchedule,
  setMatchPublished,
  updateScheduledMatch
} from "../services/matches";

import {
  deleteScheduleBreak,
  deleteScheduleWindow,
  deleteTournamentDivision,
  getDivisionGroupAssignments,
  getDivisionGroups,
  getDivisionTeamAssignments,
  getScheduleBreaks,
  getScheduleWindows,
  getTournamentDivisions,
  replaceDivisionGroups,
  replaceDivisionTeams,
  saveScheduleBreak,
  saveScheduleWindow,
  saveTournamentDivision
} from "../services/scheduleConfiguration";

import { getTeamLogoUrl, getTeams } from "../services/teams";
import { getTournament } from "../services/tournaments";

import type {
  CompetitionFormat,
  MatchStage,
  QualificationFormat,
  Team,
  Tournament,
  TournamentDivision,
  TournamentMatch,
  TournamentScheduleBreak,
  TournamentScheduleWindow
} from "../types/database";

import {
  generateMultiDivisionSchedule,
  type DivisionScheduleInput
} from "../utils/scheduleGenerator";

import "./SchedulePage.css";

const POSTER_ITEMS_PER_PAGE = 7;

const stageOptions: Array<{ value: MatchStage; label: string }> = [
  { value: "league", label: "League" },
  { value: "group", label: "Group" },
  { value: "qualifier_one", label: "Qualifier 1" },
  { value: "eliminator", label: "Eliminator" },
  { value: "qualifier_two", label: "Qualifier 2" },
  { value: "semi_final", label: "Semi-final" },
  { value: "third_place", label: "Third-place match" },
  { value: "final", label: "Final" },
  { value: "custom", label: "Custom" }
];

interface EditableDivision {
  key: string;
  id?: string;
  name: string;
  shortName: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
  format: CompetitionFormat;
  qualificationFormat: QualificationFormat;
  qualifiersCount: number;
  groupCount: number;
  defaultOvers: number;
  defaultBallsPerOver: number;
  defaultWickets: number;
  matchesPerTurn: number;
  avoidHeat: boolean;
  avoidTimeFrom: string;
  avoidTimeTo: string;
  teamIds: string[];
  groupNames: string[];
  teamGroupIndexes: Record<string, number>;
}

interface EditableWindow {
  key: string;
  id?: string;
  label: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  matchDurationMinutes: number;
  turnaroundMinutes: number;
  displayOrder: number;
}

interface EditableBreak {
  key: string;
  id?: string;
  windowKey: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

interface EditableMatch {
  id: string | null;
  matchNumber: string;
  divisionId: string;
  scheduleWindowId: string;
  stage: MatchStage;
  teamOneId: string;
  teamTwoId: string;
  teamOnePlaceholder: string;
  teamTwoPlaceholder: string;
  scheduledAt: string;
  venue: string;
  overs: string;
  ballsPerOver: string;
  wickets: string;
  isPublished: boolean;
}

function key() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function futureDateTime(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toLocalDateTime(date.toISOString());
}

function groupNames(count: number, existing: string[] = []) {
  return Array.from({ length: count }, (_, index) =>
    existing[index] ?? `Group ${String.fromCharCode(65 + index)}`
  );
}

function stageLabel(stage: MatchStage) {
  return stageOptions.find((item) => item.value === stage)?.label ?? stage;
}

function teamName(match: TournamentMatch, side: "one" | "two") {
  return side === "one"
    ? match.team_one?.name ?? match.team_one_placeholder ?? "To be decided"
    : match.team_two?.name ?? match.team_two_placeholder ?? "To be decided";
}

function formatDate(value: string | null) {
  if (!value) return "Date and time TBA";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function newDivision(order: number): EditableDivision {
  return {
    key: key(),
    name: order === 0 ? "Open Division" : `Division ${order + 1}`,
    shortName: order === 0 ? "OPEN" : `D${order + 1}`,
    color: order % 2 === 0 ? "#2f72ff" : "#ff7a18",
    displayOrder: order,
    isActive: true,
    format: "league",
    qualificationFormat: "final_only",
    qualifiersCount: 2,
    groupCount: 2,
    defaultOvers: 5,
    defaultBallsPerOver: 6,
    defaultWickets: 10,
    matchesPerTurn: 1,
    avoidHeat: false,
    avoidTimeFrom: "10:30",
    avoidTimeTo: "15:30",
    teamIds: [],
    groupNames: ["Group A", "Group B"],
    teamGroupIndexes: {}
  };
}

function newWindow(order: number): EditableWindow {
  return {
    key: key(),
    label: `Event day ${order + 1}`,
    startsAt: futureDateTime(order + 1, 8),
    endsAt: futureDateTime(order + 1, 18),
    venue: "",
    matchDurationMinutes: 40,
    turnaroundMinutes: 5,
    displayOrder: order
  };
}

function blankMatch(
  number: number,
  division: TournamentDivision,
  window?: TournamentScheduleWindow
): EditableMatch {
  return {
    id: null,
    matchNumber: String(number),
    divisionId: division.id,
    scheduleWindowId: window?.id ?? "",
    stage: division.format === "groups" ? "group" : "league",
    teamOneId: "",
    teamTwoId: "",
    teamOnePlaceholder: "",
    teamTwoPlaceholder: "",
    scheduledAt: toLocalDateTime(window?.starts_at),
    venue: window?.venue ?? "",
    overs: String(division.default_overs),
    ballsPerOver: String(division.default_balls_per_over),
    wickets: String(division.default_wickets_per_innings),
    isPublished: true
  };
}

function fromMatch(match: TournamentMatch): EditableMatch {
  return {
    id: match.id,
    matchNumber: String(match.match_number),
    divisionId: match.division_id,
    scheduleWindowId: match.schedule_window_id ?? "",
    stage: match.stage,
    teamOneId: match.team_one_id ?? "",
    teamTwoId: match.team_two_id ?? "",
    teamOnePlaceholder: match.team_one_placeholder ?? "",
    teamTwoPlaceholder: match.team_two_placeholder ?? "",
    scheduledAt: toLocalDateTime(match.scheduled_at),
    venue: match.venue ?? "",
    overs: String(match.overs_per_innings),
    ballsPerOver: String(match.balls_per_over),
    wickets: String(match.wickets_per_innings),
    isPublished: match.is_published
  };
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament") ?? "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<EditableDivision[]>([]);
  const [windows, setWindows] = useState<EditableWindow[]>([]);
  const [breaks, setBreaks] = useState<EditableBreak[]>([]);
  const [savedDivisions, setSavedDivisions] = useState<TournamentDivision[]>([]);
  const [savedWindows, setSavedWindows] = useState<TournamentScheduleWindow[]>([]);
  const [savedBreaks, setSavedBreaks] = useState<TournamentScheduleBreak[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [editableMatch, setEditableMatch] = useState<EditableMatch | null>(null);
  const [publishGenerated, setPublishGenerated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    void loadPage();
  }, [tournamentId]);

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        tournamentRecord,
        teamRecords,
        divisionRecords,
        divisionTeamRecords,
        windowRecords,
        breakRecords,
        groupRecords,
        groupAssignmentRecords,
        matchRecords
      ] = await Promise.all([
        getTournament(tournamentId),
        getTeams(tournamentId),
        getTournamentDivisions(tournamentId),
        getDivisionTeamAssignments(tournamentId),
        getScheduleWindows(tournamentId),
        getScheduleBreaks(tournamentId),
        getDivisionGroups(tournamentId),
        getDivisionGroupAssignments(tournamentId),
        getTournamentMatches(tournamentId)
      ]);

      const activeTeams = teamRecords.filter((team) => team.is_active);
      setTournament(tournamentRecord);
      setTeams(activeTeams);
      setSavedDivisions(divisionRecords);
      setSavedWindows(windowRecords);
      setSavedBreaks(breakRecords);
      setMatches(matchRecords);

      setDivisions(
        divisionRecords.map((division) => {
          const assignedTeams = divisionTeamRecords
            .filter((item) => item.division_id === division.id)
            .map((item) => item.team_id);
          const divisionGroups = groupRecords
            .filter((group) => group.division_id === division.id)
            .sort((a, b) => a.display_order - b.display_order);
          const groupIndexById = new Map(
            divisionGroups.map((group, index) => [group.id, index])
          );

          return {
            key: division.id,
            id: division.id,
            name: division.name,
            shortName: division.short_name,
            color: division.division_color,
            displayOrder: division.display_order,
            isActive: division.is_active,
            format: division.format,
            qualificationFormat: division.qualification_format,
            qualifiersCount: division.qualifiers_count,
            groupCount: division.group_count,
            defaultOvers: division.default_overs,
            defaultBallsPerOver: division.default_balls_per_over,
            defaultWickets: division.default_wickets_per_innings,
            matchesPerTurn: division.matches_per_turn,
            avoidHeat: Boolean(
              division.avoid_time_from && division.avoid_time_to
            ),
            avoidTimeFrom: division.avoid_time_from?.slice(0, 5) ?? "10:30",
            avoidTimeTo: division.avoid_time_to?.slice(0, 5) ?? "15:30",
            teamIds: assignedTeams,
            groupNames: groupNames(
              division.group_count,
              divisionGroups.map((group) => group.name)
            ),
            teamGroupIndexes: Object.fromEntries(
              groupAssignmentRecords
                .filter((item) => item.division_id === division.id)
                .map((item) => [
                  item.team_id,
                  groupIndexById.get(item.group_id) ?? 0
                ])
            )
          };
        })
      );

      setWindows(
        windowRecords.map((window) => ({
          key: window.id,
          id: window.id,
          label: window.label,
          startsAt: toLocalDateTime(window.starts_at),
          endsAt: toLocalDateTime(window.ends_at),
          venue: window.venue ?? "",
          matchDurationMinutes: window.match_duration_minutes,
          turnaroundMinutes: window.turnaround_minutes,
          displayOrder: window.display_order
        }))
      );

      setBreaks(
        breakRecords.map((item) => ({
          key: item.id,
          id: item.id,
          windowKey: item.schedule_window_id,
          label: item.label,
          startsAt: toLocalDateTime(item.starts_at),
          endsAt: toLocalDateTime(item.ends_at)
        }))
      );
    } catch (error) {
      console.error("Schedule loading error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The schedule could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const posterPages = useMemo(() => {
    const items: SchedulePosterItem[] = [
      ...matches.map((match) => ({ type: "match" as const, match })),
      ...savedBreaks.map((scheduleBreak) => ({
        type: "break" as const,
        scheduleBreak
      }))
    ].sort((a, b) => {
      const first = a.type === "match"
        ? a.match.scheduled_at
        : a.scheduleBreak.starts_at;
      const second = b.type === "match"
        ? b.match.scheduled_at
        : b.scheduleBreak.starts_at;
      return new Date(first ?? 0).getTime() - new Date(second ?? 0).getTime();
    });

    const pages: SchedulePosterItem[][] = [];
    for (let index = 0; index < items.length; index += POSTER_ITEMS_PER_PAGE) {
      pages.push(items.slice(index, index + POSTER_ITEMS_PER_PAGE));
    }
    return pages;
  }, [matches, savedBreaks]);

  function updateDivision(
    divisionKey: string,
    changes: Partial<EditableDivision>
  ) {
    setDivisions((current) =>
      current.map((division) =>
        division.key === divisionKey ? { ...division, ...changes } : division
      )
    );
  }

  function updateWindow(windowKey: string, changes: Partial<EditableWindow>) {
    setWindows((current) =>
      current.map((window) =>
        window.key === windowKey ? { ...window, ...changes } : window
      )
    );
  }

  function updateBreak(breakKey: string, changes: Partial<EditableBreak>) {
    setBreaks((current) =>
      current.map((item) =>
        item.key === breakKey ? { ...item, ...changes } : item
      )
    );
  }

  function validateConfiguration() {
    if (divisions.length === 0) return "Create at least one division.";
    if (windows.length === 0) return "Create at least one event window.";

    for (const division of divisions) {
      if (!division.name.trim() || !division.shortName.trim()) {
        return "Every division requires a name and short name.";
      }
      if (
        division.defaultOvers < 1 ||
        division.defaultBallsPerOver < 1 ||
        division.defaultBallsPerOver > 12 ||
        division.defaultWickets < 1 ||
        division.matchesPerTurn < 1
      ) {
        return `Check the match rules for ${division.name}.`;
      }
      if (
        division.isActive &&
        division.format !== "custom" &&
        division.teamIds.length < 2
      ) {
        return `${division.name} needs at least two selected teams.`;
      }
      if (division.avoidHeat && !division.avoidTimeFrom) {
        return `${division.name} requires a heat restriction start time.`;
      }
      if (division.format === "groups") {
        const counts = Array.from({ length: division.groupCount }, (_, index) =>
          division.teamIds.filter(
            (teamId) => (division.teamGroupIndexes[teamId] ?? 0) === index
          ).length
        );
        if (counts.some((count) => count < 2)) {
          return `Every group in ${division.name} needs at least two teams.`;
        }
      }
    }

    for (const window of windows) {
      if (!window.label.trim()) return "Every event window requires a label.";
      if (
        !window.startsAt ||
        !window.endsAt ||
        new Date(window.endsAt) <= new Date(window.startsAt)
      ) {
        return `Check the start and end time for ${window.label}.`;
      }
      if (window.matchDurationMinutes < 1 || window.turnaroundMinutes < 0) {
        return `Check the duration settings for ${window.label}.`;
      }
    }

    for (const item of breaks) {
      const window = windows.find((candidate) => candidate.key === item.windowKey);
      if (!window || !item.label.trim()) return "Every break needs a window and label.";
      if (
        !item.startsAt ||
        !item.endsAt ||
        new Date(item.startsAt) < new Date(window.startsAt) ||
        new Date(item.endsAt) > new Date(window.endsAt) ||
        new Date(item.endsAt) <= new Date(item.startsAt)
      ) {
        return `${item.label} must stay inside ${window.label}.`;
      }
    }
    return null;
  }

  async function persistConfiguration() {
    const savedDivisionInputs: DivisionScheduleInput[] = [];

    for (let index = 0; index < divisions.length; index += 1) {
      const draft = divisions[index];
      const saved = await saveTournamentDivision({
        id: draft.id,
        tournamentId,
        name: draft.name,
        shortName: draft.shortName,
        divisionColor: draft.color,
        displayOrder: index,
        isActive: draft.isActive,
        format: draft.format,
        groupCount: draft.groupCount,
        qualificationFormat: draft.qualificationFormat,
        qualifiersCount: draft.qualifiersCount,
        defaultOvers: draft.defaultOvers,
        defaultBallsPerOver: draft.defaultBallsPerOver,
        defaultWicketsPerInnings: draft.defaultWickets,
        matchesPerTurn: draft.matchesPerTurn,
        avoidTimeFrom: draft.avoidHeat ? draft.avoidTimeFrom : null,
        avoidTimeTo: draft.avoidHeat ? draft.avoidTimeTo : null
      });

      await replaceDivisionTeams(saved.id, draft.teamIds);
      let groups: DivisionScheduleInput["groups"] = [];

      if (draft.format === "groups") {
        const savedGroupRecords = await replaceDivisionGroups(
          saved.id,
          groupNames(draft.groupCount, draft.groupNames),
          draft.teamIds.map((teamId, seedIndex) => ({
            teamId,
            groupIndex: draft.teamGroupIndexes[teamId] ?? 0,
            seedNumber: seedIndex + 1
          }))
        );

        groups = savedGroupRecords.map((group, groupIndex) => ({
          group,
          teams: teams.filter(
            (team) =>
              draft.teamIds.includes(team.id) &&
              (draft.teamGroupIndexes[team.id] ?? 0) === groupIndex
          )
        }));
      }

      savedDivisionInputs.push({
        division: saved,
        teams: teams.filter((team) => draft.teamIds.includes(team.id)),
        groups
      });
    }

    const windowByKey = new Map<string, TournamentScheduleWindow>();
    const savedWindowRecords: TournamentScheduleWindow[] = [];

    for (let index = 0; index < windows.length; index += 1) {
      const draft = windows[index];
      const saved = await saveScheduleWindow({
        id: draft.id,
        tournamentId,
        label: draft.label,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        venue: draft.venue,
        matchDurationMinutes: draft.matchDurationMinutes,
        turnaroundMinutes: draft.turnaroundMinutes,
        displayOrder: index
      });
      windowByKey.set(draft.key, saved);
      savedWindowRecords.push(saved);
    }

    const savedBreakRecords: TournamentScheduleBreak[] = [];
    for (const draft of breaks) {
      const savedWindow = windowByKey.get(draft.windowKey);
      if (!savedWindow) throw new Error("A break has no saved event window.");
      savedBreakRecords.push(
        await saveScheduleBreak({
          id: draft.id,
          tournamentId,
          scheduleWindowId: savedWindow.id,
          label: draft.label,
          startsAt: new Date(draft.startsAt).toISOString(),
          endsAt: new Date(draft.endsAt).toISOString()
        })
      );
    }

    return {
      divisions: savedDivisionInputs,
      windows: savedWindowRecords,
      breaks: savedBreakRecords
    };
  }

  async function saveConfigurationOnly() {
    const validation = validateConfiguration();
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await persistConfiguration();
      setSuccessMessage("Division and event-day settings saved.");
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function generateSchedule() {
    const validation = validateConfiguration();
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    if (
      matches.length > 0 &&
      !window.confirm("Replace the current unstarted schedule?")
    ) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await assertScheduleReplaceable(tournamentId);
      const saved = await persistConfiguration();
      const generated = generateMultiDivisionSchedule({
        tournamentId,
        divisions: saved.divisions,
        windows: saved.windows,
        breaks: saved.breaks,
        publishMatches: publishGenerated
      });
      await replaceGeneratedSchedule(tournamentId, generated);
      setSuccessMessage(`${generated.length} mixed-division matches generated.`);
      await loadPage();
    } catch (error) {
      console.error("Schedule generation error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Schedule generation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDivision(division: EditableDivision) {
    if (!division.id) {
      setDivisions((current) => current.filter((item) => item.key !== division.key));
      return;
    }
    if (!window.confirm(`Delete ${division.name}?`)) return;
    setSaving(true);
    try {
      await deleteTournamentDivision(division.id);
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Division could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function removeWindow(item: EditableWindow) {
    if (!item.id) {
      setWindows((current) => current.filter((window) => window.key !== item.key));
      setBreaks((current) => current.filter((entry) => entry.windowKey !== item.key));
      return;
    }
    if (!window.confirm(`Delete ${item.label} and its breaks?`)) return;
    setSaving(true);
    try {
      await deleteScheduleWindow(item.id);
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Event window could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function removeBreak(item: EditableBreak) {
    if (!item.id) {
      setBreaks((current) => current.filter((entry) => entry.key !== item.key));
      return;
    }
    setSaving(true);
    try {
      await deleteScheduleBreak(item.id);
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Break could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  function matchInput(editor: EditableMatch): MatchInput {
    return {
      tournamentId,
      divisionId: editor.divisionId,
      scheduleWindowId: editor.scheduleWindowId || null,
      matchNumber: Number(editor.matchNumber),
      stage: editor.stage,
      teamOneId: editor.teamOneId || null,
      teamTwoId: editor.teamTwoId || null,
      teamOnePlaceholder: editor.teamOneId ? null : editor.teamOnePlaceholder,
      teamTwoPlaceholder: editor.teamTwoId ? null : editor.teamTwoPlaceholder,
      scheduledAt: editor.scheduledAt
        ? new Date(editor.scheduledAt).toISOString()
        : null,
      venue: editor.venue,
      oversPerInnings: Number(editor.overs),
      ballsPerOver: Number(editor.ballsPerOver),
      wicketsPerInnings: Number(editor.wickets),
      isPublished: editor.isPublished
    };
  }

  async function saveManualMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editableMatch) return;
    if (!editableMatch.divisionId) {
      setErrorMessage("Select a division.");
      return;
    }
    if (!editableMatch.teamOneId && !editableMatch.teamOnePlaceholder.trim()) {
      setErrorMessage("Select team one or enter a placeholder.");
      return;
    }
    if (!editableMatch.teamTwoId && !editableMatch.teamTwoPlaceholder.trim()) {
      setErrorMessage("Select team two or enter a placeholder.");
      return;
    }
    if (editableMatch.teamOneId === editableMatch.teamTwoId) {
      setErrorMessage("A team cannot play itself.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      const input = matchInput(editableMatch);
      if (editableMatch.id) await updateScheduledMatch(editableMatch.id, input);
      else await createMatch(input);
      setEditableMatch(null);
      setSuccessMessage("Manual match saved.");
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Match could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMatch(match: TournamentMatch) {
    if (match.status !== "scheduled" || !window.confirm(`Delete Match ${match.match_number}?`)) return;
    setSaving(true);
    try {
      await deleteScheduledMatch(match.id);
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Match could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(match: TournamentMatch) {
    setSaving(true);
    try {
      await setMatchPublished(match.id, !match.is_published);
      await loadPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Publication could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  const manualTeams = teams.filter((team) => {
    const division = divisions.find((item) => item.id === editableMatch?.divisionId);
    return division?.teamIds.includes(team.id);
  });

  if (!tournamentId) {
    return (
      <main className="schedule-page"><section className="schedule-empty">
        <h1>Tournament not selected</h1>
        <button onClick={() => navigate("/admin/tournaments")}>Return to tournaments</button>
      </section></main>
    );
  }

  if (loading) {
    return <main className="schedule-page"><section className="schedule-empty">Loading schedule…</section></main>;
  }

  if (!tournament) {
    return <main className="schedule-page"><section className="schedule-empty"><h1>Schedule unavailable</h1><p>{errorMessage}</p></section></main>;
  }

  return (
    <main className="schedule-page">
      <header className="schedule-page-header">
        <div>
          <p className="page-label">MULTI-DIVISION MATCH OPERATIONS</p>
          <h1>Schedule generator</h1>
          <p>
            Mix separate competitions across selected event days while respecting
            breaks, turnaround time and optional heat restrictions.
          </p>
        </div>
        <div className="schedule-header-stat"><span>DIVISIONS</span><strong>{divisions.length}</strong></div>
        <div className="schedule-header-stat"><span>FIXTURES</span><strong>{matches.length}</strong></div>
      </header>

      {errorMessage && <div className="schedule-alert schedule-error">{errorMessage}</div>}
      {successMessage && <div className="schedule-alert schedule-success">{successMessage}</div>}

      <section className="schedule-panel">
        <div className="schedule-panel-heading">
          <div><span>STEP 1</span><h2>Tournament divisions</h2><p>Use one division for an ordinary tournament, or add Under 40, Over 40 and other independent competitions.</p></div>
          <button type="button" onClick={() => setDivisions((current) => [...current, newDivision(current.length)])}>+ Add division</button>
        </div>

        <div className="schedule-division-list">
          {divisions.map((division) => (
            <article className="schedule-division-card" key={division.key} style={{ "--division-color": division.color } as CSSProperties}>
              <div className="schedule-division-title">
                <div><span>{division.shortName || "DIV"}</span><h3>{division.name || "New division"}</h3></div>
                <label className="schedule-inline-check"><input type="checkbox" checked={division.isActive} onChange={(event) => updateDivision(division.key, { isActive: event.target.checked })} /> Active</label>
                <button type="button" onClick={() => removeDivision(division)}>Remove</button>
              </div>

              <div className="schedule-form-grid">
                <label>Division name<input value={division.name} onChange={(event) => updateDivision(division.key, { name: event.target.value })} /></label>
                <label>Short name<input value={division.shortName} maxLength={12} onChange={(event) => updateDivision(division.key, { shortName: event.target.value })} /></label>
                <label>Division colour<input type="color" value={division.color} onChange={(event) => updateDivision(division.key, { color: event.target.value })} /></label>
                <label>Competition format<select value={division.format} onChange={(event) => updateDivision(division.key, { format: event.target.value as CompetitionFormat })}><option value="league">League</option><option value="groups">Groups</option><option value="knockout">Direct knockout</option><option value="custom">Manual fixtures only</option></select></label>
                <label>Qualification<select value={division.qualificationFormat} disabled={division.format === "knockout" || division.format === "custom"} onChange={(event) => updateDivision(division.key, { qualificationFormat: event.target.value as QualificationFormat })}><option value="ipl_playoff">IPL-style playoff</option><option value="semi_final">Two semi-finals and final</option><option value="final_only">Top two final</option><option value="custom">No automatic finals</option></select></label>
                <label>Qualifying teams<input type="number" min="2" value={division.qualifiersCount} onChange={(event) => updateDivision(division.key, { qualifiersCount: Number(event.target.value) })} /></label>
                {division.format === "groups" && <label>Number of groups<input type="number" min="1" value={division.groupCount} onChange={(event) => { const count = Math.max(1, Number(event.target.value)); updateDivision(division.key, { groupCount: count, groupNames: groupNames(count, division.groupNames) }); }} /></label>}
                <label>Overs<input type="number" min="1" value={division.defaultOvers} onChange={(event) => updateDivision(division.key, { defaultOvers: Number(event.target.value) })} /></label>
                <label>Balls per over<input type="number" min="1" max="12" value={division.defaultBallsPerOver} onChange={(event) => updateDivision(division.key, { defaultBallsPerOver: Number(event.target.value) })} /></label>
                <label>Wickets<input type="number" min="1" value={division.defaultWickets} onChange={(event) => updateDivision(division.key, { defaultWickets: Number(event.target.value) })} /></label>
                <label>Matches per turn<input type="number" min="1" value={division.matchesPerTurn} onChange={(event) => updateDivision(division.key, { matchesPerTurn: Number(event.target.value) })} /><small>1 and 1 alternates. Under 40 = 1 and Over 40 = 3 creates a 1:3 rotation.</small></label>
              </div>

              <label className="schedule-checkbox schedule-heat-toggle"><input type="checkbox" checked={division.avoidHeat} onChange={(event) => updateDivision(division.key, { avoidHeat: event.target.checked })} /><span><strong>Avoid a daily time period for this division</strong><small>Useful for keeping Over-40 matches away from heavy midday sun.</small></span></label>
              {division.avoidHeat && <div className="schedule-heat-times"><label>Avoid from<input type="time" value={division.avoidTimeFrom} onChange={(event) => updateDivision(division.key, { avoidTimeFrom: event.target.value })} /></label><label>Avoid until<input type="time" value={division.avoidTimeTo} onChange={(event) => updateDivision(division.key, { avoidTimeTo: event.target.value })} /></label></div>}

              {division.format === "groups" && <div className="schedule-group-names">{division.groupNames.map((name, index) => <label key={index}>Group {index + 1}<input value={name} onChange={(event) => updateDivision(division.key, { groupNames: division.groupNames.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /></label>)}</div>}

              <div className="schedule-team-selector"><h4>Teams participating in {division.name}</h4><div>{teams.map((team) => { const checked = division.teamIds.includes(team.id); const logo = getTeamLogoUrl(team.logo_path); return <label key={team.id} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} onChange={(event) => { const teamIds = event.target.checked ? [...division.teamIds, team.id] : division.teamIds.filter((id) => id !== team.id); updateDivision(division.key, { teamIds }); }} />{logo ? <img src={logo} alt="" /> : <span>{team.short_name}</span>}<strong>{team.name}</strong>{division.format === "groups" && checked && <select value={division.teamGroupIndexes[team.id] ?? 0} onClick={(event) => event.stopPropagation()} onChange={(event) => updateDivision(division.key, { teamGroupIndexes: { ...division.teamGroupIndexes, [team.id]: Number(event.target.value) } })}>{division.groupNames.map((name, index) => <option key={index} value={index}>{name}</option>)}</select>}</label>; })}</div></div>
            </article>
          ))}
        </div>
      </section>

      <section className="schedule-panel">
        <div className="schedule-panel-heading"><div><span>STEP 2</span><h2>Event dates and time windows</h2><p>Add only the periods when the ground is available. Dates do not need to be consecutive.</p></div><button type="button" onClick={() => setWindows((current) => [...current, newWindow(current.length)])}>+ Add event window</button></div>
        <div className="schedule-window-list">
          {windows.map((item) => (
            <article className="schedule-window-card" key={item.key}>
              <div className="schedule-window-heading"><h3>{item.label}</h3><button type="button" onClick={() => removeWindow(item)}>Remove</button></div>
              <div className="schedule-form-grid"><label>Label<input value={item.label} onChange={(event) => updateWindow(item.key, { label: event.target.value })} /></label><label>Starts<input type="datetime-local" value={item.startsAt} onChange={(event) => updateWindow(item.key, { startsAt: event.target.value })} /></label><label>Ends<input type="datetime-local" value={item.endsAt} onChange={(event) => updateWindow(item.key, { endsAt: event.target.value })} /></label><label>Venue<input value={item.venue} onChange={(event) => updateWindow(item.key, { venue: event.target.value })} /></label><label>Match duration (minutes)<input type="number" min="1" value={item.matchDurationMinutes} onChange={(event) => updateWindow(item.key, { matchDurationMinutes: Number(event.target.value) })} /></label><label>Turnaround (minutes)<input type="number" min="0" value={item.turnaroundMinutes} onChange={(event) => updateWindow(item.key, { turnaroundMinutes: Number(event.target.value) })} /></label></div>
              <div className="schedule-break-area"><div><h4>Breaks</h4><button type="button" onClick={() => setBreaks((current) => [...current, { key: key(), windowKey: item.key, label: "Break", startsAt: item.startsAt, endsAt: item.startsAt }])}>+ Add break</button></div>{breaks.filter((entry) => entry.windowKey === item.key).map((entry) => <div className="schedule-break-row" key={entry.key}><input value={entry.label} aria-label="Break label" onChange={(event) => updateBreak(entry.key, { label: event.target.value })} /><input type="datetime-local" value={entry.startsAt} aria-label="Break starts" onChange={(event) => updateBreak(entry.key, { startsAt: event.target.value })} /><input type="datetime-local" value={entry.endsAt} aria-label="Break ends" onChange={(event) => updateBreak(entry.key, { endsAt: event.target.value })} /><button type="button" onClick={() => removeBreak(entry)}>Remove</button></div>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="schedule-panel schedule-generation-panel">
        <div><span>STEP 3</span><h2>Save or generate</h2><p>The engine fills event windows chronologically, skips breaks, follows the matches-per-turn rotation, and enforces division heat restrictions.</p></div>
        <label className="schedule-checkbox"><input type="checkbox" checked={publishGenerated} onChange={(event) => setPublishGenerated(event.target.checked)} /><span><strong>Publish generated matches</strong></span></label>
        <div><button type="button" className="schedule-secondary-button" disabled={saving} onClick={saveConfigurationOnly}>Save configuration only</button><button type="button" className="schedule-primary-button" disabled={saving} onClick={generateSchedule}>{saving ? "Working…" : "Generate mixed schedule"}</button></div>
      </section>

      <section className="schedule-panel schedule-fixture-panel">
        <div className="schedule-panel-heading"><div><span>FIXTURES</span><h2>Match schedule</h2><p>Only scheduled matches can be edited or deleted.</p></div><button type="button" disabled={savedDivisions.length === 0} onClick={() => { const division = savedDivisions[0]; if (division) setEditableMatch(blankMatch(matches.length + 1, division, savedWindows[0])); }}>+ Add match manually</button></div>
        {matches.length === 0 ? <div className="schedule-empty">No matches created yet.</div> : <div className="schedule-match-list">{matches.map((match) => { const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null); const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null); return <article className="schedule-match-card" key={match.id}><div className="schedule-match-number"><small>MATCH</small><strong>{match.match_number}</strong><span>{stageLabel(match.stage)}</span></div><div className="schedule-division-badge" style={{ "--division-color": match.division?.division_color ?? "#2f72ff" } as CSSProperties}>{match.division?.short_name ?? "DIV"}</div><div className="schedule-match-team">{firstLogo ? <img src={firstLogo} alt="" /> : <span>{match.team_one?.short_name ?? "TBD"}</span>}<strong>{teamName(match, "one")}</strong></div><b className="schedule-versus">VS</b><div className="schedule-match-team">{secondLogo ? <img src={secondLogo} alt="" /> : <span>{match.team_two?.short_name ?? "TBD"}</span>}<strong>{teamName(match, "two")}</strong></div><div className="schedule-match-details"><strong>{formatDate(match.scheduled_at)}</strong><span>{match.venue || "Venue TBA"}</span><small>{match.overs_per_innings} overs · {match.balls_per_over} balls/over</small></div><div className="schedule-match-actions"><button type="button" disabled={saving} onClick={() => togglePublished(match)}>{match.is_published ? "Published" : "Hidden"}</button><button type="button" disabled={match.status !== "scheduled" || saving} onClick={() => setEditableMatch(fromMatch(match))}>Edit</button><button type="button" className="schedule-delete-button" disabled={match.status !== "scheduled" || saving} onClick={() => removeMatch(match)}>Delete</button></div></article>; })}</div>}
      </section>

      {editableMatch && <div className="schedule-modal-overlay"><form className="schedule-match-form" onSubmit={saveManualMatch}><div className="schedule-panel-heading"><div><span>MANUAL CONTROL</span><h2>{editableMatch.id ? "Edit match" : "Add match"}</h2></div><button type="button" onClick={() => setEditableMatch(null)}>Close</button></div><div className="schedule-form-grid"><label>Match number<input type="number" min="1" value={editableMatch.matchNumber} onChange={(event) => setEditableMatch({ ...editableMatch, matchNumber: event.target.value })} /></label><label>Division<select value={editableMatch.divisionId} onChange={(event) => { const division = savedDivisions.find((item) => item.id === event.target.value); setEditableMatch({ ...editableMatch, divisionId: event.target.value, teamOneId: "", teamTwoId: "", overs: String(division?.default_overs ?? editableMatch.overs), ballsPerOver: String(division?.default_balls_per_over ?? editableMatch.ballsPerOver), wickets: String(division?.default_wickets_per_innings ?? editableMatch.wickets) }); }}>{savedDivisions.map((division) => <option value={division.id} key={division.id}>{division.name}</option>)}</select></label><label>Event window<select value={editableMatch.scheduleWindowId} onChange={(event) => { const selected = savedWindows.find((item) => item.id === event.target.value); setEditableMatch({ ...editableMatch, scheduleWindowId: event.target.value, scheduledAt: toLocalDateTime(selected?.starts_at) || editableMatch.scheduledAt, venue: selected?.venue ?? editableMatch.venue }); }}><option value="">No window</option>{savedWindows.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Stage<select value={editableMatch.stage} onChange={(event) => setEditableMatch({ ...editableMatch, stage: event.target.value as MatchStage })}>{stageOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label>Team one<select value={editableMatch.teamOneId} onChange={(event) => setEditableMatch({ ...editableMatch, teamOneId: event.target.value })}><option value="">Use placeholder</option>{manualTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>{!editableMatch.teamOneId && <label>Team one placeholder<input value={editableMatch.teamOnePlaceholder} onChange={(event) => setEditableMatch({ ...editableMatch, teamOnePlaceholder: event.target.value })} /></label>}<label>Team two<select value={editableMatch.teamTwoId} onChange={(event) => setEditableMatch({ ...editableMatch, teamTwoId: event.target.value })}><option value="">Use placeholder</option>{manualTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>{!editableMatch.teamTwoId && <label>Team two placeholder<input value={editableMatch.teamTwoPlaceholder} onChange={(event) => setEditableMatch({ ...editableMatch, teamTwoPlaceholder: event.target.value })} /></label>}<label>Date and time<input type="datetime-local" value={editableMatch.scheduledAt} onChange={(event) => setEditableMatch({ ...editableMatch, scheduledAt: event.target.value })} /></label><label>Venue<input value={editableMatch.venue} onChange={(event) => setEditableMatch({ ...editableMatch, venue: event.target.value })} /></label><label>Overs<input type="number" min="1" value={editableMatch.overs} onChange={(event) => setEditableMatch({ ...editableMatch, overs: event.target.value })} /></label><label>Balls per over<input type="number" min="1" max="12" value={editableMatch.ballsPerOver} onChange={(event) => setEditableMatch({ ...editableMatch, ballsPerOver: event.target.value })} /></label><label>Wickets<input type="number" min="1" value={editableMatch.wickets} onChange={(event) => setEditableMatch({ ...editableMatch, wickets: event.target.value })} /></label><label className="schedule-checkbox"><input type="checkbox" checked={editableMatch.isPublished} onChange={(event) => setEditableMatch({ ...editableMatch, isPublished: event.target.checked })} /><span><strong>Publish match</strong></span></label></div><div className="schedule-modal-actions"><button type="button" onClick={() => setEditableMatch(null)}>Cancel</button><button type="submit" className="schedule-primary-button" disabled={saving}>{saving ? "Saving…" : "Save match"}</button></div></form></div>}

      {posterPages.length > 0 && <section className="schedule-poster-area"><div className="schedule-panel-heading"><div><span>SOCIAL MEDIA</span><h2>Downloadable schedule</h2><p>Breaks are shown in sequence and each page now stretches its fixture area to remove unused bottom space.</p></div></div><div className="schedule-poster-pages">{posterPages.map((items, index) => <SchedulePoster key={index} tournament={tournament} items={items} pageNumber={index + 1} totalPages={posterPages.length} />)}</div></section>}
    </main>
  );
}