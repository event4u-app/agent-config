#!/usr/bin/env python3
"""
Augment Sync — sync .augment.uncompressed/ → .augment/

Copies non-.md files as-is. Lists .md files that need compression (done by the
Augment agent interactively). Deletes stale files in .augment/ that no longer
exist in .augment.uncompressed/.

Usage:
    python scripts/compress.py              # sync all non-.md files + cleanup
    python scripts/compress.py --list       # list .md files needing compression
    python scripts/compress.py --check      # check if directories are in sync
"""

import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = PROJECT_ROOT / ".augment.uncompressed"
TARGET_DIR = PROJECT_ROOT / ".augment"

# Files to copy as-is even if .md (not compressed by agent)
COPY_AS_IS = {"README.md"}


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
        print(f"📄  {len(files)} .md files need compression by agent:\n")
        for f in files:
            print(f"  {f}")

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
        print(f"\nRun 'make sync' to fix non-.md files, then ask the agent to compress .md files.")
        sys.exit(1)

    elif arg == "--sync":
        print(f"Source: {SOURCE_DIR}")
        print(f"Target: {TARGET_DIR}\n")
        print("--- Syncing non-.md files ---")
        copied = sync_non_md(SOURCE_DIR, TARGET_DIR)
        print(f"\n--- Cleanup stale files ---")
        deleted = cleanup_stale(SOURCE_DIR, TARGET_DIR)
        md_files = list_md_files(SOURCE_DIR)
        print(f"\n✅  Done: {copied} copied, {deleted} stale deleted")
        if md_files:
            print(f"📄  {len(md_files)} .md files need compression by agent (run --list to see them)")

    else:
        print("Usage: python scripts/compress.py [--sync|--list|--check]")
        sys.exit(1)


if __name__ == "__main__":
    main()
