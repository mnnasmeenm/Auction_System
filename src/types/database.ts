export type PlayerStatus =
  | "registered"
  | "available"
  | "sold"
  | "unsold"
  | "reauction"
  | "withdrawn";

export type TournamentStatus =
  | "draft"
  | "ready"
  | "live"
  | "paused"
  | "completed";

export type CompetitionFormat =
  | "league"
  | "groups"
  | "knockout"
  | "custom";

export type QualificationFormat =
  | "ipl_playoff"
  | "semi_final"
  | "final_only"
  | "custom";

export type MatchStage =
  | "league"
  | "group"
  | "qualifier_one"
  | "eliminator"
  | "qualifier_two"
  | "semi_final"
  | "third_place"
  | "final"
  | "custom";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "innings_break"
  | "completed"
  | "no_result"
  | "cancelled";

export type MatchResultType =
  | "win"
  | "tie"
  | "no_result"
  | "abandoned";

export type ScoringMode =
  | "live"
  | "manual"
  | "hybrid";

export type InningsStatus =
  | "not_started"
  | "live"
  | "completed";

export type DismissalType =
  | "not_out"
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "retired"
  | "other";

export type BallExtraType =
  | "wide"
  | "no_ball"
  | "bye"
  | "leg_bye"
  | "penalty";

export type ScoreAuditAction =
  | "start_match"
  | "start_innings"
  | "add_ball"
  | "undo_ball"
  | "correct_ball"
  | "manual_innings_save"
  | "complete_innings"
  | "complete_match"
  | "reopen_match"
  | "other";

export interface PlayerCategory {
  id: string;
  tournament_id: string;
  name: string;
  minimum_required: number;
  display_order: number;
}

export interface Player {
  id: string;
  tournament_id: string;
  division_id: string | null;
  category_id: string | null;
  player_number: number | null;
  full_name: string;
  nickname: string | null;
  photo_path: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  preferred_position: string | null;
  base_price: number;
  previous_matches: number;
  previous_runs: number;
  previous_wickets: number;
  catches: number;
  achievements: string | null;
  availability_notes: string | null;
  status: PlayerStatus;
  sold_team_id: string | null;
  sold_price: number | null;
  allocation_source: "auction" | "manual";
  counts_toward_budget: boolean;
  created_at?: string;
  updated_at?: string;
  category?: PlayerCategory;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  team_color: string;
  logo_path: string | null;
  manager_name: string | null;
  captain_player_id: string | null;
  vice_captain_player_id: string | null;
  starting_budget: number;
  amount_spent: number;
  squad_limit: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Tournament {
  id: string;
  society_name: string;
  tournament_name: string;
  society_logo_path: string | null;
  tournament_logo_path: string | null;
  starting_budget: number;
  maximum_squad_size: number;
  allow_sale_revocation: boolean;
  require_revocation_reason: boolean;
  status: TournamentStatus;
  public_slug: string | null;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentCompetitionSettings {
  tournament_id: string;
  division_id: string | null;
  format: CompetitionFormat;
  qualification_format: QualificationFormat;
  group_count: number;
  qualifiers_count: number;
  default_overs: number;
  default_balls_per_over: number;
  default_wickets_per_innings: number;
  nrr_display_balls_per_over: number;
  win_points: number;
  tie_points: number;
  no_result_points: number;
  loss_points: number;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentGroup {
  id: string;
  tournament_id: string;
  division_id: string;
  name: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentGroupTeam {
  id: string;
  tournament_id: string;
  division_id: string;
  group_id: string;
  team_id: string;
  seed_number: number | null;
  created_at?: string;
}

export interface TournamentDivision {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  division_color: string;
  display_order: number;
  is_active: boolean;
  format: CompetitionFormat;
  group_count: number;
  qualification_format: QualificationFormat;
  qualifiers_count: number;
  default_overs: number;
  default_balls_per_over: number;
  default_wickets_per_innings: number;
  matches_per_turn: number;
  avoid_time_from: string | null;
  avoid_time_to: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentDivisionTeam {
  id: string;
  tournament_id: string;
  division_id: string;
  team_id: string;
  seed_number: number | null;
  captain_player_id: string | null;
  vice_captain_player_id: string | null;
  created_at?: string;
  team?: Team | null;
}

export interface PointsTableRow {
  position: number;
  team_id: string;
  team_name: string;
  short_name: string;
  team_color: string;
  logo_path: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  runs_for: number;
  overs_for: number;
  runs_against: number;
  overs_against: number;
  net_run_rate: number;
}

export interface PointsTableAdjustment {
  id: string;
  tournament_id: string;
  division_id: string;
  group_id: string | null;
  team_id: string;
  played_adjustment: number;
  won_adjustment: number;
  lost_adjustment: number;
  tied_adjustment: number;
  no_result_adjustment: number;
  points_adjustment: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface TournamentScheduleWindow {
  id: string;
  tournament_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  match_duration_minutes: number;
  turnaround_minutes: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentScheduleBreak {
  id: string;
  tournament_id: string;
  schedule_window_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  division_id: string;
  schedule_window_id: string | null;
  group_id: string | null;
  match_number: number;
  round_number: number | null;
  stage: MatchStage;
  team_one_id: string | null;
  team_two_id: string | null;
  team_one_placeholder: string | null;
  team_two_placeholder: string | null;
  scheduled_at: string | null;
  venue: string | null;
  status: MatchStatus;
  overs_per_innings: number;
  balls_per_over: number;
  wickets_per_innings: number;
  toss_winner_id: string | null;
  toss_decision: "bat" | "bowl" | null;
  winner_team_id: string | null;
  result_type: MatchResultType | null;
  result_summary: string | null;
  player_of_match_id: string | null;
  player_of_match_reason: string | null;
  scoring_mode: ScoringMode;
  revised_target: number | null;
  revised_target_note: string | null;
  last_score_update_at: string | null;
  is_published: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
  group?: TournamentGroup | null;
  division?: TournamentDivision | null;
  schedule_window?: TournamentScheduleWindow | null;
  team_one?: Team | null;
  team_two?: Team | null;
}

export interface MatchInnings {
  id: string;
  match_id: string;
  tournament_id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id: string;
  runs: number;
  wickets: number;
  legal_balls: number;
  extras: number;
  wides: number;
  no_balls: number;
  byes: number;
  leg_byes: number;
  penalty_runs: number;
  is_all_out: boolean;
  is_completed: boolean;
  nrr_runs_override: number | null;
  nrr_balls_override: number | null;
  innings_status: InningsStatus;
  maximum_overs: number;
  balls_per_over: number;
  maximum_wickets: number;
  target_runs: number | null;
  target_note: string | null;
  is_declared: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
  batting_team?: Team | null;
  bowling_team?: Team | null;
  batting_scorecards?: BattingScorecard[];
  bowling_scorecards?: BowlingScorecard[];
  fall_of_wickets?: FallOfWicket[];
}

export interface BattingScorecard {
  id: string;
  innings_id: string;
  tournament_id: string;
  team_id: string;
  player_id: string | null;
  player_name: string;
  batting_position: number | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal_type: DismissalType;
  bowler_player_id: string | null;
  fielder_player_id: string | null;
  dismissal_text: string | null;
  created_at?: string;
  updated_at?: string;
  player?: Player | null;
}

export interface BowlingScorecard {
  id: string;
  innings_id: string;
  tournament_id: string;
  team_id: string;
  player_id: string | null;
  player_name: string;
  legal_balls: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
  dot_balls: number;
  fours_conceded: number;
  sixes_conceded: number;
  created_at?: string;
  updated_at?: string;
  player?: Player | null;
}

export interface FieldingScorecard {
  id: string;
  match_id: string;
  tournament_id: string;
  team_id: string;
  player_id: string | null;
  player_name: string;
  catches: number;
  stumpings: number;
  direct_run_outs: number;
  assisted_run_outs: number;
  created_at?: string;
  updated_at?: string;
  player?: Player | null;
  team?: Team | null;
}

export interface MatchBallEvent {
  id: string;
  match_id: string;
  innings_id: string;
  tournament_id: string;
  sequence_number: number;
  over_number: number;
  ball_in_over: number;
  batter_player_id: string | null;
  batter_name: string | null;
  non_striker_player_id: string | null;
  non_striker_name: string | null;
  bowler_player_id: string | null;
  bowler_name: string | null;
  runs_off_bat: number;
  extra_type: BallExtraType | null;
  extra_runs: number;
  is_legal_ball: boolean;
  is_wicket: boolean;
  dismissal_type: DismissalType | null;
  dismissed_player_id: string | null;
  dismissed_player_name: string | null;
  fielder_player_id: string | null;
  wicket_counts: boolean;
  credited_bowler_wicket: boolean;
  free_hit_delivery: boolean;
  strike_rotation_runs: number;
  run_out_kind: "direct" | "assisted" | null;
  note: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FallOfWicket {
  id: string;
  innings_id: string;
  tournament_id: string;
  wicket_number: number;
  team_runs: number;
  legal_balls: number;
  player_id: string | null;
  player_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface MatchLiveState {
  match_id: string;
  tournament_id: string;
  current_innings_id: string | null;
  striker_player_id: string | null;
  striker_name: string | null;
  non_striker_player_id: string | null;
  non_striker_name: string | null;
  bowler_player_id: string | null;
  bowler_name: string | null;
  target_runs: number | null;
  last_ball_event_id: string | null;
  free_hit: boolean;
  over_complete: boolean;
  next_bowler_required: boolean;
  last_over_bowler_player_id: string | null;
  last_over_bowler_name: string | null;
  revision: number;
  updated_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MatchScoreAudit {
  id: string;
  tournament_id: string;
  match_id: string;
  innings_id: string | null;
  ball_event_id: string | null;
  action: ScoreAuditAction;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  performed_by: string | null;
  created_at?: string;
}
