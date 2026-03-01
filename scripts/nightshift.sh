#!/bin/bash
# Usage: nightshift.sh <on|off|toggle> [temp]
set -euo pipefail
TEMP="${2:-3500}"
case "${1:-toggle}" in
  on)     pkill gammastep 2>/dev/null; gammastep -O "$TEMP" & disown ;;
  off)    pkill gammastep 2>/dev/null ;;
  toggle) if pgrep gammastep >/dev/null; then pkill gammastep; else gammastep -O "$TEMP" & disown; fi ;;
esac
