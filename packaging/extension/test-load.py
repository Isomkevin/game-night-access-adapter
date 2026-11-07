"""Load a built extension package into a throwaway Chrome profile and check it starts.

Usage: python3 packaging/extension/test-load.py dist/extension/game-night-extension-<v>-store.zip

Chrome 137+ ignores --load-extension, so this uses the DevTools
``Extensions.loadUnpacked`` command over --remote-debugging-pipe.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile


def main() -> int:
    package = os.path.abspath(sys.argv[1])
    chrome = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium")
    work = tempfile.mkdtemp(prefix="gnaa-ext-test-")
    ext_dir = os.path.join(work, "ext")
    with zipfile.ZipFile(package) as archive:
        archive.extractall(ext_dir)
    manifest = json.load(open(os.path.join(ext_dir, "manifest.json")))

    to_chrome_r, to_chrome_w = os.pipe()
    from_chrome_r, from_chrome_w = os.pipe()

    def child_fds():
        read_end, write_end = os.dup(to_chrome_r), os.dup(from_chrome_w)
        os.dup2(read_end, 3)
        os.dup2(write_end, 4)

    proc = subprocess.Popen(
        [chrome, "--headless=new", "--no-first-run", "--remote-debugging-pipe",
         "--enable-unsafe-extension-debugging", f"--user-data-dir={work}/profile", "about:blank"],
        close_fds=False, preexec_fn=child_fds,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    os.close(to_chrome_r)
    os.close(from_chrome_w)
    buffer = b""
    next_id = 0

    def call(method, params=None):
        nonlocal buffer, next_id
        next_id += 1
        os.write(to_chrome_w, json.dumps({"id": next_id, "method": method, "params": params or {}}).encode() + b"\0")
        while True:
            while b"\0" not in buffer:
                buffer += os.read(from_chrome_r, 65536)
            raw, buffer = buffer.split(b"\0", 1)
            message = json.loads(raw)
            if message.get("id") == next_id:
                return message

    try:
        loaded = call("Extensions.loadUnpacked", {"path": ext_dir})
        if "error" in loaded:
            print("load failed:", loaded["error"])
            return 1
        ext_id = loaded["result"]["id"]
        worker = None
        for _ in range(20):
            targets = call("Target.getTargets")["result"]["targetInfos"]
            worker = next((t for t in targets if t["url"].startswith(f"chrome-extension://{ext_id}/")
                           and t["type"] == "service_worker"), None)
            if worker:
                break
            time.sleep(0.25)
        print(f"{manifest['name']} v{manifest['version']} loaded as {ext_id}")
        print("background service worker:", worker["url"] if worker else "NOT RUNNING")
        return 0 if worker else 1
    finally:
        proc.kill()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
