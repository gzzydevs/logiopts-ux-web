#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/logitux"

echo "Installing LogiTux to $INSTALL_DIR..."

# Build frontend + server
npm run build:all

# Create installation directories and copy artifacts (needs root for /opt)
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server}
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp package.json "$INSTALL_DIR/"

# Install production-only dependencies in the target directory
sudo bash -c "cd $INSTALL_DIR && npm install --omit=dev --ignore-scripts"

# Launcher
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# Desktop entry (needs root for /usr/share)
sudo cp packaging/logitux.desktop /usr/share/applications/
[ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/ || true

echo "✓ Installed. Run 'logitux' to start."
