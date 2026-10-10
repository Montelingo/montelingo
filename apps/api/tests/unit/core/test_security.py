from app.core.security import Argon2PasswordHasher, SecureToken, SystemClock


def test_password_hashing_and_verification():
    hasher = Argon2PasswordHasher()
    password = "secret_password_123"

    hashed = hasher.hash(password)
    assert hashed != password
    assert hasher.verify(password, hashed) is True
    assert hasher.verify("wrong_password", hashed) is False


def test_secure_token_generation():
    token1 = SecureToken.generate()
    token2 = SecureToken.generate()

    assert len(token1) >= 32
    assert token1 != token2


def test_secure_token_constant_time_comparison():
    assert SecureToken.compare_digest("abc", "abc") is True
    assert SecureToken.compare_digest("abc", "xyz") is False


def test_system_clock():
    clock = SystemClock()
    now = clock.now()
    assert now.tzinfo is not None
