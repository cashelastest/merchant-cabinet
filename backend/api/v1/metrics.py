"""Metrics endpoint for Prometheus."""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.dependencies import get_session
from models import Deal

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/deals", response_class=PlainTextResponse)
async def deals_metrics(session: AsyncSession = Depends(get_session)) -> str:
    """Prometheus metrics for deals."""

    # Count deals by status
    stmt = select(Deal.status, func.count(Deal.id)).group_by(Deal.status)
    result = await session.execute(stmt)
    status_counts = dict(result.all())

    # Total deals
    total_stmt = select(func.count(Deal.id))
    total_result = await session.execute(total_stmt)
    total_deals = total_result.scalar() or 0

    # Build Prometheus format
    lines = [
        "# HELP deals_total Total number of deals",
        "# TYPE deals_total counter",
        f'deals_total{{status="pending"}} {status_counts.get("pending", 0)}',
        f'deals_total{{status="in_progress"}} {status_counts.get("in_progress", 0)}',
        f'deals_total{{status="completed"}} {status_counts.get("completed", 0)}',
        f'deals_total{{status="refused"}} {status_counts.get("refused", 0)}',
        "",
        "# HELP deals_count Total count of deals",
        "# TYPE deals_count gauge",
        f"deals_count {total_deals}",
    ]

    return "\n".join(lines)
