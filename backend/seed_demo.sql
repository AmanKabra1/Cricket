-- LocalScore — demo data seed for TiDB Cloud (run the WHOLE script at once so
-- the @session variables persist). Mirrors the local `python -m app.seed`.
-- Safe to run once on a fresh DB. Assumes the two admin users already exist
-- (super@localscore.dev / admin@localscore.dev); if not, create them first.

-- 1) Venue
INSERT INTO localscore.venues (name, city, capacity) VALUES ('Maple Ground', 'Springfield', 2000);

-- 2) Teams
INSERT INTO localscore.teams (name, city, coach) VALUES ('Springfield Strikers', 'Springfield', 'A. Coach');
SET @ta := LAST_INSERT_ID();
INSERT INTO localscore.teams (name, city, coach) VALUES ('Shelbyville Stars', 'Shelbyville', 'B. Coach');
SET @tb := LAST_INSERT_ID();

-- 3) Players (6 per team)
INSERT INTO localscore.players (team_id, name, age, batting_style, bowling_style, `role`, jersey_number) VALUES
(@ta, 'Strikers Opener',       27, 'RIGHT_HAND', 'None',    'BATSMAN',        1),
(@ta, 'Strikers No.3',         29, 'LEFT_HAND',  'None',    'BATSMAN',        3),
(@ta, 'Strikers Allrounder',   25, 'RIGHT_HAND', 'Right-arm medium',  'ALL_ROUNDER',    7),
(@ta, 'Strikers Keeper',       24, 'RIGHT_HAND', 'None',    'WICKET_KEEPER',  8),
(@ta, 'Strikers Pacer',        26, 'RIGHT_HAND', 'Right-arm fast',    'BOWLER',         11),
(@ta, 'Strikers Spinner',      28, 'LEFT_HAND',  'Right-arm off-break','BOWLER',         9),
(@tb, 'Stars Opener',          27, 'RIGHT_HAND', 'None',    'BATSMAN',        1),
(@tb, 'Stars No.3',            30, 'RIGHT_HAND', 'None',    'BATSMAN',        3),
(@tb, 'Stars Allrounder',      23, 'LEFT_HAND',  'Right-arm medium',  'ALL_ROUNDER',    7),
(@tb, 'Stars Keeper',          25, 'RIGHT_HAND', 'None',    'WICKET_KEEPER',  8),
(@tb, 'Stars Pacer',           28, 'RIGHT_HAND', 'Right-arm fast',    'BOWLER',         11),
(@tb, 'Stars Spinner',         29, 'RIGHT_HAND', 'Right-arm leg-break','BOWLER',         9);

-- 4) Captains (first player of each team)
UPDATE localscore.teams SET captain_id = (SELECT MIN(id) FROM localscore.players WHERE team_id=@ta) WHERE id=@ta;
UPDATE localscore.teams SET captain_id = (SELECT MIN(id) FROM localscore.players WHERE team_id=@tb) WHERE id=@tb;

-- 5) A LIVE match (Strikers batting first)
SET @venue := (SELECT MAX(id) FROM localscore.venues WHERE name='Maple Ground');
INSERT INTO localscore.matches (sport, team_a_id, team_b_id, venue_id, overs_limit, status, toss_winner_id, toss_decision)
VALUES ('cricket', @ta, @tb, @venue, 20, 'LIVE', @ta, 'BAT');
SET @match := LAST_INSERT_ID();

-- 6) Assign the match admin (so they can score it)
INSERT INTO localscore.match_admins (match_id, user_id)
SELECT @match, id FROM localscore.users WHERE email='admin@localscore.dev';

-- 7) Open the first innings
INSERT INTO localscore.innings (match_id, innings_number, batting_team_id, bowling_team_id)
VALUES (@match, 1, @ta, @tb);

-- Done. Open the site → the dashboard shows a LIVE match; log in as the match
-- admin to score it, or as super admin to manage everything.
