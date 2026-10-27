"""Primer incremento de integración: HTTP local sobre los handlers reales."""

import gzip
import http.client
import importlib.util
import json
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest


def test_disconnected_client_during_headers_does_not_break_server(monkeypatch):
    spec = importlib.util.spec_from_file_location(
        "serve_api_abort", Path(__file__).resolve().parents[2] / "scripts/serve_api.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original = module.LocalHandler.end_headers
    attempts = []

    def interrupted(self):
        if not attempts:
            attempts.append(True)
            raise ConnectionAbortedError("client closed during headers")
        original(self)

    monkeypatch.setattr(module.LocalHandler, "end_headers", interrupted)
    server = module.create_server(port=0)
    errors = []
    server.handle_error = lambda *args: errors.append(True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/v1/health"
    try:
        with pytest.raises((OSError, http.client.HTTPException)):
            urllib.request.urlopen(url, timeout=10)
        with urllib.request.urlopen(url, timeout=10) as response:
            assert json.load(response)["status"] == "ok"
        assert errors == []
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def test_real_http_health_preview_and_error():
    spec = importlib.util.spec_from_file_location(
        "serve_api", Path(__file__).resolve().parents[2] / "scripts/serve_api.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    server = module.create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/v1"
    try:
        with urllib.request.urlopen(base + "/health", timeout=10) as response:
            assert json.load(response)["status"] == "ok"
        data = json.dumps(
            dict(
                schemaVersion="1.0",
                configuration=dict(
                    scenario=dict(populationSize=50, days=1), intervention=dict(vaccines=10)
                ),
            )
        ).encode()
        request = urllib.request.Request(
            base + "/scenarios/preview", data=data, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            assert response.headers["Content-Encoding"] == "gzip"
            payload = json.loads(gzip.decompress(response.read()))
            assert len(payload["graph"]["nodes"]) == 50
        with pytest.raises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(base + "/missing", timeout=10)
        assert caught.value.code == 404
        caught.value.close()
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()
