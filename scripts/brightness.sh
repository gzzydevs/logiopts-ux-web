#!/bin/bash
# Usage: brightness.sh <up|down|set|get> [value] [output]
set -euo pipefail
OUTPUT="${3:-HDMI-1}"
case "${1:-get}" in
  up)  current=$(xrandr --verbose | grep -A5 "^${OUTPUT}" | grep Brightness | awk '{print $2}')
       new=$(echo "$current + 0.05" | bc); xrandr --output "$OUTPUT" --brightness "$new" ;;
  down) current=$(xrandr --verbose | grep -A5 "^${OUTPUT}" | grep Brightness | awk '{print $2}')
        new=$(echo "$current - 0.05" | bc); xrandr --output "$OUTPUT" --brightness "$new" ;;
  set) xrandr --output "$OUTPUT" --brightness "${2}" ;;
  get) xrandr --verbose | grep -A5 "^${OUTPUT}" | grep Brightness | awk '{print $2}' ;;
esac
