#!/usr/bin/env python3
"""Validate the A/B bench corpora + `docs/benchmark.md` shape.

Phase 5 Step 3 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

Checks:

- `internal/bench/corpora/ab-tracka.yaml`
  - version: 1
  - corpus_id: ab-tracka
  - prompts: ≥ 30 entries
  - per prompt: id, category ∈ {rule, skill}, expected_target, expected_keywords, prompt

- `internal/bench/corpora/ab-trackb.yaml`
  - version: 1
  - corpus_id: ab-trackb
  - tasks: ≥ 10 entries
  - per task: id, category ∈ {bugfix, feature, refactor, uiaudit, testadd},
    prompt, seed_files, success_criteria

- `docs/benchmark.md` (if it exists)
  - carries every section in REQUIRED_SECTIONS

Exit 0 on success, 1 on the first violation (with file + line where possible).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACK_A_PATH = REPO_ROOT / "internal" / "bench" / "corpora" / "ab-tracka.yaml"
TRACK_B_PATH = REPO_ROOT / "internal" / "bench" / "corpora" / "ab-trackb.yaml"
DOCS_PATH = REPO_ROOT / "docs" / "benchmark.md"

REQUIRED_SECTIONS = (
    "## Headline",
    "## Track A",
    "## Track B",
    "## Methodology",
    "## History",
)

TRACK_A_CATEGORIES = {"rule", "skill"}
TRACK_B_CATEGORIES = {"bugfix", "feature", "refactor", "uiaudit", "testadd"}

try:
    import yaml
except ImportError:
    sys.stderr.write("lint_bench_ab: PyYAML required (pip install pyyaml)\n")
    raise SystemExit(2)


class LintError(Exception):
    pass


def _fail(path: Path, msg: str) -> None:
    sys.stderr.write(f"lint_bench_ab: {path.relative_to(REPO_ROOT)}: {msg}\n")
    raise LintError(msg)


def lint_track_a() -> None:
    if not TRACK_A_PATH.exists():
        _fail(TRACK_A_PATH, "missing corpus file")
    data = yaml.safe_load(TRACK_A_PATH.read_text())
    if data.get("version") != 1:
        _fail(TRACK_A_PATH, f"version must be 1 (got {data.get('version')!r})")
    if data.get("corpus_id") != "ab-tracka":
        _fail(TRACK_A_PATH, f"corpus_id must be 'ab-tracka' (got {data.get('corpus_id')!r})")
    prompts = data.get("prompts") or []
    if not isinstance(prompts, list):
        _fail(TRACK_A_PATH, "prompts must be a list")
    if len(prompts) < 30:
        _fail(TRACK_A_PATH, f"prompts must have ≥ 30 entries (found {len(prompts)})")
    ids = set()
    for i, prompt in enumerate(prompts):
        loc = f"prompts[{i}]"
        if not isinstance(prompt, dict):
            _fail(TRACK_A_PATH, f"{loc} must be a mapping")
        pid = prompt.get("id")
        if not isinstance(pid, str) or not pid:
            _fail(TRACK_A_PATH, f"{loc}.id must be a non-empty string")
        if pid in ids:
            _fail(TRACK_A_PATH, f"{loc}.id duplicates an earlier id ({pid!r})")
        ids.add(pid)
        cat = prompt.get("category")
        if cat not in TRACK_A_CATEGORIES:
            _fail(TRACK_A_PATH, f"{loc}.category must be in {TRACK_A_CATEGORIES} (got {cat!r})")
        target = prompt.get("expected_target")
        if not isinstance(target, str) or not target:
            _fail(TRACK_A_PATH, f"{loc}.expected_target must be a non-empty string")
        keywords = prompt.get("expected_keywords")
        if keywords is not None and not isinstance(keywords, list):
            _fail(TRACK_A_PATH, f"{loc}.expected_keywords must be a list when present")
        if not isinstance(prompt.get("prompt"), str) or not prompt["prompt"]:
            _fail(TRACK_A_PATH, f"{loc}.prompt must be a non-empty string")


def lint_track_b() -> None:
    if not TRACK_B_PATH.exists():
        _fail(TRACK_B_PATH, "missing corpus file")
    data = yaml.safe_load(TRACK_B_PATH.read_text())
    if data.get("version") != 1:
        _fail(TRACK_B_PATH, f"version must be 1 (got {data.get('version')!r})")
    if data.get("corpus_id") != "ab-trackb":
        _fail(TRACK_B_PATH, f"corpus_id must be 'ab-trackb' (got {data.get('corpus_id')!r})")
    tasks = data.get("tasks") or []
    if not isinstance(tasks, list):
        _fail(TRACK_B_PATH, "tasks must be a list")
    if len(tasks) < 10:
        _fail(TRACK_B_PATH, f"tasks must have ≥ 10 entries (found {len(tasks)})")
    ids = set()
    for i, task in enumerate(tasks):
        loc = f"tasks[{i}]"
        if not isinstance(task, dict):
            _fail(TRACK_B_PATH, f"{loc} must be a mapping")
        tid = task.get("id")
        if not isinstance(tid, str) or not tid:
            _fail(TRACK_B_PATH, f"{loc}.id must be a non-empty string")
        if tid in ids:
            _fail(TRACK_B_PATH, f"{loc}.id duplicates an earlier id ({tid!r})")
        ids.add(tid)
        cat = task.get("category")
        if cat not in TRACK_B_CATEGORIES:
            _fail(TRACK_B_PATH, f"{loc}.category must be in {TRACK_B_CATEGORIES} (got {cat!r})")
        if not isinstance(task.get("prompt"), str) or not task["prompt"]:
            _fail(TRACK_B_PATH, f"{loc}.prompt must be a non-empty string")
        seeds = task.get("seed_files")
        if not isinstance(seeds, list):
            _fail(TRACK_B_PATH, f"{loc}.seed_files must be a list")
        crit = task.get("success_criteria")
        if not isinstance(crit, dict) or not crit:
            _fail(TRACK_B_PATH, f"{loc}.success_criteria must be a non-empty mapping")


def lint_doc(quiet: bool) -> None:
    if not DOCS_PATH.exists():
        if not quiet:
            sys.stdout.write(
                f"lint_bench_ab: {DOCS_PATH.relative_to(REPO_ROOT)} not yet rendered "
                "(run task bench:ab:diff) — skipping doc shape check\n"
            )
        return
    body = DOCS_PATH.read_text()
    missing = [section for section in REQUIRED_SECTIONS if section not in body]
    if missing:
        _fail(DOCS_PATH, f"missing required sections: {missing}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate A/B bench corpora + docs/benchmark.md.")
    parser.add_argument("--quiet", action="store_true", help="Only emit on error.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        lint_track_a()
        lint_track_b()
        lint_doc(args.quiet)
    except LintError:
        return 1
    if not args.quiet:
        sys.stdout.write("lint_bench_ab: OK\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
