"""Authentication module public interface."""

__all__ = ["get_current_user", "get_optional_user"]


def __getattr__(name: str) -> object:
    if name in __all__:
        from . import dependencies

        return getattr(dependencies, name)
    raise AttributeError(name)
