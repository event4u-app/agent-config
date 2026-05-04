#!/usr/bin/env python3
"""lint_showcase_sessions.py — gate `docs/showcase.md` ↔ `docs/showcase/sessions/`.

Phase 1.6 deliverable for `road-to-feedback-consolidation.md`.

Rules:
  1. Every `docs/showcase/sessions/<slug>.log` reference inside
     `docs/showcase.md` must point to an existing file.
  2. Every referenced session file must carry a YAML frontmatter block
     containing at minimum `commit_sha` and a `metrics:` mapping (the
     four outcome-baseline metrics; values may be null but the keys
     must be present per `scripts/capture_showcase_session.py`).
  3. Every file under `docs/showcase/sessions/` must be referenced
     from `docs/showcase.md` — orphans are not allowed.

When `docs/showcase/sessions/` is empty AND `docs/showcase.md` carries
no session references, the linter exits 0 (clean — Phase 1.3-1.5 are
deferred to manual host-agent runs).

Exit codes:
  0  clean
  1  one or more violations
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOWCASE_MD = ROOT / "docs" / "showcase.md"
SESSIONS_DIR = ROOT / "docs" / "showcase" / "sessions"

REQUIRED_METRICS = {
    "tool_call_count",
    "reply_chars_mean",
    "memory_hit_ratio",
    "verify_pass_rate",
}

REF_RE = re.compile(r"docs/showcase/sessions/([A-Za-z0-9_\-]+)\.log")


def _parse_frontmatter(text: str) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    block: dict[str, str] = {}
    current_key: str | None = None
    nested: dict[str, str] = {}
    for raw in text[4:end].splitlines():
        if not raw.strip():
            continue
        if raw.startswith("  ") and current_key:
            k, _, v = raw.strip().partition(":")
            nested[k.strip()] = v.strip()
            continue
        if ":" not in raw:
            continue
        k, _, v = raw.partition(":")
        v = v.strip()
        if not v:
            current_key = k.strip()
            nested = {}
            block[current_key] = ""
            block[f"_{current_key}_nested"] = nested  # type: ignore[assignment]
        else:
            block[k.strip()] = v
            current_key = None
    return block


def _validate_session(slug: str) -> list[str]:
    errors: list[str] = []
    path = SESSIONS_DIR / f"{slug}.log"
    if not path.is_file():
        errors.append(f"referenced session missing on disk: {path.relative_to(ROOT)}")
        return errors
    text = path.read_text(encoding="utf-8")
    fm = _parse_frontmatter(text)
    if fm is None:
        errors.append(f"{slug}.log: no YAML frontmatter block")
        return errors
    if not fm.get("commit_sha"):
        errors.append(f"{slug}.log: missing or empty `commit_sha`")
    metrics = fm.get("_metrics_nested")
    if not isinstance(metrics, dict):
        errors.append(f"{slug}.log: missing `metrics:` mapping")
    else:
        missing = REQUIRED_METRICS - set(metrics.keys())
        if missing:
            errors.append(
                f"{slug}.log: metrics block missing keys: {sorted(missing)}"
            )
    return errors


def main() -> int:
    if not SHOWCASE_MD.is_file():
        print(f"❌  {SHOWCASE_MD.relative_to(ROOT)} not found", file=sys.stderr)
        return 1

    text = SHOWCASE_MD.read_text(encoding="utf-8")
    referenced = set(REF_RE.findall(text))

    on_disk: set[str] = set()
    if SESSIONS_DIR.is_dir():
        on_disk = {p.stem for p in SESSIONS_DIR.glob("*.log")}

    errors: list[str] = []

    for slug in sorted(referenced):
        errors.extend(_validate_session(slug))

    orphans = on_disk - referenced
    for slug in sorted(orphans):
        errors.append(
            f"orphan session: docs/showcase/sessions/{slug}.log "
            f"is not referenced from docs/showcase.md"
        )

    if errors:
        print(
            f"❌  lint_showcase_sessions: {len(errors)} violation(s) "
            f"({len(referenced)} referenced, {len(on_disk)} on disk)",
            file=sys.stderr,
        )
        for err in errors:
            print(f"    {err}", file=sys.stderr)
        return 1

    if not referenced and not on_disk:
        print(
            "✅  lint_showcase_sessions: 0 sessions referenced, 0 on disk "
            "(Phase 1.3-1.5 deferred to manual host-agent runs)"
        )
    else:
        print(
            f"✅  lint_showcase_sessions: {len(referenced)} session(s) "
            f"valid ({len(on_disk)} on disk)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
