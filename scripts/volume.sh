#!/bin/bash
# Usage: volume.sh <up|down|mute|get>
set -euo pipefail
case "${1:-get}" in
  up)   pactl set-sink-volume @DEFAULT_SINK@ +5% ;;
  down) pactl set-sink-volume @DEFAULT_SINK@ -5% ;;
  mute) pactl set-sink-mute @DEFAULT_SINK@ toggle ;;
  get)  pactl get-sink-volume @DEFAULT_SINK@ | head -1 ;;
esac
