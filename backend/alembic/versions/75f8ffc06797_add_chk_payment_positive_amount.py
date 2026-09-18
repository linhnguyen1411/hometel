"""add_chk_payment_positive_amount

Revision ID: 75f8ffc06797
Revises: 3260353f94f7
Create Date: 2026-09-18 10:43:43.380116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75f8ffc06797'
down_revision: Union[str, Sequence[str], None] = '3260353f94f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint('chk_payment_positive_amount', 'payments', 'amount > 0')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('chk_payment_positive_amount', 'payments', type_='check')
