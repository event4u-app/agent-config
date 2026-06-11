#!/usr/bin/env python3
"""Differential-test driver for the YAML round-trip spike.

Reads YAML text from stdin (UTF-8, binary-safe so CRLF survives),
runs it through ``src/scripts/sync_yaml_rt.parse`` -> ``emit``, and
writes the result to stdout byte-for-byte.

Invoked by ``tests/spikes/yaml_rt_spike.test.ts`` via child_process to
compare the Python reference output against the TypeScript spike port.
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "scripts"))

import sync_yaml_rt as rt  # noqa: E402


def main() -> int:
    text = sys.stdin.buffer.read().decode("utf-8")
    out = rt.emit(rt.parse(text))
    sys.stdout.buffer.write(out.encode("utf-8"))
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
