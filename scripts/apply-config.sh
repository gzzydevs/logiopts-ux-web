#!/bin/bash
# Reads config from stdin, writes to /etc/logid.cfg, restarts logid
set -euo pipefail
sudo tee /etc/logid.cfg > /dev/null
sudo systemctl restart logid
echo "Config applied"
