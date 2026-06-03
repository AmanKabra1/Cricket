"""Import all models so SQLAlchemy + Alembic see the full metadata."""
from app.models.ball import Ball
from app.models.innings import Innings
from app.models.match import Match
from app.models.player import Player
from app.models.push import PushToken
from app.models.setting import AppSetting
from app.models.stats import PlayerMatchStats
from app.models.team import Team
from app.models.tournament import Tournament, TournamentTeam
from app.models.user import User, match_admins
from app.models.venue import Venue

__all__ = [
    "AppSetting",
    "Ball",
    "Innings",
    "Match",
    "Player",
    "PlayerMatchStats",
    "PushToken",
    "Team",
    "Tournament",
    "TournamentTeam",
    "User",
    "Venue",
    "match_admins",
]
