"""Phase 1: key injector presses and releases only the requested combination."""


class FakeKeyboard:
    def __init__(self) -> None:
        self.pressed: list[object] = []
        self.released: list[object] = []

    def press(self, key: object) -> None:
        self.pressed.append(key)

    def release(self, key: object) -> None:
        self.released.append(key)


def test_sync_presses_combination_and_releases_stale_keys():
    from access_adapter.keys import KeyInjector

    board = FakeKeyboard()
    injector = KeyInjector(controller=board)
    injector.sync(["ctrl", "left"])
    assert injector.held_names == ["ctrl", "left"]
    injector.sync(["left"])
    assert injector.held_names == ["left"]
    assert len(board.released) == 1
    injector.release_all()
    assert injector.held_names == []
    assert len(board.released) == 2


def test_sync_is_idempotent():
    from access_adapter.keys import KeyInjector

    board = FakeKeyboard()
    injector = KeyInjector(controller=board)
    injector.sync(["w"])
    injector.sync(["w"])
    assert len(board.pressed) == 1
    assert board.released == []


def test_hold_mode_keeps_key_down_while_matched():
    from access_adapter.keys import KeyInjector
    from access_adapter.mapping import MappingRule

    board = FakeKeyboard()
    injector = KeyInjector(controller=board)
    rule = MappingRule(
        id="left",
        label="Left",
        sensor="accelerometer",
        axis="x",
        comparator="lt",
        threshold=-2.8,
        keys=["a"],
        press_mode="hold",
    )
    injector.apply_rules([rule])
    injector.apply_rules([rule])
    assert injector.held_names == ["a"]
    assert len(board.pressed) == 1
    injector.apply_rules([])
    assert injector.held_names == []
    assert len(board.released) == 1


def test_once_mode_types_once_until_position_left():
    from access_adapter.keys import KeyInjector
    from access_adapter.mapping import MappingRule

    board = FakeKeyboard()
    injector = KeyInjector(controller=board)
    rule = MappingRule(
        id="left",
        label="Left",
        sensor="accelerometer",
        axis="x",
        comparator="lt",
        threshold=-2.8,
        keys=["a"],
        press_mode="once",
    )
    injector.apply_rules([rule])
    injector.apply_rules([rule])
    injector.apply_rules([rule])
    assert injector.held_names == []
    assert len(board.pressed) == 1
    assert len(board.released) == 1
    injector.apply_rules([])
    injector.apply_rules([rule])
    assert len(board.pressed) == 2
    assert len(board.released) == 2


def test_letter_keys_use_hardware_keysym_when_available():
    from pynput.keyboard import KeyCode

    from access_adapter.keys import _to_pynput_key

    key = _to_pynput_key("w")
    if hasattr(KeyCode, "_from_symbol"):
        assert getattr(key, "vk", None)
    else:
        assert key.char == "w"


def test_win32_hold_controller_keeps_scan_code_down_until_release():
    from access_adapter.keys import (
        KEYEVENTF_KEYUP,
        KEYEVENTF_SCANCODE,
        KeyInjector,
        Win32HoldController,
        win32_hold_events,
    )

    sent: list[tuple[int, int, int]] = []
    injector = KeyInjector(controller=Win32HoldController(sender=sent.extend))
    injector.sync(["w"])
    injector.sync(["w"])
    down = win32_hold_events("w", is_press=True)
    assert sent == down
    assert down[0] == (0, 0x11, KEYEVENTF_SCANCODE)
    assert down[1][0] == 0x57
    injector.sync([])
    up = win32_hold_events("w", is_press=False)
    assert sent[len(down) :] == up
    assert up[0][2] & KEYEVENTF_KEYUP
    assert up[1][2] & KEYEVENTF_SCANCODE and up[1][2] & KEYEVENTF_KEYUP


def test_win32_hold_keys_use_scancodes_not_unicode():
    from access_adapter.keys import KEYEVENTF_EXTENDEDKEY, KEYEVENTF_SCANCODE, win32_key_spec

    vk, scan, flags = win32_key_spec("w")
    assert vk == 0x57
    assert scan == 0x11
    assert flags & KEYEVENTF_SCANCODE
    assert not flags & KEYEVENTF_EXTENDEDKEY

    vk, scan, flags = win32_key_spec("a")
    assert vk == 0x41
    assert scan == 0x1E
    assert flags & KEYEVENTF_SCANCODE

    vk, scan, flags = win32_key_spec("left")
    assert vk == 0x25
    assert scan == 0x4B
    assert flags & KEYEVENTF_SCANCODE
    assert flags & KEYEVENTF_EXTENDEDKEY
