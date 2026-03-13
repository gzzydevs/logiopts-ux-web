#!/usr/bin/env bash
set -euo pipefail

# Run as a regular user: script will call sudo only for privileged steps.
if [[ $EUID -eq 0 ]]; then
  echo "Error: run as a regular user, not root — e.g. 'bash install.sh'" >&2
  exit 1
fi

INSTALL_DIR="/opt/logitux"
NODE_VERSION="24.0.0"

echo "Installing LogiTux to $INSTALL_DIR..."

# ---------- Build (no root needed) ----------
npm run build:all

# ---------- Download bundled Node (runtime only — no npm needed) ----------
NODE_TAR="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
if [ ! -f "/tmp/${NODE_TAR}" ]; then
  echo "Downloading Node.js v${NODE_VERSION} (linux-x64)..."
  curl -fSL -o "/tmp/${NODE_TAR}" "$NODE_URL"
fi
tar -xJf "/tmp/${NODE_TAR}" -C /tmp "node-v${NODE_VERSION}-linux-x64/bin/node"

# ---------- Copy artifacts (sudo) ----------
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server}
sudo cp "/tmp/node-v${NODE_VERSION}-linux-x64/bin/node" "$INSTALL_DIR/bin/node"
sudo chmod +x "$INSTALL_DIR/bin/node"
rm -rf "/tmp/node-v${NODE_VERSION}-linux-x64"
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp package.json "$INSTALL_DIR/"

# Install production deps using the user's npm (system npm, PATH preserved).
# Strip "type":"module" from the installed package.json so CJS tooling (npm) works correctly.
sudo sed -i '/"type"/d' "$INSTALL_DIR/package.json"
sudo env "PATH=$PATH" npm --prefix "$INSTALL_DIR" install --omit=dev

# Launcher + PATH symlink
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# ---------- Desktop entry ----------
# On rpm-ostree (Bazzite/Silverblue) /usr/share is read-only; fall back to user dir.
if sudo test -w /usr/share/applications 2>/dev/null; then
  sudo cp packaging/logitux.desktop /usr/share/applications/
  [ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/ || true
else
  mkdir -p "$HOME/.local/share/applications"
  cp packaging/logitux.desktop "$HOME/.local/share/applications/"
  if [ -f assets/logitux.png ]; then
    mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
    cp assets/logitux.png "$HOME/.local/share/icons/hicolor/256x256/apps/"
  fi
  echo "  (rpm-ostree: desktop entry installed to ~/.local/share/applications/)"
fi

# ---------- udev rules ----------
# /etc/udev/rules.d is writable on all systems including rpm-ostree.
sudo cp packaging/99-logitux.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules 2>/dev/null || true

echo "✓ Installed. Run 'logitux' to start."
