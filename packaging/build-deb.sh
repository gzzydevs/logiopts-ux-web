#!/usr/bin/env bash
# packaging/build-deb.sh — Build a .deb package with bundled Node.js
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
PKG="logitux_${VERSION}_amd64"

# Build tarball first (downloads Node binary + production deps)
bash packaging/build-tarball.sh

# Prepare .deb directory structure
rm -rf "release/$PKG"
mkdir -p "release/$PKG"/{DEBIAN,opt/logitux,usr/bin,usr/share/applications,usr/share/icons/hicolor/256x256/apps,lib/udev/rules.d}

# Extract tarball
tar -xzf "release/logitux-${VERSION}.tar.gz" -C /tmp
cp -r "/tmp/logitux-${VERSION}/"* "release/$PKG/opt/logitux/"
rm -rf "/tmp/logitux-${VERSION}"

# Ensure bundled Node binary and launcher are executable
chmod +x "release/$PKG/opt/logitux/bin/node"
chmod +x "release/$PKG/opt/logitux/bin/logitux"

# Control file
cp packaging/debian/control "release/$PKG/DEBIAN/control"

# Symlink in PATH
ln -sf /opt/logitux/bin/logitux "release/$PKG/usr/bin/logitux"

# Desktop entry + icon
mv "release/$PKG/opt/logitux/logitux.desktop" "release/$PKG/usr/share/applications/" 2>/dev/null || true
mv "release/$PKG/opt/logitux/logitux.png" "release/$PKG/usr/share/icons/hicolor/256x256/apps/" 2>/dev/null || true

# udev rules for Logitech HID++ devices
mv "release/$PKG/opt/logitux/99-logitux.rules" "release/$PKG/lib/udev/rules.d/" 2>/dev/null || true

# Build .deb
dpkg-deb --build "release/$PKG"
rm -rf "release/$PKG"

echo "✓ release/${PKG}.deb"
