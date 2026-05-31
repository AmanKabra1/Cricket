"""Seed demo data: users, teams, players, a venue, and a live match.

Idempotent — running twice will not duplicate the super admin. Run after
migrations:  python -m app.seed
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.enums import (
    BattingStyle,
    BowlingStyle,
    MatchStatus,
    PlayerRole,
    TossDecision,
    UserRole,
)
from app.models.innings import Innings
from app.models.match import Match
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.models.venue import Venue

_ROLE_CYCLE = [
    (PlayerRole.BATSMAN, BowlingStyle.NONE),
    (PlayerRole.ALL_ROUNDER, BowlingStyle.MEDIUM),
    (PlayerRole.BOWLER, BowlingStyle.FAST),
    (PlayerRole.WICKET_KEEPER, BowlingStyle.NONE),
    (PlayerRole.BOWLER, BowlingStyle.OFF_SPIN),
]


def _make_players(team_name: str) -> list[Player]:
    players = []
    for i in range(1, 12):
        role, bowl = _ROLE_CYCLE[i % len(_ROLE_CYCLE)]
        players.append(
            Player(
                name=f"{team_name} Player {i}",
                age=20 + (i % 12),
                batting_style=BattingStyle.RIGHT_HAND if i % 3 else BattingStyle.LEFT_HAND,
                bowling_style=bowl,
                role=role,
                jersey_number=i,
            )
        )
    return players


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        if await db.scalar(select(User).where(User.email == "super@localscore.dev")):
            print("Seed data already present — skipping.")
            return

        super_admin = User(
            email="super@localscore.dev",
            hashed_password=hash_password("superadmin"),
            full_name="Super Admin",
            role=UserRole.SUPER_ADMIN,
        )
        match_admin = User(
            email="admin@localscore.dev",
            hashed_password=hash_password("adminpass"),
            full_name="Match Admin",
            role=UserRole.MATCH_ADMIN,
        )
        db.add_all([super_admin, match_admin])

        venue = Venue(name="Maple Ground", city="Springfield", capacity=2000)
        team_a = Team(name="Springfield Strikers", city="Springfield", coach="A. Coach")
        team_b = Team(name="Shelbyville Stars", city="Shelbyville", coach="B. Coach")
        team_a.players = _make_players("Strikers")
        team_b.players = _make_players("Stars")
        db.add_all([venue, team_a, team_b])
        await db.flush()

        team_a.captain_id = team_a.players[0].id
        team_b.captain_id = team_b.players[0].id

        match = Match(
            team_a_id=team_a.id,
            team_b_id=team_b.id,
            venue_id=venue.id,
            overs_limit=20,
            status=MatchStatus.LIVE,
            toss_winner_id=team_a.id,
            toss_decision=TossDecision.BAT,
        )
        match.admins = [match_admin]
        db.add(match)
        await db.flush()

        innings = Innings(
            match_id=match.id,
            innings_number=1,
            batting_team_id=team_a.id,
            bowling_team_id=team_b.id,
        )
        db.add(innings)

        await db.commit()
        print("Seeded:")
        print("  Super Admin -> super@localscore.dev / superadmin")
        print("  Match Admin -> admin@localscore.dev / adminpass")
        print(f"  Live match id={match.id} ({team_a.name} vs {team_b.name})")
        print(f"  Open innings id={innings.id}; striker={team_a.players[0].id} "
              f"non-striker={team_a.players[1].id} bowler={team_b.players[2].id}")


if __name__ == "__main__":
    asyncio.run(seed())
