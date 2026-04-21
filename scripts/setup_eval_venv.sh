#!/usr/bin/env bash
# Bootstrap .venv/ for the live trigger-eval runner.
#
# We install the anthropic SDK in an isolated virtualenv instead of the
# system Python so:
#   - the SDK never leaks into the user's global interpreter,
#   - no PYTHONPATH / sys.path surprises when other scripts import
#     parts of the repo,
#   - removal is `rm -rf .venv/` with no state elsewhere.
#
# The Taskfile target `task test-triggers-live` calls
# `.venv/bin/python3 scripts/skill_trigger_eval.py` directly, so the
# user never needs to `source .venv/bin/activate`.
#
# Idempotent: safe to rerun to refresh pins.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

VENV_DIR=".venv"
REQ_FILE="scripts/requirements-evals.txt"

if [[ ! -f "${REQ_FILE}" ]]; then
    echo "❌  ${REQ_FILE} missing — aborting."
    exit 2
fi

# Prefer python3.10+ if available; fall back to the system python3.
PY="python3"
for candidate in python3.12 python3.11 python3.10; do
    if command -v "${candidate}" >/dev/null 2>&1; then
        PY="${candidate}"
        break
    fi
done

if [[ ! -d "${VENV_DIR}" ]]; then
    echo "→ Creating ${VENV_DIR} with ${PY} ..."
    "${PY}" -m venv "${VENV_DIR}"
else
    echo "→ Reusing existing ${VENV_DIR}"
fi

echo "→ Upgrading pip ..."
"${VENV_DIR}/bin/pip" install --upgrade pip -q

echo "→ Installing pinned requirements from ${REQ_FILE} ..."
"${VENV_DIR}/bin/pip" install -q -r "${REQ_FILE}"

echo
"${VENV_DIR}/bin/python3" -c "import anthropic; print(f'✅  anthropic {anthropic.__version__}')"
"${VENV_DIR}/bin/python3" --version
echo
echo "Venv ready at ${REPO_ROOT}/${VENV_DIR}."
echo "Next:  task install-anthropic-key    # will prompt for your key"
echo "Then:  task test-triggers-live -- eloquent"
