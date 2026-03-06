#!/usr/bin/env bash
# apply-solaar.sh — Write Solaar rules and patch config, then restart Solaar
# Called by the web UI.  No sudo needed.
#
# Usage:  apply-solaar.sh <install_type> <config_dir> [divert_keys_csv]
#
# Reads rules.yaml content from stdin.
# divert_keys_csv format: "83:2,86:2,253:2" (CID:mode pairs)
#
# The script patches divert-keys in the EXISTING config.yaml via sed
# (preserving Solaar's own format) rather than overwriting the file,
# which avoids issues with YAML key types (integer vs string).
set -euo pipefail

INSTALL_TYPE="${1:-flatpak}"
CONFIG_DIR="${2:-$HOME/.var/app/io.github.pwr_solaar.solaar/config/solaar}"
DIVERT_KEYS="${3:-}"

CONFIG_FILE="$CONFIG_DIR/config.yaml"
RULES_FILE="$CONFIG_DIR/rules.yaml"

# Read rules YAML from stdin
RULES_YAML=$(cat)

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# ─── Backup existing configs ────────────────────────────────────────────────
[[ -f "$CONFIG_FILE" ]] && cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
[[ -f "$RULES_FILE" ]]  && cp "$RULES_FILE"  "$RULES_FILE.bak"

# ─── Patch divert-keys in existing config.yaml ─────────────────────────────
# Solaar stores divert-keys per device with integer keys:
#     divert-keys: {83: 0, 86: 0, 253: 0}
# We use sed to change specific CID values (e.g. from 0 → 2) without
# overwriting the entire file, preserving Solaar's native format.
if [[ -f "$CONFIG_FILE" && -n "$DIVERT_KEYS" ]]; then
    IFS=',' read -ra PAIRS <<< "$DIVERT_KEYS"
    for pair in "${PAIRS[@]}"; do
        CID="${pair%%:*}"
        MODE="${pair##*:}"
        # Replace any current mode (0, 1, or 2) for this CID with the new mode
        sed -i -E "s/(divert-keys:.*\b${CID}:) [0-2]/\1 ${MODE}/g" "$CONFIG_FILE"
    done
    echo "[apply-solaar] divert-keys patched:"
    grep 'divert-keys' "$CONFIG_FILE" 2>/dev/null | head -5 | sed 's/^/  /'
elif [[ ! -f "$CONFIG_FILE" ]]; then
    echo "[apply-solaar] WARNING: $CONFIG_FILE does not exist yet."
    echo "  Run Solaar once manually first so it creates its config."
fi

# ─── Write rules.yaml ──────────────────────────────────────────────────────
echo "$RULES_YAML" > "$RULES_FILE"
echo "[apply-solaar] rules.yaml written ($(echo "$RULES_YAML" | wc -l) lines)"

# ─── Kill and restart Solaar ────────────────────────────────────────────────
pkill -f "python.*solaar" 2>/dev/null || true
sleep 1

# Force kill if still alive
if pgrep -f "python.*solaar" &>/dev/null; then
    pkill -9 -f "python.*solaar" 2>/dev/null || true
    sleep 1
fi

if [[ "$INSTALL_TYPE" == "flatpak" ]]; then
  nohup flatpak run io.github.pwr_solaar.solaar --window=hide > /dev/null 2>&1 &
else
  nohup solaar --window=hide > /dev/null 2>&1 &
fi

# Give Solaar a moment to start
sleep 2

if pgrep -f "python.*solaar" &>/dev/null; then
    echo "OK — Solaar restarted successfully"
else
    echo "WARNING — Solaar may not have started. Check manually."
fi
