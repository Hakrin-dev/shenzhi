"""Initial Chat session persistence tables."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_chat_tables'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('owner', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('settings', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('favorite', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(
        'idx_chat_sessions_owner',
        'chat_sessions',
        ['owner', sa.text('favorite DESC'), sa.text('updated_at DESC')],
    )
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('settings', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('attachment_context', sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column('warnings', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('content', sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column('reasoning', sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('message_refs', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('followups', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('duration_ms', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('streaming', 'done', 'stopped', 'failed')",
            name='chk_chat_messages_status',
        ),
    )
    op.create_index('idx_chat_messages_session', 'chat_messages', ['session_id', 'created_at'])
    op.create_index(
        'uq_chat_messages_active',
        'chat_messages',
        ['session_id'],
        unique=True,
        postgresql_where=sa.text("status = 'streaming'"),
    )


def downgrade() -> None:
    op.drop_index('uq_chat_messages_active', table_name='chat_messages')
    op.drop_index('idx_chat_messages_session', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('idx_chat_sessions_owner', table_name='chat_sessions')
    op.drop_table('chat_sessions')
