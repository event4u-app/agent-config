#!/usr/bin/env python3
"""audit_cloud_compatibility.py — tier each artefact for cloud distribution.

Classifies every .md under .agent-src.uncondensed/{skills,rules,commands,
guidelines} into a tier:

  T1  Universal       no script / no FS / pure guidance
  T2  Local-Agent     references repo paths or FS work, no script
  T3-S Script-soft    mentions a script as one option (manual fallback exists)
  T3-H Script-hard    artefact's core procedure REQUIRES a script

Cloud-safe markers (HTML comment on its own line, anywhere in body):

  <!-- cloud_safe: noop -->     artefact is inert on cloud → tier = T1
  <!-- cloud_safe: degrade -->  prose fallback is provided → tier = T3-S

The marker downgrades the audit tier so build_cloud_bundle.py can emit a
cloud-aware variant. Source still ships its full local content; the
marker plus a "## Cloud Behavior" section is what the cloud agent reads.

Output: JSON summary on stdout + per-artefact list on --details.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE = ROOT / ".agent-src.uncondensed"
SCAN_DIRS = ["skills", "rules", "commands", "guidelines"]

# patterns
SCRIPT_RE = re.compile(
    r"(?:scripts/[a-z_]+\.(?:py|sh)|python3\s+scripts/|bash\s+scripts/|\./scripts/)"
)
TASK_RE = re.compile(r"`task\s+[a-z][a-z0-9-]+`")
HARD_RE = re.compile(
    r"(?:MUST\s+(?:run|invoke|call)|"
    r"^\s*[*-]?\s*(?:Run|Invoke|Call)\s+`?(?:python3\s+)?scripts/|"
    r"first\s+tool\s+call.*scripts/|"
    r"runs?\s+silently\s+before|"
    r"automatically\s+(?:invokes?|runs?)\s+`?scripts/)",
    re.IGNORECASE | re.MULTILINE,
)
FS_RE = re.compile(
    r"(?:dist/agent-src(?:\.uncondensed)?/|"
    r"\.augment/|\.claude/|\.cursor/|\.clinerules/|"
    r"agents/|\.agent-settings\.yml|\.agent-chat-history)"
)
CLOUD_MARKER_RE = re.compile(
    r"<!--\s*cloud_safe:\s*(noop|degrade)\s*-->",
    re.IGNORECASE,
)

# Cloud-action heuristics — Phase 4 Step 1, narrow second pass.
#
# Goal: flag only artefacts whose PROSE imperatives the cloud agent
# cannot execute. False positives from a broad first pass (inline
# backtick CLI, ```bash example blocks, "write a test" coding
# instructions) are explicitly excluded — the bundle builder's
# SANDBOX_NOTE preamble already neutralises CLI-as-guidance.
#
# Two signals that DO matter on cloud:
#
# 1. AGENT_EDIT_RE — procedure imperatively tells the AGENT to write
#    or edit a specific local path the user owns (`.agent-settings.yml`,
#    `.gitignore`, `.augmentignore`, `composer.json`, etc.). Plain
#    "create a file" / "write a class" is coding work, fine on cloud.
# 2. AGENT_RUN_RE — procedure imperatively tells the AGENT to invoke
#    a local command as ITS OWN action ("first tool call is …",
#    "MUST run `task ci`", "automatically invokes scripts/x.py").
#    Backtick CLI in mid-sentence ("with `composer install`") is
#    guidance for the user and does NOT match.
AGENT_EDIT_RE = re.compile(
    r"(?:"
    r"\b(?:edit|write|update|modify|patch|append\s+to|set)\s+"
    r"(?:the\s+|a\s+|this\s+|that\s+|your\s+)?"
    r"`?\.(?:agent-settings\.yml|gitignore|augmentignore|"
    r"agent-chat-history|env|claude/|cursor/|clinerules|windsurfrules)"
    r"|"
    r"\b(?:str-replace-editor|save-file|remove-files)\b"
    r")",
    re.IGNORECASE,
)
AGENT_RUN_RE = re.compile(
    r"(?:"
    r"MUST\s+(?:run|invoke|call|execute)\s+`?(?:task|python3|bash|"
    r"src/scripts/|\.augment/scripts/|\.augment/scripts)"
    r"|"
    r"first\s+tool\s+call\s+(?:is|must\s+be)\b"
    r"|"
    r"automatically\s+(?:invokes?|runs?)\s+`?(?:task|scripts/|"
    r"\.augment/scripts/)"
    r"|"
    r"runs?\s+silently\s+before"
    r"|"
    r"^\s*[*-]\s*(?:Run|Invoke|Call|Execute)\s+`(?:task|python3|"
    r"bash\s+scripts|scripts/|\.augment/scripts/)"
    r")",
    re.IGNORECASE | re.MULTILINE,
)
# READ_RE retained for completeness — but it's mostly informational
# (read-only ops are universally cloud-safe; we don't rewrite them).
AGENT_READ_RE = re.compile(
    r"\b(?:MUST\s+read|first\s+(?:reads?|inspects?))\s+"
    r"(?:the\s+|a\s+)?(?:file|frontmatter|`\.)",
    re.IGNORECASE,
)


def detect_cloud_marker(text: str) -> str | None:
    """Return 'noop', 'degrade', or None for the cloud-safe marker."""
    m = CLOUD_MARKER_RE.search(text)
    return m.group(1).lower() if m else None


def classify_cloud_action(text: str) -> str:
    """Tag T2/T3-S artefact with cloud-action category.

    Returns one of: 'reads-only', 'edits', 'runs-task', 'mixed', 'none'.
    Narrow heuristic — only matches imperatives directed at the agent
    itself. CLI examples shown to the user (backtick or ```bash) do
    not match — the bundle builder's SANDBOX_NOTE handles those.
    """
    has_edit = bool(AGENT_EDIT_RE.search(text))
    has_run = bool(AGENT_RUN_RE.search(text))
    has_read = bool(AGENT_READ_RE.search(text))

    active = sum([has_edit, has_run, has_read])
    if active == 0:
        return "none"
    if active >= 2:
        return "mixed"
    if has_edit:
        return "edits"
    if has_run:
        return "runs-task"
    return "reads-only"


def classify(text: str) -> tuple[str, dict]:
    scripts = sorted(set(SCRIPT_RE.findall(text)))
    tasks = sorted(set(m.strip("`") for m in TASK_RE.findall(text)))
    fs_refs = sorted(set(FS_RE.findall(text)))
    has_hard = bool(HARD_RE.search(text))
    cloud_marker = detect_cloud_marker(text)

    has_script = bool(scripts) or bool(tasks)
    has_fs = bool(fs_refs)

    if has_script and has_hard:
        raw_tier = "T3-H"
    elif has_script:
        raw_tier = "T3-S"
    elif has_fs:
        raw_tier = "T2"
    else:
        raw_tier = "T1"

    # Cloud marker downgrades the served tier — local behavior unchanged.
    if cloud_marker == "noop":
        tier = "T1"
    elif cloud_marker == "degrade":
        tier = "T3-S" if raw_tier == "T3-H" else raw_tier
    else:
        tier = raw_tier

    # Cloud-action category is meaningful for tiers that *might* run on
    # cloud (T1 / T2 / T3-S). For T3-H the answer is always "blocked".
    if tier in ("T1", "T2", "T3-S"):
        cloud_action = classify_cloud_action(text)
    else:
        cloud_action = "blocked"

    return tier, {
        "scripts": scripts,
        "tasks": tasks,
        "fs_refs_sample": fs_refs[:3],
        "has_hard_dep_marker": has_hard,
        "raw_tier": raw_tier,
        "cloud_marker": cloud_marker,
        "cloud_action": cloud_action,
    }


def scan() -> list[dict]:
    rows: list[dict] = []
    for sub in SCAN_DIRS:
        base = SOURCE / sub
        if not base.is_dir():
            continue
        for md in sorted(base.rglob("*.md")):
            if md.name.lower() == "readme.md":
                continue
            text = md.read_text(encoding="utf-8")
            tier, evidence = classify(text)
            rows.append({
                "path": str(md.relative_to(ROOT)),
                "kind": sub,
                "tier": tier,
                **evidence,
            })
    return rows


# step-9 P11 · U3 — Iron-Law bypass scan. Any Python module that loads
# `agents/settings/.ai-council.yml` directly (yaml.safe_load / open + parse) instead
# of going through `scripts.ai_council.config.load_council_config` skips the
# `_reject_top_level_locked_dispatch` gate and is a potential Iron-Law
# bypass. The scan is intentionally over-broad — false positives are
# annotated with `# iron-law-ok: …` on the offending line.
_IRON_LAW_YAML_LOAD_RE = re.compile(
    r"yaml\.(?:safe_load|load|full_load|unsafe_load)\s*\(",
)
_IRON_LAW_AI_COUNCIL_REF_RE = re.compile(
    r"['\"]\.ai-council\.yml['\"]|ai-council\.yml",
)
_IRON_LAW_ALLOWLIST = (
    # the canonical loader itself
    "src/scripts/ai_council/config.py",
    # tests are allowed to construct synthetic configs directly
    "tests/",
    # this audit script's own pattern definitions
    "src/scripts/audit_cloud_compatibility.py",
)


def _iron_law_bypass_scan() -> list[dict]:
    """Scan ``scripts/`` for code that bypasses the Iron-Law validator.

    A bypass is any module that calls a raw YAML loader on a value
    associated with ``.ai-council.yml`` outside the canonical loader
    in ``scripts/ai_council/config.py``. Proximity heuristic: the YAML
    load line, or the 3 lines preceding it, must reference
    ``ai-council.yml``. Annotate intentional cases with
    ``# iron-law-ok: <reason>`` on the load line to suppress.
    """
    findings: list[dict] = []
    scripts_dir = ROOT / "src" / "scripts"
    if not scripts_dir.is_dir():
        return findings
    for py in sorted(scripts_dir.rglob("*.py")):
        rel = py.relative_to(ROOT).as_posix()
        if any(rel.startswith(p) for p in _IRON_LAW_ALLOWLIST):
            continue
        try:
            text = py.read_text(encoding="utf-8")
        except OSError:
            continue
        lines = text.splitlines()
        offending: list[int] = []
        for i, line in enumerate(lines, start=1):
            if not _IRON_LAW_YAML_LOAD_RE.search(line):
                continue
            if "iron-law-ok" in line:
                continue
            window = "\n".join(lines[max(0, i - 4):i])
            if _IRON_LAW_AI_COUNCIL_REF_RE.search(window):
                offending.append(i)
        if offending:
            findings.append({
                "path": rel,
                "lines": offending,
                "reason": "raw YAML load on ai-council.yml — bypasses "
                          "_reject_top_level_locked_dispatch",
            })
    return findings


def summarize(rows: list[dict]) -> dict:
    by_tier = Counter(r["tier"] for r in rows)
    by_kind_tier: dict[str, Counter] = {}
    for r in rows:
        by_kind_tier.setdefault(r["kind"], Counter())[r["tier"]] += 1
    script_freq = Counter()
    task_freq = Counter()
    cloud_action_freq = Counter()
    cloud_action_by_tier: dict[str, Counter] = {}
    for r in rows:
        for s in r["scripts"]:
            script_freq[s] += 1
        for t in r["tasks"]:
            task_freq[t] += 1
        ca = r.get("cloud_action")
        if ca:
            cloud_action_freq[ca] += 1
            cloud_action_by_tier.setdefault(r["tier"], Counter())[ca] += 1
    return {
        "total": len(rows),
        "by_tier": dict(by_tier.most_common()),
        "by_kind_tier": {k: dict(v) for k, v in by_kind_tier.items()},
        "by_cloud_action": dict(cloud_action_freq.most_common()),
        "cloud_action_by_tier": {
            k: dict(v) for k, v in cloud_action_by_tier.items()
        },
        "top_scripts": script_freq.most_common(15),
        "top_tasks": task_freq.most_common(10),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--details", action="store_true",
                   help="emit per-artefact rows, not just summary")
    p.add_argument("--tier", choices=["T1", "T2", "T3-S", "T3-H"],
                   help="filter --details to one tier")
    p.add_argument(
        "--cloud-action",
        choices=["reads-only", "edits", "runs-task", "mixed", "none",
                 "blocked"],
        help="filter --details to one cloud-action category",
    )
    p.add_argument("--format", choices=["json", "md"], default="json")
    p.add_argument(
        "--iron-law",
        action="store_true",
        help="scan scripts/ for Iron-Law validator bypasses (step-9 P11 · U3)",
    )
    args = p.parse_args(argv)

    if args.iron_law:
        findings = _iron_law_bypass_scan()
        print(json.dumps({"iron_law_bypass_findings": findings}, indent=2))
        return 1 if findings else 0

    rows = scan()
    summary = summarize(rows)

    if args.details:
        filtered = [
            r for r in rows
            if (not args.tier or r["tier"] == args.tier)
            and (not args.cloud_action
                 or r.get("cloud_action") == args.cloud_action)
        ]
        if args.format == "json":
            print(json.dumps({"summary": summary, "rows": filtered}, indent=2))
        else:
            print(f"# Cloud-compat audit — tier filter: {args.tier or 'all'}"
                  f" · cloud-action: {args.cloud_action or 'all'}\n")
            print(f"Total in scope: {len(filtered)}\n")
            for r in filtered:
                marker = " 🔴" if r["has_hard_dep_marker"] else ""
                action = r.get("cloud_action", "—")
                print(f"- `{r['path']}` — **{r['tier']}** · "
                      f"action: `{action}`{marker}")
                if r["scripts"]:
                    print(f"  - scripts: `{'`, `'.join(r['scripts'])}`")
                if r["tasks"]:
                    print(f"  - tasks: `{'`, `'.join(r['tasks'])}`")
        return 0

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
