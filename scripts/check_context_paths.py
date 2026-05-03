#!/usr/bin/env python3
"""Context-file path & orphan checker.

Validates that every `*.md` under `.agent-src.uncompressed/contexts/`:

1. Lives in a locked sub-tree (or is one of six grandfathered root files).
2. Does not collide on basename with another context file in another sub-tree.
3. Is referenced by at least one rule, skill, command, or other context
   (via `load_context:` frontmatter or a markdown body path mention).

Contract: docs/contracts/context-paths.md
Roadmap:  road-to-structural-optimization.md § 0.6

Exit codes: 0 = clean, 1 = violations, 3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTEXTS_ROOT = ROOT / ".agent-src.uncompressed" / "contexts"

# Sub-trees that may contain context files. Update in lock-step with
# docs/contracts/context-paths.md whenever a roadmap revision adds one.
LOCKED_SUBTREES = (
    "communication/rules-always",
    "communication/rules-auto",
    "judges",
    "analysis",
    "skills",
    "chat-history",
    "execution",
    "authority",
)

# Files allowed to remain at the contexts root. Anything else at the root
# fails the path check. New context files MUST live in a sub-tree.
GRANDFATHERED_ROOT_FILES = frozenset({
    "augment-infrastructure.md",
    "documentation-hierarchy.md",
    "model-recommendations.md",
    "override-system.md",
    "skills-and-commands.md",
    "subagent-configuration.md",
})

# Directories whose content we scan for references to a context file.
# `agents/roadmaps` is included because in-flight roadmap docs are
# legitimate referrers during multi-phase rollouts — a context can land
# in phase N while its first rule/skill referrer lands in phase N+k.
# Without this scan dir, every newly-introduced context would orphan
# until the consuming artefact lands, blocking phase-by-phase commits.
REFERENCE_SCAN_DIRS = (
    ".agent-src.uncompressed/rules",
    ".agent-src.uncompressed/skills",
    ".agent-src.uncompressed/commands",
    ".agent-src.uncompressed/contexts",
    "agents/roadmaps",
)


@dataclass
class Violation:
    file: str
    kind: str          # "out-of-tree" | "root-not-grandfathered" | "collision" | "orphan"
    detail: str


def _collect_contexts(root: Path) -> list[Path]:
    if not (root / CONTEXTS_ROOT.relative_to(ROOT)).exists():
        return []
    return sorted((root / CONTEXTS_ROOT.relative_to(ROOT)).rglob("*.md"))


def _check_path(ctx: Path, contexts_root: Path) -> Violation | None:
    rel = ctx.relative_to(contexts_root)
    parts = rel.parts
    if len(parts) == 1:
        if parts[0] not in GRANDFATHERED_ROOT_FILES:
            return Violation(
                file=str(ctx),
                kind="root-not-grandfathered",
                detail=(f"new file at contexts/ root — must live in one of "
                        f"{sorted(LOCKED_SUBTREES)} or be added to "
                        "GRANDFATHERED_ROOT_FILES via a roadmap revision"),
            )
        return None
    subtree = "/".join(parts[:-1])
    # Allow nested matches: e.g. communication/rules-always/foo/bar.md still
    # lives under "communication/rules-always". Direct prefix match suffices.
    for allowed in LOCKED_SUBTREES:
        if subtree == allowed or subtree.startswith(allowed + "/"):
            return None
    return Violation(
        file=str(ctx),
        kind="out-of-tree",
        detail=(f"sub-tree '{subtree}' is not in LOCKED_SUBTREES — see "
                "docs/contracts/context-paths.md to add a new sub-tree"),
    )


def _check_collisions(contexts: list[Path], contexts_root: Path) -> list[Violation]:
    by_name: dict[str, list[Path]] = {}
    for ctx in contexts:
        by_name.setdefault(ctx.name, []).append(ctx)
    out: list[Violation] = []
    for name, paths in by_name.items():
        if len(paths) <= 1:
            continue
        rels = sorted(str(p.relative_to(contexts_root)) for p in paths)
        for p in paths:
            out.append(Violation(
                file=str(p),
                kind="collision",
                detail=f"basename '{name}' shared with: {', '.join(r for r in rels if r != str(p.relative_to(contexts_root)))}",
            ))
    return out


def _build_reference_corpus(root: Path) -> str:
    chunks: list[str] = []
    for d in REFERENCE_SCAN_DIRS:
        base = root / d
        if not base.exists():
            continue
        for f in base.rglob("*.md"):
            try:
                chunks.append(f.read_text(encoding="utf-8"))
            except OSError:
                continue
    return "\n".join(chunks)


def _check_orphans(contexts: list[Path], corpus: str, root: Path) -> list[Violation]:
    out: list[Violation] = []
    for ctx in contexts:
        rel_src = str(ctx.relative_to(root))                       # .agent-src.uncompressed/contexts/...
        rel_short = rel_src.split("contexts/", 1)[-1]               # judges/persona-voice-rubric.md
        candidates = (rel_src, f"contexts/{rel_short}", rel_short)
        # Exclude self-references: drop this file's own content from the
        # corpus check by reading the file and subtracting its substring.
        try:
            own_text = ctx.read_text(encoding="utf-8")
        except OSError:
            own_text = ""
        external_corpus = corpus.replace(own_text, "") if own_text else corpus
        if not any(c in external_corpus for c in candidates):
            out.append(Violation(
                file=str(ctx),
                kind="orphan",
                detail="not referenced by any rule, skill, command, or other context",
            ))
    return out


def scan(root: Path) -> list[Violation]:
    contexts_root = root / CONTEXTS_ROOT.relative_to(ROOT)
    contexts = _collect_contexts(root)
    violations: list[Violation] = []
    for ctx in contexts:
        v = _check_path(ctx, contexts_root)
        if v:
            violations.append(v)
    violations.extend(_check_collisions(contexts, contexts_root))
    corpus = _build_reference_corpus(root)
    violations.extend(_check_orphans(contexts, corpus, root))
    return violations


def format_text(violations: list[Violation]) -> str:
    if not violations:
        return "✅  No context-path violations."
    lines = [f"❌  Found {len(violations)} context-path violation(s):\n"]
    for v in violations:
        lines.append(f"  🔴 [{v.kind}] {v.file}\n      {v.detail}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        violations = scan(args.root)
    except Exception as e:    # pragma: no cover
        print(f"Internal error: {e}", file=sys.stderr)
        return 3
    if args.format == "json":
        print(json.dumps([asdict(v) for v in violations], indent=2))
    else:
        print(format_text(violations))
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
