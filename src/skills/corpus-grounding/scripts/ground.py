#!/usr/bin/env python3
"""corpus-grounding · ground — CLI entry point (interface v1).

Usage (paths resolve skill-relative — works from ANY cwd; see
docs/contracts/skill-bundled-assets.md for the invocation contract):

  # Search one domain of a corpus (auto-detects domain when omitted):
  python3 ground.py search --manifest <path/to/manifest.json> "fintech dashboard"
  python3 ground.py search --manifest m.json --domain color "muted palette" --json

  # Structured pre-filter before ranking:
  python3 ground.py search --manifest m.json --filter "Severity=HIGH" "forms"

  # Stack axis:
  python3 ground.py search --manifest m.json --stack react "memo rerender"

  # Conditional grounding (tier 2 — reasoning plan + decision rules):
  python3 ground.py ground --manifest m.json "luxury e-commerce" [--persist DIR]

  # Validate a manifest:
  python3 ground.py validate --manifest m.json

Pure stdlib · read-only except --persist · no network · no subprocess.
Ported CLI surface from nextlevelbuilder/ui-ux-pro-max-skill `search.py`
@ b7e3af80f6e331f6fb456667b82b12cade7c9d35 · MIT · last checked 2026-06-07.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Skill-relative import: the engine modules sit beside this file.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from decision_engine import ground as run_ground  # noqa: E402
from decision_engine import persist_grounding, search_domain, search_stack  # noqa: E402
from schema_validator import ManifestError, load_manifest, validate_manifest  # noqa: E402


def _parse_filters(pairs: list[str]) -> dict:
    filters: dict = {}
    for pair in pairs or []:
        if "=" not in pair:
            raise SystemExit(f"--filter expects COLUMN=VALUE, got: {pair!r}")
        col, value = pair.split("=", 1)
        filters.setdefault(col, [])
        filters[col].append(value)
    return {k: (v if len(v) > 1 else v[0]) for k, v in filters.items()}


def _format_search(result: dict) -> str:
    if result.get("error"):
        return f"Error: {result['error']}"
    out = ["## Corpus search results"]
    head = f"**Domain:** {result.get('stack') or result.get('domain')} | **Query:** {result.get('query')}"
    out.append(head)
    conf = result.get("confidence") or {}
    out.append(
        f"**Source:** {result.get('file')} | **Found:** {result.get('count')} "
        f"| **Confidence:** {conf.get('label')} ({conf.get('score')})"
    )
    out.append("")
    for i, row in enumerate(result.get("results") or [], 1):
        out.append(f"### Result {i}")
        for key, value in row.items():
            value_str = str(value)
            if len(value_str) > 300:
                value_str = value_str[:300] + "…"
            if value_str:
                out.append(f"- **{key}:** {value_str}")
        out.append("")
    gaps = result.get("evidence_gap") or []
    if gaps:
        out.append("### Evidence gap")
        out.extend(f"- {g}" for g in gaps)
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ground", description=__doc__)
    sub = parser.add_subparsers(dest="op", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--manifest", required=True, help="Path to the domain manifest.json")
    common.add_argument("--json", action="store_true", help="Emit raw JSON")

    p_search = sub.add_parser("search", parents=[common], help="Search one corpus domain")
    p_search.add_argument("query")
    p_search.add_argument("--domain", "-d", help="Domain (auto-detected when omitted)")
    p_search.add_argument("--stack", "-s", help="Stack axis instead of a domain")
    p_search.add_argument("--max-results", "-n", type=int, default=None)
    p_search.add_argument(
        "--filter", action="append", default=[], metavar="COLUMN=VALUE",
        help="Structured pre-filter before ranking (repeatable)",
    )
    p_search.add_argument(
        "--retriever", choices=["bm25", "structured", "hybrid"], default=None,
        help="Override the manifest's retriever",
    )

    p_ground = sub.add_parser("ground", parents=[common], help="Conditional grounding")
    p_ground.add_argument("query")
    p_ground.add_argument("--context", help="JSON object of context flags for rule evaluation")
    p_ground.add_argument("--persist", metavar="DIR", help="Write MASTER.md (+ page override) under DIR")
    p_ground.add_argument("--project-name", "-p", default=None)
    p_ground.add_argument("--page", default=None)

    p_validate = sub.add_parser("validate", parents=[common], help="Validate a manifest")

    args = parser.parse_args(argv)

    try:
        if args.op == "validate":
            raw = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
            errors = validate_manifest(raw)
            if errors:
                print("INVALID manifest:")
                for err in errors:
                    print(f"  - {err}")
                return 1
            print("OK — manifest satisfies contract v1")
            return 0

        manifest = load_manifest(Path(args.manifest))
        if args.retriever if hasattr(args, "retriever") else None:
            manifest["retriever"] = args.retriever

        if args.op == "search":
            if args.stack:
                result = search_stack(
                    manifest, args.query, args.stack,
                    args.max_results or 3, _parse_filters(args.filter) or None,
                )
            else:
                result = search_domain(
                    manifest, args.query, args.domain,
                    args.max_results, _parse_filters(args.filter) or None,
                )
            print(json.dumps(result, indent=2, ensure_ascii=False) if args.json
                  else _format_search(result))
            return 0 if not result.get("error") else 1

        # ground
        context = json.loads(args.context) if args.context else {}
        grounded = run_ground(manifest, args.query, context)
        if args.persist:
            info = persist_grounding(
                grounded, Path(args.persist), args.project_name, args.page
            )
            grounded["persisted"] = info
        if args.json:
            print(json.dumps(grounded, indent=2, ensure_ascii=False))
        else:
            from decision_engine import _render_markdown
            print(_render_markdown(grounded))
        return 0
    except (ManifestError, json.JSONDecodeError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
