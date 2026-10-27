"""Servidor HTTP de desarrollo sobre los handlers Lambda; solo loopback."""

import argparse
import base64
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from api.compare import handler as compare  # noqa: E402
from api.config import handler as config  # noqa: E402
from api.health import handler as health  # noqa: E402
from api.preview import handler as preview  # noqa: E402

MAX_REQUEST = 65536
HANDLERS = {
    "/v1/health": health,
    "/v1/config": config,
    "/v1/scenarios/preview": preview,
    "/v1/simulations/compare": compare,
}


class LocalHandler(BaseHTTPRequestHandler):
    def _handle(self) -> None:
        path = urlsplit(self.path).path
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if self.headers.get("Transfer-Encoding") or length < 0:
            body = b"{"  # El adapter produce INVALID_JSON sin interpretar datos no soportados.
        elif length > MAX_REQUEST:
            body = b" " * (MAX_REQUEST + 1)
        else:
            body = self.rfile.read(length)
        event: dict[str, Any] = dict(
            version="2.0",
            rawPath=path,
            requestContext=dict(http=dict(method=self.command)),
            body=base64.b64encode(body).decode("ascii"),
            isBase64Encoded=True,
        )
        result = HANDLERS.get(path, health)(event, None)
        data = (
            base64.b64decode(result["body"])
            if result["isBase64Encoded"]
            else result["body"].encode("utf-8")
        )
        self.send_response(result["statusCode"])
        for name, value in result["headers"].items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)
        self.close_connection = True

    def do_GET(self) -> None:
        self._handle()

    def do_POST(self) -> None:
        self._handle()

    def log_message(self, format: str, *args: Any) -> None:
        pass  # Los handlers ya registran metadatos saneados, sin queries ni cuerpos.


def create_server(*, port: int = 8000) -> HTTPServer:
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


if __name__ == "__main__":
    main()
