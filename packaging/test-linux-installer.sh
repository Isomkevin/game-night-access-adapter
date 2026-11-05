#!/usr/bin/env bash
# Checks the Linux .deb layout without installing it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="${1:-$ROOT/dist/installers}"
VERSION="$(PYTHONPATH="$ROOT" python3 -c "from access_adapter.version import __version__; print(__version__)")"
DEB="$OUT/game-night-access-adapter_${VERSION}_all.deb"
FAIL=0

pass() { echo "  OK  $*"; }
fail() { echo "  FAIL $*"; FAIL=1; }

echo "==> Linux installer tests (v${VERSION})"

for script in \
  "$ROOT/packaging/build-installers.sh" \
  "$ROOT/packaging/linux/build-deb.sh" \
  "$ROOT/packaging/linux/install.sh" \
  "$ROOT/packaging/linux/uninstall.sh" \
  "$ROOT/packaging/windows/build-zip.sh" \
  "$ROOT/packaging/windows/build-sfx.sh"
do
  if bash -n "$script"; then
    pass "syntax $(basename "$script")"
  else
    fail "syntax $(basename "$script")"
  fi
done

if [[ ! -f "$DEB" ]]; then
  fail "deb missing: $DEB"
else
  pass "deb exists: $(basename "$DEB")"
  info="$(dpkg-deb -I "$DEB")"
  if grep -q "Package: game-night-access-adapter" <<<"$info" && grep -q "Version: ${VERSION}" <<<"$info"; then
    pass "control package and version"
  else
    fail "control package or version"
    echo "$info"
  fi
  listing="$(dpkg-deb -c "$DEB")"
  for path in \
    ./usr/bin/game-night-access-adapter \
    ./usr/share/applications/game-night-access-adapter.desktop \
    ./etc/xdg/autostart/game-night-access-adapter.desktop \
    ./opt/game-night-access-adapter/access_adapter/__main__.py \
    ./opt/game-night-access-adapter/access_adapter/ui/phone_view.py \
    ./opt/game-night-access-adapter/access_adapter/ui/flow.py \
    ./opt/game-night-access-adapter/access_adapter/ui/style.py \
    ./opt/game-night-access-adapter/requirements.txt
  do
    if grep -Fq "$path" <<<"$listing"; then
      pass "deb contains $path"
    else
      fail "deb missing $path"
    fi
  done
  control_dir="$(mktemp -d)"
  dpkg-deb -e "$DEB" "$control_dir"
  if grep -Fq "python3 -m venv" "$control_dir/postinst"; then
    pass "postinst creates a virtual environment"
  else
    fail "postinst does not create a virtual environment"
  fi
  rm -rf "$control_dir"
fi

echo "-- Name checks"
if grep -R -n -E -e 'ops-device' -e 'OPS Device' --exclude-dir=vendor --exclude=test-linux-installer.sh packaging access_adapter docs README.md >/dev/null 2>&1; then
  fail 'found a foreign service name in project files'
  grep -R -n -E -e 'ops-device' -e 'OPS Device' --exclude-dir=vendor --exclude=test-linux-installer.sh packaging access_adapter docs README.md || true
else
  pass 'installer and app sources use this project name'
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "TESTS FAILED"
  exit 1
fi

echo ""
echo "All Linux installer tests passed."
