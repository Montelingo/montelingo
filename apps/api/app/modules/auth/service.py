from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.auth.schemas import CurrentUser, SignUpRequest
from app.modules.users.service import create_user as create_user_in_users_module


async def sign_up(db: AsyncSession, data: SignUpRequest) -> CurrentUser:
    hashed_pwd = hash_password(data.password)

    try:
        user = await create_user_in_users_module(
            db=db,
            email=data.email,
            password_hash=hashed_pwd,
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email_taken",
        ) from exc

    return CurrentUser(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
    )
