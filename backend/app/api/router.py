"""Aggregate all v1 routers under the API prefix."""
from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    maintenance,
    matches,
    public,
    scoring,
    teams,
    tournaments,
    uploads,
    venues,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(teams.router)
api_router.include_router(venues.router)
api_router.include_router(tournaments.router)
api_router.include_router(matches.router)
api_router.include_router(scoring.router)
api_router.include_router(public.router)
api_router.include_router(uploads.router)
api_router.include_router(admin.router)
api_router.include_router(maintenance.router)
