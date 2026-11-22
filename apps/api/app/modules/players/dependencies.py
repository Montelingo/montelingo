from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.auth.repository import SqlAlchemyAuthRepository
from app.modules.progress.repository import SqlAlchemyLearningProfileRepository
from app.modules.users.repository import SqlAlchemyUserRepository

from .service import PlayersService


def get_players_service(session: AsyncSession = Depends(get_db_session)) -> PlayersService:
    users = SqlAlchemyUserRepository(session)
    return PlayersService(
        profiles=SqlAlchemyLearningProfileRepository(session),
        sessions=SqlAlchemyAuthRepository(session, users=users),
        accounts=users,
        transaction_manager=SessionTransactionManager(session),
    )
