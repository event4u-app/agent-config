#!/usr/bin/env python3
"""`agent-config use --profile=<id>` — switch the active experience.

The explicit profile-switch entry point named by the Execution-Model ADR
(`docs/decisions/ADR-040-execution-model-projection-time-filtering.md`) and
wired in `road-to-6.0.0-a-positioning-and-validation` Phase 2 / Step 8.

In 6.0.0-A this writes `profile.id` into the canonical project
`.agent-settings.yml` and prints what changed — it does **NOT** narrow what
gets projected into the tool trees. Pack-scoped surfacing (projection-time
filtering) activates in 6.0.0-B behind a staged, opt-in rollout. This command
is the stable seam that 6.0.0-B hooks projection into.

Comment-preserving: the canonical settings file is hand-editable and richly
commented, so the write is a surgical text edit of the `profile:` block, not a
yaml round-trip that would strip comments.

CLI:
    agent-config use --profile=<id>
    agent-config use --profile <id>

Valid ids (the six seed profiles, docs/contracts/profile-system.md):
    developer · content_creator · founder · agency · finance · ops
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_settings import (  # noqa: E402
    canonical_settings_write_path,
    find_project_root,
)

VALID_PROFILES = (
    "developer",
    "content_creator",
    "founder",
    "agency",
    "finance",
    "ops",
)

# Matches a top-level `profile:` block and the `id:` leaf under it. The id
# value may be bare, single-, or double-quoted; we only rewrite the value.
_PROFILE_ID_RE = re.compile(
    r"(?m)^(?P<head>profile:[ \t]*\n(?:[ \t]+#[^\n]*\n|[ \t]*\n)*"
    r"[ \t]+id:[ \t]*)(?P<val>[^\n#]*)",
)


def _resolve_write_path() -> Path:
    cwd = Path.cwd()
    root = find_project_root(cwd) or cwd
    return canonical_settings_write_path(root)


def _set_profile_id(text: str, profile_id: str) -> tuple[str, str | None]:
    """Return (new_text, previous_id). Append a block if none exists."""
    m = _PROFILE_ID_RE.search(text)
    if m:
        previous = m.group("val").strip().strip("'\"") or None
        new_text = text[: m.start("val")] + profile_id + text[m.end("val") :]
        return new_text, previous
    # No profile block — append one. Keep a single trailing newline.
    block = f"\n# --- Profile (experience) ---\nprofile:\n  id: {profile_id}\n"
    sep = "" if text.endswith("\n") else "\n"
    return text + sep + block, None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config use",
        description="Switch the active experience/profile (writes profile.id).",
    )
    parser.add_argument(
        "--profile",
        metavar="ID",
        help=f"Experience to switch to. One of: {', '.join(VALID_PROFILES)}.",
    )
    args = parser.parse_args(argv)

    if not args.profile:
        print(
            "❌  `use` requires --profile=<id>. Valid: "
            + " · ".join(VALID_PROFILES),
            file=sys.stderr,
        )
        return 2

    profile_id = args.profile.strip()
    if profile_id not in VALID_PROFILES:
        print(
            f"❌  unknown profile `{profile_id}`. Valid: "
            + " · ".join(VALID_PROFILES),
            file=sys.stderr,
        )
        return 2

    path = _resolve_write_path()
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    new_text, previous = _set_profile_id(text, profile_id)

    if previous == profile_id and path.exists():
        print(f"✅  Already on experience `{profile_id}` — no change ({path}).")
        return 0

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_text, encoding="utf-8")

    arrow = f"`{previous}` → `{profile_id}`" if previous else f"`{profile_id}`"
    print(f"✅  Experience set to {arrow} in {path}.")
    print(
        "ℹ️   6.0.0-A records the choice only — it does not yet narrow what is "
        "projected into .claude/ .cursor/ .augment/. Pack-scoped surfacing "
        "(ADR-040) activates in 6.0.0-B behind a staged, opt-in rollout."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
