"""Store one anonymous, replaceable vote per reader and entry."""

import sqlalchemy as sa
from alembic import op

revision = "0002_entry_feedback"
down_revision = "0001_collections"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "entry_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("daily_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reader_hash", sa.String(64), nullable=False),
        sa.Column("vote", sa.String(7), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("entry_id", "reader_hash", name="uq_entry_reader"),
        sa.CheckConstraint("vote IN ('like', 'dislike')", name="ck_feedback_vote"),
    )
    op.create_index("ix_entry_feedback_reader_hash", "entry_feedback", ["reader_hash"])


def downgrade():
    op.drop_table("entry_feedback")
