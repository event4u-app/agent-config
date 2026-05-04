#!/usr/bin/env python3
"""Test fixture concern — exits 0 without emitting any stdout.

Used to verify the dispatcher infers decision/severity from the
exit code when stdout is empty (per stdout-contract: empty MAY).
"""
import sys

_ = sys.stdin.read() if not sys.stdin.isatty() else ""
sys.exit(0)
