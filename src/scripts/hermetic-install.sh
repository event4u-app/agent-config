#!/usr/bin/env bash
# scripts/hermetic-install.sh — verified-offline install entrypoint.
#
# Phase 2 Step 5 of agents/roadmaps/road-to-distribution-maturity.md.
# Council-revised semantic: this is a **verified-offline install**.
# The script name keeps "hermetic" for roadmap continuity; the
# Anthropic Phase 2 verdict requires the checksum manifest to be
# delivered through a separate channel (not bundled in the tarball)
# so the trust model is not circular.
#
# Operator brings the trust root (--gpg-key). No embedded key.
# Unix-only (macOS + Linux). Windows is future scope per o1 verdict.
#
# Sub-criteria from the roadmap:
#  (a) stages a tarball from `npm pack` or operator-supplied .tgz
#  (b) verifies sha256sum against a separate-channel manifest +
#      operator GPG key
#  (c) invokes `scripts/install.py --offline --package-dir=<staging>`
#  (d) writes additive lockfile fields under schema_version: 1
#      (installation_mode, package_checksum, signature_verified)
#
# Exit codes:
#   0   — install + verification succeeded
#   1   — argument error
#   2   — checksum mismatch
#   3   — GPG verification failed
#   4   — install.py invocation failed
#   5   — required dependency missing

set -euo pipefail

# ---------------------------------------------------------------- usage

usage() {
  cat <<'USAGE'
Usage:
  hermetic-install.sh --tarball <file.tgz> --manifest <file.sha256>
                      --gpg-key <pubkey.gpg> [--package-dir <staging>]
                      [--package-version <semver>] [--dry-run]

Required:
  --tarball         Path to the agent-config-<version>.tgz produced
                    by `npm pack @event4u/agent-config@<version>`.
  --manifest        Path to the separate-channel sha256 manifest.
                    Manifest must be detached-signed by the operator
                    key; the script verifies the signature before
                    using the manifest for checksum comparison.
  --gpg-key         Path to the operator-supplied GPG public key
                    (ASCII-armored or binary). No embedded trust root.

Optional:
  --package-dir     Staging dir for the extracted tarball
                    (default: $(mktemp -d)).
  --package-version Override the semver written to installed.lock
                    (default: parse package.json after extraction).
  --dry-run         Verify everything but skip install.py invocation.

Exit codes: 0 ok · 1 args · 2 checksum · 3 gpg · 4 install · 5 dep
USAGE
}

# ---------------------------------------------------------------- deps

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌  missing required command: $1" >&2
    exit 5
  }
}

require bash
require tar
require gpg

# Prefer sha256sum (Linux); fall back to shasum -a 256 (macOS).
SHA256_CMD=""
if command -v sha256sum >/dev/null 2>&1; then
  SHA256_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA256_CMD="shasum -a 256"
else
  echo "❌  missing sha256sum / shasum" >&2
  exit 5
fi

# ---------------------------------------------------------------- args

TARBALL=""
MANIFEST=""
GPG_KEY=""
PACKAGE_DIR=""
PACKAGE_VERSION=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tarball) TARBALL="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --gpg-key) GPG_KEY="$2"; shift 2 ;;
    --package-dir) PACKAGE_DIR="$2"; shift 2 ;;
    --package-version) PACKAGE_VERSION="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "❌  unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$TARBALL" || -z "$MANIFEST" || -z "$GPG_KEY" ]]; then
  echo "❌  --tarball, --manifest, --gpg-key are required" >&2
  usage
  exit 1
fi

for f in "$TARBALL" "$MANIFEST" "$GPG_KEY"; do
  [[ -f "$f" ]] || { echo "❌  file not found: $f" >&2; exit 1; }
done

# ---------------------------------------------------------------- gpg

# Use a throwaway GPG home so we never touch the operator's
# real keyring. Cleanup on exit.
GPGHOME="$(mktemp -d)"
trap 'rm -rf "$GPGHOME"' EXIT
export GNUPGHOME="$GPGHOME"

echo "🔐  importing operator GPG key from $GPG_KEY"
gpg --batch --quiet --import "$GPG_KEY"

# Verify the manifest signature. Expect detached signature at
# <manifest>.asc OR inline-signed manifest. Try both.
if [[ -f "${MANIFEST}.asc" ]]; then
  echo "🔐  verifying detached signature: ${MANIFEST}.asc"
  gpg --batch --quiet --verify "${MANIFEST}.asc" "$MANIFEST" || {
    echo "❌  GPG verification failed (detached)" >&2
    exit 3
  }
else
  echo "🔐  verifying inline signature on $MANIFEST"
  gpg --batch --quiet --verify "$MANIFEST" || {
    echo "❌  GPG verification failed (inline)" >&2
    echo "    hint: provide ${MANIFEST}.asc as a detached signature" >&2
    exit 3
  }
fi
SIGNATURE_VERIFIED=true

# ---------------------------------------------------------------- sha

echo "🔍  computing tarball checksum"
ACTUAL_SHA="$($SHA256_CMD "$TARBALL" | awk '{print $1}')"

# Manifest format: lines of "<sha256>  <relative-tarball-path>".
# Match by basename to avoid path-prefix surprises.
TARBALL_BASE="$(basename "$TARBALL")"
EXPECTED_SHA="$(awk -v base="$TARBALL_BASE" '
  $2 == base || $2 == "*"base || $2 ~ "/"base"$" {print $1; exit}
' "$MANIFEST")"

if [[ -z "$EXPECTED_SHA" ]]; then
  echo "❌  no checksum entry for $TARBALL_BASE in manifest" >&2
  exit 2
fi

if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "❌  checksum mismatch" >&2
  echo "    expected: $EXPECTED_SHA" >&2
  echo "    actual:   $ACTUAL_SHA" >&2
  exit 2
fi

PACKAGE_CHECKSUM="sha256:${ACTUAL_SHA}"
echo "✅  checksum verified: $PACKAGE_CHECKSUM"

# ---------------------------------------------------------------- stage

if [[ -z "$PACKAGE_DIR" ]]; then
  PACKAGE_DIR="$(mktemp -d -t agent-config-hermetic-XXXXXX)"
fi
mkdir -p "$PACKAGE_DIR"
echo "📦  staging tarball into $PACKAGE_DIR"
tar -xzf "$TARBALL" -C "$PACKAGE_DIR"

# npm pack produces a top-level `package/` directory.
STAGED="$PACKAGE_DIR/package"
[[ -d "$STAGED" ]] || {
  echo "❌  staged dir missing expected 'package/' subdir: $STAGED" >&2
  exit 4
}

if [[ -z "$PACKAGE_VERSION" ]] && [[ -f "$STAGED/package.json" ]]; then
  # Pull the literal value bound to the "version" key, not the next
  # quoted token on the same line (which is the package name when
  # package.json is single-line).
  PACKAGE_VERSION="$(
    sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$STAGED/package.json" | head -n 1
  )"
fi
[[ -n "$PACKAGE_VERSION" ]] || {
  echo "❌  could not determine package version" >&2
  exit 4
}

# ---------------------------------------------------------------- install.ts

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "🟡  --dry-run: skipping install.ts invocation"
  echo "    would invoke: scripts/install.ts --offline --package-dir=$STAGED"
  echo "    installation_mode=hermetic"
  echo "    package_checksum=$PACKAGE_CHECKSUM"
  echo "    signature_verified=$SIGNATURE_VERIFIED"
  exit 0
fi

# install.ts is shipped inside the staged package — invoke that
# copy, not whatever happens to be in $PWD.
INSTALL_TS="$STAGED/scripts/install.ts"
[[ -f "$INSTALL_TS" ]] || {
  echo "❌  install.ts not found in staged package: $INSTALL_TS" >&2
  exit 4
}

# Resolve tsx from the staged package's node_modules, else fall back to npx.
if [[ -x "$STAGED/node_modules/.bin/tsx" ]]; then
  TSX_BIN="$STAGED/node_modules/.bin/tsx"
elif command -v npx >/dev/null 2>&1; then
  TSX_BIN="npx tsx"
else
  echo "❌  tsx runner not found (no node_modules/.bin/tsx in staged package, no npx on PATH)" >&2
  exit 4
fi

echo "🚀  invoking install.ts --offline --package-dir=$STAGED"
# Pass the hermetic metadata via environment so install.ts can record
# the additive lockfile fields without changing its CLI surface.
# shellcheck disable=SC2086
AGENT_CONFIG_INSTALLATION_MODE="hermetic" \
AGENT_CONFIG_PACKAGE_CHECKSUM="$PACKAGE_CHECKSUM" \
AGENT_CONFIG_SIGNATURE_VERIFIED="$SIGNATURE_VERIFIED" \
AGENT_CONFIG_PACKAGE_VERSION="$PACKAGE_VERSION" \
$TSX_BIN "$INSTALL_TS" --offline --package-dir="$STAGED" || {
  echo "❌  install.ts exited non-zero" >&2
  exit 4
}

echo "✅  verified-offline install complete (version $PACKAGE_VERSION)"
