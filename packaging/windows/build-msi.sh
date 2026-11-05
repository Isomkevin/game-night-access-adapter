#!/usr/bin/env bash
# Build a Windows Installer (.msi) with a standard GUI wizard (wixl).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$ROOT/dist/installers}"
VENDOR="$SCRIPT_DIR/vendor/wixl"
VERSION="$(python3 -c "import sys; sys.path.insert(0, '$ROOT'); from access_adapter.version import __version__; print(__version__)")"
STAGE="$(mktemp -d /tmp/access-adapter-msi-XXXXXX)"
MSI_NAME="game-night-access-adapter-${VERSION}.msi"

mkdir -p "$OUT_DIR" "$VENDOR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

ensure_wixl() {
  if command -v wixl >/dev/null 2>&1; then
    WIXL="$(command -v wixl)"
    if [[ -d /usr/share/wixl-0.103/ext ]]; then
      WIXL_EXTDIR="${WIXL_EXTDIR:-/usr/share/wixl-0.103/ext}"
    else
      WIXL_EXTDIR="${WIXL_EXTDIR:-/usr/share/wixl-0.103}"
    fi
    return
  fi
  local bin="$VENDOR/usr/bin/wixl"
  if [[ ! -x "$bin" ]]; then
    echo "Fetching wixl (Windows MSI builder)..."
    local debs
    debs="$(mktemp -d)"
    (cd "$debs" && apt-get download wixl wixl-data libmsi-1.0-0 libgcab-1.0-0 >/dev/null)
    mkdir -p "$VENDOR"
    for deb in "$debs"/*.deb; do
      dpkg-deb -x "$deb" "$VENDOR"
    done
    rm -rf "$debs"
  fi
  export LD_LIBRARY_PATH="$VENDOR/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  WIXL="$VENDOR/usr/bin/wixl"
  WIXL_EXTDIR="$VENDOR/usr/share/wixl-0.103/ext"
}

rsync -a --exclude '__pycache__' --exclude '*.pyc' "$ROOT/access_adapter" "$STAGE/"
cp "$ROOT/requirements.txt" "$STAGE/"
cp "$SCRIPT_DIR/python-bootstrap.ps1" \
   "$SCRIPT_DIR/install.ps1" \
   "$SCRIPT_DIR/install.bat" \
   "$SCRIPT_DIR/post-install.ps1" \
   "$SCRIPT_DIR/register-autostart.ps1" \
   "$SCRIPT_DIR/run-app.cmd" \
   "$SCRIPT_DIR/uninstall.ps1" \
   "$SCRIPT_DIR/uninstall.bat" \
   "$SCRIPT_DIR/msi-postinstall.cmd" \
   "$SCRIPT_DIR/License.rtf" \
   "$STAGE/"

python3 - "$STAGE" "$VERSION" "$STAGE/product.wxs" <<'PY'
from __future__ import annotations

import hashlib
import sys
from pathlib import Path
from xml.sax.saxutils import escape

stage = Path(sys.argv[1])
version = sys.argv[2]
out = Path(sys.argv[3])


def guid_for(relative: str) -> str:
    digest = hashlib.sha1(f"game-night-access-adapter:{relative}".encode()).hexdigest()
    return f"{{{digest[0:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}}}"


def xml_id(prefix: str, relative: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in relative)
    return (prefix + cleaned)[:70]


class DirNode:
    __slots__ = ("dirs", "files")

    def __init__(self) -> None:
        self.dirs: dict[str, DirNode] = {}
        self.files: list[Path] = []


files = [path for path in stage.rglob("*") if path.is_file() and path.name != "product.wxs"]
tree = DirNode()
component_ids: list[str] = []
for path in sorted(files):
    rel = path.relative_to(stage)
    node = tree
    for part in rel.parts[:-1]:
        node = node.dirs.setdefault(part, DirNode())
    node.files.append(path)


def emit_directory(node: DirNode, rel_dir: str, indent: int) -> list[str]:
    pad = " " * indent
    lines: list[str] = []
    for path in sorted(node.files, key=lambda item: item.name.lower()):
        rel = path.relative_to(stage).as_posix()
        cid = xml_id("F_", rel)
        component_ids.append(cid)
        lines.append(f"{pad}<Component Id='{cid}' Guid='{guid_for(rel)}' Win64='yes'>")
        lines.append(f"{pad}  <File Id='{cid}' Source='{escape(str(path))}' KeyPath='yes' />")
        lines.append(f"{pad}</Component>")
    for name in sorted(node.dirs):
        child = node.dirs[name]
        child_rel = name if not rel_dir else f"{rel_dir}/{name}"
        did = xml_id("D_", child_rel)
        lines.append(f"{pad}<Directory Id='{did}' Name='{escape(name)}'>")
        lines.extend(emit_directory(child, child_rel, indent + 2))
        lines.append(f"{pad}</Directory>")
    return lines


directory_body = "\n".join(emit_directory(tree, "", 10))
refs = "\n".join(f"      <ComponentRef Id='{cid}' />" for cid in component_ids)

out.write_text(
    f"""<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="Game Night Access Adapter" Language="1033"
           Version="{escape(version)}" Manufacturer="Game Night"
           UpgradeCode="7C2E9A14-5B18-4E3A-9F01-6D4A2B8C1E70">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />
    <UIRef Id="WixUI_Minimal" />
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="Game Night Access Adapter">
{directory_body}
        </Directory>
      </Directory>
      <Directory Id="ProgramMenuFolder">
        <Directory Id="AppMenuDir" Name="Game Night Access Adapter">
          <Component Id="StartMenuShortcut" Guid="{guid_for("shortcut-menu")}">
            <Shortcut Id="StartMenuLink" Name="Game Night Access Adapter"
                      Description="Live phone tilt mapped to keyboard keys"
                      Target="[INSTALLDIR]run-app.cmd" WorkingDirectory="INSTALLDIR" />
            <RemoveFolder Id="AppMenuDir" On="uninstall" />
            <RegistryValue Root="HKCU" Key="Software\\\\GameNightAccessAdapter"
                           Name="StartMenu" Type="integer" Value="1" KeyPath="yes" />
          </Component>
        </Directory>
      </Directory>
      <Directory Id="DesktopFolder">
        <Component Id="DesktopShortcut" Guid="{guid_for("shortcut-desktop")}">
          <Shortcut Id="DesktopLink" Name="Game Night Access Adapter"
                    Description="Live phone tilt mapped to keyboard keys"
                    Target="[INSTALLDIR]run-app.cmd" WorkingDirectory="INSTALLDIR" />
          <RegistryValue Root="HKCU" Key="Software\\\\GameNightAccessAdapter"
                         Name="Desktop" Type="integer" Value="1" KeyPath="yes" />
        </Component>
      </Directory>
    </Directory>
    <Feature Id="Complete" Title="Game Night Access Adapter" Level="1">
{refs}
      <ComponentRef Id="StartMenuShortcut" />
      <ComponentRef Id="DesktopShortcut" />
    </Feature>
    <Property Id="POSTINSTALLCMD" Value="[INSTALLDIR]msi-postinstall.cmd" />
    <CustomAction Id="PostInstall" Property="POSTINSTALLCMD" ExeCommand=""
                  Execute="immediate" Return="asyncNoWait" />
    <InstallExecuteSequence>
      <Custom Action="PostInstall" After="InstallFinalize">NOT Installed</Custom>
    </InstallExecuteSequence>
  </Product>
</Wix>
""",
    encoding="utf-8",
)
print(f"Wrote {out} ({len(files)} files)")
PY

ensure_wixl
cp "$STAGE/License.rtf" "$PWD/License.rtf" 2>/dev/null || true
(
  cd "$STAGE"
  "$WIXL" --ext ui --extdir "$WIXL_EXTDIR" -a x64 -o "$OUT_DIR/$MSI_NAME" product.wxs
)
rm -f "$PWD/License.rtf"
rm -rf "$STAGE"

BYTES=$(wc -c < "$OUT_DIR/$MSI_NAME")
if [[ "$BYTES" -lt 20000 ]]; then
  echo "ERROR: MSI too small ($BYTES bytes)" >&2
  exit 1
fi
echo "Built $OUT_DIR/$MSI_NAME ($BYTES bytes)"
