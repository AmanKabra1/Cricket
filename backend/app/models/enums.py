"""Enumerations shared across models and schemas."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    PUBLIC = "PUBLIC"
    MATCH_ADMIN = "MATCH_ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class BattingStyle(str, enum.Enum):
    RIGHT_HAND = "RIGHT_HAND"
    LEFT_HAND = "LEFT_HAND"


class BowlingStyle(str, enum.Enum):
    NONE = "NONE"
    FAST = "FAST"
    MEDIUM = "MEDIUM"
    OFF_SPIN = "OFF_SPIN"
    LEG_SPIN = "LEG_SPIN"
    LEFT_ARM_SPIN = "LEFT_ARM_SPIN"
    LEFT_ARM_FAST = "LEFT_ARM_FAST"


class PlayerRole(str, enum.Enum):
    BATSMAN = "BATSMAN"
    BOWLER = "BOWLER"
    ALL_ROUNDER = "ALL_ROUNDER"
    WICKET_KEEPER = "WICKET_KEEPER"


class TournamentFormat(str, enum.Enum):
    LEAGUE = "LEAGUE"
    KNOCKOUT = "KNOCKOUT"
    ROUND_ROBIN = "ROUND_ROBIN"
    GROUP_STAGE = "GROUP_STAGE"


class TournamentStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


class MatchStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    LIVE = "LIVE"
    INNINGS_BREAK = "INNINGS_BREAK"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class TossDecision(str, enum.Enum):
    BAT = "BAT"
    BOWL = "BOWL"


class ExtraType(str, enum.Enum):
    NONE = "NONE"
    WIDE = "WIDE"
    NO_BALL = "NO_BALL"
    BYE = "BYE"
    LEG_BYE = "LEG_BYE"


class WicketType(str, enum.Enum):
    NONE = "NONE"
    BOWLED = "BOWLED"
    CAUGHT = "CAUGHT"
    LBW = "LBW"
    RUN_OUT = "RUN_OUT"
    STUMPED = "STUMPED"
    HIT_WICKET = "HIT_WICKET"
    RETIRED_HURT = "RETIRED_HURT"
