#!/bin/bash
# Usage: monitor-colors.sh <output> <gamma> <brightness>
# Example: monitor-colors.sh HDMI-1 1.0:0.9:0.8 0.95
set -euo pipefail
xrandr --output "${1}" --gamma "${2}" --brightness "${3}"
echo "Applied gamma=${2} brightness=${3} to ${1}"
