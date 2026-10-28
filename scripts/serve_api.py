"""Servidor HTTP de desarrollo sobre los handlers Lambda; solo loopback."""

import argparse
import base64
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from api.compare import handler as compare
from api.config import handler as config
from api.health import handler as health
from api.jobs import cancel_handler, create_handler, get_handler, result_handler
from api.preview import handler as preview
from api.report import handler as report
from simulation.exports import MAX_DOCUMENT_BYTES
from simulation.jobs import GLOBAL_JOB_MANAGER

MAX_REQUEST = 65536
HANDLERS = {
    "/v1/jobs": create_handler,
    "/v1/health": health,
    "/v1/config": config,
    "/v1/scenarios/preview": preview,
    "/v1/simulations/compare": compare,
    "/v1/reports/mayor": report,
}


class LocalHandler(BaseHTTPRequestHandler):
    def _handle(self) -> None:
        path = urlsplit(self.path).path
        max_request = MAX_DOCUMENT_BYTES if path == "/v1/reports/mayor" else MAX_REQUEST
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if self.headers.get("Transfer-Encoding") or length < 0:
            body = b"{"  # El adapter produce INVALID_JSON sin interpretar datos no soportados.
        elif length > max_request:
            body = b" " * (max_request + 1)
        else:
            body = self.rfile.read(length)
        event: dict[str, Any] = {
            "version": "2.0",
            "rawPath": path,
            "headers": dict(self.headers.items()),
            "requestContext": {"http": {"method": self.command}},
            "body": base64.b64encode(body).decode("ascii"),
            "isBase64Encoded": True,
        }
        handler = HANDLERS.get(path, health)
        if re.fullmatch(r"/v1/jobs/[0-9a-f-]{36}", path):
            handler = get_handler
        elif re.fullmatch(r"/v1/jobs/[0-9a-f-]{36}/cancel", path):
            handler = cancel_handler
        elif re.fullmatch(r"/v1/jobs/[0-9a-f-]{36}/result", path):
            handler = result_handler
        result = handler(event, None)
        data = (
            base64.b64decode(result["body"])
            if result["isBase64Encoded"]
            else result["body"].encode("utf-8")
        )
        self.close_connection = True
        try:
            self.send_response(result["statusCode"])
            for name, value in result["headers"].items():
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(data)
        except ConnectionError:
            pass  # El navegador puede cancelar un preview al editar parámetros.

    def do_GET(self) -> None:
        self._handle()

    def do_POST(self) -> None:
        self._handle()

    def log_message(self, format: str, *args: Any) -> None:
        pass  # Los handlers ya registran metadatos saneados, sin queries ni cuerpos.


def create_server(*, port: int = 8000) -> HTTPServer:
    os.environ["LOCAL_JOBS_ENABLED"] = "1"
    return HTTPServer(("127.0.0.1", port), LocalHandler)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with create_server(port=args.port) as server:
        print(
            f"API local: http://127.0.0.1:{server.server_port}/v1 (Ctrl+C para detener)",
            flush=True,
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            GLOBAL_JOB_MANAGER.close()


if __name__ == "__main__":
    main()
