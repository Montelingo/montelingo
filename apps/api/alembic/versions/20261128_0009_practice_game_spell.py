"""let a practice heart be for Vješalo (spell)

`spell` is a practice-only game (ADR 0006, ADR 0009, #294): the Riječi tab
records it as a heart, so `heart_events.game` allows it. `game_results` keeps
the chapter games only, since no chapter has `spell`.

Downgrading fails while a `spell` heart exists, rather than deleting a
child's hearts.

Revision ID: 20261128_0009
Revises: 20261128_0008
Create Date: 2026-11-28 00:00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261128_0009"
down_revision: str | None = "20261128_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_heart_events_game", "heart_events", type_="check")
    op.create_check_constraint(
        "ck_heart_events_game", "heart_events", "game IN ('memory', 'match', 'spell')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_heart_events_game", "heart_events", type_="check")
    op.create_check_constraint(
        "ck_heart_events_game", "heart_events", "game IN ('memory', 'match')"
    )
