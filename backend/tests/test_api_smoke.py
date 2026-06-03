"""End-to-end API smoke test over the real ASGI app (SQLite-backed).

Drives the full happy path a match admin and a spectator would exercise.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.main import app
from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    # Seed a super admin (can score any match).
    async with AsyncSessionLocal() as db:
        if not await db.scalar(select(User).where(User.email == "boss@x.dev")):
            db.add(
                User(
                    email="boss@x.dev",
                    hashed_password=hash_password("password1"),
                    full_name="Boss",
                    role=UserRole.SUPER_ADMIN,
                )
            )
            await db.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_happy_path(client: AsyncClient):
    # login
    r = await client.post("/api/v1/auth/login", json={"email": "boss@x.dev", "password": "password1"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    # create two teams + a player each
    team_ids = []
    for name in ("Alpha", "Beta"):
        rt = await client.post("/api/v1/teams", json={"name": name}, headers=auth)
        assert rt.status_code == 201, rt.text
        tid = rt.json()["id"]
        team_ids.append(tid)
        for pname in ("P1", "P2", "P3"):
            rp = await client.post(
                f"/api/v1/teams/{tid}/players", json={"name": f"{name} {pname}"}, headers=auth
            )
            assert rp.status_code == 201, rp.text

    # roster ids
    a_players = (await client.get(f"/api/v1/teams/{team_ids[0]}/players")).json()
    b_players = (await client.get(f"/api/v1/teams/{team_ids[1]}/players")).json()

    # create match
    rm = await client.post(
        "/api/v1/matches",
        json={
            "team_a_id": team_ids[0],
            "team_b_id": team_ids[1],
            "overs_limit": 5,
            "scheduled_at": "2030-01-01T10:00:00",
        },
        headers=auth,
    )
    assert rm.status_code == 201, rm.text
    match_id = rm.json()["id"]

    # toss + start innings
    await client.post(
        f"/api/v1/matches/{match_id}/toss",
        json={"toss_winner_id": team_ids[0], "decision": "BAT"},
        headers=auth,
    )
    ri = await client.post(
        f"/api/v1/matches/{match_id}/innings",
        json={"batting_team_id": team_ids[0], "bowling_team_id": team_ids[1]},
        headers=auth,
    )
    assert ri.status_code == 200, ri.text

    # score a six
    rb = await client.post(
        f"/api/v1/matches/{match_id}/scoring/ball",
        json={
            "striker_id": a_players[0]["id"],
            "non_striker_id": a_players[1]["id"],
            "bowler_id": b_players[0]["id"],
            "runs_batsman": 6,
        },
        headers=auth,
    )
    assert rb.status_code == 201, rb.text
    body = rb.json()
    assert body["live_score"]["innings"][0]["runs"] == 6

    # public live read (no auth)
    rl = await client.get(f"/api/v1/public/matches/{match_id}/live")
    assert rl.status_code == 200
    assert rl.json()["innings"][0]["runs"] == 6

    # public scorecard shows the batter
    rc = await client.get(f"/api/v1/public/matches/{match_id}/scorecard")
    assert rc.status_code == 200
    batting = rc.json()["innings"][0]["batting"]
    assert any(b["runs"] == 6 and b["sixes"] == 1 for b in batting)

    # spectator cannot score (no token -> 401)
    r401 = await client.post(
        f"/api/v1/matches/{match_id}/scoring/ball",
        json={
            "striker_id": a_players[0]["id"],
            "non_striker_id": a_players[1]["id"],
            "bowler_id": b_players[0]["id"],
            "runs_batsman": 1,
        },
    )
    assert r401.status_code == 401


async def test_tournament_standings_update_on_completion(client: AsyncClient):
    """Completing a tournament match must update the points table."""
    token = (await client.post("/api/v1/auth/login", json={"email": "boss@x.dev", "password": "password1"})).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    team_ids = []
    players = {}
    for name in ("Aces", "Bolts"):
        tid = (await client.post("/api/v1/teams", json={"name": name}, headers=auth)).json()["id"]
        team_ids.append(tid)
        for pname in ("P1", "P2", "P3"):
            await client.post(f"/api/v1/teams/{tid}/players", json={"name": f"{name} {pname}"}, headers=auth)
        players[tid] = (await client.get(f"/api/v1/teams/{tid}/players")).json()

    # Tournament → approve → generate the single fixture.
    tid_t = (await client.post("/api/v1/tournaments", json={"name": "Cup", "format": "LEAGUE", "team_ids": team_ids}, headers=auth)).json()["id"]
    await client.post(f"/api/v1/tournaments/{tid_t}/approve", headers=auth)
    fixtures = (await client.post(f"/api/v1/tournaments/{tid_t}/fixtures", json={"overs_limit": 5}, headers=auth)).json()
    assert len(fixtures) == 1, fixtures
    m = fixtures[0]
    mid, bat, bowl = m["id"], m["team_a_id"], m["team_b_id"]
    bat_p, bowl_p = players[bat], players[bowl]

    async def ball(payload):
        r = await client.post(f"/api/v1/matches/{mid}/scoring/ball", json=payload, headers=auth)
        assert r.status_code == 201, r.text
        return r.json()

    # Innings 1: bat side all out for 0 (3 players → out at 2 wickets).
    await client.post(f"/api/v1/matches/{mid}/innings", json={"batting_team_id": bat, "bowling_team_id": bowl}, headers=auth)
    for i in (0, 1):
        await ball({
            "striker_id": bat_p[i]["id"], "non_striker_id": bat_p[2]["id"], "bowler_id": bowl_p[0]["id"],
            "is_wicket": True, "wicket_type": "BOWLED", "dismissed_player_id": bat_p[i]["id"],
        })

    # Innings 2: chasing side scores the 1 run needed → match complete.
    await client.post(f"/api/v1/matches/{mid}/innings", json={"batting_team_id": bowl, "bowling_team_id": bat}, headers=auth)
    res = await ball({
        "striker_id": bowl_p[0]["id"], "non_striker_id": bowl_p[1]["id"], "bowler_id": bat_p[0]["id"],
        "runs_batsman": 1,
    })
    assert res["innings_closed"] is True

    # The match is COMPLETED and the points table reflects it.
    assert (await client.get(f"/api/v1/matches/{mid}", headers=auth)).json()["status"] == "COMPLETED"
    standings = (await client.get(f"/api/v1/tournaments/{tid_t}/standings", headers=auth)).json()
    rows = {r["team_id"]: r for r in standings}
    assert rows[bowl]["points"] == 2 and rows[bowl]["won"] == 1, standings
    assert rows[bat]["points"] == 0 and rows[bat]["lost"] == 1, standings
    assert rows[bat]["played"] == 1 and rows[bowl]["played"] == 1

    # AI training-data export yields labelled feature rows from the completed match.
    td = (await client.get("/api/v1/admin/ai/training-data", headers=auth)).json()
    assert td["count"] > 0 and "label" in td["rows"][0]
    assert set(td["feature_keys"]).issubset(td["rows"][0].keys())

    # Undo the final ball → match un-completes and the points table resets.
    und = await client.post(f"/api/v1/matches/{mid}/scoring/undo", headers=auth)
    assert und.status_code == 200, und.text
    assert (await client.get(f"/api/v1/matches/{mid}", headers=auth)).json()["status"] != "COMPLETED"
    standings2 = (await client.get(f"/api/v1/tournaments/{tid_t}/standings", headers=auth)).json()
    assert all(r["played"] == 0 and r["points"] == 0 for r in standings2), standings2
