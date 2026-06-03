#!/usr/bin/env python3
"""
Agent-config sync — condense .agent-src.uncondensed/ → .agent-src/
and project .agent-src/ → .augment/ (copies for rules by default,
symlinks for the rest; opt into rule symlinks via
augment.rules_use_symlinks in .agent-settings.yml).

Copies non-.md files as-is. Lists .md files that need condensation (done by the
Augment agent interactively). Tracks SHA-256 hashes of source files to detect
changes since last condensation.

Usage:
    python scripts/condense.py              # sync all non-.md files + cleanup + project
    python scripts/condense.py --list       # list .md files needing condensation
    python scripts/condense.py --changed    # list only .md files changed since last condensation
    python scripts/condense.py --check      # check if directories are in sync
    python scripts/condense.py --mark-done <relative-path>  # mark file as condensed (update hash)
    python scripts/condense.py --mark-all-done              # mark ALL .md files as condensed
    python scripts/condense.py --project-augment            # rebuild .augment/ projection
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.script_output import info, success, flush_summary, resolve_level  # noqa: E402
from _lib.agent_src import (  # noqa: E402
    artefact_roots,
    iter_all_sources,
    resolve_logical,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Legacy single-root anchor — kept for backward compatibility with callers
# that pass it explicitly. Multi-root iteration (post-ADR-017 physical
# move) goes through `_lib.agent_src` helpers.
SOURCE_DIR = PROJECT_ROOT / ".agent-src.uncondensed"
TARGET_DIR = PROJECT_ROOT / ".agent-src"
AUGMENT_DIR = PROJECT_ROOT / ".augment"
HASH_FILE = PROJECT_ROOT / "internal" / ".condensation-hashes.json"
SETTINGS_FILE = project_settings_path(PROJECT_ROOT)


def _iter_sources():
    """Yield (physical_path, logical_relpath) for every source artefact.

    Wraps `_lib.agent_src.iter_all_sources` so the condenseor walks every
    active source root (legacy `.agent-src.uncondensed/` plus any
    `packages/*/.agent-src.uncondensed/`) and keys outputs by the
    logical relative path that survives the physical move (ADR-017).
    """
    yield from iter_all_sources()


def _resolve_source(relative: str) -> Path | None:
    """Find the physical path that backs a logical relative path."""
    return resolve_logical(relative)


def _any_source_root_exists() -> bool:
    """True if at least one artefact source root contains files."""
    return bool(artefact_roots())

# Self-projection tool toggle — see agents/.agent-tools.yml. When the file is
# absent (e.g. tests run in tmp dirs, consumer projects), `_active_tools`
# returns ``None`` which is treated as "emit every tool".
_ALL_TOOLS = frozenset({
    "claude-code", "claude-desktop", "augment", "copilot",
    "cursor", "windsurf", "cline", "gemini",
})


def _active_tools() -> frozenset[str] | None:
    """Return the set of active self-projection tools, or None for "all".

    Reads `agents/.agent-tools.yml` relative to the current `PROJECT_ROOT`
    so test fixtures that monkey-patch `condense.PROJECT_ROOT` see their
    own (empty) project root and get the default "all tools" behaviour.
    """
    tools_file = PROJECT_ROOT / "agents" / ".agent-tools.yml"
    if not tools_file.exists():
        return None
    try:
        data = yaml.safe_load(tools_file.read_text()) or {}
    except yaml.YAMLError:
        return None
    tools = data.get("tools") if isinstance(data, dict) else None
    if not isinstance(tools, list):
        return None
    return frozenset(str(t) for t in tools if isinstance(t, str))


def _tool_active(tool_id: str) -> bool:
    """True when ``tool_id`` should be emitted by self-projection."""
    active = _active_tools()
    return True if active is None else tool_id in active

# Files to copy as-is even if .md (not condensed by agent)
COPY_AS_IS = {"README.md"}

# Directories (relative to SOURCE_DIR) whose .md content is data, not prose,
# and must be copied verbatim. Ghostwriter fixtures carry voice_samples that
# would be destroyed by telegraph condensation.
COPY_AS_IS_DIRS = frozenset({"ghostwriter"})


def _read_augment_rules_use_symlinks() -> bool:
    """Read augment.rules_use_symlinks from .agent-settings.yml.

    Returns True only when the setting is present under the top-level
    ``augment:`` block and resolves to a truthy value. Missing file,
    missing block, or any other value → False (preserve copy default).

    Centralized loader (road-to-portable-dev-preferences P3): tolerance
    contract handles missing file / malformed YAML / no PyYAML uniformly.
    """
    try:
        from scripts._lib.agent_settings import load_agent_settings
    except ImportError:  # pragma: no cover — script-style invocation
        import sys as _sys
        from pathlib import Path as _Path
        _sys.path.insert(0, str(_Path(__file__).resolve().parent))
        from _lib.agent_settings import load_agent_settings  # type: ignore[import-not-found]

    data = load_agent_settings(project_path=SETTINGS_FILE)
    augment = data.get("augment")
    if not isinstance(augment, dict):
        return False
    value = augment.get("rules_use_symlinks")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "on", "1")
    if isinstance(value, int):
        return value == 1
    return False


def _lean_projection_mode() -> str:
    """Read lean_projection.mode from .agent-settings.yml.

    `eager-all` (default) → every rule body inlined into every projection
    (today's behaviour). `thin` → kernel full-bodied + non-kernel rules as
    router-resolved pointers (lean-initial-context Phase 3.1; ~36k GPT tok
    lighter, measured). Missing / malformed → `eager-all`, so the thin path
    is strictly opt-in and one-flip-revertible (see docs/contracts/rule-router.md
    § Kill-switch). The flip MUST be live-A/B-validated before it ships as the
    default — a thin projection only holds behaviour if the agent resolves the
    pointer on trigger-match.
    """
    try:
        from scripts._lib.agent_settings import load_agent_settings
    except ImportError:  # pragma: no cover — script-style invocation
        import sys as _sys
        from pathlib import Path as _Path
        _sys.path.insert(0, str(_Path(__file__).resolve().parent))
        from _lib.agent_settings import load_agent_settings  # type: ignore[import-not-found]

    data = load_agent_settings(project_path=SETTINGS_FILE)
    lean = data.get("lean_projection")
    if isinstance(lean, dict) and str(lean.get("mode", "")).strip().lower() == "thin":
        return "thin"
    return "eager-all"


def file_hash(filepath: Path) -> str:
    """Return SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    h.update(filepath.read_bytes())
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Transitive include hashing (road-to-6.0.0-D Phase 0 Step 1)
#
# An artefact declares the skills / rules it includes via its frontmatter
# `skills:` / `rules:` lists. The condensation gate must treat that artefact
# as stale when an included skill/rule changes — otherwise a moved or edited
# dependency slips past the hash check silently (the single biggest risk the
# 6.0.0-D council named). `effective_hash` folds the content hash of every
# transitive include into the artefact's own content hash.
#
# Leaf artefacts (no declared includes) hash exactly like `file_hash`, so the
# stored hash table only changes for artefacts that actually declare deps —
# the migration stays contained.
# ---------------------------------------------------------------------------

_DEP_FRONTMATTER_KEYS = ("skills", "rules")


def _slug_to_logical(slug: str) -> str | None:
    """Map a skill / rule slug to its logical relative path, if it resolves.

    Skill slug ``foo`` → ``skills/foo/SKILL.md``; rule slug ``bar`` →
    ``rules/bar.md``. Returns the first candidate that backs a real source
    file, else ``None`` (a typo'd / external slug contributes no edge).
    """
    for cand in (f"skills/{slug}/SKILL.md", f"rules/{slug}.md"):
        if _resolve_source(cand) is not None:
            return cand
    return None


def _direct_includes(relative: str) -> list[str]:
    """Logical relpaths an artefact directly includes via frontmatter.

    Reads the artefact's ``skills:`` / ``rules:`` frontmatter lists and
    resolves each slug to a logical path. Non-resolving slugs are skipped.
    """
    source = _resolve_source(relative)
    if source is None:
        return []
    try:
        meta, _ = _parse_frontmatter(source.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return []
    deps: list[str] = []
    for key in _DEP_FRONTMATTER_KEYS:
        value = meta.get(key)
        if not isinstance(value, list):
            continue
        for item in value:
            if not isinstance(item, str):
                continue
            logical = _slug_to_logical(item.strip())
            if logical is not None and logical != relative:
                deps.append(logical)
    return deps


def effective_hash(relative: str, _seen: frozenset | None = None) -> str:
    """Content hash of an artefact folded with its transitive include hashes.

    Changes whenever the artefact's own bytes change OR any skill/rule it
    transitively includes changes. Cycle-safe: a slug that re-enters the
    current resolution chain folds only its own content hash, breaking the
    loop. Leaf artefacts (no includes) return exactly ``file_hash`` so the
    stored-hash migration is limited to artefacts that declare dependencies.
    """
    source = _resolve_source(relative)
    if source is None:
        return ""
    own = file_hash(source)
    if _seen is not None and relative in _seen:
        return own  # cycle — fold own content only
    deps = sorted(set(_direct_includes(relative)))
    if not deps:
        return own  # leaf — identical to plain file_hash
    seen_next = (_seen or frozenset()) | {relative}
    parts = [own] + [effective_hash(dep, seen_next) for dep in deps]
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def load_hashes() -> dict:
    """Load stored condensation hashes from JSON file."""
    if HASH_FILE.exists():
        try:
            return json.loads(HASH_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_hashes(hashes: dict) -> None:
    """Save condensation hashes to JSON file."""
    HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    HASH_FILE.write_text(json.dumps(hashes, indent=2, sort_keys=True) + "\n")


def mark_done(relative_path: str) -> None:
    """Mark a single file as condensed by storing its current source hash.

    Also runs the path rewriter on the just-written `.agent-src/<path>` so
    logical names from the source frontmatter resolve to deployment-correct
    relative paths in the shipped layer (P1 of road-to-path-fixes.md).
    Idempotent — re-running is a no-op.
    """
    source_file = _resolve_source(relative_path)
    if source_file is None or not source_file.exists():
        print(f"❌  Source file not found: {relative_path}")
        sys.exit(1)
    apply_path_rewriter(relative_path)
    hashes = load_hashes()
    hashes[relative_path] = effective_hash(relative_path)
    save_hashes(hashes)
    print(f"✅  Marked as condensed: {relative_path}")


def apply_path_rewriter(relative_path: str) -> bool:
    """Apply `_rewrite_paths` to `.agent-src/<relative_path>` in-place.

    Returns True if the file was modified, False otherwise. Silently
    returns False if the target doesn't exist (condensation hasn't run
    yet) — `--mark-done` is also valid before content exists.
    """
    target = TARGET_DIR / relative_path
    if not target.exists() or not relative_path.endswith(".md"):
        return False
    original = target.read_text(encoding="utf-8")
    rewritten = _rewrite_paths(original, relative_path)
    if rewritten == original:
        return False
    target.write_text(rewritten, encoding="utf-8")
    return True


def mark_all_done() -> None:
    """Mark ALL .md files as condensed (e.g. after initial full condensation)."""
    hashes = load_hashes()
    count = 0
    for source_file, relative in _iter_sources():
        if not should_condense(source_file):
            continue
        hashes[relative] = effective_hash(relative)
        count += 1
    save_hashes(hashes)
    print(f"✅  Marked {count} files as condensed")


def list_changed_md(source_dir: Path) -> list:
    """List .md files whose source hash differs from stored hash (= need recondensation).

    The ``source_dir`` parameter is retained for backward compatibility but
    ignored — iteration walks every active source root (ADR-017).
    """
    del source_dir  # multi-root: ignored, kept for signature stability
    hashes = load_hashes()
    changed = []
    for source_file, relative in _iter_sources():
        if not should_condense(source_file):
            continue
        current_hash = effective_hash(relative)
        stored_hash = hashes.get(relative)
        if stored_hash != current_hash:
            changed.append(relative)
    return changed


def find_stale_hashes(source_dir: Path) -> list:
    """Find hashes stored for source files that no longer exist in any root."""
    del source_dir  # multi-root: ignored, kept for signature stability
    hashes = load_hashes()
    stale = []
    for relative in sorted(hashes.keys()):
        if _resolve_source(relative) is None:
            stale.append(relative)
    return stale


def clean_stale_hashes(source_dir: Path) -> int:
    """Remove hashes for source files that no longer exist. Returns count removed."""
    stale = find_stale_hashes(source_dir)
    if not stale:
        return 0
    hashes = load_hashes()
    for relative in stale:
        del hashes[relative]
    save_hashes(hashes)
    return len(stale)



def should_condense(filepath: Path) -> bool:
    """Check if file should be condensed (is .md and not in copy-as-is list)."""
    if filepath.suffix != ".md":
        return False
    if filepath.name in COPY_AS_IS:
        return False
    # Determine the logical relative path so the COPY_AS_IS_DIRS check
    # works for both legacy (`.agent-src.uncondensed/`) and post-move
    # (`packages/*/.agent-src.uncondensed/`) source roots.
    rel_parts: tuple[str, ...] = filepath.parts
    for root in artefact_roots():
        try:
            rel_parts = filepath.relative_to(root).parts
            break
        except ValueError:
            continue
    if rel_parts and rel_parts[0] in COPY_AS_IS_DIRS:
        return False
    return True


def copy_file(source: Path, target: Path) -> None:
    """Copy a non-.md file as-is."""
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def cleanup_stale(source_dir: Path, target_dir: Path) -> int:
    """Delete files in target that don't exist in any source root. Returns count."""
    del source_dir  # multi-root: ignored, kept for signature stability
    deleted = 0
    if not target_dir.exists():
        return 0

    for target_file in sorted(target_dir.rglob("*")):
        if target_file.is_dir():
            continue
        relative = target_file.relative_to(target_dir)
        if _resolve_source(str(relative)) is None:
            print(f"  Deleting stale: {relative}")
            target_file.unlink()
            deleted += 1

    # Remove empty directories
    for dirpath in sorted(target_dir.rglob("*"), reverse=True):
        if dirpath.is_dir() and not any(dirpath.iterdir()):
            dirpath.rmdir()
            print(f"  Removing empty dir: {dirpath.relative_to(target_dir)}")

    return deleted


def sync_non_md(source_dir: Path, target_dir: Path) -> int:
    """Copy all non-.md files (and COPY_AS_IS .md files) from every source
    root to target. Returns count."""
    del source_dir  # multi-root: ignored, kept for signature stability
    copied = 0
    seen: set[str] = set()
    for source_file, relative in _iter_sources():
        if should_condense(source_file):
            continue  # .md files are condensed by the agent, not copied here
        if relative in seen:
            continue
        seen.add(relative)
        target_file = target_dir / relative
        copy_file(source_file, target_file)
        print(f"  Copied: {relative}")
        copied += 1
    return copied


def list_md_files(source_dir: Path) -> list:
    """List all .md files that need condensation by the agent."""
    del source_dir  # multi-root: ignored, kept for signature stability
    files: list[str] = []
    seen: set[str] = set()
    for source_file, relative in _iter_sources():
        if not should_condense(source_file):
            continue
        if relative in seen:
            continue
        seen.add(relative)
        files.append(relative)
    return sorted(files)


def check_sync(source_dir: Path, target_dir: Path) -> tuple:
    """Check if target is in sync with source(s). Returns (missing, stale) lists."""
    del source_dir  # multi-root: ignored, kept for signature stability
    missing = []
    stale = []

    # Files in any source root but not in target
    seen: set[str] = set()
    for _source_file, relative in _iter_sources():
        if relative in seen:
            continue
        seen.add(relative)
        if not (target_dir / relative).exists():
            missing.append(relative)

    # Files in target but not in any source root (stale)
    if target_dir.exists():
        for target_file in sorted(target_dir.rglob("*")):
            if target_file.is_dir():
                continue
            relative = str(target_file.relative_to(target_dir))
            if _resolve_source(relative) is None:
                stale.append(relative)

    return missing, stale


# ── Multi-agent tool generation ──────────────────────────────────────

RULES_SOURCE = PROJECT_ROOT / ".agent-src" / "rules"

TOOL_DIRS = {
    ".claude/rules": "../../.agent-src/rules",
    ".cursor/rules": "../../.agent-src/rules",
    ".clinerules": "../.agent-src/rules",
}

SKILLS_SOURCE = PROJECT_ROOT / ".agent-src" / "skills"
COMMANDS_SOURCE = PROJECT_ROOT / ".agent-src" / "commands"
PERSONAS_SOURCE = PROJECT_ROOT / ".agent-src" / "personas"
USER_TYPES_SOURCE = PROJECT_ROOT / ".agent-src" / "user-types"
CLAUDE_SKILLS_DIR = PROJECT_ROOT / ".claude" / "skills"
# Committed plugin-marketplace projection for command-as-skill entries.
# The marketplace is consumed as a git repo, so every skills[] path must be
# committed. Real skills resolve to .agent-src/skills/<name> (already
# committed); commands have no <slug>/SKILL.md shape in source, so their
# committed projection lives here. .claude/skills/ stays a gitignored,
# generate-tools-rebuilt local auto-discovery channel.
PLUGIN_SKILLS_DIR = PROJECT_ROOT / ".claude-plugin" / "skills"

PERSONA_TOOL_DIRS = {
    ".claude/personas": "../../.agent-src/personas",
    ".cursor/personas": "../../.agent-src/personas",
}

USER_TYPE_TOOL_DIRS = {
    ".claude/user-types": "../../.agent-src/user-types",
    ".cursor/user-types": "../../.agent-src/user-types",
}

# Map tool-projection directories to the canonical tool ID used by
# `agents/.agent-tools.yml`. Directories not in this map are always emitted.
_DIR_TOOL_ID = {
    ".claude/rules": "claude-code",
    ".cursor/rules": "cursor",
    ".clinerules": "cline",
    ".claude/personas": "claude-code",
    ".cursor/personas": "cursor",
    ".claude/user-types": "claude-code",
    ".cursor/user-types": "cursor",
}


def _filter_tool_dirs(mapping: dict[str, str]) -> dict[str, str]:
    """Drop entries whose tool ID is not active in `agents/.agent-tools.yml`."""
    return {
        d: p for d, p in mapping.items()
        if _tool_active(_DIR_TOOL_ID.get(d, "claude-code"))
    }


def strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter (between --- markers) from content."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            content = content[end + 3:].lstrip("\n")
    return content


# ── Path rewriter (P1 of road-to-path-fixes.md) ───────────────────────────
# Source files use logical names that the rewriter resolves at condense
# time, so the shipped `.agent-src/` (and `.augment/` projection) carry
# deployment-correct relative paths without the agent author having to
# know how deep their file lives.
#
# Frontmatter rewrites:
#   load_context: / load_context_eager:
#     contexts/<area>/<file>.md                          (logical, preferred)
#     .agent-src.uncondensed/contexts/<area>/<file>.md  (legacy)
#       → ../contexts/<area>/<file>.md  (relative from .agent-src/rules/)
#   triggers[].path_prefix:
#     LEFT ALONE — `path_prefix:` is a literal match pattern, not a
#     file reference. Source-of-truth rules that fire on edits under
#     `.agent-src.uncondensed/` keep that prefix verbatim (see
#     road-to-path-fixes.md P2.2 / Modified Option 1).
#
# Body-link rewrites:
#   ../../docs/guidelines/<file>.md  →  ../docs/guidelines/<file>.md
#   ../../docs/contracts/<file>.md   →  ../docs/contracts/<file>.md
#
# Idempotent: applying twice is a no-op (rewritten patterns no longer
# match the source patterns).

_LEGACY_SRC_PREFIX = ".agent-src.uncondensed/"
_PROJECTED_SRC_PREFIX = ".agent-src/"

# A YAML list item under load_context*: `  - some/path.md` (optionally quoted)
_FM_LIST_ITEM_RE = re.compile(r'^(\s*-\s*)(["\']?)([^"\'\n]+?\.md)(["\']?)\s*$')

# `path_prefix:` line — top-level or under `triggers:` (with leading dash)
_FM_PATH_PREFIX_RE = re.compile(
    r'^(\s*(?:-\s+)?path_prefix:\s*)(["\']?)([^"\'\n]+?)(["\']?)\s*$'
)

# Body-link patterns (relative two-up to docs/) — capture the docs/... tail
_BODY_DOCS_RE = re.compile(r'\.\./\.\./(docs/(?:guidelines|contracts)/[^)\s]+\.md)')


def _depth_prefix(source_relative_path: str) -> str:
    """Return the `../` chain to climb from `<source_relative_path>` back to
    the source root. A file at `rules/X.md` (1 dir deep) needs `../`; a
    file at `commands/council/default.md` (2 dirs deep) needs `../../`.
    """
    parts = Path(source_relative_path).parts
    depth = max(len(parts) - 1, 1)
    return "../" * depth


def _split_frontmatter(content: str):
    """Return (frontmatter_lines, body) — frontmatter_lines is None if no FM."""
    if not content.startswith("---\n"):
        return None, content
    end = content.find("\n---\n", 4)
    if end == -1:
        return None, content
    fm_text = content[4:end]
    body = content[end + len("\n---\n"):]
    return fm_text.split("\n"), body


def _rewrite_load_context_value(value: str, prefix: str) -> str:
    """Rewrite a single `load_context` list-item value to a deployment path."""
    # Already relative or absolute → leave alone (idempotence).
    if value.startswith(("../", "./", "/")):
        return value
    # Legacy fully-qualified source prefix.
    if value.startswith(_LEGACY_SRC_PREFIX):
        return prefix + value[len(_LEGACY_SRC_PREFIX):]
    # Projected source prefix (defensive — also strip).
    if value.startswith(_PROJECTED_SRC_PREFIX):
        return prefix + value[len(_PROJECTED_SRC_PREFIX):]
    # Logical name (e.g. `contexts/execution/foo.md`).
    return prefix + value


def _rewrite_path_prefix_value(value: str) -> str:
    """No-op for `triggers[].path_prefix:` values.

    `path_prefix:` is a literal match pattern the host evaluates against
    the file the agent is editing — not a file reference. Rewriting it
    breaks the workflow it was authored for: source-of-truth rules that
    fire when the agent edits files under `.agent-src.uncondensed/`
    keep that prefix verbatim. The prefix ban therefore applies only to
    `load_context:` entries and body links (see road-to-path-fixes.md
    P2.2 + the AI-Council convergence on 2026-05-06).
    """
    return value


def _rewrite_frontmatter_lines(lines, prefix):
    """Apply load_context / path_prefix rewrites to a frontmatter line list."""
    in_load_context = False
    out = []
    for line in lines:
        bare = line.lstrip()
        if bare.startswith(("load_context:", "load_context_eager:")):
            in_load_context = True
            out.append(line)
            continue
        if in_load_context:
            m = _FM_LIST_ITEM_RE.match(line)
            if m:
                indent, q1, value, q2 = m.groups()
                rewritten = _rewrite_load_context_value(value, prefix)
                out.append(f"{indent}{q1}{rewritten}{q2}")
                continue
            in_load_context = False
            # fall through to path_prefix / passthrough
        m = _FM_PATH_PREFIX_RE.match(line)
        if m:
            head, q1, value, q2 = m.groups()
            out.append(f"{head}{q1}{_rewrite_path_prefix_value(value)}{q2}")
            continue
        out.append(line)
    return out


def _rewrite_body_links(body: str, prefix: str) -> str:
    """Rewrite `../../docs/{guidelines,contracts}/...` to use depth-prefix."""
    return _BODY_DOCS_RE.sub(prefix + r"\1", body)


# ── Human-review banner injection (Phase 5.3 / ADR-018) ───────────────────
# Source artefacts may set `trust.human_review_required: true` in their
# frontmatter. The condenseor injects a short, parser-stable banner block
# at the top of the projected body so every downstream surface (agent
# memory, .augment, .claude, etc.) surfaces the gate. Idempotent — the
# marker comment prevents double-injection on re-condense.

_HRR_BANNER_MARKER = "<!-- agent-config:human-review-banner -->"

# Plain YAML list item — any scalar, used to read `packs:` / `workspaces:`
# blocks where values are bare identifiers, not file paths.
_FM_PLAIN_LIST_RE = re.compile(r'^\s*-\s*(["\']?)([^"\'\n]+?)\1\s*$')


def _parse_trust_and_owner(fm_lines):
    """Extract `trust.level`, `human_review_required`, and an owner hint
    from a frontmatter line list. Owner falls back to the first pack
    prefix (`finance-basic` → `finance`), then the first workspace,
    then `unknown`.
    """
    # Default to the schema default `core` so the HUMAN REVIEW banner still
    # renders if a future artefact sets `human_review_required: true` while
    # omitting the (defaulted) `trust.level` line (abstraction-reduction
    # preflight Decision D). The banner only fires when `hrr` is true, so this
    # never affects artefacts that omit the whole trust block.
    level = "core"
    hrr = False
    packs: list[str] = []
    workspaces: list[str] = []
    in_trust = False
    in_packs = False
    in_workspaces = False
    for line in fm_lines:
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if indent == 0 and stripped.endswith(":"):
            key = stripped[:-1]
            in_trust = key == "trust"
            in_packs = key == "packs"
            in_workspaces = key == "workspaces"
            continue
        if in_trust and stripped.startswith("level:"):
            level = stripped.split(":", 1)[1].strip().strip('"').strip("'")
        elif in_trust and stripped.startswith("human_review_required:"):
            val = stripped.split(":", 1)[1].strip()
            hrr = val.lower() == "true"
        elif in_packs or in_workspaces:
            m = _FM_PLAIN_LIST_RE.match(line)
            if m:
                value = m.group(2).strip()
                (packs if in_packs else workspaces).append(value)
    owner = "unknown"
    if packs:
        owner = packs[0].split("-")[0]
    elif workspaces:
        owner = workspaces[0]
    return level, hrr, owner


def _inject_hrr_banner(body: str, level: str, owner: str) -> str:
    """Prepend the HUMAN_REVIEW banner block to `body`. Idempotent — a
    body that already carries `_HRR_BANNER_MARKER` is returned unchanged.
    """
    if _HRR_BANNER_MARKER in body:
        return body
    banner = (
        f"{_HRR_BANNER_MARKER}\n"
        f"> HUMAN REVIEW REQUIRED · trust: {level} · owner: {owner}\n\n"
    )
    return banner + body.lstrip("\n")


def _rewrite_paths(content: str, source_relative_path: str) -> str:
    """Rewrite logical / legacy paths in `content` for a file shipped at
    `.agent-src/{source_relative_path}`. Idempotent.

    See module-level comment above for the full pattern catalog.
    Also injects the HUMAN_REVIEW banner when the source frontmatter
    sets `trust.human_review_required: true` (Phase 5.3 / ADR-018).
    """
    prefix = _depth_prefix(source_relative_path)
    fm_lines, body = _split_frontmatter(content)
    body = _rewrite_body_links(body, prefix)
    if fm_lines is None:
        return body
    new_fm = _rewrite_frontmatter_lines(fm_lines, prefix)
    level, hrr, owner = _parse_trust_and_owner(fm_lines)
    if hrr and level:
        body = _inject_hrr_banner(body, level, owner)
    return "---\n" + "\n".join(new_fm) + "\n---\n" + body


def generate_rule_symlinks() -> int:
    """Create symlink directories for rules (.claude/rules/, .cursor/rules/, .clinerules/).

    Symlinks ALL .md files from .agent-src/rules/ into tool-specific directories.
    """
    # All .md files in .agent-src/rules/ — not just universal ones
    rules = sorted([f.name for f in RULES_SOURCE.glob("*.md")])
    tool_dirs = _filter_tool_dirs(TOOL_DIRS)

    # Thin-projection opt-in (lean-initial-context Phase 3.1). Default
    # `eager-all` keeps the symlink behaviour below untouched; `thin` writes
    # kernel rules full + non-kernel rules as router-resolved pointers.
    thin_files: dict[str, str] | None = None
    if _lean_projection_mode() == "thin":
        try:
            from scripts.project_thin_rules import build_thin
        except ImportError:  # pragma: no cover — script-style invocation
            from project_thin_rules import build_thin  # type: ignore[import-not-found]
        thin_files = build_thin(RULES_SOURCE)

    total = 0
    for tool_dir, rel_prefix in tool_dirs.items():
        target_dir = PROJECT_ROOT / tool_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        # Clean stale symlinks
        for item in target_dir.iterdir():
            if item.is_symlink() and item.name not in rules and item.name != "README.md":
                item.unlink()

        for rule in rules:
            link = target_dir / rule
            if link.exists() or link.is_symlink():
                link.unlink()
            if thin_files is not None:
                # Thin mode: write a real file (kernel full / non-kernel pointer),
                # not a symlink to the full source body.
                link.write_text(thin_files[rule], encoding="utf-8")
            else:
                link.symlink_to(Path(rel_prefix) / rule)
            total += 1

    # Verify counts match across all tool directories
    source_count = len(rules)
    for tool_dir in tool_dirs:
        target_dir = PROJECT_ROOT / tool_dir
        tool_count = len([f for f in target_dir.iterdir() if f.suffix == ".md"])
        if tool_count != source_count:
            print(f"  ⚠️  {tool_dir}: {tool_count} rules (expected {source_count})")

    info(f"  ✅  Created {total} rule symlinks across {len(tool_dirs)} tool directories ({source_count} rules each)")
    return total


def generate_windsurfrules() -> int:
    """Generate .windsurfrules by concatenating all rules (no frontmatter).
    """
    rules = sorted([f.name for f in RULES_SOURCE.glob("*.md")])
    parts = ["# Auto-generated from .agent-src/rules/ — do not edit directly\n"]

    for rule in rules:
        path = RULES_SOURCE / rule
        content = strip_frontmatter(path.read_text())
        parts.append(f"---\n\n{content.strip()}\n")

    output = PROJECT_ROOT / ".windsurfrules"
    output.write_text("\n".join(parts) + "\n")
    info(f"  ✅  Generated .windsurfrules ({len(rules)} rules)")
    return len(rules)


# ── Modern editor formats (road-to-simplicity-and-everywhere Phase 5) ─
# Cursor `.cursor/rules/*.mdc` (frontmatter: description, globs,
# alwaysApply) and Windsurf `.windsurf/rules/*.md` (frontmatter:
# trigger, description, globs) are the formats current editors prefer.
# Legacy `.windsurfrules` aggregate stays for users who prefer it.

CURSOR_RULES_MDC_DIR = PROJECT_ROOT / ".cursor" / "rules"
WINDSURF_RULES_DIR = PROJECT_ROOT / ".windsurf" / "rules"
WINDSURF_WORKFLOWS_DIR = PROJECT_ROOT / ".windsurf" / "workflows"
CURSOR_COMMANDS_DIR = PROJECT_ROOT / ".cursor" / "commands"


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split a `---`-delimited YAML frontmatter from the body."""
    if not content.startswith("---"):
        return {}, content
    end = content.find("\n---", 3)
    if end == -1:
        return {}, content
    raw = content[3:end].strip()
    body = content[end + 4:].lstrip("\n")
    try:
        meta = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        meta = {}
    return meta if isinstance(meta, dict) else {}, body


def _yaml_scalar(value: str) -> str:
    """Return a YAML-safe single-line scalar for a frontmatter value.

    Descriptions can contain ``:``, ``#``, or quotes — characters that break
    an unquoted YAML scalar (e.g. ``description: Hard Floor: ...`` is invalid
    YAML). A JSON string is itself a valid YAML double-quoted scalar, so
    ``json.dumps`` gives correct escaping for free.
    """
    return json.dumps(value, ensure_ascii=False)


def _emit_cursor_mdc(source: Path, target: Path) -> None:
    """Write a Cursor `.mdc` file with Cursor-shaped frontmatter."""
    meta, body = _parse_frontmatter(source.read_text())
    description = (meta.get("description") or "").replace("\n", " ").strip()
    always_apply = bool(meta.get("alwaysApply") or meta.get("type") == "always")
    lines = [
        "---",
        f"description: {_yaml_scalar(description)}",
        "globs: ",
        f"alwaysApply: {'true' if always_apply else 'false'}",
        "---",
        "",
        body.rstrip() + "\n",
    ]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines))


def _emit_windsurf_rule(source: Path, target: Path) -> None:
    """Write a Windsurf rule with Wave-8 frontmatter (trigger/description/globs)."""
    meta, body = _parse_frontmatter(source.read_text())
    description = (meta.get("description") or "").replace("\n", " ").strip()
    always_apply = bool(meta.get("alwaysApply") or meta.get("type") == "always")
    trigger = "always_on" if always_apply else "model_decision"
    lines = [
        "---",
        f"trigger: {trigger}",
        f"description: {_yaml_scalar(description)}",
        "globs: ",
        "---",
        "",
        body.rstrip() + "\n",
    ]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines))


def _clean_modern_dir(target_dir: Path, valid_names: set[str]) -> None:
    """Drop files in `target_dir` whose names are not in `valid_names`."""
    if not target_dir.exists():
        return
    for item in target_dir.iterdir():
        if item.name == "README.md":
            continue
        if item.name not in valid_names:
            if item.is_dir() and not item.is_symlink():
                shutil.rmtree(item)
            else:
                item.unlink()


def generate_cursor_mdc_rules() -> int:
    """Emit `.cursor/rules/*.mdc` per source rule (alongside legacy `.md` symlinks)."""
    rules = sorted(RULES_SOURCE.glob("*.md"))
    valid = {f"{r.stem}.mdc" for r in rules}
    _clean_modern_dir(CURSOR_RULES_MDC_DIR, valid | {r.name for r in rules})
    for rule in rules:
        _emit_cursor_mdc(rule, CURSOR_RULES_MDC_DIR / f"{rule.stem}.mdc")
    info(f"  ✅  Wrote {len(rules)} `.cursor/rules/*.mdc` files")
    return len(rules)


def generate_windsurf_modern_rules() -> int:
    """Emit `.windsurf/rules/*.md` per source rule (Wave-8 frontmatter)."""
    rules = sorted(RULES_SOURCE.glob("*.md"))
    valid = {r.name for r in rules}
    _clean_modern_dir(WINDSURF_RULES_DIR, valid)
    for rule in rules:
        _emit_windsurf_rule(rule, WINDSURF_RULES_DIR / rule.name)
    info(f"  ✅  Wrote {len(rules)} `.windsurf/rules/*.md` files")
    return len(rules)


def generate_cursor_commands(active_command_slugs: set[str] | None = None) -> int:
    """Symlink `.cursor/commands/<slug>.md` per source command.

    `active_command_slugs` is `None` for legacy-all (every command projected)
    or a slug allowlist for scoped projection; the `_clean_modern_dir` pass
    then reaps any command no longer in the active set.
    """
    if not COMMANDS_SOURCE.exists():
        return 0
    cmds = [
        (sf, slug)
        for sf, slug in _iter_commands()
        if active_command_slugs is None or slug in active_command_slugs
    ]
    valid = {f"{slug}.md" for _, slug in cmds}
    _clean_modern_dir(CURSOR_COMMANDS_DIR, valid)
    CURSOR_COMMANDS_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for source_file, slug in cmds:
        link = CURSOR_COMMANDS_DIR / f"{slug}.md"
        if link.exists() or link.is_symlink():
            link.unlink()
        rel = Path("../../.agent-src/commands") / source_file.relative_to(COMMANDS_SOURCE)
        link.symlink_to(rel)
        count += 1
    info(f"  ✅  Linked {count} `.cursor/commands/*.md` files")
    return count


def generate_windsurf_workflows(active_command_slugs: set[str] | None = None) -> int:
    """Symlink `.windsurf/workflows/<slug>.md` per source command.

    `active_command_slugs` is `None` for legacy-all or a slug allowlist for
    scoped projection (see `generate_cursor_commands`).
    """
    if not COMMANDS_SOURCE.exists():
        return 0
    cmds = [
        (sf, slug)
        for sf, slug in _iter_commands()
        if active_command_slugs is None or slug in active_command_slugs
    ]
    valid = {f"{slug}.md" for _, slug in cmds}
    _clean_modern_dir(WINDSURF_WORKFLOWS_DIR, valid)
    WINDSURF_WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for source_file, slug in cmds:
        link = WINDSURF_WORKFLOWS_DIR / f"{slug}.md"
        if link.exists() or link.is_symlink():
            link.unlink()
        rel = Path("../../.agent-src/commands") / source_file.relative_to(COMMANDS_SOURCE)
        link.symlink_to(rel)
        count += 1
    info(f"  ✅  Linked {count} `.windsurf/workflows/*.md` files")
    return count




def generate_gemini_md() -> None:
    """Create GEMINI.md symlink to AGENTS.md."""
    link = PROJECT_ROOT / "GEMINI.md"
    if link.exists() or link.is_symlink():
        link.unlink()
    link.symlink_to("AGENTS.md")
    info("  ✅  Created GEMINI.md → AGENTS.md symlink")


def _command_slug(source_file: Path) -> str:
    """Return the flat .claude/skills/ slug for a command source file.

    Top-level commands keep their stem (`commit.md` → `commit`). Nested
    commands flatten the relative path with `-` (`council/default.md` →
    `council-default`). Keeps slug collisions out of `.claude/skills/`
    while preserving native nested invocation in `.agent-src/commands/`.
    """
    rel = source_file.relative_to(COMMANDS_SOURCE)
    return "-".join(rel.with_suffix("").parts)


def _iter_commands():
    """Yield (source_file, slug) for every command .md file (recursive)."""
    if not COMMANDS_SOURCE.exists():
        return
    for source_file in sorted(COMMANDS_SOURCE.rglob("*.md")):
        # Skip the cluster AGENTS.md authoring doc (not a command).
        if source_file.name == "AGENTS.md":
            continue
        yield source_file, _command_slug(source_file)


# --- Per-skill model auto-switch (ADR-035 / road-to-model-capability-tiers) ---

# The SINGLE generator-owned tier→Claude-model mapping (ADR-035 § 3). Claude
# Code is the only surface that consumes a native `model:`, so this is the only
# place a capability tier resolves to a concrete model. `inherit`/absent emit
# nothing and stay pure symlinks. Non-Claude agents never get a per-vendor
# table — the rule surfaces the tier name as a suggestion.
_TIER_TO_CLAUDE_MODEL = {"high": "opus", "medium": "sonnet", "lite": "haiku"}
_MODEL_TIER_RE = re.compile(r'^model_tier:\s*"?([a-z]+)"?\s*$', re.MULTILINE)


def _read_model_auto_switch() -> str:
    """Read `model.auto_switch` from .agent-settings.yml.

    Returns `auto` | `suggest` | `off`; default `suggest`. Only `auto` makes
    the generator emit a native Claude `model:` key (ADR-034 § 4) — `suggest`
    and `off` keep skills/commands as pure symlinks so the package never
    silently overrides a user's explicit `/model` choice.
    """
    try:
        from scripts._lib.agent_settings import load_agent_settings
    except ImportError:  # pragma: no cover — script-style invocation
        import sys as _sys
        from pathlib import Path as _Path
        _sys.path.insert(0, str(_Path(__file__).resolve().parent))
        from _lib.agent_settings import load_agent_settings  # type: ignore[import-not-found]
    data = load_agent_settings(project_path=SETTINGS_FILE)
    model = data.get("model")
    value = model.get("auto_switch") if isinstance(model, dict) else None
    if isinstance(value, str) and value.strip().lower() in ("auto", "suggest", "off"):
        return value.strip().lower()
    return "suggest"


# --- Pack-scoped projection (ADR-040 / road-to-6.0.0-B Step 8) ---------------


def _read_projection_mode() -> str:
    """Read `projection.mode` from .agent-settings.yml.

    Returns `legacy-all` | `scoped`; default `legacy-all`. Only `scoped`
    narrows the projected artefact set; `legacy-all` projects the full surface
    byte-identically to 5.x. Scoping is opt-in by this key alone — never
    inferred from `profile.id`.
    """
    try:
        from scripts._lib.agent_settings import load_agent_settings
    except ImportError:  # pragma: no cover — script-style invocation
        import sys as _sys
        from pathlib import Path as _Path
        _sys.path.insert(0, str(_Path(__file__).resolve().parent))
        from _lib.agent_settings import load_agent_settings  # type: ignore[import-not-found]
    data = load_agent_settings(project_path=SETTINGS_FILE)
    proj = data.get("projection")
    value = proj.get("mode") if isinstance(proj, dict) else None
    if isinstance(value, str) and value.strip().lower() in ("legacy-all", "scoped"):
        return value.strip().lower()
    return "legacy-all"


def _command_path_to_slug(manifest_path: str) -> str:
    """Map a manifest command path to the flat generator slug.

    `.../commands/council/analysis.md` → `council-analysis` — identical to
    `_command_slug()` (which flattens the path relative to COMMANDS_SOURCE),
    so the predicate matches what the generators emit.
    """
    parts = Path(manifest_path).parts
    i = parts.index("commands")
    return "-".join(Path(*parts[i + 1:]).with_suffix("").parts)


def _skill_path_to_name(manifest_path: str) -> str:
    """Map a manifest skill path to its directory name.

    `.../skills/accessibility-auditor/SKILL.md` → `accessibility-auditor` —
    the key the skills generators iterate on.
    """
    parts = Path(manifest_path).parts
    i = parts.index("skills")
    return parts[i + 1]


def _resolve_active_predicates() -> tuple[set[str] | None, set[str] | None]:
    """Return `(active_command_slugs, active_skill_names)` for the projection.

    `(None, None)` ⇒ legacy-all (no filtering — byte-identical to 5.x). In
    `scoped` mode the selected packs are the active profile's `packs` UNIONED
    with the `runtime.active_packs` overlay; the resolver expands that over the
    `requires` graph and resolves the active command/skill set.
    """
    if _read_projection_mode() != "scoped":
        return None, None
    try:
        from scripts.config import packs as packs_mod
        from scripts.config import session_profiles as sp_mod
        from scripts.config.profiles import resolve_profile
        from scripts._lib.agent_settings import load_agent_settings
    except ImportError:  # pragma: no cover — script-style invocation
        import sys as _sys
        _sys.path.insert(0, str(PROJECT_ROOT))
        from scripts.config import packs as packs_mod  # type: ignore
        from scripts.config import session_profiles as sp_mod  # type: ignore
        from scripts.config.profiles import resolve_profile  # type: ignore
        from scripts._lib.agent_settings import load_agent_settings  # type: ignore
    settings = load_agent_settings(project_path=SETTINGS_FILE)
    profile = resolve_profile(project_root=PROJECT_ROOT, user_settings=settings)
    selected = sorted(set(profile.packs) | set(sp_mod.read_overlay(PROJECT_ROOT)))
    active = packs_mod.resolve_active_set(PROJECT_ROOT, selected)
    cmd_slugs = {_command_path_to_slug(p) for p in active.commands}
    skill_names = {_skill_path_to_name(p) for p in active.skills}
    return cmd_slugs, skill_names


def _model_tier(skill_md: Path) -> str | None:
    """Return the `model_tier` frontmatter value, or None if absent."""
    if not skill_md.exists():
        return None
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    m = _MODEL_TIER_RE.search(text[4:end])
    return m.group(1) if m else None


def _render_native_model_md(src_md: Path, tier: str) -> str:
    """Rewrite the source `model_tier: <tier>` line to a native Claude
    `model: <mapped>` key via the generator-owned mapping (ADR-035 § 3). The
    rest of the SKILL.md is byte-identical."""
    text = src_md.read_text(encoding="utf-8")
    model = _TIER_TO_CLAUDE_MODEL[tier]
    return _MODEL_TIER_RE.sub(f"model: {model}", text, count=1)


def generate_claude_skills(active_skill_names: set[str] | None = None) -> int:
    """Create .claude/skills/ entries for ALL skills in .agent-src/skills/.

    Default: a directory symlink → .agent-src/skills/<name> (verbatim).
    When `model.auto_switch: auto` AND a skill declares
    `model_tier: lite|medium|high`, the entry becomes a real directory whose
    sub-files are symlinked but whose SKILL.md is a rendered copy carrying a
    native Claude `model:` key (ADR-034 Option (b) — only model-bearing skills
    break the symlink). Idempotent: each entry is rebuilt from scratch.
    """
    if not SKILLS_SOURCE.exists():
        print("  ⚠️  .agent-src/skills/ not found — skipping skills", file=sys.stderr)
        return 0

    # All skill directories in .agent-src/skills/. Under scoped projection
    # (active_skill_names not None) keep only the active set; the stale-cleanup
    # loop below then reaps any now-inactive skill entry.
    skills = sorted([d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()])
    if active_skill_names is not None:
        skills = [s for s in skills if s in active_skill_names]
    skill_set = set(skills)
    # All command slugs (to protect from stale cleanup)
    command_slugs = {slug for _, slug in _iter_commands()}

    CLAUDE_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    auto = _read_model_auto_switch() == "auto"

    # Clean stale entries (symlinks AND rendered skill dirs) — but never touch
    # command dirs (real dir whose SKILL.md is a symlink) or the README.
    for item in CLAUDE_SKILLS_DIR.iterdir():
        if item.name in skill_set or item.name in command_slugs or item.name == "README.md":
            continue
        if item.is_symlink():
            item.unlink()
        elif item.is_dir():
            skill_md = item / "SKILL.md"
            # A rendered skill dir has a *real* SKILL.md copy; a command dir has
            # a SKILL.md *symlink* (left for generate_claude_commands to manage).
            if skill_md.is_file() and not skill_md.is_symlink():
                shutil.rmtree(item)

    count = 0
    rendered = 0
    for skill in skills:
        link = CLAUDE_SKILLS_DIR / skill
        src_dir = SKILLS_SOURCE / skill
        value = _model_tier(src_dir / "SKILL.md") if auto else None
        # Rebuild from scratch for idempotency (symlink ↔ rendered-dir flips).
        if link.is_symlink():
            link.unlink()
        elif link.is_dir():
            shutil.rmtree(link)
        elif link.exists():
            link.unlink()
        if value in _TIER_TO_CLAUDE_MODEL:
            link.mkdir(parents=True)
            for entry in sorted(src_dir.iterdir()):
                if entry.name == "SKILL.md":
                    (link / "SKILL.md").write_text(
                        _render_native_model_md(entry, value), encoding="utf-8"
                    )
                else:
                    (link / entry.name).symlink_to(
                        Path("../../../.agent-src/skills") / skill / entry.name
                    )
            rendered += 1
        else:
            link.symlink_to(Path("../../.agent-src/skills") / skill)
        count += 1

    suffix = f" ({rendered} rendered with native model:)" if rendered else ""
    info(f"  ✅  Created {count} skill entries in .claude/skills/{suffix}")
    return count


def extract_description_from_md(content: str) -> str:
    """Extract description from first # heading or first non-empty line."""
    for line in content.strip().split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line and not line.startswith("#"):
            return line[:120]
    return ""


def generate_claude_commands(active_command_slugs: set[str] | None = None) -> int:
    """Create .claude/skills/{slug}/SKILL.md symlinks for ALL Augment commands.

    Commands in .agent-src/commands/ are the single source of truth.
    They must include name: and disable-model-invocation: true in frontmatter
    (added once, then maintained as part of the command file).

    Top-level commands use their filename stem as the slug. Nested
    cluster commands (e.g. `commands/council/default.md`) are flattened
    to `council-default` so directories never collide in `.claude/skills/`.
    """
    if not COMMANDS_SOURCE.exists():
        print("  ⚠️  .agent-src/commands/ not found — skipping commands", file=sys.stderr)
        return 0

    CLAUDE_SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    # Collect skill names to avoid overwriting real skills with same-name commands
    skill_names = set()
    if SKILLS_SOURCE.exists():
        skill_names = {d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()}

    # Track current command slugs for stale-directory cleanup
    current_slugs: set[str] = set()
    count = 0
    skipped = 0
    rendered = 0
    auto = _read_model_auto_switch() == "auto"
    for source_file, slug in _iter_commands():
        # Scoped projection: skip commands outside the active set. They are not
        # added to current_slugs, so the stale-cleanup pass below reaps any
        # existing dir for them (switch-down behaviour).
        if active_command_slugs is not None and slug not in active_command_slugs:
            continue
        # Skip if a real skill with the same name exists — skill takes priority
        if slug in skill_names:
            skipped += 1
            continue

        current_slugs.add(slug)

        # Create skill directory (real dir, SKILL.md symlinked or rendered)
        skill_dir = CLAUDE_SKILLS_DIR / slug
        skill_dir.mkdir(parents=True, exist_ok=True)

        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists() or skill_file.is_symlink():
            skill_file.unlink()

        rel_path = source_file.relative_to(COMMANDS_SOURCE)
        value = _model_tier(source_file) if auto else None
        if value in _TIER_TO_CLAUDE_MODEL:
            # Render a copy carrying the native Claude model: key (ADR-034).
            skill_file.write_text(
                _render_native_model_md(source_file, value), encoding="utf-8"
            )
            rendered += 1
        else:
            # Symlink: .claude/skills/{slug}/SKILL.md → ../../../.agent-src/commands/<rel-path>
            rel_target = Path("../../../.agent-src/commands") / rel_path
            skill_file.symlink_to(rel_target)
        count += 1

    # Clean stale command skill directories — real dirs from removed commands.
    # Only delete if the directory contains exactly the SKILL.md symlink we created.
    removed_dirs = 0
    for item in CLAUDE_SKILLS_DIR.iterdir():
        if not item.is_dir() or item.is_symlink():
            continue
        if item.name in skill_names or item.name in current_slugs:
            continue
        skill_md = item / "SKILL.md"
        # Stale command dir = exactly one SKILL.md, either symlinked (default)
        # or a rendered copy (native-model command, ADR-034). Skill-render dirs
        # are protected above (item.name in skill_names) and via the skills
        # generator, so this only reaps removed commands.
        if skill_md.is_symlink() or skill_md.is_file():
            entries = list(item.iterdir())
            if len(entries) == 1 and entries[0].name == "SKILL.md":
                skill_md.unlink()
                item.rmdir()
                removed_dirs += 1

    msg = f"  ✅  Created {count} command entries in .claude/skills/"
    if rendered:
        msg += f" ({rendered} rendered with native model:)"
    if skipped:
        msg += f" ({skipped} skipped — same-name skill exists)"
    if removed_dirs:
        msg += f" ({removed_dirs} stale dirs removed)"
    info(msg)
    return count


def generate_plugin_command_skills() -> int:
    """Mirror command-as-skill entries into the committed .claude-plugin/skills/.

    The plugin marketplace references each command entry as a <slug>/SKILL.md
    path that must be committed (git-consumed marketplace). Commands have no
    such shape in source, so this projects them as symlinks:
    .claude-plugin/skills/<slug>/SKILL.md → ../../../.agent-src/commands/<rel>.

    Symlink-only by design: the committed .claude/skills/ shape was always
    symlinks (ADR-034 model-rendered copies are local-only, never committed),
    so the distributed marketplace behaviour is preserved exactly. The local
    auto-discovery channel (.claude/skills/, gitignored) keeps model rendering
    for the dev loop.
    """
    if not COMMANDS_SOURCE.exists():
        return 0

    PLUGIN_SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    skill_names: set[str] = set()
    if SKILLS_SOURCE.exists():
        skill_names = {d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()}

    current_slugs: set[str] = set()
    count = 0
    for source_file, slug in _iter_commands():
        # A real skill of the same name takes priority — skip the command.
        if slug in skill_names:
            continue
        current_slugs.add(slug)

        skill_dir = PLUGIN_SKILLS_DIR / slug
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists() or skill_file.is_symlink():
            skill_file.unlink()

        rel_path = source_file.relative_to(COMMANDS_SOURCE)
        rel_target = Path("../../../.agent-src/commands") / rel_path
        skill_file.symlink_to(rel_target)
        count += 1

    # Reap stale command dirs from removed commands (exactly one SKILL.md).
    removed_dirs = 0
    for item in PLUGIN_SKILLS_DIR.iterdir():
        if not item.is_dir() or item.is_symlink():
            continue
        if item.name in current_slugs:
            continue
        skill_md = item / "SKILL.md"
        if skill_md.is_symlink() or skill_md.is_file():
            entries = list(item.iterdir())
            if len(entries) == 1 and entries[0].name == "SKILL.md":
                skill_md.unlink()
                item.rmdir()
                removed_dirs += 1

    msg = f"  ✅  Created {count} command entries in .claude-plugin/skills/"
    if removed_dirs:
        msg += f" ({removed_dirs} stale dirs removed)"
    info(msg)
    return count


def generate_persona_symlinks() -> int:
    """Create symlink directories for personas (.claude/personas/, .cursor/personas/).

    Symlinks each persona .md file from .agent-src/personas/ into tool-specific
    directories. Excludes README.md — that's authoring documentation, not a persona.
    """
    if not PERSONAS_SOURCE.exists():
        print("  ⚠️  .agent-src/personas/ not found — skipping personas")
        return 0

    personas = sorted([
        f.name for f in PERSONAS_SOURCE.glob("*.md") if f.stem != "README"
    ])
    tool_dirs = _filter_tool_dirs(PERSONA_TOOL_DIRS)
    total = 0
    for tool_dir, rel_prefix in tool_dirs.items():
        target_dir = PROJECT_ROOT / tool_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        # Clean stale symlinks
        for item in target_dir.iterdir():
            if item.is_symlink() and item.name not in personas and item.name != "README.md":
                item.unlink()

        for persona in personas:
            link = target_dir / persona
            target = Path(rel_prefix) / persona
            if link.exists() or link.is_symlink():
                link.unlink()
            link.symlink_to(target)
            total += 1

    info(f"  ✅  Created {total} persona symlinks across {len(tool_dirs)} tool directories ({len(personas)} personas each)")
    return total


def generate_user_type_symlinks() -> int:
    """Create symlink directories for user-types (.claude/user-types/, .cursor/user-types/).

    Symlinks each user-type .md file from .agent-src/user-types/ into tool-specific
    directories. Excludes README.md and _template/ — those are authoring scaffolding,
    not user-type lenses.
    """
    if not USER_TYPES_SOURCE.exists():
        print("  ⚠️  .agent-src/user-types/ not found — skipping user-types")
        return 0

    user_types = sorted([
        f.name for f in USER_TYPES_SOURCE.glob("*.md") if f.stem != "README"
    ])
    tool_dirs = _filter_tool_dirs(USER_TYPE_TOOL_DIRS)
    total = 0
    for tool_dir, rel_prefix in tool_dirs.items():
        target_dir = PROJECT_ROOT / tool_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        # Clean stale symlinks
        for item in target_dir.iterdir():
            if item.is_symlink() and item.name not in user_types and item.name != "README.md":
                item.unlink()

        for user_type in user_types:
            link = target_dir / user_type
            target = Path(rel_prefix) / user_type
            if link.exists() or link.is_symlink():
                link.unlink()
            link.symlink_to(target)
            total += 1

    info(f"  ✅  Created {total} user-type symlinks across {len(tool_dirs)} tool directories ({len(user_types)} user-types each)")
    return total


def generate_plugin_hooks() -> int:
    """Generate ``hooks/hooks.json`` at the plugin root from the hook manifest.

    Claude Code plugins auto-discover hooks at ``<plugin-root>/hooks/hooks.json``
    (Plugins reference). The agent-config plugin's source is the repo root
    (``.claude-plugin/marketplace.json``), so the file lands at
    ``PROJECT_ROOT/hooks/hooks.json``.

    Delivering the Claude lifecycle hooks via **plugin scope** — instead of
    writing them into the shared ``.claude/settings.json`` ``hooks`` array —
    means no shared ``hooks`` array in any settings file, so there is no
    collision with a neighbour tool's hooks or with a developer's
    ``settings.local.json``. Claude Code merges plugin-scope and
    settings-scope hooks and dedups by command string.

    The command resolves the binary project-local-first
    (``$CLAUDE_PROJECT_DIR/agent-config`` when executable — maintainer dev-loop)
    and falls back to ``agent-config`` on PATH (global-only consumer per
    ADR-020, where the repo carries no wrapper). It always passes
    ``--project-dir "$CLAUDE_PROJECT_DIR"`` so a globally resolved binary still
    scans the project the event fired in. The universal dispatcher then reads
    ``scripts/hook_manifest.yaml`` at runtime to fan out to the active
    concerns (each a no-op when its feature is disabled).
    """
    manifest_path = PROJECT_ROOT / "scripts" / "hook_manifest.yaml"
    if not manifest_path.exists():
        print("  ⚠️  scripts/hook_manifest.yaml not found — skipping plugin hooks",
              file=sys.stderr)
        return 0

    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    hook_spec = manifest.get("schema_version", 1)
    claude_events = manifest.get("platforms", {}).get("claude", {}) or {}
    aliases = manifest.get("native_event_aliases", {}).get("claude", {}) or {}
    # Reverse the native→agent-config map so we can emit native event names.
    ac_to_native = {ac: native for native, ac in aliases.items()}

    hooks: dict[str, list] = {}
    for ac_event, concerns in claude_events.items():
        if not concerns:
            continue
        native = ac_to_native.get(ac_event)
        if native is None:
            continue
        # Resolve the binary project-local-first, PATH-fallback: a maintainer
        # dev-loop (or any repo carrying a project-local wrapper) uses its own
        # ./agent-config; a global-only consumer (ADR-020 — nothing in the
        # repo) falls back to the globally-installed `agent-config` on PATH.
        # Either way pass --project-dir "$CLAUDE_PROJECT_DIR" so a globally
        # resolved binary still scans the project the event fired in.
        command = (
            'BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; '
            f'"$BIN" dispatch:hook --platform claude --event {ac_event} '
            f'--native-event {native} --project-dir "$CLAUDE_PROJECT_DIR" '
            f'--min-version {hook_spec}'
        )
        hooks[native] = [{"hooks": [{"type": "command", "command": command}]}]

    hooks_dir = PROJECT_ROOT / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    out = hooks_dir / "hooks.json"
    out.write_text(json.dumps({"hooks": hooks}, indent=2) + "\n", encoding="utf-8")
    info(f"  ✅  Generated hooks/hooks.json ({len(hooks)} Claude plugin hooks)")
    return len(hooks)


def _generate_tools_inner(
    cmd_slugs: set[str] | None, skill_names: set[str] | None
) -> None:
    """Run every tool generator once. `cmd_slugs` / `skill_names` are `None`
    for legacy-all (full surface) or allowlists for scoped projection. Only the
    four consumer-local native generators honour the allowlists; the committed
    plugin marketplace (`.claude-plugin/`) and the Augment tree always project
    the full set in 6.0.0 (ADR-040 / road-to-6.0.0-B Step 8, D3)."""
    info("🔧  Generating multi-agent tool directories...\n")
    rules = generate_rule_symlinks()
    windsurfrules = generate_windsurfrules() if _tool_active("windsurf") else 0
    if _tool_active("gemini"):
        generate_gemini_md()
    skills = generate_claude_skills(skill_names) if _tool_active("claude-code") else 0
    commands = generate_claude_commands(cmd_slugs) if _tool_active("claude-code") else 0
    plugin_cmd_skills = generate_plugin_command_skills() if _tool_active("claude-code") else 0
    plugin_hooks = generate_plugin_hooks() if _tool_active("claude-code") else 0
    personas = generate_persona_symlinks()
    user_types = generate_user_type_symlinks()
    cursor_mdc = generate_cursor_mdc_rules() if _tool_active("cursor") else 0
    windsurf_modern = generate_windsurf_modern_rules() if _tool_active("windsurf") else 0
    cursor_cmds = generate_cursor_commands(cmd_slugs) if _tool_active("cursor") else 0
    windsurf_wf = generate_windsurf_workflows(cmd_slugs) if _tool_active("windsurf") else 0
    summary = (
        f"✅  generate-tools — rules={rules} skills={skills} "
        f"commands={commands} plugin_cmd_skills={plugin_cmd_skills} "
        f"plugin_hooks={plugin_hooks} "
        f"personas={personas} user_types={user_types} "
        f"cursor_mdc={cursor_mdc} windsurf_rules={windsurf_modern} "
        f"cursor_commands={cursor_cmds} windsurf_workflows={windsurf_wf} "
        f"windsurfrules={windsurfrules}"
    )
    if resolve_level() == "verbose":
        print(f"\n{summary}")
    else:
        success(summary)
        flush_summary()


def generate_tools() -> None:
    """Generate all tool-specific directories and files.

    `agents/.agent-tools.yml` gates per-tool emission. When the file
    is missing, every tool is emitted (preserves test fixtures and
    pre-gating behaviour). See `_active_tools()` and `_tool_active()`.

    Honours `projection.mode` (ADR-040): `legacy-all` (default) projects the
    full surface; `scoped` projects only the active profile + packs. A failed
    scoped projection restores the full (legacy-all) tree so the host tool is
    never left with a partial set, then re-raises.
    """
    cmd_slugs, skill_names = _resolve_active_predicates()
    scoped = cmd_slugs is not None
    try:
        _generate_tools_inner(cmd_slugs, skill_names)
    except Exception:
        if scoped:
            info("  ⚠️  scoped projection failed — restoring full (legacy-all) projection")
            _generate_tools_inner(None, None)
        raise
    if not scoped:
        info(
            "  ℹ️  Profile mode available — focused surface. "
            "Run `agent-config use --profile=developer`."
        )


# ── .augment/ projection ──────────────────────────────────────────────
# The package uses .agent-src/ as the tool-agnostic condensed source of truth.
# .augment/ is a generated projection so that Augment Code (which reads from
# .augment/) works on the package repo itself. Rules default to copies
# because Augment Code historically does not load symlinked rule files;
# flip augment.rules_use_symlinks: true in .agent-settings.yml to switch
# them to symlinks (everything else is always symlinked).

# Subdirectories of .agent-src/ that map into .augment/ as symlinks.
AUGMENT_SYMLINK_DIRS = ("skills", "commands", "guidelines", "personas", "user-types", "templates", "contexts", "scripts")
# Top-level files to symlink into .augment/ (README, etc.)
AUGMENT_SYMLINK_FILES = ("README.md",)


def project_to_augment() -> None:
    """Mirror .agent-src/ into .augment/. Symlink everything except rules,
    which default to copies; opt into rule symlinks via
    augment.rules_use_symlinks in .agent-settings.yml."""
    if not TARGET_DIR.exists():
        print(f"  ⚠️  {TARGET_DIR.name}/ not found — nothing to project")
        return

    AUGMENT_DIR.mkdir(parents=True, exist_ok=True)

    use_symlinks = _read_augment_rules_use_symlinks()

    # Rules: copy by default (Augment Code historically does not load
    # symlinked rules), or symlink when augment.rules_use_symlinks is true.
    src_rules = TARGET_DIR / "rules"
    dst_rules = AUGMENT_DIR / "rules"
    dst_rules.mkdir(parents=True, exist_ok=True)
    existing = {f.name for f in dst_rules.iterdir() if f.is_file() or f.is_symlink()}
    current = set()
    written = 0
    if src_rules.exists():
        for rule in sorted(src_rules.glob("*.md")):
            target = dst_rules / rule.name
            # Always remove first to avoid copy↔symlink mode mismatch.
            if target.is_symlink() or target.exists():
                target.unlink()
            if use_symlinks:
                target.symlink_to(Path("..") / ".." / ".agent-src" / "rules" / rule.name)
            else:
                shutil.copy2(rule, target)
            current.add(rule.name)
            written += 1
    # Remove stale rule files
    removed_rules = 0
    for name in existing - current:
        (dst_rules / name).unlink()
        removed_rules += 1
    mode_label = "Symlinked" if use_symlinks else "Copied"
    print(f"  ✅  {mode_label} {written} rules to .augment/rules/" + (f" ({removed_rules} stale removed)" if removed_rules else ""))

    # Subdirectories: replace each with a symlink → ../.agent-src/<subdir>
    for sub in AUGMENT_SYMLINK_DIRS:
        dst = AUGMENT_DIR / sub
        if dst.is_symlink() or dst.exists():
            if dst.is_dir() and not dst.is_symlink():
                shutil.rmtree(dst)
            else:
                dst.unlink()
        src = TARGET_DIR / sub
        if src.exists():
            dst.symlink_to(Path("..") / ".agent-src" / sub, target_is_directory=True)
            print(f"  ✅  Symlinked .augment/{sub} → ../.agent-src/{sub}")

    # Top-level files: symlink
    for name in AUGMENT_SYMLINK_FILES:
        dst = AUGMENT_DIR / name
        src = TARGET_DIR / name
        if dst.is_symlink() or dst.exists():
            dst.unlink()
        if src.exists():
            dst.symlink_to(Path("..") / ".agent-src" / name)
            print(f"  ✅  Symlinked .augment/{name} → ../.agent-src/{name}")

    # Cleanup: remove any stray top-level entries in .augment/ that are no longer projected.
    # `state` holds runtime state files written by hooks (onboarding-gate,
    # context-hygiene, …) and must survive sync — it is regenerated by
    # the next hook fire, not by condense.
    known = set(AUGMENT_SYMLINK_DIRS) | set(AUGMENT_SYMLINK_FILES) | {"rules", "state"}
    for item in AUGMENT_DIR.iterdir():
        if item.name in known:
            continue
        if item.is_symlink() or item.is_file():
            item.unlink()
            print(f"  🗑️  Removed stale .augment/{item.name}")
        elif item.is_dir():
            shutil.rmtree(item)
            print(f"  🗑️  Removed stale .augment/{item.name}/")


def clean_tools() -> None:
    """Remove all generated tool directories and files."""
    import shutil as _shutil
    targets = [
        PROJECT_ROOT / ".claude",
        PROJECT_ROOT / ".cursor",
        PROJECT_ROOT / ".clinerules",
        PROJECT_ROOT / ".windsurf",
        PROJECT_ROOT / ".windsurfrules",
        PROJECT_ROOT / "GEMINI.md",
    ]
    for t in targets:
        if t.is_dir():
            _shutil.rmtree(t)
            print(f"  🗑️  Removed {t.relative_to(PROJECT_ROOT)}")
        elif t.exists() or t.is_symlink():
            t.unlink()
            print(f"  🗑️  Removed {t.relative_to(PROJECT_ROOT)}")
    print("✅  All generated tool files cleaned")



def main() -> None:
    # Multi-root awareness (ADR-017): tolerate a missing legacy
    # `.agent-src.uncondensed/` as long as at least one package-scoped
    # source root carries artefacts.
    if not SOURCE_DIR.exists() and not _any_source_root_exists():
        print(f"❌  No source directory found (looked at {SOURCE_DIR} and packages/*/.agent-src.uncondensed)")
        sys.exit(1)

    arg = sys.argv[1] if len(sys.argv) > 1 else "--sync"

    if arg == "--list":
        files = list_md_files(SOURCE_DIR)
        print(f"📄  {len(files)} .md files total:\n")
        for f in files:
            print(f"  {f}")

    elif arg == "--changed":
        changed = list_changed_md(SOURCE_DIR)
        if not changed:
            print("✅  No .md files changed since last condensation")
            sys.exit(0)
        print(f"📝  {len(changed)} .md files changed since last condensation:\n")
        for f in changed:
            print(f"  {f}")

    elif arg == "--mark-done":
        if len(sys.argv) < 3:
            print("Usage: python scripts/condense.py --mark-done <relative-path>")
            sys.exit(1)
        mark_done(sys.argv[2])

    elif arg == "--mark-all-done":
        mark_all_done()

    elif arg == "--check":
        missing, stale = check_sync(SOURCE_DIR, TARGET_DIR)
        if not missing and not stale:
            print("✅  .agent-src/ is in sync with .agent-src.uncondensed/")
            sys.exit(0)
        if missing:
            print(f"❌  Missing in .agent-src/ ({len(missing)}):")
            for f in missing:
                print(f"  {f}")
        if stale:
            print(f"❌  Stale in .agent-src/ ({len(stale)}):")
            for f in stale:
                print(f"  {f}")
        print(f"\nRun 'task sync' to fix non-.md files, then ask the agent to condense .md files.")
        sys.exit(1)

    elif arg == "--sync":
        print(f"Source: {SOURCE_DIR}")
        print(f"Target: {TARGET_DIR}\n")
        print("--- Syncing non-.md files ---")
        copied = sync_non_md(SOURCE_DIR, TARGET_DIR)
        print(f"\n--- Cleanup stale files ---")
        deleted = cleanup_stale(SOURCE_DIR, TARGET_DIR)
        # Also cleanup stale hashes (multi-root aware — resolve against
        # every artefact root, not just the legacy SOURCE_DIR).
        hashes = load_hashes()
        stale_keys = [k for k in hashes if _resolve_source(k) is None]
        for k in stale_keys:
            del hashes[k]
        if stale_keys:
            save_hashes(hashes)
            print(f"  Cleaned {len(stale_keys)} stale hash entries")
        changed = list_changed_md(SOURCE_DIR)
        print(f"\n✅  Done: {copied} copied, {deleted} stale deleted")
        if changed:
            print(f"📝  {len(changed)} .md files need condensation (run --changed to see them)")
        else:
            print(f"✅  All .md files are up to date")
        print(f"\n--- Projecting .agent-src/ → .augment/ ---")
        project_to_augment()

    elif arg == "--check-hashes":
        has_issues = False
        changed = list_changed_md(SOURCE_DIR)
        stale = find_stale_hashes(SOURCE_DIR)

        if stale:
            has_issues = True
            print(f"⚠️  {len(stale)} stale hash(es) for deleted source files:\n")
            for f in stale:
                print(f"  {f}")
            print(f"\nRun 'task sync-clean-hashes' to remove them.\n")

        if changed:
            has_issues = True
            print(f"❌  {len(changed)} .md file(s) need recondensation:\n")
            for f in changed:
                stored = load_hashes().get(f)
                reason = "no hash stored" if stored is None else "hash mismatch"
                print(f"  {f}  ({reason})")
            print(f"\nRun '/condense' command to recondense these files.")

        if not has_issues:
            print("✅  All condensation hashes are clean (no stale, no mismatches)")
            sys.exit(0)
        sys.exit(1)

    elif arg == "--clean-hashes":
        count = clean_stale_hashes(SOURCE_DIR)
        if count:
            print(f"✅  Removed {count} stale hash(es)")
        else:
            print("✅  No stale hashes found")

    elif arg == "--generate-tools":
        generate_tools()

    elif arg == "--clean-tools":
        clean_tools()

    elif arg == "--project-augment":
        project_to_augment()

    else:
        print("Usage: python scripts/condense.py [--sync|--list|--changed|--check|--check-hashes|--clean-hashes|--mark-done <path>|--mark-all-done|--generate-tools|--clean-tools|--project-augment]")
        sys.exit(1)


if __name__ == "__main__":
    main()
