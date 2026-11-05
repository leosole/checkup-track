import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

import main


class SPAStaticFilesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.static_dir = Path(self.temp_dir.name)
        (self.static_dir / "index.html").write_text("spa entrypoint", encoding="utf-8")
        app = FastAPI()
        app.mount(
            "/",
            main.SPAStaticFiles(directory=str(self.static_dir), html=True),
            name="spa",
        )
        self.client = TestClient(app)

    def test_unknown_document_route_returns_spa_entrypoint(self) -> None:
        response = self.client.get(
            "/privacy-policy", headers={"accept": "text/html"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "spa entrypoint")

    def test_unknown_asset_keeps_static_404(self) -> None:
        response = self.client.get(
            "/assets/missing.js", headers={"accept": "text/html"}
        )

        self.assertEqual(response.status_code, 404)

    def test_unknown_api_document_route_keeps_404(self) -> None:
        response = self.client.get(
            "/api/unknown", headers={"accept": "text/html"}
        )

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()