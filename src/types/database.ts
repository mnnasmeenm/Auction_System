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
