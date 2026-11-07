"""Hold W through the installed adapter and count what Windows delivers.

Run with the installed venv python on a Windows desktop session:

    python test-hold.py "C:\\Program Files\\Game Night Access Adapter"

A low-level keyboard hook counts every injected key-down, and a focused Tk
window counts the KeyPress events an application receives. A physical key
held for 1.5 s produces a first key-down plus a stream of auto-repeat
key-downs, so a working hold must deliver many key-downs, then one key-up.
"""

from __future__ import annotations

import ctypes
import sys
import threading
import time
import tkinter as tk

HOLD_SECONDS = 1.5
POLL_SECONDS = 0.08
VK_W = 0x57
SCAN_W = 0x11
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101


def main() -> int:
    install_dir = sys.argv[1]
    sys.path.insert(0, install_dir)
    from access_adapter.keys import KeyInjector
    from access_adapter.version import __version__
    from pynput import keyboard

    print(f"adapter version {__version__} from {install_dir}")
    hook_down = 0
    hook_up = 0

    def win32_filter(msg, data):
        nonlocal hook_down, hook_up
        if data.vkCode == VK_W or data.scanCode == SCAN_W:
            if msg == WM_KEYDOWN:
                hook_down += 1
            elif msg == WM_KEYUP:
                hook_up += 1
        return True

    listener = keyboard.Listener(win32_event_filter=win32_filter)
    listener.start()
    listener.wait()

    root = tk.Tk()
    root.title("hold test")
    root.geometry("300x120+50+50")
    root.attributes("-topmost", True)
    tk_down = 0
    tk_up = 0
    state_samples: list[bool] = []

    def on_press(event):
        nonlocal tk_down
        if event.keysym.lower() == "w":
            tk_down += 1

    def on_release(event):
        nonlocal tk_up
        if event.keysym.lower() == "w":
            tk_up += 1

    root.bind("<KeyPress>", on_press)
    root.bind("<KeyRelease>", on_release)

    def drive():
        time.sleep(1.0)
        root.after(0, root.focus_force)
        time.sleep(0.5)
        injector = KeyInjector()
        started = time.monotonic()
        while time.monotonic() - started < HOLD_SECONDS:
            injector.sync(["w"])
            state = ctypes.windll.user32.GetAsyncKeyState(VK_W)
            state_samples.append(bool(state & 0x8000))
            time.sleep(POLL_SECONDS)
        injector.sync([])
        time.sleep(0.4)
        after = bool(ctypes.windll.user32.GetAsyncKeyState(VK_W) & 0x8000)
        state_samples.append(not after)
        root.after(0, root.destroy)

    threading.Thread(target=drive, daemon=True).start()
    root.mainloop()
    listener.stop()

    held_ratio = sum(state_samples[:-1]) / max(1, len(state_samples) - 1)
    released = state_samples[-1] if state_samples else False
    print(f"hook key-down events: {hook_down}")
    print(f"hook key-up events:   {hook_up}")
    print(f"window KeyPress:      {tk_down}")
    print(f"window KeyRelease:    {tk_up}")
    print(f"GetAsyncKeyState down while held: {held_ratio:.0%}")
    print(f"released after pose ended: {released}")

    ok = hook_down >= 10 and hook_up >= 1 and held_ratio > 0.9 and released
    print("HOLD OK" if ok else "HOLD BROKEN: a held key must keep sending key-down like a real keyboard")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
