"""Authentication module public interface."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .dependencies import get_current_user, get_optional_user

__all__ = ["get_current_user", "get_optional_user"]


def __getattr__(name: str) -> object:
    if name in __all__:
        from . import dependencies

        return getattr(dependencies, name)
    raise AttributeError(name)
