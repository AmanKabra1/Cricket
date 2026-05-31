// Shared API types — mirror the backend Pydantic schemas.

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "INNINGS_BREAK"
  | "COMPLETED"
  | "ABANDONED";

export type UserRole = "PUBLIC" | "MATCH_ADMIN" | "SUPER_ADMIN";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Team {
  id: number;
  name: string;
  city: string | null;
  coach: string | null;
  logo_url: string | null;
  captain_id: number | null;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  age: number | null;
  batting_style: string;
  bowling_style: string;
  role: string;
  jersey_number: number | null;
  photo_url: string | null;
}

export interface TeamDetail extends Team {
  players: Player[];
}

export interface Match {
  id: number;
  sport: string;
  tournament_id: number | null;
  team_a_id: number;
  team_b_id: number;
  venue_id: number | null;
  scheduled_at: string | null;
  overs_limit: number;
  status: MatchStatus;
  toss_winner_id: number | null;
  toss_decision: "BAT" | "BOWL" | null;
  winner_team_id: number | null;
  result_text: string | null;
}

export interface InningsScore {
  innings_id: number;
  innings_number: number;
  batting_team_id: number;
  bowling_team_id: number;
  runs: number;
  wickets: number;
  overs: string;
  extras: number;
  run_rate: number;
  target: number | null;
  required_run_rate: number | null;
  is_closed: boolean;
}

export interface LiveScore {
  match_id: number;
  status: MatchStatus;
  overs_limit: number;
  innings: InningsScore[];
}

export interface BatterCard {
  player_id: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  is_out: boolean;
}

export interface BowlerCard {
  player_id: number;
  name: string;
  overs: string;
  runs_conceded: number;
  wickets: number;
  economy: number;
}

export interface InningsCard extends InningsScore {
  batting: BatterCard[];
  bowling: BowlerCard[];
}

export interface Scorecard {
  match_id: number;
  status: MatchStatus;
  innings: InningsCard[];
}

export interface CommentaryItem {
  over: number;
  ball: number;
  runs: number;
  is_wicket: boolean;
  text: string;
}

export interface OverPoint {
  over: number;
  runs: number;
  wickets: number;
  cumulative: number;
}

export interface Analytics {
  match_id: number;
  innings: { innings_number: number; batting_team_id: number; overs: OverPoint[] }[];
}

export interface DashboardData {
  live: Match[];
  upcoming: Match[];
  recent: Match[];
}

export interface StandingRow {
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  net_run_rate: number;
}

export interface Tournament {
  id: number;
  name: string;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}
