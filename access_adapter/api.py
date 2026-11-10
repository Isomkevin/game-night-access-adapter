"""Local JSON API. Binds to loopback unless explicitly allowed otherwise.

The desktop app starts this server in a background thread. Other programs on
the same machine can read mappings, change them, and ask for an ADB scan.

Base path: ``/api/v1`` on ``http://127.0.0.1:8765`` by default.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading
from typing import Any
from urllib.parse import urlparse

from access_adapter.state import AppState
from access_adapter.version import API_VERSION, __version__


LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def assert_bind_host(host: str) -> str:
    """Refuse non-loopback binds so the API is not exposed on the network."""
    cleaned = host.strip() or "127.0.0.1"
    if os.environ.get("ACCESS_ADAPTER_ALLOW_LAN") == "1":
        return cleaned
    if cleaned not in LOOPBACK_HOSTS:
        raise ValueError(
            f"Refusing to bind {cleaned}. The API listens on 127.0.0.1 only."
        )
    if cleaned == "localhost":
        return "127.0.0.1"
    return cleaned


class AdapterApiHandler(BaseHTTPRequestHandler):
    state: AppState
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        self._dispatch("GET")

    def do_POST(self) -> None:
        self._dispatch("POST")

    def do_PUT(self) -> None:
        self._dispatch("PUT")

    def do_DELETE(self) -> None:
        self._dispatch("DELETE")

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            status, payload = self._route(method, path)
            self._json(status, {"ok": True, "data": payload})
        except ApiError as exc:
            self._json(exc.status, {"ok": False, "error": {"code": exc.code, "message": exc.message}})
        except ValueError as exc:
            self._json(400, {"ok": False, "error": {"code": "INVALID_PAYLOAD", "message": str(exc)}})
        except KeyError as exc:
            missing = str(exc.args[0]) if exc.args else "item"
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": f"No mapping {missing}"}})
        except RuntimeError as exc:
            self._json(503, {"ok": False, "error": {"code": "DEVICE_OFFLINE", "message": str(exc)}})
        except Exception:
            self._json(
                500,
                {"ok": False, "error": {"code": "SERVICE_ERROR", "message": "Unexpected server error"}},
            )

    def _route(self, method: str, path: str) -> tuple[int, Any]:
        state = self.state
        body = self._read_json() if method in {"POST", "PUT"} else {}

        if method == "GET" and path == "/api/v1/health":
            return 200, {"status": "ok", "version": __version__, "api": API_VERSION}

        if method == "GET" and path == "/api/v1/settings":
            return 200, state.settings_dict()
        if method == "PUT" and path == "/api/v1/settings":
            return 200, state.update_settings(body)

        if method == "GET" and path == "/api/v1/mappings":
            return 200, state.mappings_dict()
        if method == "PUT" and path == "/api/v1/mappings":
            rules = body.get("rules")
            if not isinstance(rules, list):
                raise ValueError("rules must be a list")
            return 200, state.replace_mappings(rules)
        if method == "POST" and path == "/api/v1/mappings":
            rule = state.add_mapping(body)
            return 201, rule.to_dict()

        prefix = "/api/v1/mappings/"
        if path.startswith(prefix) and method == "DELETE":
            rule_id = path[len(prefix) :]
            if not rule_id or "/" in rule_id:
                raise ApiError(404, "NOT_FOUND", "Endpoint not found")
            state.delete_mapping(rule_id)
            return 200, {"deleted": rule_id}

        if method == "GET" and path == "/api/v1/devices":
            return 200, state.devices_dict()
        if method == "POST" and path == "/api/v1/devices/scan":
            return 200, state.scan_devices()
        if method == "POST" and path == "/api/v1/devices/connect":
            message = state.adb.connect(str(body.get("endpoint", "")))
            state.scan_devices()
            return 200, {"message": message, **state.devices_dict()}
        if method == "POST" and path == "/api/v1/devices/pair":
            message = state.adb.pair(str(body.get("endpoint", "")), str(body.get("code", "")))
            return 200, {"message": message}
        if method == "POST" and path == "/api/v1/devices/disconnect":
            message = state.adb.disconnect(str(body.get("serial", "")))
            state.scan_devices()
            return 200, {"message": message, **state.devices_dict()}
        if method == "POST" and path == "/api/v1/devices/select":
            serial = state.select_device(str(body.get("serial", "")))
            return 200, {"selected_serial": serial}

        if method == "GET" and path == "/api/v1/sensors":
            return 200, state.sensors_dict()
        if method == "POST" and path == "/api/v1/bridge/start":
            state.ensure_bridge().start()
            return 200, state.sensors_dict()
        if method == "POST" and path == "/api/v1/bridge/stop":
            if state.bridge is not None:
                state.bridge.stop()
            return 200, state.sensors_dict()
        if method == "POST" and path == "/api/v1/injection":
            if "enabled" not in body:
                raise ValueError("enabled is required")
            return 200, state.update_settings({"injection_enabled": bool(body["enabled"])})
        if method == "GET" and path == "/api/v1/press":
            remote = state.ensure_remote()
            return 200, {"held": remote.held_mappings(), "recent": list(remote.recent)}
        if method == "POST" and path in {"/api/v1/press", "/api/v1/press/release-all"}:
            self._require_trusted_origin()
            remote = state.ensure_remote()
            if path.endswith("/release-all"):
                remote.release_all()
                return 200, {"held": []}
            press_state = str(body.get("state", "pulse"))
            if press_state != "up" and not state.config.injection_enabled:
                raise ApiError(409, "INJECTION_OFF", "Key injection is off. Turn on Send keys in the adapter.")
            result = remote.press(str(body.get("mapping", "")), press_state)
            return 200, {**result, "held": remote.held_mappings()}
        if method == "POST" and path == "/api/v1/calibrate":
            sample = None
            if any(key in body for key in ("ax", "ay", "az")):
                from access_adapter.mapping import SensorSample

                sample = SensorSample(
                    ax=float(body.get("ax", 0.0)),
                    ay=float(body.get("ay", 0.0)),
                    az=float(body.get("az", 0.0)),
                    source=str(body.get("source", "calibrate")),
                )
            return 200, state.calibrate_rest_pose(sample)
        if method == "POST" and path == "/api/v1/calibrate/reset":
            return 200, state.clear_calibration()

        raise ApiError(404, "NOT_FOUND", "Endpoint not found")

    def _require_trusted_origin(self) -> None:
        """Any website can reach loopback; only browser extensions and local tools may press keys."""
        origin = self.headers.get("Origin")
        if origin is None or origin.startswith(("chrome-extension://", "moz-extension://")):
            return
        raise ApiError(403, "ORIGIN_NOT_ALLOWED", "Web pages cannot press keys through the adapter.")

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Body must be JSON") from exc
        if not isinstance(data, dict):
            raise ValueError("Body must be a JSON object")
        return data

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")


def make_server(state: AppState, host: str, port: int) -> ThreadingHTTPServer:
    bind_host = assert_bind_host(host)
    handler = type("BoundAdapterApiHandler", (AdapterApiHandler,), {"state": state})
    server = ThreadingHTTPServer((bind_host, port), handler)
    server.daemon_threads = True
    return server


class ApiService:
    """Background HTTP server. ``base_url`` is set after ``start``."""

    def __init__(self, state: AppState, host: str = "127.0.0.1", port: int = 8765) -> None:
        self.state = state
        self.host = host
        self.port = port
        self.server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def base_url(self) -> str:
        if self.server is None:
            return ""
        bound_host, bound_port = self.server.server_address[:2]
        shown = "127.0.0.1" if bound_host in {"127.0.0.1", "0.0.0.0", "::1"} else bound_host
        return f"http://{shown}:{bound_port}"

    def start(self) -> str:
        self.server = make_server(self.state, self.host, self.port)
        self._thread = threading.Thread(target=self.server.serve_forever, name="access-adapter-api", daemon=True)
        self._thread.start()
        return self.base_url

    def stop(self) -> None:
        if self.server is not None:
            self.server.shutdown()
            self.server.server_close()
            self.server = None
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None
