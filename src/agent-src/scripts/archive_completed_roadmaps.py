#!/usr/bin/env python3
"""Archive completed roadmaps — the PR-gate (council 2026-06-14).

A roadmap that has reached ``count_open == 0`` and ``count_deferred == 0`` is
**complete**. This sweep moves it to ``agents/roadmaps/archive/``, rewrites
inbound references (``agents/roadmaps/<x>.md`` → ``agents/roadmaps/archive/<x>.md``)
across tracked files so links never break, and regenerates the dashboard.

It replaces the old **merge-gate** (keep one item open + a manual post-merge
archival step that got forgotten — leaving finished roadmaps to rot in ``main``)
with a deterministic **PR-gate**: ``/create-pr`` runs this before the PR is
created, so the roadmap lands already-archived in the PR and merges clean.

Default ``--changed-only``: only archive roadmaps that appear in this branch's
history since it diverged from ``origin/main`` (``git log origin/main..HEAD``),
so a PR archives exactly the roadmaps it completed — never an unrelated complete
roadmap. ``--all`` archives every complete active roadmap. No agent-set
annotation is required — completion is detected from the checkbox counts.

Usage:
    python3 scripts/archive_completed_roadmaps.py            # --changed-only (default)
    python3 scripts/archive_completed_roadmaps.py --all
    python3 scripts/archive_completed_roadmaps.py --base origin/main --dry-run
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_roadmap_progress as urp  # noqa: E402


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def _repo_root() -> Path:
    cp = _run(["git", "rev-parse", "--show-toplevel"], Path.cwd())
    return Path(cp.stdout.strip()) if cp.returncode == 0 else Path.cwd()


def _branch_touched_paths(root: Path, base: str) -> set[str] | None:
    """Repo-relative paths touched in any commit since divergence from base.

    Returns None when the base ref is unavailable (e.g. a shallow clone or a
    detached state) — callers treat None as "cannot scope, fall back to --all".
    """
    cp = _run(["git", "log", f"{base}..HEAD", "--name-only",
               "--pretty=format:"], root)
    if cp.returncode != 0:
        return None
    return {line.strip() for line in cp.stdout.splitlines() if line.strip()}


def _inbound_ref_rewrite(root: Path, old_rel: str, new_rel: str,
                         dry_run: bool) -> list[str]:
    """Rewrite full-path references ``old_rel`` → ``new_rel`` in tracked files.

    Only the exact repo-relative path is rewritten (bare-filename mentions like
    ``road-to-x.md`` are left alone — they do not resolve as links and do not
    break). The archived file's own path never matches because the search string
    is the un-archived path.
    """
    grep = _run(["git", "grep", "-l", "--", old_rel], root)
    changed: list[str] = []
    if grep.returncode != 0:  # 1 = no matches, fine
        return changed
    for rel in grep.stdout.splitlines():
        rel = rel.strip()
        if not rel or rel == old_rel:  # skip the roadmap file itself
            continue
        fp = root / rel
        try:
            text = fp.read_text(encoding="utf-8")
        except OSError:
            continue
        if old_rel not in text:
            continue
        if not dry_run:
            fp.write_text(text.replace(old_rel, new_rel), encoding="utf-8")
        changed.append(rel)
    return changed


def _git_mv(root: Path, src_rel: str, dst_rel: str, dry_run: bool) -> bool:
    dst = root / dst_rel
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        cp = _run(["git", "mv", src_rel, dst_rel], root)
        return cp.returncode == 0
    return True


def archive_completed(root: Path, *, changed_only: bool, base: str,
                      dry_run: bool) -> list[dict]:
    """Archive every complete active roadmap (count_open==0, count_deferred==0).

    Returns a list of ``{roadmap, archived_to, refs_migrated}`` records.
    """
    roadmap_root = root / "agents" / "roadmaps"
    if not roadmap_root.is_dir():
        return []
    touched = _branch_touched_paths(root, base) if changed_only else None
    # changed_only requested but base unavailable → conservative: archive nothing
    # rather than sweep unrelated roadmaps.
    if changed_only and touched is None:
        print(f"  ⚠️  cannot resolve `{base}` — skipping the changed-only "
              "archival sweep (run with --all to force).", file=sys.stderr)
        return []

    archived: list[dict] = []
    for stats in urp.collect(roadmap_root):
        if stats.open_ != 0 or stats.deferred != 0:
            continue  # not complete
        old_rel = f"agents/roadmaps/{stats.rel}"
        if changed_only and old_rel not in touched:
            continue  # complete, but not this branch's work
        new_rel = f"agents/roadmaps/archive/{stats.rel}"
        if not _git_mv(root, old_rel, new_rel, dry_run):
            print(f"  ⚠️  git mv failed for {old_rel}", file=sys.stderr)
            continue
        refs = _inbound_ref_rewrite(root, old_rel, new_rel, dry_run)
        if not dry_run and refs:
            _run(["git", "add", "--", *refs], root)
        archived.append({"roadmap": old_rel, "archived_to": new_rel,
                         "refs_migrated": refs})
    return archived


def _regen_dashboard(root: Path, dry_run: bool) -> None:
    if dry_run:
        return
    script = Path(__file__).resolve().parent / "update_roadmap_progress.py"
    _run([sys.executable, str(script)], root)
    dash = root / "agents" / "roadmaps-progress.md"
    if dash.is_file():
        _run(["git", "add", "--", "agents/roadmaps-progress.md"], root)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--all", action="store_true",
                    help="Archive every complete active roadmap (not only "
                         "those touched in this branch).")
    ap.add_argument("--base", default="origin/main",
                    help="Base ref for the changed-only scope (default origin/main).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Report what would be archived; touch nothing.")
    ns = ap.parse_args(argv)

    root = _repo_root()
    archived = archive_completed(root, changed_only=not ns.all,
                                 base=ns.base, dry_run=ns.dry_run)
    if not archived:
        print("  ℹ️  No completed roadmaps to archive.")
        return 0
    _regen_dashboard(root, ns.dry_run)
    verb = "Would archive" if ns.dry_run else "Archived"
    for rec in archived:
        print(f"  ✅  {verb}: {rec['roadmap']} → {rec['archived_to']}"
              + (f"  ({len(rec['refs_migrated'])} ref(s) migrated)"
                 if rec["refs_migrated"] else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
