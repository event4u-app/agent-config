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

# The `legacy-all` pseudo-profile: not an experience, but the projection
# escape hatch — restores the full (5.x) surface without changing profile.id.
LEGACY_ALL = "legacy-all"

# Matches a top-level `profile:` block and the `id:` leaf under it. The id
# value may be bare, single-, or double-quoted; we only rewrite the value.
_PROFILE_ID_RE = re.compile(
    r"(?m)^(?P<head>profile:[ \t]*\n(?:[ \t]+#[^\n]*\n|[ \t]*\n)*"
    r"[ \t]+id:[ \t]*)(?P<val>[^\n#]*)",
)

# Same shape for `projection:` → `mode:` (ADR-040 / road-to-6.0.0-B Step 8).
_PROJECTION_MODE_RE = re.compile(
    r"(?m)^(?P<head>projection:[ \t]*\n(?:[ \t]+#[^\n]*\n|[ \t]*\n)*"
    r"[ \t]+mode:[ \t]*)(?P<val>[^\n#]*)",
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


def _set_projection_mode(text: str, mode: str) -> tuple[str, str | None]:
    """Return (new_text, previous_mode). Append a block if none exists."""
    m = _PROJECTION_MODE_RE.search(text)
    if m:
        previous = m.group("val").strip().strip("'\"") or None
        new_text = text[: m.start("val")] + mode + text[m.end("val") :]
        return new_text, previous
    block = (
        "\n# --- Pack-scoped projection (ADR-040) ---\n"
        f"projection:\n  mode: {mode}\n"
    )
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
        help=(
            f"Experience to switch to. One of: {', '.join(VALID_PROFILES)} "
            f"— or `{LEGACY_ALL}` to restore the full (unscoped) surface."
        ),
    )
    args = parser.parse_args(argv)

    if not args.profile:
        print(
            "❌  `use` requires --profile=<id>. Valid: "
            + " · ".join((*VALID_PROFILES, LEGACY_ALL)),
            file=sys.stderr,
        )
        return 2

    profile_id = args.profile.strip()
    if profile_id != LEGACY_ALL and profile_id not in VALID_PROFILES:
        print(
            f"❌  unknown profile `{profile_id}`. Valid: "
            + " · ".join((*VALID_PROFILES, LEGACY_ALL)),
            file=sys.stderr,
        )
        return 2

    path = _resolve_write_path()
    text = path.read_text(encoding="utf-8") if path.exists() else ""

    # `legacy-all` is the projection escape hatch — flip projection.mode only,
    # leave the recorded experience (profile.id) untouched.
    if profile_id == LEGACY_ALL:
        new_text, prev_mode = _set_projection_mode(text, "legacy-all")
        if prev_mode == "legacy-all" and path.exists():
            print(f"✅  Already in `legacy-all` projection (full surface) — no change ({path}).")
            return 0
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(new_text, encoding="utf-8")
        print(f"✅  Projection set to `legacy-all` (full surface) in {path}.")
        print("ℹ️   Run `agent-config refresh` to re-project the full set.")
        return 0

    # A real experience: record the profile AND opt into scoped projection.
    new_text, previous = _set_profile_id(text, profile_id)
    new_text, _ = _set_projection_mode(new_text, "scoped")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_text, encoding="utf-8")

    arrow = f"`{previous}` → `{profile_id}`" if previous else f"`{profile_id}`"
    print(f"✅  Experience set to {arrow}; projection mode `scoped` in {path}.")
    print(
        "ℹ️   Run `agent-config refresh` to re-project only this profile's "
        "packs (plus any runtime overlay). `agent-config use "
        f"--profile={LEGACY_ALL}` restores the full surface."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
