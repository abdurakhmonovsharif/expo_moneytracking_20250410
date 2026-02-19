#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_LOGO="$ROOT_DIR/logo.png"
ASSETS_DIR="$ROOT_DIR/assets"
BG_COLOR="122332"

if [[ ! -f "$SOURCE_LOGO" ]]; then
  echo "Source logo not found: $SOURCE_LOGO" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

build_square_asset() {
  local output_file="$1"
  local size="$2"
  local temp_file="$TMP_DIR/$output_file"

  sips -Z "$size" "$SOURCE_LOGO" --out "$temp_file" >/dev/null 2>&1
  sips -p "$size" "$size" --padColor "$BG_COLOR" "$temp_file" --out "$ASSETS_DIR/$output_file" >/dev/null 2>&1
}

build_square_asset "icon.png" 1024
build_square_asset "adaptive-icon.png" 432
build_square_asset "splash.png" 1024
build_square_asset "img_logo.png" 125
build_square_asset "img_logo@2x.png" 250
build_square_asset "favicon.png" 48

echo "Logo assets generated from logo.png" 
