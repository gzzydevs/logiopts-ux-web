#!/usr/bin/env bash
# packaging/build-tarball.sh — Generate a release tarball with compiled artifacts
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
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
[ -f assets/logitux.png ] && cp assets/logitux.png "$OUT/" || true

# Install production-only dependencies
cd "$OUT"
npm install --omit=dev --ignore-scripts
cd -

# Create tarball
tar -czf "release/${NAME}.tar.gz" -C release "${NAME}"
rm -rf "$OUT"

echo "✓ release/${NAME}.tar.gz"
