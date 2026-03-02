#!/usr/bin/env bash
# apply-solaar.sh — Write Solaar config and restart Solaar
# Called by the web UI.  No sudo needed.
#
# Usage:  apply-solaar.sh <install_type> <config_dir>
# Reads two YAML documents from stdin, separated by "---RULES---"
#   First part  → config.yaml
#   Second part → rules.yaml
set -euo pipefail

INSTALL_TYPE="${1:-flatpak}"
CONFIG_DIR="${2:-$HOME/.var/app/io.github.pwr_solaar.solaar/config/solaar}"

# Read stdin and split
INPUT=$(cat)
CONFIG_YAML=$(echo "$INPUT" | sed '/^---RULES---$/,$d')
RULES_YAML=$(echo "$INPUT" | sed '1,/^---RULES---$/d')

# Backup existing configs
[[ -f "$CONFIG_DIR/config.yaml" ]] && cp "$CONFIG_DIR/config.yaml" "$CONFIG_DIR/config.yaml.bak"
[[ -f "$CONFIG_DIR/rules.yaml" ]]  && cp "$CONFIG_DIR/rules.yaml"  "$CONFIG_DIR/rules.yaml.bak"

# Write new configs
echo "$CONFIG_YAML" > "$CONFIG_DIR/config.yaml"
echo "$RULES_YAML"  > "$CONFIG_DIR/rules.yaml"

# Kill and restart Solaar
pkill -f solaar 2>/dev/null || true
sleep 1

if [[ "$INSTALL_TYPE" == "flatpak" ]]; then
  nohup flatpak run io.github.pwr_solaar.solaar --window=hide > /dev/null 2>&1 &
else
  nohup solaar --window=hide > /dev/null 2>&1 &
fi

# Give Solaar a moment to start
sleep 2
echo "OK"
