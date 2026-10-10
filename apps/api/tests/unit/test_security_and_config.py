from app.core.config import Settings
from app.core.security import Argon2PasswordHasher, SecureToken


def test_password_hasher_needs_rehash() -> None:
    hasher = Argon2PasswordHasher()
    hashed = hasher.hash("SecurePassword123!")
    assert hasher.needs_rehash(hashed) is False


def test_secure_token_hash_and_verify() -> None:
    token = SecureToken.generate()
    token_hash = SecureToken.hash(token)
    assert SecureToken.verify(token=token, expected_hash=token_hash) is True


def test_secure_verify_malformed_hash() -> None:
    assert SecureToken.verify(token="some_token", expected_hash=b"invalid") is False
    assert SecureToken.verify(token="some_token", expected_hash=b"") is False


def test_config_per_env_defaults() -> None:
    dev_settings = Settings(env="development")
    assert dev_settings.cookie_secure is False

    prod_settings = Settings(env="production")
    assert prod_settings.cookie_secure is True


def test_secrets_do_not_leak_in_repr() -> None:
    settings = Settings()
    repr_str = repr(settings)
    assert "database_url" not in repr_str or "postgres" not in repr_str
