"""Launch the desktop window and the loopback API."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from access_adapter.api import ApiService
from access_adapter.state import AppState
from access_adapter.version import APP_NAME, DEFAULT_PORT, __version__


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="access_adapter", description=APP_NAME)
    parser.add_argument("--api-only", action="store_true", help="Serve the local API without opening a window")
    parser.add_argument("--version", action="store_true", help="Print the version and exit")
    args = parser.parse_args(argv)
    if args.version:
        print(__version__)
        return 0

    state = AppState()
    state.ensure_bridge()
    host = os.environ.get("ACCESS_ADAPTER_HOST", state.config.api_host)
    port = int(os.environ.get("ACCESS_ADAPTER_PORT", str(state.config.api_port or DEFAULT_PORT)))
    service = ApiService(state, host=host, port=port)
    try:
        state.api_base_url = service.start()
        print(f"{APP_NAME} API {state.api_base_url}/api/v1")
    except OSError as exc:
        state.api_base_url = ""
        print(f"Local API did not start: {exc}", file=sys.stderr)

    if args.api_only:
        try:
            while True:
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nStopping.")
        finally:
            _shutdown(state, service)
        return 0

    try:
        from PySide6.QtWidgets import QApplication

        from access_adapter.ui.main_window import MainWindow
    except ImportError as exc:
        print(f"Window dependencies are missing ({exc}). Re-run with --api-only or install requirements.txt.", file=sys.stderr)
        _shutdown(state, service)
        return 1

    app = QApplication(sys.argv)
    from PySide6.QtCore import QLockFile, QStandardPaths

    from access_adapter.ui.style import apply_app_fonts

    apply_app_fonts(app)
    lock_dir = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppConfigLocation) or ".")
    lock_dir.mkdir(parents=True, exist_ok=True)
    lock = QLockFile(str(lock_dir / "access-adapter.lock"))
    lock.setStaleLockTime(30_000)
    if not lock.tryLock(100):
        from PySide6.QtWidgets import QMessageBox

        QMessageBox.information(None, APP_NAME, f"{APP_NAME} is already open.")
        _shutdown(state, service)
        return 0
    window = MainWindow(state)
    window.show()
    app.aboutToQuit.connect(lambda: _shutdown(state, service))
    return app.exec()


def _shutdown(state: AppState, service: ApiService) -> None:
    if state.bridge is not None:
        state.bridge.stop()
    service.stop()


if __name__ == "__main__":
    raise SystemExit(main())
