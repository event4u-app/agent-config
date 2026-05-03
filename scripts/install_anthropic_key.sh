#!/usr/bin/env bash
# Interactive Anthropic-API-key installer for scripts/skill_trigger_eval.py.
#
# Reads the key with `read -s` so it never echoes to the terminal and
# never lands in shell history or scrollback. Writes atomically to
# ~/.config/agent-config/anthropic.key with mode 0600.
#
# Contract — companion to scripts/skill_trigger_eval.py:
#   - File path:  $HOME/.config/agent-config/anthropic.key
#   - File mode:  0600 (owner read/write only)
#   - Key format: must start with `sk-ant-`
#   - No --force, no --yes, no env-var bypass. Piped stdin is rejected.
#
# The runner re-checks all of the above at every live invocation and
# refuses to run if the file drifts from this contract.

set -euo pipefail

TARGET_DIR="${HOME}/.config/agent-config"
TARGET_FILE="${TARGET_DIR}/anthropic.key"

# ── controlling-terminal requirement ─────────────────────────────────────
# We read from /dev/tty directly (fd 3), not from stdin. This is the
# stricter and more portable contract:
#   - works under `task`, `script`, `sudo`, anything that reattaches stdin
#   - forces every character to come from the user's real keyboard, so a
#     pipe or redirected file cannot smuggle the key into the process
#   - exits cleanly if there is no controlling terminal at all (e.g. CI,
#     cron, agent automation)
if ! exec 3</dev/tty 2>/dev/null; then
    echo "❌  install_anthropic_key.sh requires a controlling terminal." >&2
    echo "    /dev/tty not available \u2014 refusing to run under automation." >&2
    exit 2
fi

# ── overwrite confirmation ───────────────────────────────────────────────
if [[ -e "${TARGET_FILE}" ]]; then
    echo "⚠️   ${TARGET_FILE} already exists."
    printf "Overwrite? [type 'yes' to replace, anything else aborts]: "
    read -r -u 3 answer
    if [[ "${answer}" != "yes" ]]; then
        echo "Aborted. Existing key untouched."
        exit 0
    fi
fi

# ── read key (no echo, no history) ───────────────────────────────────────
echo "Paste your Anthropic API key (input is hidden, no echo)."
echo "The key should start with 'sk-ant-'."
printf "Key: "
# -s = silent (no echo), read from fd 3 = /dev/tty, not stdin.
read -r -s -u 3 API_KEY
echo

if [[ -z "${API_KEY}" ]]; then
    echo "❌  Empty input — no file written." >&2
    exit 2
fi

if [[ "${API_KEY}" != sk-ant-* ]]; then
    echo "❌  Input does not look like an Anthropic key (missing 'sk-ant-' prefix)." >&2
    echo "    No file written." >&2
    exit 2
fi

# ── create config dir with 0700, atomic write with 0600 ──────────────────
mkdir -p "${TARGET_DIR}"
chmod 0700 "${TARGET_DIR}"

TMP_FILE="$(mktemp "${TARGET_DIR}/.anthropic.key.XXXXXX")"
cleanup() { rm -f "${TMP_FILE}"; }
trap cleanup EXIT

# chmod the tmpfile BEFORE writing the key, so there is no window where
# the key sits on disk with group/other-readable permissions.
chmod 0600 "${TMP_FILE}"
printf '%s\n' "${API_KEY}" > "${TMP_FILE}"
mv "${TMP_FILE}" "${TARGET_FILE}"
trap - EXIT

# Clear the variable and the `mv` positional argument — defence in depth
# against a crash handler that dumps the process environment.
API_KEY=""

# ── verify mode post-write (portable stat: BSD on macOS, GNU on Linux) ───
if ACTUAL_MODE=$(stat -f '%Lp' "${TARGET_FILE}" 2>/dev/null); then
    :  # macOS / BSD
else
    ACTUAL_MODE=$(stat -c '%a' "${TARGET_FILE}")
fi

if [[ "${ACTUAL_MODE}" != "600" ]]; then
    echo "❌  Permissions verification failed: ${TARGET_FILE} has mode ${ACTUAL_MODE}, expected 600." >&2
    echo "    Delete and reinstall:  rm ${TARGET_FILE} && $0" >&2
    exit 3
fi

echo "✅  Key installed: ${TARGET_FILE} (mode 0600)."
echo "    Verify:  ls -la ${TARGET_FILE}"
echo "    Rotate:  rerun this script (you'll be prompted to overwrite)."
echo "    Remove:  rm ${TARGET_FILE}"
echo
echo "ℹ️   Key install ≠ enable. To use this provider in /council:"
echo "    set ai_council.enabled: true and ai_council.members.anthropic.enabled: true"
echo "    in .agent-settings.yml. Council is a 'full' cost_profile feature; under"
echo "    'minimal' / 'balanced' the runtime hooks stay inactive."
