import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import main
from models import (
    LLMProvider,
    ProviderCredentialInput,
    ProviderOrderUpdate,
    User,
    UserProviderCredential,
)


class ProfileCredentialTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(id="user-1", email="one@example.com", name="One")
        self.other_user = User(id="user-2", email="two@example.com", name="Two")
        self.session.add_all([self.user, self.other_user])
        self.session.commit()
        self.environment = patch.dict(
            os.environ,
            {"CREDENTIAL_ENCRYPTION_KEY": Fernet.generate_key().decode("ascii")},
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def test_key_is_encrypted_and_status_is_user_scoped(self) -> None:
        secret = "test-provider-api-key"

        statuses = main.save_provider_credential(
            LLMProvider.OPENAI,
            ProviderCredentialInput(api_key=secret),
            self.user,
            self.session,
        )

        row = self.session.get(UserProviderCredential, (self.user.id, "openai"))
        self.assertIsNotNone(row)
        self.assertNotEqual(row.encrypted_api_key, secret)
        self.assertNotIn(secret, row.encrypted_api_key)
        self.assertNotIn(secret, str([status.model_dump() for status in statuses]))
        other_statuses = main.list_provider_credentials(self.other_user, self.session)
        other_openai = next(status for status in other_statuses if status.provider == "openai")
        self.assertFalse(other_openai.configured)

    def test_order_updates_and_delete_preserves_order(self) -> None:
        reordered = list(reversed(list(LLMProvider)))
        statuses = main.update_provider_order(
            ProviderOrderUpdate(providers=reordered),
            self.user,
            self.session,
        )
        self.assertEqual(statuses[0].provider, reordered[0])

        main.save_provider_credential(
            LLMProvider.OPENAI,
            ProviderCredentialInput(api_key="test-provider-api-key"),
            self.user,
            self.session,
        )
        main.delete_provider_credential(LLMProvider.OPENAI, self.user, self.session)

        statuses = main.list_provider_credentials(self.user, self.session)
        openai_status = next(status for status in statuses if status.provider == "openai")
        self.assertFalse(openai_status.configured)
        self.assertEqual(openai_status.order, reordered.index(LLMProvider.OPENAI))


if __name__ == "__main__":
    unittest.main()