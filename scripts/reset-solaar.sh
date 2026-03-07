#!/usr/bin/env bash
# reset-solaar.sh — Reset Solaar config to defaults (no diversions, empty rules)
# No sudo needed.
#
# Usage:  reset-solaar.sh <install_type> <config_dir>
set -euo pipefail

INSTALL_TYPE="${1:-flatpak}"
CONFIG_DIR="${2:-$HOME/.var/app/io.github.pwr_solaar.solaar/config/solaar}"

# Backup existing configs
[[ -f "$CONFIG_DIR/config.yaml" ]] && cp "$CONFIG_DIR/config.yaml" "$CONFIG_DIR/config.yaml.bak"
[[ -f "$CONFIG_DIR/rules.yaml" ]]  && cp "$CONFIG_DIR/rules.yaml"  "$CONFIG_DIR/rules.yaml.bak"

# Clear rules
echo "%YAML 1.3
---
[]" > "$CONFIG_DIR/rules.yaml"

# Reset config.yaml: set all divert-keys to 0
if [[ -f "$CONFIG_DIR/config.yaml" ]]; then
  # Use sed to set all divert-key values to 0
  sed -i 's/\(divert-keys:.*{\)[^}]*/\1/' "$CONFIG_DIR/config.yaml" 2>/dev/null || true
fi

# Kill and restart Solaar
pkill -f solaar 2>/dev/null || true
sleep 1

if [[ "$INSTALL_TYPE" == "flatpak" ]]; then
  nohup flatpak run io.github.pwr_solaar.solaar --window=hide > /dev/null 2>&1 &
else
  nohup solaar --window=hide > /dev/null 2>&1 &
fi

sleep 2
echo "OK"
