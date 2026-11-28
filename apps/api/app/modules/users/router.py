from __future__ import annotations

from fastapi import APIRouter

from .privacy import PRIVACY_POLICY_VERSION
from .schemas import PrivacyPolicy

router = APIRouter()


@router.get(
    "/privacy-policy",
    operation_id="privacy_policy_get",
    summary="The current privacy policy version",
    response_model=PrivacyPolicy,
)
async def privacy_policy() -> PrivacyPolicy:
    """No session needed: the sign-up page sends this version back (ADR 0008)."""
    return PrivacyPolicy(version=PRIVACY_POLICY_VERSION)
