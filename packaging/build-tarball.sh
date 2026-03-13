#!/usr/bin/env bash
# packaging/build-tarball.sh — Generate a release tarball with compiled artifacts + bundled Node
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
NODE_VERSION="24.0.0"
NAME="logitux-${VERSION}"
OUT="release/${NAME}"

rm -rf "$OUT" "release/${NAME}.tar.gz"
mkdir -p "$OUT"/{bin,dist,dist-server}

# Build frontend + server
npm run build:all

# Copy artifacts
cp -r dist/* "$OUT/dist/"
cp -r dist-server/* "$OUT/dist-server/"
cp bin/logitux "$OUT/bin/"
chmod +x "$OUT/bin/logitux"
cp package.json "$OUT/"
cp packaging/logitux.desktop "$OUT/"
cp packaging/99-logitux.rules "$OUT/"
[ -f assets/logitux.png ] && cp assets/logitux.png "$OUT/" || true

# Download and bundle Node.js portable binary (linux-x64)
NODE_TAR="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
if [ ! -f "/tmp/${NODE_TAR}" ]; then
  echo "Downloading Node.js v${NODE_VERSION} (linux-x64)..."
  curl -fSL -o "/tmp/${NODE_TAR}" "$NODE_URL"
fi
tar -xJf "/tmp/${NODE_TAR}" -C /tmp "node-v${NODE_VERSION}-linux-x64/bin/node"
cp "/tmp/node-v${NODE_VERSION}-linux-x64/bin/node" "$OUT/bin/node"
chmod +x "$OUT/bin/node"
rm -rf "/tmp/node-v${NODE_VERSION}-linux-x64"

# Install production-only dependencies
cd "$OUT"
npm install --omit=dev --ignore-scripts
cd -

# Create tarball
tar -czf "release/${NAME}.tar.gz" -C release "${NAME}"
rm -rf "$OUT"

echo "✓ release/${NAME}.tar.gz"
