#!/usr/bin/env python3
"""Differential-test driver for the value_ladder / value_report TS twins.

ADR-088 parity gate 2 (golden replay). Reads a JSON request from stdin of
the shape ``{"fn": <name>, "args": [...]}`` and writes the Python function's
result to stdout as canonical JSON (sorted keys) so the vitest twin can
assert TS == Python byte-for-byte over the scoring / rendering contract.

Supported functions (value_ladder, pure):
  price_tokens_eur, price_input_delta_eur, price_output_delta_eur,
  load_rung_from_router, load_rung_from_frugality, load_rung_from_projection,
  thin_rung_from_projection, condense_rung_from_telegraph_v2,
  rtk_rung_from_report, terse_rung_from_telegraph_v1,
  selection_metric_from_dev_reports, destructive_stops_metric,
  ask_vs_act_metric, completion_metric, assemble_ladder, compute_totals,
  pending_rung, baseline_rung

Supported functions (value_report):
  render_md_dump   (args: [report_dict])
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys

DRIVER = pathlib.Path(__file__).resolve()
REPO_ROOT = DRIVER.parents[2]
# value_report.py uses `from _lib.value_ladder import ...` (and a
# `from scripts._lib...` fallback); put both prefixes on the path so the
# absolute import resolves, exactly like the pytest fixture environment.
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
sys.path.insert(0, str(REPO_ROOT))
LADDER_PATH = REPO_ROOT / "src" / "scripts" / "_lib" / "value_ladder.py"
REPORT_PATH = REPO_ROOT / "src" / "scripts" / "_lib" / "value_report.py"


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


L = _load_module("value_ladder", LADDER_PATH)
R = _load_module("value_report", REPORT_PATH)


def _dispatch(fn, args):
    if fn == "price_tokens_eur":
        return L.price_tokens_eur(*args)
    if fn == "price_input_delta_eur":
        return L.price_input_delta_eur(*args)
    if fn == "price_output_delta_eur":
        return L.price_output_delta_eur(*args)
    if fn == "load_rung_from_router":
        return L.load_rung_from_router(*args)
    if fn == "load_rung_from_frugality":
        return L.load_rung_from_frugality(*args)
    if fn == "load_rung_from_projection":
        return L.load_rung_from_projection(*args)
    if fn == "thin_rung_from_projection":
        return L.thin_rung_from_projection(*args)
    if fn == "condense_rung_from_telegraph_v2":
        return L.condense_rung_from_telegraph_v2(*args)
    if fn == "rtk_rung_from_report":
        return L.rtk_rung_from_report(*args)
    if fn == "terse_rung_from_telegraph_v1":
        return L.terse_rung_from_telegraph_v1(*args)
    if fn == "selection_metric_from_dev_reports":
        return L.selection_metric_from_dev_reports(*args)
    if fn == "destructive_stops_metric":
        return L.destructive_stops_metric(*args)
    if fn == "ask_vs_act_metric":
        return L.ask_vs_act_metric(*args)
    if fn == "completion_metric":
        return L.completion_metric(*args)
    if fn == "assemble_ladder":
        return L.assemble_ladder(*args)
    if fn == "compute_totals":
        return L.compute_totals(*args)
    if fn == "pending_rung":
        return L.pending_rung(*args)
    if fn == "baseline_rung":
        return L.baseline_rung(*args)
    if fn == "render_md_dump":
        return R.render_md_dump(*args)
    raise SystemExit(f"unknown function: {fn}")


def main() -> int:
    req = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    fn = req["fn"]
    args = req.get("args", [])
    result = _dispatch(fn, args)
    # render_md_dump returns a str; everything else returns JSON-serialisable
    # dicts / lists / numbers. Emit as JSON so the harness can compare the
    # decoded value (str stays a str under json).
    sys.stdout.write(json.dumps(result, sort_keys=True))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
