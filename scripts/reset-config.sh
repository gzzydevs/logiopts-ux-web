#!/bin/bash
# Reset logid config to minimal defaults (no button remaps)
set -euo pipefail

DEVICE_NAME="${1:-LIFT VERTICAL ERGONOMIC MOUSE}"
DPI="${2:-2400}"

cat << EOF | sudo tee /etc/logid.cfg > /dev/null
devices: ({
  name: "${DEVICE_NAME}";
  dpi: ${DPI};
});
EOF

sudo systemctl restart logid
echo "Config reset to defaults"
