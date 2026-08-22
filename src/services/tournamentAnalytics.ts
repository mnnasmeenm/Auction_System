import { getTournamentMatches } from "./matches";
import { supabase } from "./supabase";

import type {
  BattingScorecard,
  BowlingScorecard,
  FieldingScorecard,
  MatchInnings,
  Player,
  Team,
  TournamentMatch
} from "../types/database";

export interface PlayerTournamentStatistics {
  key: string;
  playerId: string | null;
  playerName: string;
  photoPath: string | null;
  teamId: string | null;
  teamName: string;
  teamShortName: string;
  teamColor: string;
  teamLogoPath: string | null;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highestScore: number;
  strikeRate: number;
  bowlingInnings: number;
  legalBalls: number;
  bowlingOvers: number;
  runsConceded: number;
  wickets: number;
  bestWickets: number;
  bestBowlingRuns: number;
  economy: number;
  wides: number;
  noBalls: number;
  bowlingExtras: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  playerOfMatchAwards: number;
  tournamentScore: number;
}

export interface TeamInningsRecord {
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamColor: string;
  teamLogoPath: string | null;
  runs: number;
  wickets: number;
  legalBalls: number;
  ballsPerOver: number;
  matchNumber: number;
  opponentName: string;
}

export type TournamentAwardKind =
  | "most_runs"
  | "most_wickets"
  | "most_catches"
  | "most_sixes"
  | "most_fours"
  | "most_wides"
  | "most_no_balls"
  | "most_bowling_extras"
  | "highest_individual_score"
  | "best_bowling_innings"
  | "highest_team_score"
  | "most_player_of_match"
  | "player_of_tournament";

export interface TournamentAward {
  id: TournamentAwardKind;
  title: string;
  label: string;
  value: string;
  detail: string;
  accent: string;
  player: PlayerTournamentStatistics | null;
  team: TeamInningsRecord | null;
}

export interface TournamentAnalyticsSnapshot {
  players: PlayerTournamentStatistics[];
  awards: TournamentAward[];
  matchPlayerSuggestions: MatchPlayerAwardSuggestion[];
  playerOfTournament: PlayerTournamentStatistics | null;
  playerOfTournamentReason: string;
  highestTeamScore: TeamInningsRecord | null;
  scoredMatches: number;
}

export interface MatchPlayerAwardSuggestion {
  match: TournamentMatch;
  innings: MatchInnings[];
  candidates: PlayerTournamentStatistics[];
  suggestedPlayer: PlayerTournamentStatistics | null;
  suggestedReason: string;
  confirmedPlayer: PlayerTournamentStatistics | null;
  confirmedReason: string | null;
}

interface AnalyticsAccumulator
  extends Omit<
    PlayerTournamentStatistics,
    "strikeRate" | "economy" | "tournamentScore"
  > {
  bowlingOvers: number;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function playerKey(
  playerId: string | null,
  teamId: string | null,
  playerName: string
) {
  return playerId ?? `manual:${teamId ?? "unknown"}:${normalizeName(playerName)}`;
}

function initialAccumulator(
  key: string,
  playerId: string | null,
  playerName: string,
  team: Team | null,
  player: Player | null
): AnalyticsAccumulator {
  return {
    key,
    playerId,
    playerName,
    photoPath: player?.photo_path ?? null,
    teamId: team?.id ?? player?.sold_team_id ?? null,
    teamName: team?.name ?? "Unassigned team",
    teamShortName: team?.short_name ?? "—",
    teamColor: team?.team_color ?? "#2f72ff",
    teamLogoPath: team?.logo_path ?? null,
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    bowlingInnings: 0,
    legalBalls: 0,
    bowlingOvers: 0,
    runsConceded: 0,
    wickets: 0,
    bestWickets: 0,
    bestBowlingRuns: 0,
    wides: 0,
    noBalls: 0,
    bowlingExtras: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    playerOfMatchAwards: 0
  };
}

function topPlayer(
  players: PlayerTournamentStatistics[],
  metric: (player: PlayerTournamentStatistics) => number,
  tieBreaker?: (player: PlayerTournamentStatistics) => number
) {
  return [...players].sort((first, second) => {
    const difference = metric(second) - metric(first);
    if (difference !== 0) return difference;
    return (tieBreaker?.(second) ?? 0) - (tieBreaker?.(first) ?? 0);
  })[0] ?? null;
}

function award(
  id: TournamentAwardKind,
  title: string,
  label: string,
  value: string,
  detail: string,
  accent: string,
  player: PlayerTournamentStatistics | null = null,
  team: TeamInningsRecord | null = null
): TournamentAward {
  return { id, title, label, value, detail, accent, player, team };
}

function playerOfTournamentReason(player: PlayerTournamentStatistics | null) {
  if (!player) return "No completed performance data is available yet.";

  const contributions = [
    { value: player.runs, text: `${player.runs} runs` },
    { value: player.wickets * 25, text: `${player.wickets} wickets` },
    {
      value: (player.catches + player.stumpings + player.runOuts) * 8,
      text: `${player.catches + player.stumpings + player.runOuts} fielding contributions`
    },
    {
      value: player.playerOfMatchAwards * 15,
      text: `${player.playerOfMatchAwards} Player of the Match award${player.playerOfMatchAwards === 1 ? "" : "s"}`
    }
  ]
    .filter((item) => item.value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 3)
    .map((item) => item.text);

  return contributions.length > 0
    ? `Suggested from ${contributions.join(", ")}. Composite performance score: ${player.tournamentScore.toFixed(1)}.`
    : `Composite performance score: ${player.tournamentScore.toFixed(1)}.`;
}

function finalizeAccumulator(
  player: AnalyticsAccumulator
): PlayerTournamentStatistics {
  return {
    ...player,
    strikeRate: player.balls > 0
      ? player.runs / player.balls * 100
      : 0,
    economy: player.bowlingOvers > 0
      ? player.runsConceded / player.bowlingOvers
      : 0,
    tournamentScore:
      player.runs +
      player.wickets * 25 +
      player.catches * 8 +
      player.stumpings * 10 +
      player.runOuts * 10 +
      player.playerOfMatchAwards * 15 -
      player.wides -
      player.noBalls * 2
  };
}

function matchAwardReason(player: PlayerTournamentStatistics | null) {
  if (!player) return "No player performance was recorded for this match.";

  const parts: string[] = [];
  if (player.runs > 0) {
    parts.push(
      `${player.runs} run${player.runs === 1 ? "" : "s"} from ${player.balls} ball${player.balls === 1 ? "" : "s"}`
    );
  }
  if (player.wickets > 0) {
    parts.push(
      `${player.wickets} wicket${player.wickets === 1 ? "" : "s"} for ${player.runsConceded} runs`
    );
  }
  if (player.catches > 0) {
    parts.push(`${player.catches} catch${player.catches === 1 ? "" : "es"}`);
  }
  if (player.stumpings > 0) {
    parts.push(`${player.stumpings} stumping${player.stumpings === 1 ? "" : "s"}`);
  }
  if (player.runOuts > 0) {
    parts.push(`${player.runOuts} run-out contribution${player.runOuts === 1 ? "" : "s"}`);
  }

  return parts.length > 0
    ? `${parts.join(", ")}. Match performance score: ${player.tournamentScore.toFixed(1)}.`
    : `Best recorded match performance with a score of ${player.tournamentScore.toFixed(1)}.`;
}

export async function getTournamentAnalytics(
  tournamentId: string,
  divisionId: string | null = null
): Promise<TournamentAnalyticsSnapshot> {
  const matches = await getTournamentMatches(tournamentId);
  const relevantMatches = matches.filter(
    (match) =>
      (!divisionId || match.division_id === divisionId) &&
      ["live", "innings_break", "completed", "no_result"].includes(match.status)
  );
  const matchIds = relevantMatches.map((match) => match.id);

  const [playersResponse, teamsResponse] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId),
    supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
  ]);

  if (playersResponse.error) throw playersResponse.error;
  if (teamsResponse.error) throw teamsResponse.error;

  const registeredPlayers = (playersResponse.data ?? []) as Player[];
  const teams = (teamsResponse.data ?? []) as Team[];
  const playersById = new Map(
    registeredPlayers.map((player) => [player.id, player])
  );
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  if (matchIds.length === 0) {
    return {
      players: [],
      awards: [],
      matchPlayerSuggestions: [],
      playerOfTournament: null,
      playerOfTournamentReason: "No scored matches are available yet.",
      highestTeamScore: null,
      scoredMatches: 0
    };
  }

  const [inningsResponse, fieldingResponse] = await Promise.all([
    supabase
      .from("match_innings")
      .select(`
        *,
        batting_scorecards(*),
        bowling_scorecards(*)
      `)
      .in("match_id", matchIds)
      .order("innings_number"),
    supabase
      .from("fielding_scorecards")
      .select("*")
      .in("match_id", matchIds)
  ]);

  if (inningsResponse.error) throw inningsResponse.error;
  if (fieldingResponse.error) throw fieldingResponse.error;

  const innings = (inningsResponse.data ?? []) as unknown as MatchInnings[];
  const fielding = (fieldingResponse.data ?? []) as FieldingScorecard[];
  const matchById = new Map(
    relevantMatches.map((match) => [match.id, match])
  );
  const aggregate = new Map<string, AnalyticsAccumulator>();

  function getAccumulator(
    playerId: string | null,
    playerName: string,
    teamId: string | null
  ) {
    const key = playerKey(playerId, teamId, playerName);
    const existing = aggregate.get(key);
    if (existing) return existing;

    const player = playerId ? playersById.get(playerId) ?? null : null;
    const resolvedTeamId = teamId ?? player?.sold_team_id ?? null;
    const team = resolvedTeamId
      ? teamsById.get(resolvedTeamId) ?? null
      : null;
    const created = initialAccumulator(
      key,
      playerId,
      playerName,
      team,
      player
    );
    aggregate.set(key, created);
    return created;
  }

  const teamInningsRecords: TeamInningsRecord[] = [];

  innings.forEach((record) => {
    const match = matchById.get(record.match_id);
    const battingTeam = teamsById.get(record.batting_team_id) ?? null;
    const opponentId = match?.team_one_id === record.batting_team_id
      ? match.team_two_id
      : match?.team_one_id ?? null;
    const opponent = opponentId ? teamsById.get(opponentId) ?? null : null;

    if (battingTeam && match) {
      teamInningsRecords.push({
        teamId: battingTeam.id,
        teamName: battingTeam.name,
        teamShortName: battingTeam.short_name,
        teamColor: battingTeam.team_color,
        teamLogoPath: battingTeam.logo_path,
        runs: record.runs,
        wickets: record.wickets,
        legalBalls: record.legal_balls,
        ballsPerOver: record.balls_per_over,
        matchNumber: match.match_number,
        opponentName: opponent?.name ?? "Opponent"
      });
    }

    (record.batting_scorecards ?? []).forEach(
      (score: BattingScorecard) => {
        const player = getAccumulator(
          score.player_id,
          score.player_name,
          score.team_id
        );
        player.innings += 1;
        player.runs += score.runs;
        player.balls += score.balls;
        player.fours += score.fours;
        player.sixes += score.sixes;
        player.highestScore = Math.max(player.highestScore, score.runs);
      }
    );

    (record.bowling_scorecards ?? []).forEach(
      (score: BowlingScorecard) => {
        const player = getAccumulator(
          score.player_id,
          score.player_name,
          score.team_id
        );
        player.bowlingInnings += 1;
        player.legalBalls += score.legal_balls;
        player.bowlingOvers += score.legal_balls /
          Math.max(record.balls_per_over, 1);
        player.runsConceded += score.runs_conceded;
        player.wickets += score.wickets;
        player.wides += score.wides;
        player.noBalls += score.no_balls;
        player.bowlingExtras += score.wides + score.no_balls;

        if (
          score.wickets > player.bestWickets ||
          (
            score.wickets === player.bestWickets &&
            (player.bestBowlingRuns === 0 ||
              score.runs_conceded < player.bestBowlingRuns)
          )
        ) {
          player.bestWickets = score.wickets;
          player.bestBowlingRuns = score.runs_conceded;
        }
      }
    );
  });

  fielding.forEach((score) => {
    const player = getAccumulator(
      score.player_id,
      score.player_name,
      score.team_id
    );
    player.catches += score.catches;
    player.stumpings += score.stumpings;
    player.runOuts += score.direct_run_outs + score.assisted_run_outs;
  });

  relevantMatches.forEach((match) => {
    if (!match.player_of_match_id) return;
    const registered = playersById.get(match.player_of_match_id);
    if (!registered) return;

    const player = getAccumulator(
      registered.id,
      registered.full_name,
      registered.sold_team_id
    );
    player.playerOfMatchAwards += 1;
  });

  const players = Array.from(aggregate.values()).map(finalizeAccumulator);

  const matchPlayerSuggestions = relevantMatches
    .filter((match) => match.status === "completed")
    .map((match): MatchPlayerAwardSuggestion => {
      const matchInnings = innings.filter(
        (record) => record.match_id === match.id
      );
      const matchFielding = fielding.filter(
        (record) => record.match_id === match.id
      );
      const matchAggregate = new Map<string, AnalyticsAccumulator>();

      function localPlayer(
        playerId: string | null,
        playerName: string,
        teamId: string | null
      ) {
        const key = playerKey(playerId, teamId, playerName);
        const existing = matchAggregate.get(key);
        if (existing) return existing;
        const registered = playerId
          ? playersById.get(playerId) ?? null
          : null;
        const resolvedTeamId = teamId ?? registered?.sold_team_id ?? null;
        const team = resolvedTeamId
          ? teamsById.get(resolvedTeamId) ?? null
          : null;
        const created = initialAccumulator(
          key,
          playerId,
          playerName,
          team,
          registered
        );
        matchAggregate.set(key, created);
        return created;
      }

      matchInnings.forEach((record) => {
        (record.batting_scorecards ?? []).forEach((score) => {
          const player = localPlayer(
            score.player_id,
            score.player_name,
            score.team_id
          );
          player.innings += 1;
          player.runs += score.runs;
          player.balls += score.balls;
          player.fours += score.fours;
          player.sixes += score.sixes;
          player.highestScore = Math.max(player.highestScore, score.runs);
        });

        (record.bowling_scorecards ?? []).forEach((score) => {
          const player = localPlayer(
            score.player_id,
            score.player_name,
            score.team_id
          );
          player.bowlingInnings += 1;
          player.legalBalls += score.legal_balls;
          player.bowlingOvers += score.legal_balls /
            Math.max(record.balls_per_over, 1);
          player.runsConceded += score.runs_conceded;
          player.wickets += score.wickets;
          player.wides += score.wides;
          player.noBalls += score.no_balls;
          player.bowlingExtras += score.wides + score.no_balls;
          player.bestWickets = score.wickets;
          player.bestBowlingRuns = score.runs_conceded;
        });
      });

      matchFielding.forEach((score) => {
        const player = localPlayer(
          score.player_id,
          score.player_name,
          score.team_id
        );
        player.catches += score.catches;
        player.stumpings += score.stumpings;
        player.runOuts += score.direct_run_outs + score.assisted_run_outs;
      });

      const candidates = Array.from(matchAggregate.values())
        .map(finalizeAccumulator)
        .sort(
          (first, second) =>
            second.tournamentScore - first.tournamentScore ||
            second.runs - first.runs ||
            second.wickets - first.wickets
        );
      const suggestedPlayer = candidates[0] ?? null;
      const confirmedPlayer = match.player_of_match_id
        ? candidates.find(
            (candidate) => candidate.playerId === match.player_of_match_id
          ) ?? null
        : null;

      return {
        match,
        innings: matchInnings,
        candidates,
        suggestedPlayer,
        suggestedReason: matchAwardReason(suggestedPlayer),
        confirmedPlayer,
        confirmedReason: match.player_of_match_reason
      };
    })
    .sort((first, second) =>
      second.match.match_number - first.match.match_number
    );

  const mostRuns = topPlayer(players, (player) => player.runs, (player) => player.strikeRate);
  const mostWickets = topPlayer(players, (player) => player.wickets, (player) => -player.economy);
  const mostCatches = topPlayer(players, (player) => player.catches);
  const mostSixes = topPlayer(players, (player) => player.sixes);
  const mostFours = topPlayer(players, (player) => player.fours);
  const mostWides = topPlayer(players, (player) => player.wides);
  const mostNoBalls = topPlayer(players, (player) => player.noBalls);
  const mostExtras = topPlayer(players, (player) => player.bowlingExtras);
  const highestIndividual = topPlayer(players, (player) => player.highestScore);
  const bestBowling = [...players].sort(
    (first, second) =>
      second.bestWickets - first.bestWickets ||
      first.bestBowlingRuns - second.bestBowlingRuns
  )[0] ?? null;
  const mostPom = topPlayer(players, (player) => player.playerOfMatchAwards);
  const playerOfTournament = topPlayer(players, (player) => player.tournamentScore);
  const highestTeamScore = [...teamInningsRecords].sort(
    (first, second) => second.runs - first.runs || first.wickets - second.wickets
  )[0] ?? null;

  const awards: TournamentAward[] = [];

  if (mostRuns && mostRuns.runs > 0) awards.push(award("most_runs", "Orange Crown", "MOST RUNS", String(mostRuns.runs), `${mostRuns.innings} innings · SR ${mostRuns.strikeRate.toFixed(1)}`, "#ff8a1f", mostRuns));
  if (mostWickets && mostWickets.wickets > 0) awards.push(award("most_wickets", "Purple Crown", "MOST WICKETS", String(mostWickets.wickets), `Economy ${mostWickets.economy.toFixed(2)}`, "#b778ff", mostWickets));
  if (mostCatches && mostCatches.catches > 0) awards.push(award("most_catches", "Safe Hands", "MOST CATCHES", String(mostCatches.catches), `${mostCatches.stumpings} stumpings · ${mostCatches.runOuts} run-outs`, "#32d5c4", mostCatches));
  if (mostSixes && mostSixes.sixes > 0) awards.push(award("most_sixes", "Maximum Hitter", "MOST SIXES", String(mostSixes.sixes), `${mostSixes.runs} tournament runs`, "#ffd166", mostSixes));
  if (mostFours && mostFours.fours > 0) awards.push(award("most_fours", "Boundary Master", "MOST FOURS", String(mostFours.fours), `${mostFours.runs} tournament runs`, "#67a8ff", mostFours));
  if (mostWides && mostWides.wides > 0) awards.push(award("most_wides", "Wide Alert", "MOST WIDES", String(mostWides.wides), "Tournament bowling statistic", "#ff6078", mostWides));
  if (mostNoBalls && mostNoBalls.noBalls > 0) awards.push(award("most_no_balls", "Front-foot Alert", "MOST NO-BALLS", String(mostNoBalls.noBalls), "Tournament bowling statistic", "#ff4967", mostNoBalls));
  if (mostExtras && mostExtras.bowlingExtras > 0) awards.push(award("most_bowling_extras", "Extras Monitor", "MOST BOWLING EXTRAS", String(mostExtras.bowlingExtras), `${mostExtras.wides} wides · ${mostExtras.noBalls} no-balls`, "#ff7048", mostExtras));
  if (highestIndividual && highestIndividual.highestScore > 0) awards.push(award("highest_individual_score", "Innings Spotlight", "HIGHEST INDIVIDUAL SCORE", String(highestIndividual.highestScore), `${highestIndividual.playerName} · ${highestIndividual.teamName}`, "#46dd91", highestIndividual));
  if (bestBowling && bestBowling.bestWickets > 0) awards.push(award("best_bowling_innings", "Bowling Spotlight", "BEST BOWLING IN AN INNINGS", `${bestBowling.bestWickets}/${bestBowling.bestBowlingRuns}`, `${bestBowling.playerName} · ${bestBowling.teamName}`, "#8c83ff", bestBowling));
  if (highestTeamScore) awards.push(award("highest_team_score", "Team Record", "HIGHEST TEAM SCORE", `${highestTeamScore.runs}/${highestTeamScore.wickets}`, `Match ${highestTeamScore.matchNumber} vs ${highestTeamScore.opponentName}`, highestTeamScore.teamColor, null, highestTeamScore));
  if (mostPom && mostPom.playerOfMatchAwards > 0) awards.push(award("most_player_of_match", "Match Winner", "MOST PLAYER OF THE MATCH AWARDS", String(mostPom.playerOfMatchAwards), `${mostPom.playerName} · ${mostPom.teamName}`, "#f4c542", mostPom));
  if (playerOfTournament) awards.push(award("player_of_tournament", "Tournament MVP", "PLAYER OF THE TOURNAMENT SUGGESTION", playerOfTournament.playerName, playerOfTournamentReason(playerOfTournament), "#b8f227", playerOfTournament));

  return {
    players: [...players].sort(
      (first, second) => second.tournamentScore - first.tournamentScore
    ),
    awards,
    matchPlayerSuggestions,
    playerOfTournament,
    playerOfTournamentReason: playerOfTournamentReason(playerOfTournament),
    highestTeamScore,
    scoredMatches: relevantMatches.length
  };
}
