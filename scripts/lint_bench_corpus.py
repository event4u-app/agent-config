#!/usr/bin/env python3
"""Lint benchmark corpora under tests/eval/corpus-*.yaml.

Enforces the contract from docs/contracts/benchmark-corpus-spec.md:
  - Required top-level keys (version, corpus_id, prompts) present.
  - version == 1.
  - selection_accuracy_target in [0.0, 1.0].
  - Per-prompt schema (id format, category enum, language enum,
    expected_skills non-empty + referencing real skills, destructive
    prompts carry expected_carve_outs, prompt text non-empty).
  - No duplicate ids within a corpus.

Hooked into `task ci` via `task lint-bench`. Step-4 Phase 1 Step 3.

Exit codes:
  0  contract holds across every corpus
  1  one or more violations
  2  invocation error (missing PyYAML, no corpora found)

Flags:
  --quiet            suppress per-file OK lines
  --require-full     also enforce 25-prompt composition (10/8/5/2)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("error: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

QUIET = "--quiet" in sys.argv
REQUIRE_FULL = "--require-full" in sys.argv

REPO = Path(__file__).resolve().parents[1]
CORPUS_DIR = REPO / "tests" / "eval"
SKILLS_DIR = REPO / ".agent-src.uncompressed" / "skills"

VALID_CATEGORIES = frozenset({"canonical", "ambiguous", "destructive", "long-context"})
# Non-dev corpus (pre-spec) uses legacy categories — accept them so the
# new linter does not break that file. Migration is a follow-up.
LEGACY_CATEGORIES = frozenset({"content", "consulting", "finance", "ops", "safety"})
VALID_LANGUAGES = frozenset({"en", "de"})
VALID_VERSIONS = frozenset({1})
ID_RE = re.compile(r"^[a-z][a-z0-9-]*-\d{2}$")
FULL_COUNTS = {"canonical": 10, "ambiguous": 8, "destructive": 5, "long-context": 2}


def live_skills() -> set[str]:
    return {p.name for p in SKILLS_DIR.iterdir() if p.is_dir() and (p / "SKILL.md").exists()}


def lint_corpus(path: Path, skills: set[str]) -> list[str]:
    errors: list[str] = []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        return [f"{path.name}: yaml_parse_error: {exc}"]

    if not isinstance(data, dict):
        return [f"{path.name}: missing_top_level: corpus must be a mapping"]

    for key in ("version", "corpus_id", "prompts"):
        if key not in data:
            errors.append(f"{path.name}: missing_top_level: {key}")

    if data.get("version") not in VALID_VERSIONS:
        errors.append(f"{path.name}: unsupported_version: {data.get('version')!r}")

    target = data.get("selection_accuracy_target")
    if target is not None and not (isinstance(target, (int, float)) and 0.0 <= target <= 1.0):
        errors.append(f"{path.name}: target_out_of_range: {target!r}")

    prompts = data.get("prompts") or []
    if not isinstance(prompts, list):
        return errors + [f"{path.name}: missing_top_level: prompts must be a list"]

    seen_ids: set[str] = set()
    bucket_counts: dict[str, int] = {}
    is_legacy = data.get("corpus_id") == "non-dev"
    for idx, p in enumerate(prompts):
        loc = f"{path.name}:#{idx}"
        if not isinstance(p, dict):
            errors.append(f"{loc}: bad_prompt_shape")
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not ID_RE.match(pid):
            errors.append(f"{loc}: bad_id_format: {pid!r}")
        elif pid in seen_ids:
            errors.append(f"{loc}: duplicate_id: {pid}")
        else:
            seen_ids.add(pid)

        cat = p.get("category")
        if cat not in VALID_CATEGORIES and not (is_legacy and cat in LEGACY_CATEGORIES):
            errors.append(f"{loc}: bad_category: {cat!r}")
        bucket_counts[cat] = bucket_counts.get(cat, 0) + 1

        lang = p.get("language", "en")
        if lang not in VALID_LANGUAGES:
            errors.append(f"{loc}: bad_language: {lang!r}")

        prompt_text = p.get("prompt", "")
        if not isinstance(prompt_text, str) or not prompt_text.strip():
            errors.append(f"{loc}: empty_prompt")

        expected = p.get("expected_skills") or []
        if not isinstance(expected, list) or not expected:
            errors.append(f"{loc}: empty_expected")
        else:
            for slug in expected:
                if slug not in skills:
                    errors.append(f"{loc}: unknown_skill: {slug}")

        if cat == "destructive":
            carve = p.get("expected_carve_outs") or []
            if not isinstance(carve, list) or not carve:
                errors.append(f"{loc}: missing_carve_out")

    if REQUIRE_FULL and not is_legacy:
        for bucket, want in FULL_COUNTS.items():
            have = bucket_counts.get(bucket, 0)
            if have != want:
                errors.append(f"{path.name}: composition_drift: {bucket} have={have} want={want}")

    return errors


def main() -> int:
    if not CORPUS_DIR.is_dir():
        sys.stderr.write(f"error: corpus dir missing: {CORPUS_DIR}\n")
        return 2
    corpora = sorted(CORPUS_DIR.glob("corpus-*.yaml"))
    if not corpora:
        sys.stderr.write("error: no corpora found\n")
        return 2

    skills = live_skills()
    all_errors: list[str] = []
    for path in corpora:
        errs = lint_corpus(path, skills)
        if errs:
            all_errors.extend(errs)
        elif not QUIET:
            print(f"✅  {path.name}: contract OK")

    if all_errors:
        for err in all_errors:
            print(f"❌  {err}", file=sys.stderr)
        return 1
    if not QUIET:
        print(f"✅  lint-bench: {len(corpora)} corpora clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
