#!/usr/bin/env bash
# keepBoard - build Linux packages (AppImage + deb)
# Usage: bash scripts/build-installer.sh   (same flow as Windows build-installer.cmd)
set -e
cd "$(dirname "$0")/.."

# electron-builder's own toolchain (NSIS / winCodeSign) downloads from GitHub by
# default; route it through the same npmmirror mirror as the Electron binary.
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo "============================================"
echo "  keepBoard - Build Linux Packages"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js not found. Please install it (https://nodejs.org)"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "[1/5] Installing dependencies..."
    npm install
else
    echo "[1/5] Dependencies OK."
fi

echo "[2/5] Syncing version from scripts/version.txt ..."
node scripts/sync-version.mjs

echo "[3/5] Cleaning ALL previous build outputs..."
npm run clean

echo "[4/5] Regenerating icons + full build..."
npm run prepackage

echo "[5/5] Packaging with electron-builder (AppImage + deb) ..."
npm run package:linux

echo
echo "============================================"
echo "  Done! Fresh output files:"
echo "--------------------------------------------"
ls -1 release/*.AppImage release/*.deb 2>/dev/null || true
echo "============================================"
