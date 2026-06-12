"""Currency API — inspiration points balance, transactions, and settlement."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from database import get_conn, locked
from services.currency_service import (
    settle,
    deduct_for_draw,
    get_balance,
    get_transactions,
    get_today_earnings,
)

router = APIRouter(prefix="/api/currency", tags=["currency"])


@router.get("/balance")
@locked
def balance():
    """Return current IP balance, lifetime earned/spent."""
    conn = get_conn()
    settle(conn)
    return get_balance(conn)


@router.get("/transactions")
@locked
def transactions(
    source: str | None = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return transaction history, newest first. Settles first so new activity shows up."""
    conn = get_conn()
    settle(conn)
    return {
        "transactions": get_transactions(conn, source=source, limit=limit, offset=offset),
        "total": len(get_transactions(conn, source=source, limit=99999)),
    }


@router.get("/earning-today")
@locked
def earning_today():
    """Return today's earnings broken down by source."""
    conn = get_conn()
    settle(conn)
    return {
        "date": __import__("datetime").datetime.now().strftime("%Y-%m-%d"),
        "sources": get_today_earnings(conn),
    }


@router.post("/sync")
@locked
def sync():
    """Manually trigger settlement for today's un-settled records. Idempotent."""
    conn = get_conn()
    earned = settle(conn)
    bal = get_balance(conn)
    return {"settled": earned, "balance": bal["balance"]}
