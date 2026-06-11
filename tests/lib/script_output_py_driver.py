#!/usr/bin/env python3
"""Differential-test driver for the script_output TS twin (ADR-088 parity gate).

Usage: ``script_output_py_driver.py <settings_path|-> <env_json>``

Imports the real ``scripts._lib.script_output`` module from ``<repo>/src``
(``sys.path.insert(0, <repo>/src)`` — the same module the pytest suite uses),
applies ``<env_json>`` to ``os.environ`` (keys with a null value are deleted),
resets the cached level, resolves it against ``<settings_path>`` (``-`` means
``None`` → the CWD-relative default), and writes the resolved level plus the
exported ``AGENT_SCRIPT_VERBOSITY`` value to stdout as JSON so
``tests/lib/script_output.test.ts`` can assert TS == Python over the settings
cascade + env-precedence contract.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

DRIVER = pathlib.Path(__file__).resolve()
REPO_ROOT = DRIVER.parents[2]
sys.path.insert(0, str(REPO_ROOT / "src"))

from scripts._lib import script_output as so  # noqa: E402


def main() -> int:
    settings_arg = sys.argv[1]
    env_json = sys.argv[2] if len(sys.argv) > 2 else "{}"

    overrides = json.loads(env_json)
    for key, value in overrides.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value

    so.reset_level()
    settings_path = None if settings_arg == "-" else pathlib.Path(settings_arg)
    level = so.resolve_level(settings_path)

    result = {"level": level, "exported": os.environ.get(so.ENV_VAR)}
    sys.stdout.write(json.dumps(result, sort_keys=True))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
