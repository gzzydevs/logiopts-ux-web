#!/usr/bin/env bash
# packaging/build-rpm.sh — Build an RPM from the release tarball
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")

# Generate tarball first
bash packaging/build-tarball.sh

# Prepare rpmbuild structure
mkdir -p ~/rpmbuild/{SOURCES,SPECS}
cp "release/logitux-${VERSION}.tar.gz" ~/rpmbuild/SOURCES/
cp packaging/logitux.spec ~/rpmbuild/SPECS/

# Build RPM
rpmbuild -bb ~/rpmbuild/SPECS/logitux.spec

echo "✓ RPM in ~/rpmbuild/RPMS/"
