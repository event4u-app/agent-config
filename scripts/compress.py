#!/usr/bin/env python3
"""
Augment Sync — sync .augment.uncompressed/ → .augment/

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
SOURCE_DIR = PROJECT_ROOT / ".augment.uncompressed"
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
            print("✅  .augment/ is in sync with .augment.uncompressed/")
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

    else:
        print("Usage: python scripts/compress.py [--sync|--list|--changed|--check|--mark-done <path>|--mark-all-done]")
        sys.exit(1)


if __name__ == "__main__":
    main()
