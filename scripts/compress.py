#!/usr/bin/env python3
"""
Agent-config sync — compress .agent-src.uncompressed/ → .agent-src/
and project .agent-src/ → .augment/ (copies for rules by default,
symlinks for the rest; opt into rule symlinks via
augment.rules_use_symlinks in .agent-settings.yml).

Copies non-.md files as-is. Lists .md files that need compression (done by the
Augment agent interactively). Tracks SHA-256 hashes of source files to detect
changes since last compression.

Usage:
    python scripts/compress.py              # sync all non-.md files + cleanup + project
    python scripts/compress.py --list       # list .md files needing compression
    python scripts/compress.py --changed    # list only .md files changed since last compression
    python scripts/compress.py --check      # check if directories are in sync
    python scripts/compress.py --mark-done <relative-path>  # mark file as compressed (update hash)
    python scripts/compress.py --mark-all-done              # mark ALL .md files as compressed
    python scripts/compress.py --project-augment            # rebuild .augment/ projection
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

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
SOURCE_DIR = PROJECT_ROOT / ".agent-src.uncompressed"
TARGET_DIR = PROJECT_ROOT / ".agent-src"
AUGMENT_DIR = PROJECT_ROOT / ".augment"
HASH_FILE = PROJECT_ROOT / ".compression-hashes.json"
SETTINGS_FILE = PROJECT_ROOT / ".agent-settings.yml"


def _iter_sources():
    """Yield (physical_path, logical_relpath) for every source artefact.

    Wraps `_lib.agent_src.iter_all_sources` so the compressor walks every
    active source root (legacy `.agent-src.uncompressed/` plus any
    `packages/*/.agent-src.uncompressed/`) and keys outputs by the
    logical relative path that survives the physical move (ADR-017).
    """
    yield from iter_all_sources()


def _resolve_source(relative: str) -> Path | None:
    """Find the physical path that backs a logical relative path."""
    return resolve_logical(relative)


def _any_source_root_exists() -> bool:
    """True if at least one artefact source root contains files."""
    return bool(artefact_roots())

# Self-projection tool toggle — see .agent-tools.yml. When the file is
# absent (e.g. tests run in tmp dirs, consumer projects), `_active_tools`
# returns ``None`` which is treated as "emit every tool".
_ALL_TOOLS = frozenset({
    "claude-code", "claude-desktop", "augment", "copilot",
    "cursor", "windsurf", "cline", "gemini",
})


def _active_tools() -> frozenset[str] | None:
    """Return the set of active self-projection tools, or None for "all".

    Reads `.agent-tools.yml` relative to the current `PROJECT_ROOT` so
    test fixtures that monkey-patch `compress.PROJECT_ROOT` see their own
    (empty) project root and get the default "all tools" behaviour.
    """
    tools_file = PROJECT_ROOT / ".agent-tools.yml"
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

# Files to copy as-is even if .md (not compressed by agent)
COPY_AS_IS = {"README.md"}

# Directories (relative to SOURCE_DIR) whose .md content is data, not prose,
# and must be copied verbatim. Ghostwriter fixtures carry voice_samples that
# would be destroyed by caveman compression.
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




def file_hash(filepath: Path) -> str:
    """Return SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    h.update(filepath.read_bytes())
    return h.hexdigest()


def load_hashes() -> dict:
    """Load stored compression hashes from JSON file."""
    if HASH_FILE.exists():
        try:
            return json.loads(HASH_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_hashes(hashes: dict) -> None:
    """Save compression hashes to JSON file."""
    HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    HASH_FILE.write_text(json.dumps(hashes, indent=2, sort_keys=True) + "\n")


def mark_done(relative_path: str) -> None:
    """Mark a single file as compressed by storing its current source hash.

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
    hashes[relative_path] = file_hash(source_file)
    save_hashes(hashes)
    print(f"✅  Marked as compressed: {relative_path}")


def apply_path_rewriter(relative_path: str) -> bool:
    """Apply `_rewrite_paths` to `.agent-src/<relative_path>` in-place.

    Returns True if the file was modified, False otherwise. Silently
    returns False if the target doesn't exist (compression hasn't run
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
    """Mark ALL .md files as compressed (e.g. after initial full compression)."""
    hashes = load_hashes()
    count = 0
    for source_file, relative in _iter_sources():
        if not should_compress(source_file):
            continue
        hashes[relative] = file_hash(source_file)
        count += 1
    save_hashes(hashes)
    print(f"✅  Marked {count} files as compressed")


def list_changed_md(source_dir: Path) -> list:
    """List .md files whose source hash differs from stored hash (= need recompression).

    The ``source_dir`` parameter is retained for backward compatibility but
    ignored — iteration walks every active source root (ADR-017).
    """
    del source_dir  # multi-root: ignored, kept for signature stability
    hashes = load_hashes()
    changed = []
    for source_file, relative in _iter_sources():
        if not should_compress(source_file):
            continue
        current_hash = file_hash(source_file)
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



def should_compress(filepath: Path) -> bool:
    """Check if file should be compressed (is .md and not in copy-as-is list)."""
    if filepath.suffix != ".md":
        return False
    if filepath.name in COPY_AS_IS:
        return False
    # Determine the logical relative path so the COPY_AS_IS_DIRS check
    # works for both legacy (`.agent-src.uncompressed/`) and post-move
    # (`packages/*/.agent-src.uncompressed/`) source roots.
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
        if should_compress(source_file):
            continue  # .md files are compressed by the agent, not copied here
        if relative in seen:
            continue
        seen.add(relative)
        target_file = target_dir / relative
        copy_file(source_file, target_file)
        print(f"  Copied: {relative}")
        copied += 1
    return copied


def list_md_files(source_dir: Path) -> list:
    """List all .md files that need compression by the agent."""
    del source_dir  # multi-root: ignored, kept for signature stability
    files: list[str] = []
    seen: set[str] = set()
    for source_file, relative in _iter_sources():
        if not should_compress(source_file):
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

PERSONA_TOOL_DIRS = {
    ".claude/personas": "../../.agent-src/personas",
    ".cursor/personas": "../../.agent-src/personas",
}

USER_TYPE_TOOL_DIRS = {
    ".claude/user-types": "../../.agent-src/user-types",
    ".cursor/user-types": "../../.agent-src/user-types",
}

# Map tool-projection directories to the canonical tool ID used by
# `.agent-tools.yml`. Directories not in this map are always emitted.
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
    """Drop entries whose tool ID is not active in `.agent-tools.yml`."""
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
# Source files use logical names that the rewriter resolves at compress
# time, so the shipped `.agent-src/` (and `.augment/` projection) carry
# deployment-correct relative paths without the agent author having to
# know how deep their file lives.
#
# Frontmatter rewrites:
#   load_context: / load_context_eager:
#     contexts/<area>/<file>.md                          (logical, preferred)
#     .agent-src.uncompressed/contexts/<area>/<file>.md  (legacy)
#       → ../contexts/<area>/<file>.md  (relative from .agent-src/rules/)
#   triggers[].path_prefix:
#     LEFT ALONE — `path_prefix:` is a literal match pattern, not a
#     file reference. Source-of-truth rules that fire on edits under
#     `.agent-src.uncompressed/` keep that prefix verbatim (see
#     road-to-path-fixes.md P2.2 / Modified Option 1).
#
# Body-link rewrites:
#   ../../docs/guidelines/<file>.md  →  ../docs/guidelines/<file>.md
#   ../../docs/contracts/<file>.md   →  ../docs/contracts/<file>.md
#
# Idempotent: applying twice is a no-op (rewritten patterns no longer
# match the source patterns).

_LEGACY_SRC_PREFIX = ".agent-src.uncompressed/"
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
    fire when the agent edits files under `.agent-src.uncompressed/`
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
# frontmatter. The compressor injects a short, parser-stable banner block
# at the top of the projected body so every downstream surface (agent
# memory, .augment, .claude, etc.) surfaces the gate. Idempotent — the
# marker comment prevents double-injection on re-compress.

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
    level = None
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
            target = Path(rel_prefix) / rule
            if link.exists() or link.is_symlink():
                link.unlink()
            link.symlink_to(target)
            total += 1

    # Verify counts match across all tool directories
    source_count = len(rules)
    for tool_dir in tool_dirs:
        target_dir = PROJECT_ROOT / tool_dir
        tool_count = len([f for f in target_dir.iterdir() if f.is_symlink() and f.suffix == ".md"])
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


def _emit_cursor_mdc(source: Path, target: Path) -> None:
    """Write a Cursor `.mdc` file with Cursor-shaped frontmatter."""
    meta, body = _parse_frontmatter(source.read_text())
    description = (meta.get("description") or "").replace("\n", " ").strip()
    always_apply = bool(meta.get("alwaysApply") or meta.get("type") == "always")
    lines = [
        "---",
        f"description: {description}",
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
        f"description: {description}",
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


def generate_cursor_commands() -> int:
    """Symlink `.cursor/commands/<slug>.md` per source command."""
    if not COMMANDS_SOURCE.exists():
        return 0
    cmds = list(_iter_commands())
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


def generate_windsurf_workflows() -> int:
    """Symlink `.windsurf/workflows/<slug>.md` per source command."""
    if not COMMANDS_SOURCE.exists():
        return 0
    cmds = list(_iter_commands())
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


def generate_claude_skills() -> int:
    """Create .claude/skills/ symlinks for ALL skills in .agent-src/skills/.
    """
    if not SKILLS_SOURCE.exists():
        print("  ⚠️  .agent-src/skills/ not found — skipping skills", file=sys.stderr)
        return 0

    # All skill directories in .agent-src/skills/
    skills = sorted([d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()])
    # All command slugs (to protect from stale cleanup)
    command_slugs = {slug for _, slug in _iter_commands()}

    CLAUDE_SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    # Clean stale symlinks (but not converted commands or README)
    for item in CLAUDE_SKILLS_DIR.iterdir():
        if item.is_symlink() and item.name not in skills and item.name not in command_slugs and item.name != "README.md":
            item.unlink()

    count = 0
    for skill in skills:
        link = CLAUDE_SKILLS_DIR / skill
        if link.exists() or link.is_symlink():
            link.unlink()
        rel_target = Path("../../.agent-src/skills") / skill
        link.symlink_to(rel_target)
        count += 1

    info(f"  ✅  Created {count} skill symlinks in .claude/skills/")
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


def generate_claude_commands() -> int:
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
    for source_file, slug in _iter_commands():
        # Skip if a real skill with the same name exists — skill takes priority
        if slug in skill_names:
            skipped += 1
            continue

        current_slugs.add(slug)

        # Create skill directory (real dir, symlinked SKILL.md inside)
        skill_dir = CLAUDE_SKILLS_DIR / slug
        skill_dir.mkdir(parents=True, exist_ok=True)

        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists() or skill_file.is_symlink():
            skill_file.unlink()

        # Symlink: .claude/skills/{slug}/SKILL.md → ../../../.agent-src/commands/<rel-path>
        rel_path = source_file.relative_to(COMMANDS_SOURCE)
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
        if skill_md.is_symlink():
            entries = list(item.iterdir())
            if len(entries) == 1 and entries[0].name == "SKILL.md":
                skill_md.unlink()
                item.rmdir()
                removed_dirs += 1

    msg = f"  ✅  Created {count} command symlinks in .claude/skills/"
    if skipped:
        msg += f" ({skipped} skipped — same-name skill exists)"
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


def generate_tools() -> None:
    """Generate all tool-specific directories and files.

    `.agent-tools.yml` (top-level) gates per-tool emission. When the file
    is missing, every tool is emitted (preserves test fixtures and
    pre-gating behaviour). See `_active_tools()` and `_tool_active()`.
    """
    info("🔧  Generating multi-agent tool directories...\n")
    rules = generate_rule_symlinks()
    windsurfrules = generate_windsurfrules() if _tool_active("windsurf") else 0
    if _tool_active("gemini"):
        generate_gemini_md()
    skills = generate_claude_skills() if _tool_active("claude-code") else 0
    commands = generate_claude_commands() if _tool_active("claude-code") else 0
    personas = generate_persona_symlinks()
    user_types = generate_user_type_symlinks()
    cursor_mdc = generate_cursor_mdc_rules() if _tool_active("cursor") else 0
    windsurf_modern = generate_windsurf_modern_rules() if _tool_active("windsurf") else 0
    cursor_cmds = generate_cursor_commands() if _tool_active("cursor") else 0
    windsurf_wf = generate_windsurf_workflows() if _tool_active("windsurf") else 0
    summary = (
        f"✅  generate-tools — rules={rules} skills={skills} "
        f"commands={commands} personas={personas} user_types={user_types} "
        f"cursor_mdc={cursor_mdc} windsurf_rules={windsurf_modern} "
        f"cursor_commands={cursor_cmds} windsurf_workflows={windsurf_wf} "
        f"windsurfrules={windsurfrules}"
    )
    if resolve_level() == "verbose":
        print(f"\n{summary}")
    else:
        success(summary)
        flush_summary()


# ── .augment/ projection ──────────────────────────────────────────────
# The package uses .agent-src/ as the tool-agnostic compressed source of truth.
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
    # the next hook fire, not by compress.
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
    # `.agent-src.uncompressed/` as long as at least one package-scoped
    # source root carries artefacts.
    if not SOURCE_DIR.exists() and not _any_source_root_exists():
        print(f"❌  No source directory found (looked at {SOURCE_DIR} and packages/*/.agent-src.uncompressed)")
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
            print("✅  No .md files changed since last compression")
            sys.exit(0)
        print(f"📝  {len(changed)} .md files changed since last compression:\n")
        for f in changed:
            print(f"  {f}")

    elif arg == "--mark-done":
        if len(sys.argv) < 3:
            print("Usage: python scripts/compress.py --mark-done <relative-path>")
            sys.exit(1)
        mark_done(sys.argv[2])

    elif arg == "--mark-all-done":
        mark_all_done()

    elif arg == "--check":
        missing, stale = check_sync(SOURCE_DIR, TARGET_DIR)
        if not missing and not stale:
            print("✅  .agent-src/ is in sync with .agent-src.uncompressed/")
            sys.exit(0)
        if missing:
            print(f"❌  Missing in .agent-src/ ({len(missing)}):")
            for f in missing:
                print(f"  {f}")
        if stale:
            print(f"❌  Stale in .agent-src/ ({len(stale)}):")
            for f in stale:
                print(f"  {f}")
        print(f"\nRun 'task sync' to fix non-.md files, then ask the agent to compress .md files.")
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
            print(f"📝  {len(changed)} .md files need compression (run --changed to see them)")
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
            print(f"❌  {len(changed)} .md file(s) need recompression:\n")
            for f in changed:
                stored = load_hashes().get(f)
                reason = "no hash stored" if stored is None else "hash mismatch"
                print(f"  {f}  ({reason})")
            print(f"\nRun '/compress' command to recompress these files.")

        if not has_issues:
            print("✅  All compression hashes are clean (no stale, no mismatches)")
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
        print("Usage: python scripts/compress.py [--sync|--list|--changed|--check|--check-hashes|--clean-hashes|--mark-done <path>|--mark-all-done|--generate-tools|--clean-tools|--project-augment]")
        sys.exit(1)


if __name__ == "__main__":
    main()
