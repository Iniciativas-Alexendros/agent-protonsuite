#!/usr/bin/env bash
# Pinned actionlint (same version/checksum as .github/workflows/quality.yml).
set -euo pipefail
ACTIONLINT_VERSION="${ACTIONLINT_VERSION:-1.7.12}"
ACTIONLINT_SHA256="${ACTIONLINT_SHA256:-8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8}"
BIN_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/protonsuite-actionlint/${ACTIONLINT_VERSION}"
BIN="$BIN_DIR/actionlint"

if [ ! -x "$BIN" ]; then
  arch="$(uname -m)"
  if [ "$arch" != "x86_64" ]; then
    echo "checksum is pinned for x86_64 only; resolve the ${arch} asset from the same release" >&2
    exit 1
  fi
  mkdir -p "$BIN_DIR"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  archive="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
  curl -fsSL -o "$tmp/$archive" \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${archive}"
  echo "${ACTIONLINT_SHA256}  $tmp/$archive" | sha256sum -c -
  tar -xzf "$tmp/$archive" -C "$tmp" actionlint
  mv "$tmp/actionlint" "$BIN"
  chmod +x "$BIN"
fi

exec "$BIN" -color "$@"
