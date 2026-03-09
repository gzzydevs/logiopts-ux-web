#!/usr/bin/env bash
set -euo pipefail

sudo rm -rf /opt/logitux
sudo rm -f /usr/local/bin/logitux
sudo rm -f /usr/share/applications/logitux.desktop
sudo rm -f /usr/share/icons/hicolor/256x256/apps/logitux.png

echo "✓ LogiTux uninstalled."
