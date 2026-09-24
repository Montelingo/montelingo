from __future__ import annotations

from typing import Literal

from app.schemas.common import ApiSchema


class LiveHealth(ApiSchema):
    status: Literal["ok"] = "ok"


class ReadyHealth(ApiSchema):
    status: Literal["ready"] = "ready"
