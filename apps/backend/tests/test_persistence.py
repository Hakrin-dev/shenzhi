"""Contract tests for PostgreSQL session persistence (requires CHAT_DATABASE_URL)."""
import os
import unittest
import uuid

from sqlalchemy import select

from app.core.database import session_scope
from app.models.chat import ChatMessageRow
from app.services.postgres_sessions import PostgresSessionRepository
from app.services.sessions import MemorySessionRepository


@unittest.skipUnless(os.getenv('CHAT_DATABASE_URL'), 'CHAT_DATABASE_URL not set')
class PostgresPersistenceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repo = PostgresSessionRepository()
        await self.repo.clear()

    async def asyncTearDown(self):
        await self.repo.clear()
        await self.repo.close()

    async def test_owner_isolation_and_restart_recovery(self):
        session = await self.repo.create('user:a', 'hello', {'type': 'ask', 'mode': 'fast', 'model': 'm', 'web_search': False})
        message = await self.repo.add_message(session, 'hello', session.settings)
        message.content, message.status = 'answer', 'done'
        await self.repo.persist_message(message)

        other = await self.repo.list('user:b')
        self.assertEqual(other, [])
        rows = await self.repo.list('user:a')
        self.assertEqual(len(rows), 1)

        detail = await self.repo.get(session.id, 'user:a')
        self.assertEqual(detail.messages[0].content, 'answer')

    async def test_streaming_recover_marks_failed(self):
        session = await self.repo.create('user:a', 'q', {'type': 'ask', 'mode': 'fast', 'model': 'm', 'web_search': False})
        message = await self.repo.add_message(session, 'q', session.settings)
        message.content = 'partial'
        await self.repo.recover()
        restored = await self.repo.get(session.id, 'user:a')
        self.assertEqual(restored.messages[0].status, 'failed')
        self.assertEqual(restored.messages[0].content, 'partial')

    async def test_finalize_is_idempotent(self):
        session = await self.repo.create('user:a', 'q', {'type': 'ask', 'mode': 'fast', 'model': 'm', 'web_search': False})
        message = await self.repo.add_message(session, 'q', session.settings)
        message.content, message.status = 'done text', 'done'
        await self.repo.persist_message(message)
        message.content = 'overwrite'
        await self.repo.persist_message(message)
        async with session_scope() as db:
            row = await db.scalar(select(ChatMessageRow).where(ChatMessageRow.id == uuid.UUID(message.id)))
        assert row is not None
        self.assertEqual(row.content, 'done text')


class MemoryRepositoryAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_async_wrapper_parity(self):
        repo = MemorySessionRepository()
        session = await repo.create('user:a', 'q', {'type': 'ask', 'mode': 'fast', 'model': 'm', 'web_search': False})
        message = await repo.add_message(session, 'q', session.settings)
        self.assertFalse(repo.is_durable)
        await repo.persist_message(message)
        listed = await repo.list('user:a')
        self.assertEqual(len(listed), 1)


if __name__ == '__main__':
    unittest.main()
