"""Deletes old deals and nothing else — the database itself is left in place.

Run inside the backend container, from the project directory on the server:

    # see what would be deleted (dry run, the default)
    docker compose exec backend python scripts/cleanup_deals.py --before 2026-09-01

    # actually delete
    docker compose exec backend python scripts/cleanup_deals.py --before 2026-09-01 --yes

Safety defaults:
  * without --yes nothing is deleted, only counted;
  * only "pending" and "refused" deals are deleted unless told otherwise;
  * completed ("accepted") deals are kept unless --include-completed is given:
    they are the record of what was credited to merchant balances;
  * balances, balance history, users and payouts are never changed.

Receipt files of the deleted deals are removed from disk as well.
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Make the backend packages importable however the script is started.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select, update  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from core.config import DATABASE_URL  # noqa: E402
from models import Deal, Payout  # noqa: E402

# Where api/v1/deal.py stores receipt files.
UPLOAD_DIR = Path("/app/uploads/receipts")
STATUSES = ("pending", "in_progress", "accepted", "refused")
BATCH = 1000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete old deals. Dry run unless --yes is given.")
    when = parser.add_mutually_exclusive_group(required=True)
    when.add_argument(
        "--before", type=datetime.fromisoformat, metavar="YYYY-MM-DD",
        help="delete deals received before this date (UTC)",
    )
    when.add_argument(
        "--older-than-days", type=int, metavar="N",
        help="delete deals received more than N days ago",
    )
    parser.add_argument(
        "--status", default="pending,refused",
        help="comma-separated statuses to delete (default: pending,refused)",
    )
    parser.add_argument(
        "--include-completed", action="store_true",
        help='also delete completed ("accepted") deals',
    )
    parser.add_argument(
        "--test-only", action="store_true",
        help='only deals created with secret "test-secret"',
    )
    parser.add_argument("--yes", action="store_true", help="really delete; without it this is a dry run")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    statuses = [s.strip() for s in args.status.split(",") if s.strip()]
    unknown = sorted(set(statuses) - set(STATUSES))
    if unknown:
        sys.exit(f"Unknown status: {', '.join(unknown)}. Known: {', '.join(STATUSES)}")
    if args.include_completed and "accepted" not in statuses:
        statuses.append("accepted")
    if "accepted" in statuses and not args.include_completed:
        sys.exit('Completed ("accepted") deals are kept by default. Add --include-completed to delete them.')

    cutoff = args.before if args.before else datetime.utcnow() - timedelta(days=args.older_than_days)
    # received_at is stamped by the server; created_at comes from the API caller.
    received = func.coalesce(Deal.received_at, Deal.created_at)
    conditions = [received < cutoff, Deal.status.in_(statuses)]
    if args.test_only:
        conditions.append(Deal.secret == "test-secret")

    engine = create_async_engine(DATABASE_URL)
    try:
        async with async_sessionmaker(engine)() as session:
            rows = (await session.execute(
                select(Deal.id, Deal.status, Deal.receipt_url).where(*conditions)
            )).all()

            by_status: dict[str, int] = {}
            for _, status, _ in rows:
                by_status[status] = by_status.get(status, 0) + 1
            receipts = [Path(url).name for _, _, url in rows if url]

            scope = ", test deals only" if args.test_only else ""
            print(f"Deals received before {cutoff:%Y-%m-%d %H:%M} UTC, statuses: {', '.join(statuses)}{scope}")
            print(f"  matching deals: {len(rows)} {by_status if by_status else ''}")
            print(f"  receipt files:  {len(receipts)}")

            if not rows:
                return
            if not args.yes:
                print("\nDry run: nothing was deleted. Re-run with --yes to delete.")
                return

            ids = [deal_id for deal_id, _, _ in rows]
            for start in range(0, len(ids), BATCH):
                chunk = ids[start:start + BATCH]
                # payouts.deal_id points at deal.id without ON DELETE: unlink first.
                await session.execute(
                    update(Payout).where(Payout.deal_id.in_(chunk)).values(deal_id=None)
                    .execution_options(synchronize_session=False)
                )
                # Merchants' refusals of these deals go with them (ON DELETE CASCADE).
                await session.execute(
                    delete(Deal).where(Deal.id.in_(chunk)).execution_options(synchronize_session=False)
                )
            await session.commit()

        removed = 0
        for name in receipts:
            path = UPLOAD_DIR / name
            try:
                if path.is_file():
                    path.unlink()
                    removed += 1
            except OSError as e:
                print(f"  could not remove {path}: {e}")

        print(f"\nDeleted {len(ids)} deals and {removed} receipt files.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
