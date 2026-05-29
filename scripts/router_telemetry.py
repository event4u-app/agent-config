#!/usr/bin/env python3
"""Local replay of the router against a corpus — pure, no API spend.

Phase 3 of `agents/roadmaps/road-to-value-dashboard-netto-cuts.md`.

For each prompt in a corpus, applies the same trigger-match logic
agent hosts would apply at runtime against `dist/router.json`:

- kernel rules: always active (no triggers, always-on by definition).
- tier_1 + tier_2 rules: active iff any trigger matches the prompt
  text (plus optional open-files / command context).

Trigger semantics implemented:

  | Type           | Match rule                                                       |
  |----------------|------------------------------------------------------------------|
  | `keyword`      | case-insensitive substring inside the prompt text                |
  | `phrase`       | case-insensitive substring (multi-word) inside the prompt text   |
  | `command`      | case-sensitive prefix on `command:` field (optional context)     |
  | `intent`       | informational only — never auto-matches; counted separately      |
  | `path_prefix`  | prefix match against any path in `open_files` (optional context) |
  | `file_pattern` | fnmatch against any path in `open_files` (optional context)      |

Reports go to `internal/bench/reports/router-telemetry/<UTC>.json`
with three blocks:

  - `per_trigger_hits`         — count of times each trigger fired
  - `per_rule_activations`     — count of times each rule activated
  - `panel_b_untouchable_rules` — tier-1 rules that activated on ≥ 1
                                  Track B task; hard floor for Phase 5

Sample size is capped per corpus (`--sample-cap`, default 200).
Larger corpora are replayed deterministically over the first N
sorted-by-id prompts.

Honours `--quiet` per the script-output convention.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTER_JSON = REPO_ROOT / "dist" / "router.json"
DEFAULT_OUT_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "router-telemetry"
DEFAULT_SAMPLE_CAP = 200

# Track B corpus = the Panel B evidence basis; rules that fire on its
# tasks are the attribution map and become the untouchable set.
TRACK_B_CORPUS_REL = "internal/bench/corpora/ab-trackb.yaml"


def _log(msg: str, quiet: bool, *, err: bool = False) -> None:
    if err:
        print(msg, file=sys.stderr)
    elif not quiet:
        print(msg)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── Trigger matching ────────────────────────────────────────────────────


def trigger_matches(
    trigger: Dict[str, Any],
    prompt: str,
    open_files: Optional[Iterable[str]] = None,
    command: Optional[str] = None,
) -> bool:
    """Apply one trigger to a prompt + context; return True on match."""
    prompt_lower = prompt.lower()
    if "keyword" in trigger:
        return str(trigger["keyword"]).lower() in prompt_lower
    if "phrase" in trigger:
        return str(trigger["phrase"]).lower() in prompt_lower
    if "command" in trigger:
        if not command:
            return False
        return command.startswith(str(trigger["command"]))
    if "path_prefix" in trigger:
        if not open_files:
            return False
        pref = str(trigger["path_prefix"])
        return any(str(p).startswith(pref) for p in open_files)
    if "file_pattern" in trigger:
        if not open_files:
            return False
        pat = str(trigger["file_pattern"])
        return any(fnmatch.fnmatch(str(p), pat) for p in open_files)
    if "intent" in trigger:
        # Intent triggers are informational and never auto-match.
        return False
    return False


def match_prompt(
    router: Dict[str, Any],
    prompt: str,
    profile: str = "full",
    open_files: Optional[Iterable[str]] = None,
    command: Optional[str] = None,
) -> Dict[str, Any]:
    """Return the matched-triggers + activated-rules for one prompt.

    Kernel rules are always active. tier_1 always considered. tier_2
    only considered when `profile == 'full'`.
    """
    tiers = [("tier_1", router.get("tier_1", []) or [])]
    if profile == "full":
        tiers.append(("tier_2", router.get("tier_2", []) or []))

    matched_triggers: List[Dict[str, Any]] = []
    activated_rules: List[Dict[str, Any]] = []

    for tier_name, rules in tiers:
        for rule in rules:
            rule_id = rule.get("id")
            rule_triggers = rule.get("triggers", []) or []
            rule_hit = False
            for trig in rule_triggers:
                if trigger_matches(trig, prompt, open_files, command):
                    matched_triggers.append({"tier": tier_name, "rule": rule_id, "trigger": trig})
                    rule_hit = True
            if rule_hit:
                activated_rules.append({"tier": tier_name, "rule": rule_id})

    # Kernel rules are always active.
    for kid in router.get("kernel", []) or []:
        activated_rules.append({"tier": "kernel", "rule": kid})

    return {
        "matched_triggers": matched_triggers,
        "activated_rules": activated_rules,
    }


# ── Corpus loading ──────────────────────────────────────────────────────


def _safe_yaml_load(path: Path) -> Optional[Dict[str, Any]]:
    if yaml is None or not path.exists():
        return None
    try:
        return yaml.safe_load(path.read_text()) or {}
    except yaml.YAMLError:
        return None


def load_corpus_prompts(
    corpus_path: Path, sample_cap: int
) -> List[Dict[str, Any]]:
    """Return per-prompt entries capped at sample_cap, sorted by id.

    Each entry: `{id, text, intended_triggers, open_files, command}`.
    All context fields beyond id/text are optional; missing → defaults.
    """
    data = _safe_yaml_load(corpus_path)
    if not data:
        return []
    out: List[Dict[str, Any]] = []
    # Track B uses `tasks:`, dev uses `prompts:`.
    for key in ("tasks", "prompts"):
        for entry in data.get(key, []) or []:
            pid = str(entry.get("id", ""))
            text = entry.get("prompt") or entry.get("text") or ""
            intended = entry.get("intended_triggers") or []
            open_files = entry.get("open_files") or []
            command = entry.get("command") or None
            if not isinstance(intended, list):
                intended = []
            if not isinstance(open_files, list):
                open_files = []
            if pid and text:
                out.append(
                    {
                        "id": pid,
                        "text": str(text),
                        "intended_triggers": [str(t) for t in intended],
                        "open_files": [str(p) for p in open_files],
                        "command": str(command) if command else None,
                    }
                )
    out.sort(key=lambda x: x["id"])
    return out[:sample_cap]


# ── Aggregation ─────────────────────────────────────────────────────────


def aggregate_replay(
    router: Dict[str, Any],
    corpora: List[Tuple[str, Path]],
    sample_cap: int,
    profile: str,
) -> Dict[str, Any]:
    """Replay every corpus through the router; aggregate hits."""
    per_trigger_hits: Dict[str, int] = {}
    per_rule_activations: Dict[str, Dict[str, int]] = {}
    panel_b_seen_tier1: set = set()
    panel_b_seen_tier2: set = set()
    per_corpus_summary: List[Dict[str, Any]] = []
    intended_vs_observed: List[Dict[str, Any]] = []
    unintended_histogram: Dict[str, int] = {}

    for corpus_name, corpus_path in corpora:
        prompts = load_corpus_prompts(corpus_path, sample_cap)
        corpus_rule_hits: Dict[str, int] = {}
        for entry in prompts:
            pid = entry["id"]
            text = entry["text"]
            intended = entry["intended_triggers"]
            result = match_prompt(
                router,
                text,
                profile=profile,
                open_files=entry["open_files"] or None,
                command=entry["command"],
            )
            for hit in result["matched_triggers"]:
                key = f"{hit['rule']}::{json.dumps(hit['trigger'], sort_keys=True)}"
                per_trigger_hits[key] = per_trigger_hits.get(key, 0) + 1
            seen_in_prompt: set = set()
            for act in result["activated_rules"]:
                rid = act["rule"]
                if rid is None or act["tier"] == "kernel":
                    # Skip kernel — always-on by definition, no signal.
                    continue
                seen_in_prompt.add((act["tier"], rid))
            activated_ids = {rid for _t, rid in seen_in_prompt}
            for tier, rid in seen_in_prompt:
                per_rule_activations.setdefault(tier, {})
                per_rule_activations[tier][rid] = (
                    per_rule_activations[tier].get(rid, 0) + 1
                )
                corpus_rule_hits[rid] = corpus_rule_hits.get(rid, 0) + 1
                if corpus_name == "ab-trackb":
                    if tier == "tier_1":
                        panel_b_seen_tier1.add(rid)
                    elif tier == "tier_2":
                        panel_b_seen_tier2.add(rid)
            # Council R3 honesty floor: surface intended vs observed.
            if intended:
                intended_set = set(intended)
                hit = sorted(intended_set & activated_ids)
                miss = sorted(intended_set - activated_ids)
                unintended = sorted(activated_ids - intended_set)
                intended_vs_observed.append(
                    {
                        "corpus": corpus_name,
                        "task": pid,
                        "intended": sorted(intended),
                        "hit": hit,
                        "missed_intended": miss,
                        "unintended_activations": unintended,
                    }
                )
                # Council R3 #3: inter-rule conflict histogram.
                for rid in unintended:
                    unintended_histogram[rid] = unintended_histogram.get(rid, 0) + 1
        per_corpus_summary.append(
            {
                "corpus": corpus_name,
                "prompts_replayed": len(prompts),
                "unique_rules_activated": len(corpus_rule_hits),
                "top_rules": sorted(
                    corpus_rule_hits.items(), key=lambda x: -x[1]
                )[:10],
            }
        )

    panel_b_untouchable = sorted(panel_b_seen_tier1)
    return {
        "per_trigger_hits": per_trigger_hits,
        "per_rule_activations": per_rule_activations,
        "panel_b_untouchable_rules": panel_b_untouchable,
        "panel_b_tier2_drivers": sorted(panel_b_seen_tier2),
        "per_corpus_summary": per_corpus_summary,
        "intended_vs_observed_match": intended_vs_observed,
        "unintended_activation_histogram": sorted(
            unintended_histogram.items(), key=lambda x: -x[1]
        ),
    }


# ── Reports ─────────────────────────────────────────────────────────────


def write_report(
    aggregate: Dict[str, Any],
    out_dir: Path,
    corpora_paths: List[Path],
    sample_cap: int,
    profile: str,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = _utc_iso().replace(":", "-")
    out_path = out_dir / f"{stamp}.json"
    latest = out_dir / "latest.json"
    payload = {
        "schema_version": 1,
        "schema_id": "router-telemetry-v1",
        "generated_at": _utc_iso(),
        "config": {
            "router": "dist/router.json",
            "profile": profile,
            "sample_cap_per_corpus": sample_cap,
            "corpora": [str(p.relative_to(REPO_ROOT)) for p in corpora_paths],
        },
        **aggregate,
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    out_path.write_text(text)
    latest.write_text(text)
    return out_path


def find_never_matched_tier1(router: Dict[str, Any], activations: Dict[str, Any]) -> List[str]:
    """Tier-1 rules with zero activations across all corpora — dead-rule candidates."""
    tier_1_activations = activations.get("tier_1", {}) or {}
    all_tier_1_ids = [r.get("id") for r in router.get("tier_1", []) if r.get("id")]
    return sorted([rid for rid in all_tier_1_ids if rid not in tier_1_activations])


# ── Entry point ─────────────────────────────────────────────────────────


def run(
    corpora: List[Tuple[str, Path]],
    out_dir: Path = DEFAULT_OUT_DIR,
    sample_cap: int = DEFAULT_SAMPLE_CAP,
    profile: str = "full",
    quiet: bool = False,
) -> int:
    if not ROUTER_JSON.exists():
        _log(f"router not found: {ROUTER_JSON}", quiet, err=True)
        return 1
    try:
        router = json.loads(ROUTER_JSON.read_text())
    except json.JSONDecodeError as exc:
        _log(f"failed to parse router: {exc}", quiet, err=True)
        return 1

    _log(
        f"router_telemetry: replaying {len(corpora)} corpora · "
        f"cap={sample_cap} prompts/corpus · profile={profile}",
        quiet,
    )
    agg = aggregate_replay(router, corpora, sample_cap, profile)
    never_matched = find_never_matched_tier1(router, agg["per_rule_activations"])
    agg["never_matched_tier1"] = never_matched

    out_path = write_report(
        agg, out_dir, [p for _name, p in corpora], sample_cap, profile
    )
    relpath = out_path.relative_to(REPO_ROOT)
    _log(
        f"router_telemetry: wrote {relpath} · "
        f"panel_b_untouchable={len(agg['panel_b_untouchable_rules'])} · "
        f"never_matched_tier1={len(never_matched)}",
        quiet=False,
    )
    return 0


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument(
        "--corpus",
        action="append",
        default=[],
        metavar="NAME:PATH",
        help="Repeatable. NAME tags the corpus in the report; PATH is the YAML.",
    )
    p.add_argument(
        "--sample-cap",
        type=int,
        default=DEFAULT_SAMPLE_CAP,
        help="Max prompts per corpus (default %(default)s).",
    )
    p.add_argument(
        "--profile",
        choices=["balanced", "full"],
        default="full",
        help="Routing profile (default 'full' — includes tier-2 rules).",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Output directory (default %(default)s).",
    )
    p.add_argument("--quiet", action="store_true")
    return p.parse_args(argv)


def _default_corpora() -> List[Tuple[str, Path]]:
    """The default manifest: original 3 corpora + every router-coverage file.

    Phase 3 of road-to-corpus-expansion-evidence-based-cuts: adding a new
    corpus file under `internal/bench/corpora/router-coverage/` no longer
    requires editing this script — the manifest auto-discovers them.
    """
    corpora: List[Tuple[str, Path]] = [
        ("ab-trackb", REPO_ROOT / TRACK_B_CORPUS_REL),
        ("dev", REPO_ROOT / "tests/eval/corpus-dev.yaml"),
        ("non-dev", REPO_ROOT / "tests/eval/corpus-non-dev.yaml"),
    ]
    coverage_dir = REPO_ROOT / "internal" / "bench" / "corpora" / "router-coverage"
    if coverage_dir.is_dir():
        for p in sorted(coverage_dir.glob("*.yaml")):
            # Tag name: "router-coverage:<stem>" so the report distinguishes
            # them from the original 3 corpora at a glance.
            corpora.append((f"router-coverage:{p.stem}", p))
    return corpora


def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if not args.corpus:
        corpora = _default_corpora()
    else:
        corpora = []
        for spec in args.corpus:
            if ":" not in spec:
                print(f"--corpus expects NAME:PATH, got {spec!r}", file=sys.stderr)
                return 1
            name, path = spec.split(":", 1)
            corpora.append((name.strip(), Path(path.strip())))
    return run(
        corpora,
        out_dir=args.out,
        sample_cap=args.sample_cap,
        profile=args.profile,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    raise SystemExit(main())
