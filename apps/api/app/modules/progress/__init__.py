"""Progress module public interface."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .dependencies import get_learning_profile

__all__ = ["get_learning_profile"]


def __getattr__(name: str) -> object:
    if name == "get_learning_profile":
        from .dependencies import get_learning_profile

        return get_learning_profile
    raise AttributeError(name)
