"""Authentication module public interface."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .dependencies import get_current_session, get_current_user, get_optional_user
    from .rate_limit import require_trusted_origin

__all__ = [
    "get_current_session",
    "get_current_user",
    "get_optional_user",
    "require_trusted_origin",
]


def __getattr__(name: str) -> object:
    if name == "require_trusted_origin":
        from .rate_limit import require_trusted_origin

        return require_trusted_origin
    if name in __all__:
        from . import dependencies

        return getattr(dependencies, name)
    raise AttributeError(name)
