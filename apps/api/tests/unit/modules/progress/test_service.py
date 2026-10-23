from __future__ import annotations

from app.modules.content import load_content
from app.modules.progress.service import ProgressService


def test_starting_location_and_its_region_are_available_and_the_rest_locked() -> None:
    content = load_content()

    state = ProgressService(content).get_state()

    available_locations = [loc.id for loc in state.locations if loc.state == "available"]
    available_regions = [region.id for region in state.regions if region.state == "available"]
    assert available_locations == [content.starting_location] == ["budva"]
    assert available_regions == ["coast"]
    assert {loc.state for loc in state.locations} == {"available", "locked"}


def test_every_region_and_location_gets_a_state_in_content_order() -> None:
    content = load_content()

    state = ProgressService(content).get_state()

    assert [r.id for r in state.regions] == [r.slug for r in content.regions]
    assert [loc.id for loc in state.locations] == [loc.slug for loc in content.locations]
    assert len(state.regions) == 3
    assert len(state.locations) == 17
