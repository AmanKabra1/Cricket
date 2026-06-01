-- LocalScore — FULL RESET + RESEED (TiDB Cloud).
-- Run the WHOLE script at once (the @variables must persist in one session).
-- Wipes ALL app data but KEEPS the tables + migration history (alembic_version),
-- then recreates the two admins, a venue, two teams with players, and a LIVE match.
--
-- Logins after running:  super@localscore.dev / superadmin   (Super Admin)
--                        admin@localscore.dev / adminpass     (Match Admin)

-- ── 1) Wipe all data (FK checks off so delete order doesn't matter) ──
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM localscore.balls;
DELETE FROM localscore.player_match_stats;
DELETE FROM localscore.match_admins;
DELETE FROM localscore.innings;
DELETE FROM localscore.matches;
DELETE FROM localscore.players;
DELETE FROM localscore.tournament_teams;
DELETE FROM localscore.tournaments;
DELETE FROM localscore.teams;
DELETE FROM localscore.venues;
DELETE FROM localscore.users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── 2) Admin users ──
INSERT INTO localscore.users (email, hashed_password, full_name, role, is_active) VALUES
('super@localscore.dev', '$2b$12$pTJu/cejRhrLS9/SS4UVWu8MIFjQoBfoKdShfVrd0XiiUMppsEaZe', 'Super Admin', 'SUPER_ADMIN', 1),
('admin@localscore.dev', '$2b$12$bIZFZ2CTukY5Dhh5qHqUpey1dL0WdRRHS5YoauQOGtCqkpZZ3fyt.', 'Match Admin', 'MATCH_ADMIN', 1);

-- ── 3) Venue + teams ──
INSERT INTO localscore.venues (name, city, capacity) VALUES ('Maple Ground', 'Springfield', 2000);
INSERT INTO localscore.teams (name, city, coach) VALUES ('Springfield Strikers', 'Springfield', 'A. Coach');
SET @ta := LAST_INSERT_ID();
INSERT INTO localscore.teams (name, city, coach) VALUES ('Shelbyville Stars', 'Shelbyville', 'B. Coach');
SET @tb := LAST_INSERT_ID();

-- ── 4) Players (6 per team) ──
INSERT INTO localscore.players (team_id, name, age, batting_style, bowling_style, `role`, jersey_number) VALUES
(@ta, 'Strikers Opener',     27, 'RIGHT_HAND', 'None',     'BATSMAN',       1),
(@ta, 'Strikers No.3',       29, 'LEFT_HAND',  'None',     'BATSMAN',       3),
(@ta, 'Strikers Allrounder', 25, 'RIGHT_HAND', 'Right-arm medium',   'ALL_ROUNDER',   7),
(@ta, 'Strikers Keeper',     24, 'RIGHT_HAND', 'None',     'WICKET_KEEPER', 8),
(@ta, 'Strikers Pacer',      26, 'RIGHT_HAND', 'Right-arm fast',     'BOWLER',       11),
(@ta, 'Strikers Spinner',    28, 'LEFT_HAND',  'Right-arm off-break', 'BOWLER',        9),
(@tb, 'Stars Opener',        27, 'RIGHT_HAND', 'None',     'BATSMAN',       1),
(@tb, 'Stars No.3',          30, 'RIGHT_HAND', 'None',     'BATSMAN',       3),
(@tb, 'Stars Allrounder',    23, 'LEFT_HAND',  'Right-arm medium',   'ALL_ROUNDER',   7),
(@tb, 'Stars Keeper',        25, 'RIGHT_HAND', 'None',     'WICKET_KEEPER', 8),
(@tb, 'Stars Pacer',         28, 'RIGHT_HAND', 'Right-arm fast',     'BOWLER',       11),
(@tb, 'Stars Spinner',       29, 'RIGHT_HAND', 'Right-arm leg-break', 'BOWLER',        9);

-- ── 5) Captains (first player of each team) ──
UPDATE localscore.teams SET captain_id = (SELECT MIN(id) FROM localscore.players WHERE team_id=@ta) WHERE id=@ta;
UPDATE localscore.teams SET captain_id = (SELECT MIN(id) FROM localscore.players WHERE team_id=@tb) WHERE id=@tb;

-- ── 6) A LIVE match (Strikers batting first), scored by the match admin ──
SET @venue := (SELECT MAX(id) FROM localscore.venues WHERE name='Maple Ground');
INSERT INTO localscore.matches (sport, team_a_id, team_b_id, venue_id, overs_limit, status, toss_winner_id, toss_decision)
VALUES ('cricket', @ta, @tb, @venue, 20, 'LIVE', @ta, 'BAT');
SET @match := LAST_INSERT_ID();

INSERT INTO localscore.match_admins (match_id, user_id)
SELECT @match, id FROM localscore.users WHERE email='admin@localscore.dev';

-- ── 7) Open the first innings ──
INSERT INTO localscore.innings (match_id, innings_number, batting_team_id, bowling_team_id)
VALUES (@match, 1, @ta, @tb);

-- Done. Refresh the site: a LIVE match shows on the dashboard; log in to score/manage.
