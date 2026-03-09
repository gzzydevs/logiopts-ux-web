#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/logitux"
NODE_VERSION="24.0.0"

echo "Installing LogiTux to $INSTALL_DIR..."

# Build frontend + server
npm run build:all

# Create installation directories and copy artifacts (needs root for /opt)
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server}
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp package.json "$INSTALL_DIR/"

# Download and bundle Node.js portable binary (linux-x64)
NODE_TAR="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
if [ ! -f "/tmp/${NODE_TAR}" ]; then
  echo "Downloading Node.js v${NODE_VERSION} (linux-x64)..."
  curl -fSL -o "/tmp/${NODE_TAR}" "$NODE_URL"
fi
tar -xJf "/tmp/${NODE_TAR}" -C /tmp "node-v${NODE_VERSION}-linux-x64/bin/node"
sudo cp "/tmp/node-v${NODE_VERSION}-linux-x64/bin/node" "$INSTALL_DIR/bin/node"
sudo chmod +x "$INSTALL_DIR/bin/node"
rm -rf "/tmp/node-v${NODE_VERSION}-linux-x64"

# Install production-only dependencies in the target directory
sudo bash -c "cd $INSTALL_DIR && $INSTALL_DIR/bin/node $(which npm) install --omit=dev --ignore-scripts"

# Launcher
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# Desktop entry (needs root for /usr/share)
sudo cp packaging/logitux.desktop /usr/share/applications/
[ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/ || true

# udev rules for Logitech HID++ devices (non-root hardware access)
sudo cp packaging/99-logitux.rules /lib/udev/rules.d/
sudo udevadm control --reload-rules 2>/dev/null || true

echo "✓ Installed. Run 'logitux' to start."
