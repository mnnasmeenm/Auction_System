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
  created_at?: string;
  updated_at?: string;
}