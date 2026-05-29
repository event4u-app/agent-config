#!/usr/bin/env python3
"""Fail when an artefact carries a frontmatter field equal to its schema default.

Phase 3 guardrail of `road-to-abstraction-reduction.md`: a reduction without a
linter re-accumulates on the next contribution. This is the inverse of
`scripts/migrate_frontmatter_defaults.py` — it reports every field that the
migration *would* drop (present AND value == schema default) so the author
omits it instead.

The frontmatter loader (`validate_frontmatter.apply_schema_defaults`) injects
the default at read time, so omitting the field is always behaviour-preserving.

CLI:
  python3 scripts/lint_frontmatter_boilerplate.py [--quiet]

Exit codes: 0 clean · 1 at least one boilerplate field present.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import load_schema, parse_frontmatter  # noqa: E402
from migrate_frontmatter_defaults import _CATEGORIES, _iter, _plan_drops  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def _violations(path: Path, schema: dict) -> list[str]:
    text = path.read_text(encoding="utf-8")
    fm, _ = parse_frontmatter(text)
    if not isinstance(fm, dict):
        return []
    top, full, partial = _plan_drops(fm, schema)
    fields: list[str] = sorted(top) + sorted(full)
    for block, subs in sorted(partial.items()):
        fields.extend(f"{block}.{s}" for s in sorted(subs))
    return fields


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    total = 0
    offenders = 0
    for subdir, glob, schema_name in _CATEGORIES:
        schema = load_schema(schema_name)
        for path in _iter(subdir, glob):
            total += 1
            fields = _violations(path, schema)
            if fields:
                offenders += 1
                rel = path.relative_to(ROOT).as_posix()
                print(
                    f"❌  {rel}: frontmatter field(s) equal to schema default — "
                    f"omit them: {', '.join(fields)}"
                )

    if offenders:
        print(
            f"\n== frontmatter-boilerplate: {offenders}/{total} artefact(s) carry a "
            "defaulted field. Omit it (the loader injects the default) or run "
            "`python3 scripts/migrate_frontmatter_defaults.py`. ==",
            file=sys.stderr,
        )
        return 1
    if not args.quiet:
        print(f"✅  lint-frontmatter-boilerplate: {total} artefact(s) clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
