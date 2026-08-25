#!/usr/bin/env bash
# keepBoard - dev mode (Vite + Electron)
# Usage: bash scripts/dev.sh   (same flow as Windows dev.cmd)
set -e
cd "$(dirname "$0")/.."

echo "============================================"
echo "  keepBoard - Dev Mode (Vite + Electron)"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js not found. Please install it (https://nodejs.org)"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "[1/2] Installing dependencies..."
    npm install
else
    echo "[1/2] Dependencies OK."
fi

echo "[2/2] Starting Vite + Electron ..."
npm run dev
