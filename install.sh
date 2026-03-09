#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/logitux"

echo "Installing LogiTux to $INSTALL_DIR..."

# Build frontend + server
npm run build:all

# Create installation directories
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server,node_modules}

# Copy built artifacts
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp package.json "$INSTALL_DIR/"

# Copy production dependencies
# Express and its transitive deps
for dep in $(node -e "
  const pkg = JSON.parse(require('fs').readFileSync('node_modules/express/package.json','utf8'));
  console.log(Object.keys(pkg.dependencies||{}).join('\n'));
"); do
  [ -d "node_modules/$dep" ] && sudo cp -r "node_modules/$dep" "$INSTALL_DIR/node_modules/"
done
sudo cp -r node_modules/express "$INSTALL_DIR/node_modules/"

# better-sqlite3 and its native bindings
sudo cp -r node_modules/better-sqlite3 "$INSTALL_DIR/node_modules/"
sudo cp -r node_modules/bindings "$INSTALL_DIR/node_modules/" 2>/dev/null || true
sudo cp -r node_modules/file-uri-to-path "$INSTALL_DIR/node_modules/" 2>/dev/null || true

# js-yaml
sudo cp -r node_modules/js-yaml "$INSTALL_DIR/node_modules/"

# Launcher
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# Desktop entry
sudo cp packaging/logitux.desktop /usr/share/applications/
[ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/ || true

echo "✓ Installed. Run 'logitux' to start."
