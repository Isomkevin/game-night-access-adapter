# Installers

Windows and Linux packages install the desktop app, a Python virtual environment, and a shortcut that opens at login. The app runs in the signed-in user session. That is required so the keys it holds are delivered to the focused game. It is not a background system service.

Installer **scripts** live in `packaging/`. Built files go to `dist/installers/` (gitignored). A copy of the current Windows zip and `setup.exe` is in [`releases/`](../releases/) so they can be downloaded from the branch. Each package copies the current `access_adapter` tree, including the live-tilt window.

```bash
bash packaging/build-installers.sh
```

## Linux

`game-night-access-adapter_<version>_all.deb`

| Path | Role |
|------|------|
| `/opt/game-night-access-adapter` | Application and virtual environment |
| `/usr/bin/game-night-access-adapter` | Launcher |
| `/usr/share/applications/game-night-access-adapter.desktop` | Application menu |
| `/etc/xdg/autostart/game-night-access-adapter.desktop` | Open at graphical login |

The package `postinst` creates the virtual environment and installs `requirements.txt`. `adb` is recommended, not required, because the package name differs across distributions. Install it separately if `adb` is not already on `PATH`.

Remove the autostart file to stop the window opening at login. User settings stay in `~/.config/game-night-access-adapter/`.

From a git checkout, without building a deb:

```bash
sudo bash packaging/linux/install.sh
sudo bash packaging/linux/uninstall.sh
```

## Windows

Two artifacts, plus an Inno Setup script you can compile on Windows with Inno Setup 6:

| File | How it is produced |
|------|--------------------|
| `game-night-access-adapter-<version>-windows.zip` | `packaging/windows/build-zip.sh` |
| `game-night-access-adapter-<version>-setup.exe` | 7-Zip SFX. It runs `install.bat` after extract. The builder downloads `7zSD.sfx` from the 7-Zip LZMA SDK (`https://www.7-zip.org/a/lzma2501.7z`) |
| `packaging/windows/game-night-access-adapter.iss` | Compile with `iscc` on Windows |

`setup.exe` unpacks to a temporary folder that disappears when the installer exits. `post-install.ps1` copies the payload to `C:\Program Files\Game Night Access Adapter` before it creates the virtual environment. Do not run `install.bat` from inside an archive preview; extract the full zip first, or use `setup.exe`.

`install.bat` changes to its own directory, then asks for Administrator. PowerShell scripts are UTF-8 with a BOM and use ASCII punctuation so Windows PowerShell 5.1 can parse them.

Shortcuts:

- Start Menu: Game Night Access Adapter
- Startup folder (all users): same shortcut, so the app opens at login in the user session

Uninstall from that copy's `uninstall.bat`, or from Apps & Features. Settings remain in `%APPDATA%\GameNightAccessAdapter`.

Install Python 3 from python.org for all users before running the Windows installer. Android platform-tools (`adb`) must be on `PATH` as well. The installer does not download the Android SDK.

## Tests

`build-installers.sh` runs both checks after the artifacts exist:

```bash
bash packaging/test-linux-installer.sh dist/installers
bash packaging/test-windows-installers.sh dist/installers
```

The Linux check inspects the deb with `dpkg-deb` and does not install it. The Windows check confirms the zip and `setup.exe` contain the install scripts, the launcher, and `access_adapter`.

## Local API after install

While the app is running:

```bash
curl http://127.0.0.1:8765/api/v1/health
```

See [local-api.md](local-api.md).
