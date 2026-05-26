#!/usr/bin/env python3
"""Plan + apply the physical monorepo migration (Phase 4).

Reads every `.md` artefact under `.agent-src.uncondensed/`, decides
its destination under `packages/core/` or `packages/pack-<id>/` using
the deterministic rules from
`agents/roadmaps/monorepo-phase-4-physical-package-layout.md` § Mapping
rules, and emits `dist/migration/move-plan.json`.

CLI:
  --dry-run   (default) emit the plan JSON only; no FS changes
  --apply     execute the moves via `git mv` (history-preserving)

Schema: see docs/contracts/move-plan.schema.json (added in this phase).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".agent-src.uncondensed"
PACKAGES = ROOT / "packages"
CORE = PACKAGES / "core" / ".agent-src.uncondensed"
VOCAB_DIR = ROOT / "config" / "discovery"
PLAN_OUT = ROOT / "dist" / "migration" / "move-plan.json"
UNASSIGNED_YAML = VOCAB_DIR / "unassigned-artefacts.yml"

# Locked kernel — `docs/contracts/kernel-membership.md` § 4. Pinned to
# core regardless of frontmatter (sanity check, not duplication).
KERNEL_RULES = frozenset({
    "agent-authority",
    "ask-when-uncertain",
    "commit-policy",
    "direct-answers",
    "language-and-tone",
    "no-cheap-questions",
    "non-destructive-by-default",
    "scope-control",
    "verify-before-complete",
    "user-interrupt-priority",  # admitted post-P2.2
})

# Non-frontmatter trees that follow the host package (core) by default.
# Scaffold templates, profiles, presets, contexts, user-types, scripts,
# ghostwriter, packs — none of these carry pack metadata.
CORE_DIRS = (
    "templates",
    "profiles",
    "presets",
    "contexts",
    "user-types",
    "scripts",
    "ghostwriter",
    "packs",
    "personas",
)


def _load_pack_ids() -> set[str]:
    packs = yaml.safe_load((VOCAB_DIR / "packs.yml").read_text(encoding="utf-8")) or []
    return {p["id"] for p in packs}


def _load_unassigned() -> dict[str, str]:
    raw = yaml.safe_load(UNASSIGNED_YAML.read_text(encoding="utf-8")) or []
    return {e["path"]: e["reason"] for e in raw}


def _is_core(fm: dict[str, Any] | None, stem: str) -> bool:
    if stem in KERNEL_RULES:
        return True
    if fm is None:
        return False
    trust = fm.get("trust") or {}
    install = fm.get("install") or {}
    return (
        trust.get("level") == "core"
        and install.get("removable") is False
    )


def _primary_pack(fm: dict[str, Any] | None) -> str | None:
    """Round-2 council refinement R1: explicit ``primary_pack:`` wins over
    ``packs[0]`` fallback. The ``primary_pack`` lint lands in Phase 4.4.
    """
    if not fm:
        return None
    explicit = fm.get("primary_pack")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()
    packs = fm.get("packs")
    if not isinstance(packs, list) or not packs:
        return None
    return packs[0]


def _dest_for(src: Path, fm: dict[str, Any] | None, pack_ids: set[str]) -> tuple[Path, str, str | None]:
    """Return (destination_path, reason, conflict_reason_or_None)."""
    rel = src.relative_to(SRC)
    parts = rel.parts
    top = parts[0] if parts else ""

    # Non-frontmatter trees → core verbatim.
    if top in CORE_DIRS:
        return CORE / rel, f"core dir: {top}/", None

    stem = src.stem if src.name != "SKILL.md" else src.parent.name

    if _is_core(fm, stem):
        reason = "kernel rule" if stem in KERNEL_RULES else "trust.level=core + install.removable=false"
        return CORE / rel, reason, None

    primary = _primary_pack(fm)
    if primary is None:
        return CORE / rel, "no primary pack — falling back to core", "missing primary pack"
    if primary not in pack_ids:
        return CORE / rel, f"unknown pack '{primary}' — falling back to core", f"unknown pack: {primary}"
    if primary == "meta":
        # meta = package-internal scaffolding; lives in core alongside the kernel.
        return CORE / rel, "primary pack: meta (package internals → core)", None

    dest_root = PACKAGES / f"pack-{primary}" / ".agent-src.uncondensed"
    return dest_root / rel, f"primary pack: {primary}", None


# Filesystem artefacts that must never be moved (runtime caches, scratch).
_SKIP_DIR_NAMES = frozenset({".pytest_cache", "__pycache__", ".mypy_cache",
                              ".ruff_cache", "node_modules", ".DS_Store"})


def _should_skip(p: Path) -> bool:
    return any(part in _SKIP_DIR_NAMES for part in p.parts)


def _gitignored(paths: list[Path]) -> set[Path]:
    """Return the subset of paths matched by .gitignore (runtime artefacts,
    eval last-run.json, caches, …). These never participate in `git mv`."""
    if not paths:
        return set()
    rel = [p.relative_to(ROOT).as_posix() for p in paths]
    result = subprocess.run(
        ["git", "check-ignore", "--stdin"],
        cwd=ROOT,
        input="\n".join(rel),
        capture_output=True,
        text=True,
    )
    # check-ignore exits 0 when at least one path matched, 1 when none, >1 on error.
    if result.returncode > 1:
        return set()
    ignored = {line.strip() for line in result.stdout.splitlines() if line.strip()}
    return {ROOT / r for r in rel if r in ignored}


def _iter_artefacts() -> list[Path]:
    """Every source file under SRC. Includes non-md so the plan covers
    the full tree (templates/, scripts/, packs/, hooks, .gitattributes
    fragments, …). Runtime caches and gitignored files are excluded.
    """
    paths: list[Path] = []
    for p in sorted(SRC.rglob("*")):
        if not p.is_file():
            continue
        if _should_skip(p):
            continue
        paths.append(p)
    ignored = _gitignored(paths)
    return [p for p in paths if p not in ignored]


def _find_owning_skill_fm(src: Path) -> dict[str, Any] | None:
    """For a non-SKILL.md file under skills/<name>/, return the sibling SKILL.md frontmatter.

    Looks first at the source location (pre-move) and then under
    ``packages/*/.agent-src.uncondensed/skills/<name>/SKILL.md`` so the
    planner can resume mid-migration when the parent SKILL.md has already
    been relocated.
    """
    if "skills" not in src.parts:
        return None
    idx = src.parts.index("skills")
    if idx + 1 >= len(src.parts):
        return None
    skill_name = src.parts[idx + 1]
    candidates = [ROOT / Path(*src.parts[: idx + 2]) / "SKILL.md"]
    pkgs_root = ROOT / "packages"
    if pkgs_root.exists():
        for pkg in pkgs_root.iterdir():
            cand = pkg / ".agent-src.uncondensed" / "skills" / skill_name / "SKILL.md"
            if cand.exists():
                candidates.append(cand)
    for cand in candidates:
        if cand.exists():
            parsed, _ = parse_frontmatter(cand.read_text(encoding="utf-8", errors="replace"))
            if isinstance(parsed, dict):
                return parsed
    return None


def _build_plan() -> dict[str, Any]:
    pack_ids = _load_pack_ids()
    unassigned = _load_unassigned()
    moves: list[dict[str, Any]] = []
    stays_in_core: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    for src in _iter_artefacts():
        rel_src = src.relative_to(ROOT).as_posix()
        fm: dict[str, Any] | None = None
        # Only .md files carry artefact frontmatter. Non-md files (yaml,
        # python, php, hooks, .gitattributes fragments, …) inherit their
        # placement from the parent directory or sibling SKILL.md.
        if src.suffix == ".md":
            try:
                text = src.read_text(encoding="utf-8", errors="replace")
                parsed, _ = parse_frontmatter(text)
                if isinstance(parsed, dict):
                    fm = parsed
            except Exception as exc:  # noqa: BLE001
                conflicts.append({"path": rel_src, "reason": f"parse error: {exc}"})
                continue

        # Quarantined scaffolds → core, no conflict.
        if rel_src in unassigned and fm is None:
            dest = CORE / src.relative_to(SRC)
            stays_in_core.append({
                "from": rel_src,
                "to": dest.relative_to(ROOT).as_posix(),
                "reason": f"unassigned scaffold: {unassigned[rel_src]}",
            })
            continue

        # Skill auxiliary files (sub-pages, prompt fragments) inherit the
        # parent SKILL.md's pack/trust. They never carry their own frontmatter.
        inherited = False
        if fm is None and src.name != "SKILL.md":
            owner_fm = _find_owning_skill_fm(src)
            if owner_fm is not None:
                fm = owner_fm
                inherited = True

        dest, reason, conflict = _dest_for(src, fm, pack_ids)
        if inherited:
            reason = f"inherits parent SKILL.md → {reason}"
        entry = {
            "from": rel_src,
            "to": dest.relative_to(ROOT).as_posix(),
            "reason": reason,
        }
        if conflict:
            conflicts.append({"path": rel_src, "reason": conflict, "fallback_to": entry["to"]})
        if dest.is_relative_to(CORE):
            stays_in_core.append(entry)
        else:
            moves.append(entry)

    return {
        "schema_version": "1",
        "source_root": SRC.relative_to(ROOT).as_posix(),
        "packages_root": PACKAGES.relative_to(ROOT).as_posix(),
        "totals": {
            "moves": len(moves),
            "stays_in_core": len(stays_in_core),
            "conflicts": len(conflicts),
        },
        "moves": moves,
        "stays_in_core": stays_in_core,
        "conflicts": conflicts,
    }


def _write_plan(plan: dict[str, Any]) -> None:
    PLAN_OUT.parent.mkdir(parents=True, exist_ok=True)
    PLAN_OUT.write_text(
        json.dumps(plan, indent=2, sort_keys=False, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _apply(plan: dict[str, Any]) -> int:
    """Execute every move + stay via `git mv` so history follows.

    Idempotent: entries whose source is already absent and whose
    destination already exists are silently skipped. This lets a
    partial run be resumed without rewinding the worktree.
    """
    if plan["conflicts"]:
        print(f"ERROR: {len(plan['conflicts'])} unresolved conflict(s); refusing --apply.", file=sys.stderr)
        return 2

    all_entries = plan["moves"] + plan["stays_in_core"]
    moved = 0
    skipped = 0
    for entry in all_entries:
        src = ROOT / entry["from"]
        dst = ROOT / entry["to"]
        if not src.exists():
            if dst.exists():
                skipped += 1
                continue
            print(f"ERROR: source missing AND destination missing: {entry['from']}", file=sys.stderr)
            return 3
        dst.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["git", "mv", str(src), str(dst)],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"ERROR: git mv failed: {entry['from']} -> {entry['to']}\n{result.stderr}", file=sys.stderr)
            return 4
        moved += 1
    print(f"Applied {moved} moves, skipped {skipped} already-moved entries.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="Execute moves via git mv (default: dry-run only)")
    ap.add_argument("--out", type=Path, default=PLAN_OUT, help="Plan JSON output path")
    args = ap.parse_args()

    plan = _build_plan()
    PLAN_OUT.parent.mkdir(parents=True, exist_ok=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(plan, indent=2, sort_keys=False, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Plan: {args.out.relative_to(ROOT)}")
    print(f"  moves         : {plan['totals']['moves']}")
    print(f"  stays_in_core : {plan['totals']['stays_in_core']}")
    print(f"  conflicts     : {plan['totals']['conflicts']}")

    if args.apply:
        return _apply(plan)

    return 1 if plan["conflicts"] else 0


if __name__ == "__main__":
    sys.exit(main())
