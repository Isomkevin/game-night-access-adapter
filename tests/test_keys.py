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
