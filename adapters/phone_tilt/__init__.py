"""Phone tilt adapter: Android accelerometer/gyroscope → keyboard keystrokes.

Public entry points
-------------------
- ``pair_and_connect.py`` / ``connect_phone.sh`` — wireless ADB pairing
- ``sensor_reader.py`` — background sensor polling over ADB
- ``gyro_controller.py`` — pygame UI + keystroke injection (WASD / arrows)

See ``docs/phone-tilt-adapter.md`` for setup, architecture, and tuning.
"""

from .sensor_reader import SensorReader, SensorSample

__all__ = ["SensorReader", "SensorSample"]
