import unittest
from unittest.mock import call, patch

import parser
from models import LLMExamsExtractionSchema, LLMProvider


class ProviderRoutingTests(unittest.TestCase):
    def test_uses_configured_order_and_hides_provider_errors(self) -> None:
        expected = LLMExamsExtractionSchema(
            title="Lab report",
            date_performed=None,
            biomarkers=[],
        )
        configured = [
            (LLMProvider.OPENAI, "first-provider-secret"),
            (LLMProvider.GROQ, "second-provider-secret"),
        ]

        with patch(
            "parser._extract_provider",
            side_effect=[ValueError("request failed with first-provider-secret"), expected],
        ) as extract_provider:
            extraction, error = parser._extract_structured("report text", configured)

        self.assertEqual(extraction, expected)
        self.assertIsNone(error)
        self.assertEqual(
            extract_provider.call_args_list,
            [
                call(LLMProvider.OPENAI, "first-provider-secret", "report text"),
                call(LLMProvider.GROQ, "second-provider-secret", "report text"),
            ],
        )

    def test_empty_provider_list_returns_profile_guidance(self) -> None:
        extraction, error = parser._extract_structured("report text", [])

        self.assertIsNone(extraction)
        self.assertIn("Profile", error)


if __name__ == "__main__":
    unittest.main()