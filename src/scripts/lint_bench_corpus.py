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

import json
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

REPO = Path(__file__).resolve().parents[2]
CORPUS_DIR = REPO / "tests" / "eval"
ROUTER_COVERAGE_DIR = REPO / "internal" / "bench" / "corpora" / "router-coverage"
ROUTER_JSON = REPO / "dist" / "router.json"

# Live skill directories live under every artefact root post-monorepo
# Phase 4 (legacy + packages/*/.agent-src.uncondensed/skills/).
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import artefact_roots  # noqa: E402

SKILLS_DIRS = [root / "skills" for root in artefact_roots() if (root / "skills").is_dir()]

VALID_CATEGORIES = frozenset({"canonical", "ambiguous", "destructive", "long-context", "router-coverage"})
# Non-dev corpus (pre-spec) uses legacy categories — accept them so the
# new linter does not break that file. Migration is a follow-up.
LEGACY_CATEGORIES = frozenset({"content", "consulting", "finance", "ops", "safety"})
VALID_LANGUAGES = frozenset({"en", "de"})
VALID_VERSIONS = frozenset({1})
ID_RE = re.compile(r"^[a-z][a-z0-9-]*-\d{2}$")
FULL_COUNTS = {"canonical": 10, "ambiguous": 8, "destructive": 5, "long-context": 2}


def live_skills() -> set[str]:
    slugs: set[str] = set()
    for skills_dir in SKILLS_DIRS:
        slugs.update(
            p.name for p in skills_dir.iterdir()
            if p.is_dir() and (p / "SKILL.md").exists()
        )
    return slugs


def live_rule_ids() -> set[str] | None:
    """Return all rule ids known to dist/router.json (kernel + tier_1 + tier_2).

    Returns ``None`` (not an empty set) when the router is missing or
    unparseable, signalling "cannot validate rule ids — skip the
    unknown-trigger checks" rather than "every referenced id is unknown".
    A missing router is expected on a fresh clone before ``task sync``;
    returning an empty set there would falsely flag every intended /
    opaque trigger as ``unknown_intended_trigger``.
    """
    if not ROUTER_JSON.exists():
        sys.stderr.write(
            f"warning: {ROUTER_JSON.relative_to(REPO)} missing — skipping "
            "trigger rule-id validation (run `task sync` to generate it)\n"
        )
        return None
    try:
        data = json.loads(ROUTER_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        sys.stderr.write(
            f"warning: {ROUTER_JSON.relative_to(REPO)} unparseable — "
            "skipping trigger rule-id validation\n"
        )
        return None
    ids: set[str] = set()
    ids.update(data.get("kernel", []) or [])
    for tier in ("tier_1", "tier_2"):
        ids.update(
            r.get("id") for r in (data.get(tier, []) or []) if r.get("id")
        )
    return ids


def lint_corpus(path: Path, skills: set[str], rule_ids: set[str] | None = None) -> list[str]:
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
        if not isinstance(expected, list):
            errors.append(f"{loc}: bad_expected_shape")
        elif not expected and cat != "router-coverage":
            # router-coverage corpora can have empty expected_skills —
            # the focus is rule-trigger activation, not skill selection.
            # The intended_triggers field is the load-bearing assertion.
            errors.append(f"{loc}: empty_expected")
        else:
            for slug in expected:
                if slug not in skills:
                    errors.append(f"{loc}: unknown_skill: {slug}")

        if cat == "destructive":
            carve = p.get("expected_carve_outs") or []
            if not isinstance(carve, list) or not carve:
                errors.append(f"{loc}: missing_carve_out")

        # router-coverage invariants (Council R3 honesty floor).
        # A task's trigger prediction lives in two buckets:
        #   intended_triggers      — deterministically replayable (keyword /
        #                            phrase / command / path with supplied
        #                            open_files or command context).
        #   replay_opaque_triggers — fires at runtime only via an `intent`
        #                            trigger (or a router coverage gap) the
        #                            static replay cannot verify. Declared so
        #                            the telemetry reports it separately, not
        #                            as false `missed_intended` drift.
        # router-coverage requires at least one bucket non-empty.
        intended = p.get("intended_triggers")
        opaque = p.get("replay_opaque_triggers")
        intended_list = intended if isinstance(intended, list) else []
        opaque_list = opaque if isinstance(opaque, list) else []

        if intended is not None and not isinstance(intended, list):
            errors.append(f"{loc}: bad_intended_triggers_shape")
        if opaque is not None and not isinstance(opaque, list):
            errors.append(f"{loc}: bad_replay_opaque_triggers_shape")

        if cat == "router-coverage" and not intended_list and not opaque_list:
            errors.append(f"{loc}: missing_intended_triggers")

        # A rule belongs to exactly one bucket — both is a contradiction.
        for rid in sorted(set(intended_list) & set(opaque_list)):
            errors.append(f"{loc}: trigger_in_both_buckets: {rid}")

        # Every referenced id (either bucket) must be a real router rule id.
        if rule_ids is not None:
            for rid in intended_list + opaque_list:
                if rid not in rule_ids:
                    errors.append(f"{loc}: unknown_intended_trigger: {rid}")

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
    # Phase 2 of road-to-corpus-expansion-evidence-based-cuts adds a second
    # corpus tree under internal/bench/corpora/router-coverage/. Linter scans
    # both with the same invariants — router-coverage corpora additionally
    # require `intended_triggers` per prompt.
    if ROUTER_COVERAGE_DIR.is_dir():
        corpora.extend(sorted(ROUTER_COVERAGE_DIR.glob("*.yaml")))
    if not corpora:
        sys.stderr.write("error: no corpora found\n")
        return 2

    skills = live_skills()
    rule_ids = live_rule_ids()
    all_errors: list[str] = []
    for path in corpora:
        errs = lint_corpus(path, skills, rule_ids)
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
