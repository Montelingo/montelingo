"""Domain and service tests for the child profile, without a database."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError
from app.modules.progress.domain import ChildProfile, InvalidChildProfile
from app.modules.progress.service import ChildProfileService


def test_a_new_profile_is_not_complete() -> None:
    assert ChildProfile().is_complete is False
    assert ChildProfile(name="Mia", age_band="5-6").is_complete is False


def test_set_up_trims_the_name_and_completes_the_profile() -> None:
    profile = ChildProfile.set_up(name="  Mia ", age_band="5-6", avatar="fox")

    assert profile == ChildProfile(name="Mia", age_band="5-6", avatar="fox")
    assert profile.is_complete is True


@pytest.mark.parametrize("name", ["", "   ", "M" * 31])
def test_set_up_rejects_an_invalid_name(name: str) -> None:
    with pytest.raises(InvalidChildProfile):
        ChildProfile.set_up(name=name, age_band="7", avatar="owl")


def test_set_up_rejects_an_unknown_band_or_avatar() -> None:
    with pytest.raises(InvalidChildProfile):
        ChildProfile.set_up(name="Mia", age_band="8", avatar="owl")  # type: ignore[arg-type]
    with pytest.raises(InvalidChildProfile):
        ChildProfile.set_up(name="Mia", age_band="7", avatar="dragon")  # type: ignore[arg-type]


class FakeRepository:
    def __init__(self, profiles: dict[UUID, ChildProfile]) -> None:
        self.profiles = profiles

    async def get(self, learning_profile_id: UUID) -> ChildProfile | None:
        return self.profiles.get(learning_profile_id)

    async def save(self, learning_profile_id: UUID, profile: ChildProfile) -> bool:
        if learning_profile_id not in self.profiles:
            return False
        self.profiles[learning_profile_id] = profile
        return True


class FakeTransactionManager:
    def __init__(self) -> None:
        self.committed = 0

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[None]:
        yield None
        self.committed += 1


def make_service(
    profiles: dict[UUID, ChildProfile],
) -> tuple[ChildProfileService, FakeRepository, FakeTransactionManager]:
    repository = FakeRepository(profiles)
    transactions = FakeTransactionManager()
    service = ChildProfileService(repository, transactions)  # type: ignore[arg-type]
    return service, repository, transactions


async def test_get_returns_the_stored_profile() -> None:
    profile_id = uuid4()
    service, _, _ = make_service({profile_id: ChildProfile()})

    profile = await service.get(profile_id)

    assert profile.model_dump() == {
        "name": None,
        "age_band": None,
        "avatar": None,
        "is_complete": False,
    }


async def test_set_up_saves_the_trimmed_profile_in_a_transaction() -> None:
    profile_id = uuid4()
    other_id = uuid4()
    service, repository, transactions = make_service(
        {profile_id: ChildProfile(), other_id: ChildProfile()}
    )

    profile = await service.set_up(profile_id, name=" Luka ", age_band="7", avatar="bear")

    assert profile.model_dump() == {
        "name": "Luka",
        "age_band": "7",
        "avatar": "bear",
        "is_complete": True,
    }
    assert repository.profiles[profile_id] == ChildProfile(name="Luka", age_band="7", avatar="bear")
    assert repository.profiles[other_id] == ChildProfile()
    assert transactions.committed == 1


async def test_set_up_answers_422_for_an_invalid_profile() -> None:
    profile_id = uuid4()
    service, repository, transactions = make_service({profile_id: ChildProfile()})

    with pytest.raises(ApiError) as error:
        await service.set_up(profile_id, name="  ", age_band="7", avatar="bear")

    assert error.value.status_code == 422
    assert error.value.stable_code == "validation_error"
    assert repository.profiles[profile_id] == ChildProfile()
    assert transactions.committed == 0


async def test_get_without_a_learning_profile_is_a_server_error() -> None:
    service, _, _ = make_service({})

    with pytest.raises(ApiError) as error:
        await service.get(uuid4())

    assert error.value.status_code == 500


async def test_set_up_without_a_learning_profile_is_a_server_error() -> None:
    service, _, transactions = make_service({})

    with pytest.raises(ApiError) as error:
        await service.set_up(uuid4(), name="Mia", age_band="3-4", avatar="cat")

    assert error.value.status_code == 500
    assert transactions.committed == 0
