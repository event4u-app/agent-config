#!/usr/bin/env python3
"""Compile rule frontmatter into ``router.json``.

Reads ``.agent-src.uncompressed/rules/*.md``; produces deterministic JSON
mapping kernel + tier-1 + tier-2 rules to their triggers and routed
artifacts, per ``docs/contracts/rule-router.md``.

Stdlib-only, deterministic (sorted keys + sorted lists), idempotent.
Wired into ``task generate-tools`` after the compress step.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT / ".agent-src.uncompressed" / "rules"
OUT_PATH = ROOT / "router.json"
SETTINGS_PATH = ROOT / ".agent-settings.yml"
SCHEMA_VERSION = 1

# Compile-time rule toggles. Maps rule-id → settings predicate.
# Rule omitted from router.json when predicate returns False.
# Per road-to-token-frugality § Phase 8.2 — caveman.speak compile-time toggle.
COMPILE_TIME_TOGGLES = {
    "caveman-speak": lambda s: bool(
        s.get("caveman", {}).get("enabled", True)
    ) and bool(s.get("caveman", {}).get("speak", True)),
}

# Maps legacy tier values to the router-canonical names. See
# docs/contracts/rule-router.md § Backward compatibility.
LEGACY_TIER_MAP = {
    "1": "tier-1",
    "2": "tier-2",
    "2a": "tier-2",
    "3": "tier-1",
    "mechanical-already": "tier-1",
    "kernel": "kernel",
    "tier-1": "tier-1",
    "tier-2": "tier-2",
}

ALLOWED_TIERS = {"kernel", "tier-1", "tier-2"}
ALLOWED_PROFILES = {"minimal", "balanced", "full"}
ALLOWED_TRIGGER_KEYS = {"keyword", "phrase", "intent", "file_pattern",
                        "path_prefix", "command"}


def _parse_frontmatter(text: str) -> dict:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    block = text[4:end]
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(block) or {}
        return data if isinstance(data, dict) else {}
    except ImportError:
        return _parse_frontmatter_minimal(block)


def _parse_frontmatter_minimal(block: str) -> dict:
    """Minimal YAML parser fallback (flat scalars + simple lists)."""
    out: dict = {}
    cur_key = None
    for raw in block.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.startswith("  - ") and cur_key:
            out.setdefault(cur_key, []).append(line[4:].strip())
        elif ":" in line and not line.startswith(" "):
            k, _, v = line.partition(":")
            cur_key = k.strip()
            v = v.strip()
            if v in ("", "[]"):
                out[cur_key] = [] if v == "[]" else None
            else:
                out[cur_key] = v.strip('"').strip("'")
    return out


def _resolve_tier(rule_type: str, raw_tier: str) -> str:
    if rule_type == "always":
        return "kernel"
    return LEGACY_TIER_MAP.get(str(raw_tier), "tier-2")


def _normalize_trigger(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    keys = [k for k in item if k in ALLOWED_TRIGGER_KEYS]
    if len(keys) != 1:
        return None
    return {keys[0]: str(item[keys[0]])}


def _load_settings() -> dict:
    """Read .agent-settings.yml for compile-time toggles. Stdlib-only fallback."""
    if not SETTINGS_PATH.exists():
        return {}
    text = SETTINGS_PATH.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(text) or {}
        return data if isinstance(data, dict) else {}
    except ImportError:
        return {}


def _collect(rules_dir: Path) -> dict:
    settings = _load_settings()
    kernel: list[str] = []
    tiered: dict[str, list[dict]] = {"tier-1": [], "tier-2": []}
    for path in sorted(rules_dir.glob("*.md")):
        fm = _parse_frontmatter(path.read_text(encoding="utf-8"))
        if not fm:
            continue
        rule_id = path.stem
        if rule_id in COMPILE_TIME_TOGGLES:
            if not COMPILE_TIME_TOGGLES[rule_id](settings):
                continue
        rule_type = str(fm.get("type", "auto"))
        # Manual rules are reference-only (ADR-004) — no router emission.
        if rule_type == "manual":
            continue
        tier = _resolve_tier(rule_type, fm.get("tier", ""))
        if tier not in ALLOWED_TIERS:
            continue
        if tier == "kernel":
            kernel.append(rule_id)
            continue
        triggers_raw = fm.get("triggers") or []
        triggers = [t for t in (_normalize_trigger(x) for x in triggers_raw) if t]
        routes_to = sorted(str(x) for x in (fm.get("routes_to") or []))
        entry = {"id": rule_id, "triggers": triggers, "routes_to": routes_to}
        tiered[tier].append(entry)
    for k in tiered:
        tiered[k].sort(key=lambda x: x["id"])
    return {"kernel": sorted(kernel), **{k.replace("-", "_"): v for k, v in tiered.items()}}


def build() -> dict:
    collected = _collect(RULES_DIR)
    return {
        "schema_version": SCHEMA_VERSION,
        "kernel": collected["kernel"],
        "tier_1": collected["tier_1"],
        "tier_2": collected["tier_2"],
        "profiles": {
            "minimal":  ["__kernel__"],
            "balanced": ["__kernel__", "__tier_1__"],
            "full":     ["__kernel__", "__tier_1__", "__tier_2__"],
        },
    }


def main(argv: list[str]) -> int:
    out = build()
    text = json.dumps(out, indent=2, sort_keys=False) + "\n"
    if "--check" in argv:
        if not OUT_PATH.exists() or OUT_PATH.read_text(encoding="utf-8") != text:
            print("router.json out of date — run scripts/compile_router.py", file=sys.stderr)
            return 1
        print("✅  router.json is up to date")
        return 0
    OUT_PATH.write_text(text, encoding="utf-8")
    counts = (len(out["kernel"]), len(out["tier_1"]), len(out["tier_2"]))
    print(f"✅  router.json — kernel={counts[0]}  tier-1={counts[1]}  tier-2={counts[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
