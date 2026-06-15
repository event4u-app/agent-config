#!/usr/bin/env python3
"""Generate the cross-host capability matrix (road-to-competitive-borrow P1.3).

"What artifact type works on which host" — derived from the live
``generate_tools()`` projection logic in ``condense.py``, never hand-maintained.

Derivation:
  - Imports ``condense`` and reads ``inspect.getsource(_generate_tools_inner)``;
    every ``generate_*(...)`` call in the dispatcher is the ground truth for
    which generator runs and which ``_tool_active("<host>")`` gate guards it.
  - ``_FN_SPEC`` maps each generator to (artifact_type, host(s), mechanism).
  - **Coverage guard:** every ``generate_*`` call parsed from the dispatcher
    MUST appear in ``_FN_SPEC``. A new generator added to ``condense.py``
    without a matching ``_FN_SPEC`` entry fails this script (and CI via
    ``--check``) — that is the "never silently drift" guarantee.

Cell vocabulary:
  - ``native``   — the host consumes the artifact directly (symlink / native dir).
  - ``adapter``  — projected through a host-specific transform (.mdc, workflow,
                   aggregated single file).
  - ``none``     — no generator emits this artifact for this host.

Output (deterministic — no timestamp, so ``--check`` is stable):
  - ``docs/capability-matrix.md``            (human-readable)
  - ``dist/discovery/capability-matrix.json`` (machine-readable, per-host cells)

Usage:
    python3 scripts/generate_capability_matrix.py
    python3 scripts/generate_capability_matrix.py --check   # fail if out of date
"""
from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import condense  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT_MD = ROOT / "docs" / "capability-matrix.md"
OUT_JSON = ROOT / "dist" / "discovery" / "capability-matrix.json"

# Canonical host order for presentation. Sourced from condense._ALL_TOOLS plus
# the committed Claude plugin marketplace (always projected, ADR-040).
HOSTS = [
    "claude-code", "claude-plugin", "augment", "cursor",
    "windsurf", "cline", "gemini", "copilot", "claude-desktop",
]

ARTIFACTS = ["rules", "skills", "commands", "personas", "user-types", "hooks"]

# Each condense.py dispatcher generator → what it emits, for which host(s),
# via which mechanism. Universal generators (symlink fan-out to every host
# that consumes the artifact) list all consuming hosts explicitly. This is the
# one place the host×artifact mechanism is asserted; the coverage guard below
# fails if condense.py grows a generator absent here.
_FN_SPEC: dict[str, dict] = {
    # universal symlink fan-outs
    "generate_rule_symlinks": {
        "artifact": "rules",
        # .claude/rules, .cursor/rules (.mdc), .clinerules, .windsurfrules,
        # GEMINI.md — symlink dirs are native; transformed/aggregated are adapter.
        "cells": {"claude-code": "native", "augment": "native", "cline": "native",
                  "cursor": "adapter", "windsurf": "adapter", "gemini": "adapter"},
    },
    "generate_persona_symlinks": {
        "artifact": "personas",
        "cells": {"claude-code": "native", "cursor": "native", "augment": "native"},
    },
    "generate_user_type_symlinks": {
        "artifact": "user-types",
        "cells": {"claude-code": "native", "cursor": "native", "augment": "native"},
    },
    # host-gated generators
    "generate_windsurfrules": {"artifact": "rules", "cells": {"windsurf": "adapter"}},
    "generate_windsurf_modern_rules": {"artifact": "rules", "cells": {"windsurf": "adapter"}},
    "generate_windsurf_workflows": {"artifact": "commands", "cells": {"windsurf": "adapter"}},
    "generate_gemini_md": {"artifact": "rules", "cells": {"gemini": "adapter"}},
    "generate_claude_skills": {
        "artifact": "skills",
        "cells": {"claude-code": "native", "augment": "native"},
    },
    "generate_claude_commands": {
        "artifact": "commands",
        "cells": {"claude-code": "native", "augment": "native"},
    },
    "generate_plugin_command_skills": {
        "artifact": "skills", "cells": {"claude-plugin": "native"},
    },
    "generate_plugin_hooks": {"artifact": "hooks", "cells": {"claude-plugin": "native"}},
    "generate_cursor_mdc_rules": {"artifact": "rules", "cells": {"cursor": "adapter"}},
    "generate_cursor_commands": {"artifact": "commands", "cells": {"cursor": "adapter"}},
}

# Surfaces the INSTALLER provides outside generate_tools() (so the derivation
# guard stays pure). Marked with a † footnote in the rendered matrix.
_INSTALL_TIME_CELLS: dict[str, dict[str, str]] = {
    "rules": {"copilot": "adapter"},  # .github/copilot-instructions.md (aggregated, install.py)
}

_CALL_RE = re.compile(r"\b(generate_[A-Za-z0-9_]+)\s*\(")


def parse_dispatcher_generators() -> set[str]:
    """Ground truth: every generate_* call inside _generate_tools_inner."""
    src = inspect.getsource(condense._generate_tools_inner)
    return set(_CALL_RE.findall(src))


def build_matrix() -> dict[str, dict[str, str]]:
    """matrix[artifact][host] = mechanism (native|adapter|adapter†|none)."""
    matrix = {a: {h: "none" for h in HOSTS} for a in ARTIFACTS}
    for spec in _FN_SPEC.values():
        artifact = spec["artifact"]
        for host, mech in spec["cells"].items():
            cur = matrix[artifact][host]
            # native wins over adapter if two generators target the same cell
            if cur == "none" or (cur == "adapter" and mech == "native"):
                matrix[artifact][host] = mech
    # Install-time surfaces (installer, not generate_tools) — only fill empties.
    for artifact, cells in _INSTALL_TIME_CELLS.items():
        for host, mech in cells.items():
            if matrix[artifact][host] == "none":
                matrix[artifact][host] = mech + "†"
    return matrix


def coverage_guard() -> list[str]:
    """Return generators present in the dispatcher but missing from _FN_SPEC."""
    return sorted(parse_dispatcher_generators() - set(_FN_SPEC))


_GLYPH = {
    "native": "✅ native", "adapter": "🔁 adapter", "none": "— none",
    "adapter†": "🔁 adapter †",
}


def render_md(matrix: dict[str, dict[str, str]]) -> str:
    lines = [
        "# Capability matrix — what works on which host",
        "",
        "> **Generated** by `scripts/generate_capability_matrix.py` — do NOT",
        "> hand-edit. Derived from the `generate_tools()` projection logic in",
        "> `condense.py` (each cell traces to a `generate_*` dispatcher call).",
        "> Drift-checked in CI (`--check`).",
        "",
        "Cells: **✅ native** (host consumes the artifact directly — symlink /",
        "native dir) · **🔁 adapter** (projected through a host-specific",
        "transform — `.mdc`, workflow, or an aggregated single file) · **— none**",
        "(no generator emits this artifact for this host).",
        "",
        "| Artifact | " + " | ".join(HOSTS) + " |",
        "|---|" + "---|" * len(HOSTS),
    ]
    for a in ARTIFACTS:
        row = [f"`{a}`"] + [_GLYPH[matrix[a][h]] for h in HOSTS]
        lines.append("| " + " | ".join(row) + " |")
    lines += [
        "",
        "## How to read this",
        "",
        "- Projection is **intentionally asymmetric** — a `— none` cell is a",
        "  design choice, not a bug. Skills project natively only where a host",
        "  has a native skill surface; everywhere else the rules + commands",
        "  carry the behaviour.",
        "- `🔁 adapter` cells are real coverage through a host-native shape",
        "  (Cursor `.mdc`, Windsurf workflows, the aggregated `GEMINI.md`).",
        "- `†` marks an **install-time** surface the installer writes (e.g.",
        "  `.github/copilot-instructions.md`), not the `generate_tools()` path —",
        "  real coverage, different code path.",
        "",
    ]
    return "\n".join(lines).rstrip() + "\n"


def render_json(matrix: dict[str, dict[str, str]]) -> str:
    payload = {
        "schema": "capability-matrix/1",
        "generated_by": "scripts/generate_capability_matrix.py",
        "hosts": HOSTS,
        "artifacts": ARTIFACTS,
        "matrix": matrix,
    }
    body = json.dumps(payload, indent=2, sort_keys=True)
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    payload["checksum"] = f"sha256:{digest}"
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail if outputs are out of date")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    missing = coverage_guard()
    if missing:
        print(
            "❌  generate_capability_matrix: condense.py dispatcher has "
            f"generator(s) not mapped in _FN_SPEC: {missing}. Add an _FN_SPEC "
            "entry so the matrix stays derived (never silently drift).",
            file=sys.stderr,
        )
        return 1

    matrix = build_matrix()
    md = render_md(matrix)
    js = render_json(matrix)

    if args.check:
        # Only the tracked doc is drift-checked. dist/discovery/ is gitignored
        # (ephemeral build tree like discovery-manifest.json) — its JSON is
        # rendered from the same deterministic matrix dict, so a current MD
        # implies a current JSON on regeneration.
        if (OUT_MD.read_text(encoding="utf-8") if OUT_MD.is_file() else "") != md:
            print(
                "generate_capability_matrix: stale — run "
                f"`python3 scripts/generate_capability_matrix.py` ({OUT_MD.relative_to(ROOT)})",
                file=sys.stderr,
            )
            return 1
        if not args.quiet:
            print("generate_capability_matrix: OK — docs/capability-matrix.md up to date")
        return 0

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(md, encoding="utf-8")
    OUT_JSON.write_text(js, encoding="utf-8")
    if not args.quiet:
        print(f"generate_capability_matrix: wrote {OUT_MD.relative_to(ROOT)} "
              f"+ {OUT_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
