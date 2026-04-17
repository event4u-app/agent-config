#!/usr/bin/env python3
"""
Augment Sync — sync .agent-src.uncompressed/ → .augment/

Copies non-.md files as-is. Lists .md files that need compression (done by the
Augment agent interactively). Tracks SHA-256 hashes of source files to detect
changes since last compression.

Usage:
    python scripts/compress.py              # sync all non-.md files + cleanup
    python scripts/compress.py --list       # list .md files needing compression
    python scripts/compress.py --changed    # list only .md files changed since last compression
    python scripts/compress.py --check      # check if directories are in sync
    python scripts/compress.py --mark-done <relative-path>  # mark file as compressed (update hash)
    python scripts/compress.py --mark-all-done              # mark ALL .md files as compressed
"""

import hashlib
import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = PROJECT_ROOT / ".agent-src.uncompressed"
TARGET_DIR = PROJECT_ROOT / ".augment"
HASH_FILE = PROJECT_ROOT / ".compression-hashes.json"

# Files to copy as-is even if .md (not compressed by agent)
COPY_AS_IS = {"README.md"}




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
    """Mark a single file as compressed by storing its current source hash."""
    source_file = SOURCE_DIR / relative_path
    if not source_file.exists():
        print(f"❌  Source file not found: {relative_path}")
        sys.exit(1)
    hashes = load_hashes()
    hashes[relative_path] = file_hash(source_file)
    save_hashes(hashes)
    print(f"✅  Marked as compressed: {relative_path}")


def mark_all_done() -> None:
    """Mark ALL .md files as compressed (e.g. after initial full compression)."""
    hashes = load_hashes()
    count = 0
    for source_file in sorted(SOURCE_DIR.rglob("*")):
        if source_file.is_dir():
            continue
        if not should_compress(source_file):
            continue
        relative = str(source_file.relative_to(SOURCE_DIR))
        hashes[relative] = file_hash(source_file)
        count += 1
    save_hashes(hashes)
    print(f"✅  Marked {count} files as compressed")


def list_changed_md(source_dir: Path) -> list:
    """List .md files whose source hash differs from stored hash (= need recompression)."""
    hashes = load_hashes()
    changed = []
    for source_file in sorted(source_dir.rglob("*")):
        if source_file.is_dir():
            continue
        if not should_compress(source_file):
            continue
        relative = str(source_file.relative_to(source_dir))
        current_hash = file_hash(source_file)
        stored_hash = hashes.get(relative)
        if stored_hash != current_hash:
            changed.append(relative)
    return changed


def find_stale_hashes(source_dir: Path) -> list:
    """Find hashes stored for source files that no longer exist."""
    hashes = load_hashes()
    stale = []
    for relative in sorted(hashes.keys()):
        source_file = source_dir / relative
        if not source_file.exists():
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
    return True


def copy_file(source: Path, target: Path) -> None:
    """Copy a non-.md file as-is."""
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def cleanup_stale(source_dir: Path, target_dir: Path) -> int:
    """Delete files in target that don't exist in source. Returns count."""
    deleted = 0
    if not target_dir.exists():
        return 0

    for target_file in sorted(target_dir.rglob("*")):
        if target_file.is_dir():
            continue
        relative = target_file.relative_to(target_dir)
        source_file = source_dir / relative
        if not source_file.exists():
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
    """Copy all non-.md files (and COPY_AS_IS .md files) from source to target. Returns count."""
    copied = 0
    for source_file in sorted(source_dir.rglob("*")):
        if source_file.is_dir():
            continue
        if should_compress(source_file):
            continue  # .md files are compressed by the agent, not copied here
        relative = source_file.relative_to(source_dir)
        target_file = target_dir / relative
        copy_file(source_file, target_file)
        print(f"  Copied: {relative}")
        copied += 1
    return copied


def list_md_files(source_dir: Path) -> list:
    """List all .md files that need compression by the agent."""
    files = []
    for source_file in sorted(source_dir.rglob("*")):
        if source_file.is_dir():
            continue
        if should_compress(source_file):
            files.append(str(source_file.relative_to(source_dir)))
    return files


def check_sync(source_dir: Path, target_dir: Path) -> tuple:
    """Check if target is in sync with source. Returns (missing, stale) lists."""
    missing = []
    stale = []

    # Files in source but not in target
    for source_file in sorted(source_dir.rglob("*")):
        if source_file.is_dir():
            continue
        relative = str(source_file.relative_to(source_dir))
        if not (target_dir / relative).exists():
            missing.append(relative)

    # Files in target but not in source (stale)
    if target_dir.exists():
        for target_file in sorted(target_dir.rglob("*")):
            if target_file.is_dir():
                continue
            relative = str(target_file.relative_to(target_dir))

            if not (source_dir / relative).exists():
                stale.append(relative)

    return missing, stale


# ── Multi-agent tool generation ──────────────────────────────────────

RULES_SOURCE = PROJECT_ROOT / ".augment" / "rules"

TOOL_DIRS = {
    ".claude/rules": "../../.augment/rules",
    ".cursor/rules": "../../.augment/rules",
    ".clinerules": "../.augment/rules",
}

SKILLS_SOURCE = PROJECT_ROOT / ".augment" / "skills"
COMMANDS_SOURCE = PROJECT_ROOT / ".augment" / "commands"
CLAUDE_SKILLS_DIR = PROJECT_ROOT / ".claude" / "skills"


def strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter (between --- markers) from content."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            content = content[end + 3:].lstrip("\n")
    return content


def generate_rule_symlinks() -> int:
    """Create symlink directories for rules (.claude/rules/, .cursor/rules/, .clinerules/).

    Symlinks ALL .md files from .augment/rules/ into tool-specific directories.
    """
    # All .md files in .augment/rules/ — not just universal ones
    rules = sorted([f.name for f in RULES_SOURCE.glob("*.md")])
    total = 0
    for tool_dir, rel_prefix in TOOL_DIRS.items():
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
    for tool_dir in TOOL_DIRS:
        target_dir = PROJECT_ROOT / tool_dir
        tool_count = len([f for f in target_dir.iterdir() if f.is_symlink() and f.suffix == ".md"])
        if tool_count != source_count:
            print(f"  ⚠️  {tool_dir}: {tool_count} rules (expected {source_count})")

    print(f"  ✅  Created {total} rule symlinks across {len(TOOL_DIRS)} tool directories ({source_count} rules each)")
    return total


def generate_windsurfrules() -> None:
    """Generate .windsurfrules by concatenating all rules (no frontmatter).
    """
    rules = sorted([f.name for f in RULES_SOURCE.glob("*.md")])
    parts = ["# Auto-generated from .augment/rules/ — do not edit directly\n"]

    for rule in rules:
        path = RULES_SOURCE / rule
        content = strip_frontmatter(path.read_text())
        parts.append(f"---\n\n{content.strip()}\n")

    output = PROJECT_ROOT / ".windsurfrules"
    output.write_text("\n".join(parts) + "\n")
    print(f"  ✅  Generated .windsurfrules ({len(rules)} rules)")


def generate_gemini_md() -> None:
    """Create GEMINI.md symlink to AGENTS.md."""
    link = PROJECT_ROOT / "GEMINI.md"
    if link.exists() or link.is_symlink():
        link.unlink()
    link.symlink_to("AGENTS.md")
    print("  ✅  Created GEMINI.md → AGENTS.md symlink")


def generate_claude_skills() -> None:
    """Create .claude/skills/ symlinks for ALL skills in .augment/skills/.
    """
    if not SKILLS_SOURCE.exists():
        print("  ⚠️  .augment/skills/ not found — skipping skills")
        return

    # All skill directories in .augment/skills/
    skills = sorted([d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()])
    # All command names (to protect from stale cleanup)
    command_names = set()
    if COMMANDS_SOURCE.exists():
        command_names = {f.stem for f in COMMANDS_SOURCE.glob("*.md")}

    CLAUDE_SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    # Clean stale symlinks (but not converted commands or README)
    for item in CLAUDE_SKILLS_DIR.iterdir():
        if item.is_symlink() and item.name not in skills and item.name not in command_names and item.name != "README.md":
            item.unlink()

    count = 0
    for skill in skills:
        link = CLAUDE_SKILLS_DIR / skill
        if link.exists() or link.is_symlink():
            link.unlink()
        rel_target = Path("../../.augment/skills") / skill
        link.symlink_to(rel_target)
        count += 1

    print(f"  ✅  Created {count} skill symlinks in .claude/skills/")


def extract_description_from_md(content: str) -> str:
    """Extract description from first # heading or first non-empty line."""
    for line in content.strip().split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line and not line.startswith("#"):
            return line[:120]
    return ""


def generate_claude_commands() -> None:
    """Create .claude/skills/{name}/SKILL.md symlinks for ALL Augment commands.

    Commands in .augment/commands/ are the single source of truth.
    They must include name: and disable-model-invocation: true in frontmatter
    (added once, then maintained as part of the command file).
    """
    if not COMMANDS_SOURCE.exists():
        print("  ⚠️  .augment/commands/ not found — skipping commands")
        return

    CLAUDE_SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    # Collect skill names to avoid overwriting real skills with same-name commands
    skill_names = set()
    if SKILLS_SOURCE.exists():
        skill_names = {d.name for d in SKILLS_SOURCE.iterdir() if d.is_dir()}

    count = 0
    skipped = 0
    for source_file in sorted(COMMANDS_SOURCE.glob("*.md")):
        name = source_file.stem

        # Skip if a real skill with the same name exists — skill takes priority
        if name in skill_names:
            skipped += 1
            continue

        # Create skill directory (real dir, symlinked SKILL.md inside)
        skill_dir = CLAUDE_SKILLS_DIR / name
        skill_dir.mkdir(parents=True, exist_ok=True)

        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists() or skill_file.is_symlink():
            skill_file.unlink()

        # Symlink: .claude/skills/{name}/SKILL.md → ../../../.augment/commands/{name}.md
        rel_target = Path("../../../.augment/commands") / source_file.name
        skill_file.symlink_to(rel_target)
        count += 1

    msg = f"  ✅  Created {count} command symlinks in .claude/skills/"
    if skipped:
        msg += f" ({skipped} skipped — same-name skill exists)"
    print(msg)


def generate_tools() -> None:
    """Generate all tool-specific directories and files."""
    print("🔧  Generating multi-agent tool directories...\n")
    generate_rule_symlinks()
    generate_windsurfrules()
    generate_gemini_md()
    generate_claude_skills()
    generate_claude_commands()
    print("\n✅  All tool directories generated")


def clean_tools() -> None:
    """Remove all generated tool directories and files."""
    import shutil as _shutil
    targets = [
        PROJECT_ROOT / ".claude",
        PROJECT_ROOT / ".cursor",
        PROJECT_ROOT / ".clinerules",
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
    if not SOURCE_DIR.exists():
        print(f"❌  Source directory not found: {SOURCE_DIR}")
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
            print("✅  .augment/ is in sync with .agent-src.uncompressed/")
            sys.exit(0)
        if missing:
            print(f"❌  Missing in .augment/ ({len(missing)}):")
            for f in missing:
                print(f"  {f}")
        if stale:
            print(f"❌  Stale in .augment/ ({len(stale)}):")
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
        # Also cleanup stale hashes
        hashes = load_hashes()
        stale_keys = [k for k in hashes if not (SOURCE_DIR / k).exists()]
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

    else:
        print("Usage: python scripts/compress.py [--sync|--list|--changed|--check|--check-hashes|--clean-hashes|--mark-done <path>|--mark-all-done|--generate-tools|--clean-tools]")
        sys.exit(1)


if __name__ == "__main__":
    main()
