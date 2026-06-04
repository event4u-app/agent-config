#!/usr/bin/env python3
"""Tool-agnostic skill-registration probe.

Roadmap: road-to-clean-skill-distribution-channels.md § Phase C.
Contract: docs/contracts/skill-distribution-channels.md.

Surfaces every skill registered for any of the six supported AI tools
across user-global, project-local, and plugin-manifest sources. Flags
``DUPLICATE`` (same skill name registered in ≥ 2 sources) and ``DRIFT``
(same name, different description-hash or version). Both shapes are the
class of bug that opened road-to-clean-skill-distribution-channels.md
on 2026-05-25.

CLI:

    python3 scripts/probe_skill_registration.py
    python3 scripts/probe_skill_registration.py --tool=claude --format=json
    python3 scripts/probe_skill_registration.py --strict

``--strict`` flips the exit code: 0 if no DUPLICATE / DRIFT findings,
non-zero otherwise. Without ``--strict`` the script is informational
(always exits 0).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

TOOL_IDS = ("claude", "augment", "cursor", "cline", "windsurf", "copilot")
SCOPE_IDS = ("user", "project")


@dataclass(frozen=True)
class Registration:
    """One row in the probe table — a single (skill_id, scope, source) tuple."""
    skill_id: str
    tool: str
    scope: str
    source_path: str
    version: str
    description_snippet: str
    description_hash: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass
class ProbeResult:
    registrations: list[Registration] = field(default_factory=list)
    duplicates: dict[str, list[Registration]] = field(default_factory=dict)
    drift: dict[str, list[Registration]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "registrations": [r.to_dict() for r in self.registrations],
            "duplicates": {k: [r.to_dict() for r in v] for k, v in self.duplicates.items()},
            "drift": {k: [r.to_dict() for r in v] for k, v in self.drift.items()},
        }


# ---------------------------------------------------------------------------
# Frontmatter + version helpers
# ---------------------------------------------------------------------------

def _read_frontmatter(skill_md: Path) -> dict[str, str]:
    """Minimal YAML frontmatter extractor — no PyYAML dependency."""
    try:
        text = skill_md.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return {}
    rest = text.split("---", 2)
    if len(rest) < 3:
        return {}
    body = rest[1]
    out: dict[str, str] = {}
    for line in body.splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def _hash_desc(desc: str) -> str:
    return hashlib.sha256(desc.encode("utf-8", "replace")).hexdigest()[:12]


def _snippet(desc: str, n: int = 80) -> str:
    desc = desc.strip()
    return desc if len(desc) <= n else desc[: n - 1] + "…"


def _version_at(root: Path) -> str:
    """Read a 'this install's version' value from package.json / plugin.json."""
    for candidate in (root / "package.json", root / ".augment-plugin" / "plugin.json"):
        if not candidate.is_file():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
            v = data.get("version")
            if isinstance(v, str) and v:
                return v
        except (OSError, json.JSONDecodeError):
            continue
    return "unknown"


# ---------------------------------------------------------------------------
# Per-tool readers
# ---------------------------------------------------------------------------

def _iter_skill_md(skills_root: Path) -> Iterable[Path]:
    if not skills_root.is_dir():
        return
    for entry in sorted(skills_root.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        if skill_md.is_file():
            yield skill_md


def _read_claude(scope: str, root: Path) -> Iterable[Registration]:
    skills = root / ".claude" / "skills"
    for skill_md in _iter_skill_md(skills):
        fm = _read_frontmatter(skill_md)
        name = fm.get("name") or skill_md.parent.name
        desc = fm.get("description", "")
        yield Registration(
            skill_id=name,
            tool="claude",
            scope=scope,
            source_path=str(skill_md),
            version=_version_at(root),
            description_snippet=_snippet(desc),
            description_hash=_hash_desc(desc),
        )
    # Plugin manifest at the same scope. Each entry is a path string into
    # the same .claude/skills/ tree; emit it as a separate "manifest" row so
    # duplicate-detection catches manifest-vs-filesystem double-counting.
    manifest = root / ".claude-plugin" / "marketplace.json"
    if manifest.is_file():
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            plugins = data.get("plugins") or []
            entries: list[str] = []
            for plug in plugins:
                entries.extend(plug.get("skills") or [])
            for entry in entries:
                # The entry is a path string; resolve the name from the path.
                tail = Path(entry).name
                yield Registration(
                    skill_id=tail,
                    tool="claude",
                    scope=f"{scope}-plugin",
                    source_path=str(manifest),
                    version=_version_at(root),
                    description_snippet="(plugin manifest entry)",
                    description_hash="manifest",
                )
        except (OSError, json.JSONDecodeError):
            pass


def _read_augment(scope: str, root: Path) -> Iterable[Registration]:
    skills = root / ".augment" / "skills"
    for skill_md in _iter_skill_md(skills):
        fm = _read_frontmatter(skill_md)
        name = fm.get("name") or skill_md.parent.name
        desc = fm.get("description", "")
        yield Registration(
            skill_id=name,
            tool="augment",
            scope=scope,
            source_path=str(skill_md),
            version=_version_at(root),
            description_snippet=_snippet(desc),
            description_hash=_hash_desc(desc),
        )


def _read_cursor(scope: str, root: Path) -> Iterable[Registration]:
    rules = root / ".cursor" / "rules"
    if not rules.is_dir():
        return
    for rule in sorted(rules.glob("*.mdc")):
        fm = _read_frontmatter(rule)
        name = fm.get("name") or rule.stem
        desc = fm.get("description", "")
        yield Registration(
            skill_id=name,
            tool="cursor",
            scope=scope,
            source_path=str(rule),
            version=_version_at(root),
            description_snippet=_snippet(desc),
            description_hash=_hash_desc(desc),
        )


def _read_cline(scope: str, root: Path) -> Iterable[Registration]:
    rules = root / ".clinerules"
    if not rules.is_dir():
        return
    for rule in sorted(rules.glob("*.md")):
        fm = _read_frontmatter(rule)
        name = fm.get("name") or rule.stem
        desc = fm.get("description", "")
        yield Registration(
            skill_id=name,
            tool="cline",
            scope=scope,
            source_path=str(rule),
            version=_version_at(root),
            description_snippet=_snippet(desc),
            description_hash=_hash_desc(desc),
        )


def _read_windsurf(scope: str, root: Path) -> Iterable[Registration]:
    rules = root / ".windsurf" / "rules"
    if not rules.is_dir():
        return
    for rule in sorted(rules.glob("*.md")):
        fm = _read_frontmatter(rule)
        name = fm.get("name") or rule.stem
        desc = fm.get("description", "")
        yield Registration(
            skill_id=name,
            tool="windsurf",
            scope=scope,
            source_path=str(rule),
            version=_version_at(root),
            description_snippet=_snippet(desc),
            description_hash=_hash_desc(desc),
        )


def _read_copilot(scope: str, root: Path) -> Iterable[Registration]:
    # Copilot ships a single file; check both common locations.
    for candidate in (
        root / ".github" / "copilot-instructions.md",
        root / "copilot-instructions.md",
    ):
        if not candidate.is_file():
            continue
        try:
            text = candidate.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        snippet = _snippet(text.split("\n", 1)[0] if text else "")
        yield Registration(
            skill_id="copilot-instructions",
            tool="copilot",
            scope=scope,
            source_path=str(candidate),
            version=_version_at(root),
            description_snippet=snippet,
            description_hash=_hash_desc(text),
        )


TOOL_READERS = {
    "claude":   _read_claude,
    "augment":  _read_augment,
    "cursor":   _read_cursor,
    "cline":    _read_cline,
    "windsurf": _read_windsurf,
    "copilot":  _read_copilot,
}


# ---------------------------------------------------------------------------
# Probe
# ---------------------------------------------------------------------------

def run_probe(
    *,
    tool_filter: str = "all",
    scope_filter: str = "all",
    home: Path | None = None,
    project: Path | None = None,
) -> ProbeResult:
    home = home or Path(os.environ.get("HOME", "/tmp"))
    project = project or Path.cwd()

    scopes: dict[str, Path] = {}
    if scope_filter in ("all", "user"):
        scopes["user"] = home
    if scope_filter in ("all", "project"):
        scopes["project"] = project

    tools = TOOL_IDS if tool_filter == "all" else (tool_filter,)

    result = ProbeResult()
    for scope, root in scopes.items():
        for tool in tools:
            reader = TOOL_READERS.get(tool)
            if reader is None:
                continue
            for reg in reader(scope, root):
                result.registrations.append(reg)

    # Group by (tool, skill_id). Anything with ≥ 2 entries is DUPLICATE.
    # If their description hashes diverge, also flag DRIFT.
    by_key: dict[tuple[str, str], list[Registration]] = {}
    for reg in result.registrations:
        by_key.setdefault((reg.tool, reg.skill_id), []).append(reg)

    for (tool, skill_id), regs in by_key.items():
        if len(regs) < 2:
            continue
        key = f"{tool}:{skill_id}"
        result.duplicates[key] = regs
        hashes = {r.description_hash for r in regs if r.description_hash != "manifest"}
        versions = {r.version for r in regs if r.version != "unknown"}
        if len(hashes) > 1 or len(versions) > 1:
            result.drift[key] = regs

    return result


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_text(result: ProbeResult) -> str:
    lines: list[str] = []
    lines.append("Skill-registration probe")
    lines.append("=" * 64)
    lines.append("")
    if not result.registrations:
        lines.append("(no registrations found)")
        return "\n".join(lines)

    lines.append(f"{'TOOL':<10} {'SCOPE':<14} {'SKILL':<32} {'VER':<10} SOURCE")
    lines.append("-" * 100)
    for reg in result.registrations:
        lines.append(
            f"{reg.tool:<10} {reg.scope:<14} {reg.skill_id[:32]:<32} {reg.version:<10} {reg.source_path}"
        )

    if result.duplicates:
        lines.append("")
        lines.append("DUPLICATE — same skill registered in ≥ 2 sources")
        lines.append("-" * 64)
        for key, regs in result.duplicates.items():
            lines.append(f"  {key}")
            for r in regs:
                lines.append(f"    - [{r.scope}/{r.version}] {r.source_path}")
    if result.drift:
        lines.append("")
        lines.append("DRIFT — same skill registered with DIFFERENT description / version")
        lines.append("-" * 64)
        for key, regs in result.drift.items():
            lines.append(f"  {key}")
            for r in regs:
                lines.append(f"    - [{r.scope}/{r.version}] hash={r.description_hash} desc={r.description_snippet!r}")
                lines.append(f"      source: {r.source_path}")

    return "\n".join(lines)


def render_json(result: ProbeResult) -> str:
    return json.dumps(result.to_dict(), indent=2)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="probe_skill_registration",
        description="Detect duplicate / drifting skill registrations across AI tools.",
    )
    parser.add_argument("--tool", choices=("all", *TOOL_IDS), default="all")
    parser.add_argument("--scope", choices=("all", *SCOPE_IDS), default="all")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument(
        "--strict", action="store_true",
        help="Exit non-zero if any DUPLICATE / DRIFT finding is present.",
    )
    parser.add_argument("--home", type=Path, default=None, help="Override the user-global root (testing).")
    parser.add_argument("--project", type=Path, default=None, help="Override the project root (testing).")
    args = parser.parse_args(argv)

    result = run_probe(
        tool_filter=args.tool,
        scope_filter=args.scope,
        home=args.home,
        project=args.project,
    )

    out = render_json(result) if args.format == "json" else render_text(result)
    print(out)

    if args.strict and (result.duplicates or result.drift):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
