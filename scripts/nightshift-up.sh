#!/bin/bash
# Increase night shift intensity (more orange = lower Kelvin)
STATE="/tmp/logitux-nightshift-temp"
CURRENT=$(cat "$STATE" 2>/dev/null || echo 6500)
NEW=$((CURRENT - 400))
[ "$NEW" -lt 2500 ] && NEW=2500
echo "$NEW" > "$STATE"
pkill gammastep 2>/dev/null
sleep 0.2
DISPLAY=:0 gammastep -O "$NEW" &
