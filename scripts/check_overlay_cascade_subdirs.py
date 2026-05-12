#!/usr/bin/env python3
"""Guard: ``CASCADE_ELIGIBLE_KINDS`` / ``USER_GLOBAL_OVERLAY_KINDS`` ↔ docs.

Phase 1 of road-to-portable-runtime-and-update-check (P1.6). The
overlay resolver in :mod:`scripts._lib.agents_overlay` ships two
constants that gate which ``agents/<kind>/`` subdirs participate in
the cascade and which of those may live at the user-global layer.
The same lists are restated in
``docs/customization.md`` § *"agents/ overlay cascade"* so consumers
can see them without reading source.

Drift between code and docs is the failure mode this guard catches.

Exit codes: 0 = clean, 1 = drift detected, 3 = internal error.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(REPO_ROOT))

from scripts._lib.agents_overlay import (  # noqa: E402
    CASCADE_ELIGIBLE_KINDS,
    USER_GLOBAL_OVERLAY_KINDS,
)

DOCS_PATH = REPO_ROOT / "docs" / "customization.md"

# Match `agents/<kind>/` in the first column of the overlay table, plus
# the ✅/❌ markers in columns 2 and 3.
ROW_RE = re.compile(
    r"^\|\s*`agents/([a-z][a-z0-9_-]*)/`\s*\|\s*(✅|❌)[^|]*\|\s*(✅|❌)[^|]*\|",
)


def _parse_doc_table(text: str) -> tuple[set[str], set[str], set[str]]:
    """Return (all-kinds-listed, cascade-yes, user-global-yes) from the table."""
    all_kinds: set[str] = set()
    cascade_yes: set[str] = set()
    user_global_yes: set[str] = set()
    for line in text.splitlines():
        match = ROW_RE.match(line)
        if not match:
            continue
        kind, cascade_mark, user_mark = match.groups()
        all_kinds.add(kind)
        if cascade_mark == "✅":
            cascade_yes.add(kind)
        if user_mark == "✅":
            user_global_yes.add(kind)
    return all_kinds, cascade_yes, user_global_yes


def main() -> int:
    if not DOCS_PATH.is_file():
        print(f"❌  {DOCS_PATH} not found", file=sys.stderr)
        return 3
    text = DOCS_PATH.read_text(encoding="utf-8")
    _, doc_cascade, doc_user_global = _parse_doc_table(text)

    errors: list[str] = []

    code_cascade = set(CASCADE_ELIGIBLE_KINDS)
    if doc_cascade != code_cascade:
        only_code = sorted(code_cascade - doc_cascade)
        only_doc = sorted(doc_cascade - code_cascade)
        if only_code:
            errors.append(
                "CASCADE_ELIGIBLE_KINDS has entries missing from "
                f"docs/customization.md table: {only_code}",
            )
        if only_doc:
            errors.append(
                "docs/customization.md table marks these as cascade-eligible "
                f"but the code list does not: {only_doc}",
            )

    code_user_global = set(USER_GLOBAL_OVERLAY_KINDS)
    if doc_user_global != code_user_global:
        only_code = sorted(code_user_global - doc_user_global)
        only_doc = sorted(doc_user_global - code_user_global)
        if only_code:
            errors.append(
                "USER_GLOBAL_OVERLAY_KINDS has entries missing from "
                f"docs/customization.md table: {only_code}",
            )
        if only_doc:
            errors.append(
                "docs/customization.md table marks these as user-global-eligible "
                f"but the code list does not: {only_doc}",
            )

    # Sanity: user-global subset of cascade-eligible.
    if not code_user_global.issubset(code_cascade):
        errors.append(
            "USER_GLOBAL_OVERLAY_KINDS must be a subset of "
            f"CASCADE_ELIGIBLE_KINDS; surplus: "
            f"{sorted(code_user_global - code_cascade)}",
        )

    if errors:
        print("❌  agents/ overlay cascade drift detected:", file=sys.stderr)
        for err in errors:
            print(f"   - {err}", file=sys.stderr)
        print(
            "\nFix: update either scripts/_lib/agents_overlay.py "
            "or docs/customization.md so they agree.",
            file=sys.stderr,
        )
        return 1

    print(
        f"✅  agents/ overlay cascade in sync · "
        f"{len(code_cascade)} cascade-eligible, "
        f"{len(code_user_global)} user-global-eligible",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
