from __future__ import annotations

import logging

from app.modules.health.repository import DatabaseProbe

logger = logging.getLogger(__name__)


class HealthService:
    def __init__(self, database: DatabaseProbe) -> None:
        self.database = database

    async def is_ready(self) -> bool:
        try:
            await self.database.ping()
        except Exception:
            # Any failure to reach the database means "not ready"; fail safe.
            logger.warning("readiness_check_failed", exc_info=True)
            return False
        return True
