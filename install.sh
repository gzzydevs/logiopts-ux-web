#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/logitux"

echo "Installing LogiTux to $INSTALL_DIR..."

# Build frontend + server
npm run build:all

# Create installation directories
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server}

# Copy built artifacts
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp package.json "$INSTALL_DIR/"

# Install production-only dependencies in the target directory
cd "$INSTALL_DIR"
sudo npm install --omit=dev --ignore-scripts
cd -

# Launcher
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# Desktop entry
sudo cp packaging/logitux.desktop /usr/share/applications/
[ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/ || true

echo "✓ Installed. Run 'logitux' to start."
