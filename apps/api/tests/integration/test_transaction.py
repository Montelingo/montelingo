import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.transaction import SessionTransactionManager

pytestmark = pytest.mark.integration


async def test_transaction_after_a_read(db_session: AsyncSession) -> None:
    # A read autobegins a transaction; services read first and then write.
    await db_session.execute(text("SELECT 1"))

    async with SessionTransactionManager(db_session).transaction() as session:
        await session.execute(text("CREATE TEMP TABLE tx_probe (id int)"))
        await session.execute(text("INSERT INTO tx_probe VALUES (1)"))

    assert (await db_session.execute(text("SELECT count(*) FROM tx_probe"))).scalar() == 1


async def test_transaction_rolls_back_on_error(db_session: AsyncSession) -> None:
    await db_session.execute(text("CREATE TEMP TABLE tx_probe2 (id int)"))
    await db_session.commit()

    with pytest.raises(RuntimeError):
        async with SessionTransactionManager(db_session).transaction() as session:
            await session.execute(text("INSERT INTO tx_probe2 VALUES (1)"))
            raise RuntimeError("boom")

    assert (await db_session.execute(text("SELECT count(*) FROM tx_probe2"))).scalar() == 0
