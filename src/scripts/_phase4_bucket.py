#!/usr/bin/env python3
"""R3 Phase 4 — one-off artefact-to-pack bucket map.

Encodes the council-locked mapping for all skills/rules/commands under
.agent-src.uncondensed/. Run with `--check` to emit a CSV preview;
run with `--pack <id>` to print the artefact paths for that pack so
the annotator can consume them via xargs.

Not a long-lived tool: deleted at the end of Phase 4 with the rest of
the one-off scripts (Iron-Law `check-one-off-location` is opted-out
because this lives at top-level scripts/, used once).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / ".agent-src.uncondensed"

# Explicit per-name overrides (highest priority). Use when domain/keyword
# heuristics misclassify. Council Q3 fallback is applied only if no entry.
NAME_TO_PACK: dict[str, str] = {
    # Already annotated (pilot)
    "php-coder": "php", "php-service": "php", "php-debugging": "php", "composer-packages": "php",
    # PHP frameworks
    "laravel": "laravel", "laravel-api-endpoint": "laravel", "laravel-dto": "laravel",
    "laravel-horizon": "laravel", "laravel-mail": "laravel", "laravel-middleware": "laravel",
    "laravel-migration": "laravel", "laravel-notifications": "laravel", "laravel-pennant": "laravel",
    "laravel-pulse": "laravel", "laravel-reverb": "laravel", "laravel-scheduling": "laravel",
    "laravel-validation": "laravel", "laravel-websocket": "laravel",
    "eloquent": "laravel", "artisan-commands": "laravel", "blade-ui": "laravel",
    "flux": "laravel", "livewire": "laravel", "livewire-architect": "laravel",
    "jobs-events": "laravel", "pest-testing": "laravel",
    "project-analysis-laravel": "laravel",
    "symfony-workflow": "symfony", "project-analysis-symfony": "symfony",
    "project-analysis-zend-laminas": "php",
    # JS/TS frameworks
    "nextjs-patterns": "nextjs", "project-analysis-nextjs": "nextjs",
    "react-shadcn-ui": "react", "react-native-setup": "react",
    "project-analysis-react": "react",
    "project-analysis-node-express": "typescript",
    # Python
    "async-python-patterns": "python",
    # Product
    "estimate-ticket": "product-basic", "refine-ticket": "product-basic",
    "po-discovery": "product-basic", "feature-planning": "product-basic",
    "technical-specification": "product-basic", "rice-prioritization": "product-basic",
    "stakeholder-tradeoff": "product-basic", "onboarding-design": "product-basic",
    "retention-loops": "product-basic", "churn-prevention": "product-basic",
    "funnel-analysis": "product-basic", "activation-design": "product-discovery",
    "customer-research": "product-discovery", "discovery-interview": "product-discovery",
    "voc-extract": "product-discovery",
    # GTM marketing
    "competitive-positioning": "gtm-marketing", "content-funnel-design": "gtm-marketing",
    "editorial-calendar": "gtm-marketing", "messaging-architecture": "gtm-marketing",
    "positioning-strategy": "gtm-marketing", "release-comms": "gtm-marketing",
    "voice-and-tone-design": "gtm-marketing", "gtm-launch": "gtm-marketing",
    # GTM sales
    "deal-qualification-meddic": "gtm-sales", "expansion-playbook": "gtm-sales",
    "forecast-accuracy": "gtm-sales", "pipeline-strategy": "gtm-sales",
    # Finance
    "dcf-modeling": "finance-advanced", "scenario-modeling": "finance-advanced",
    "forecasting": "finance-basic", "unit-economics-modeling": "finance-basic",
    "runway-cognition": "finance-basic",
    # Ops people
    "comp-banding": "ops-people", "hiring-loop-design": "ops-people",
    "onboarding-program": "ops-people", "one-on-one-cadence": "ops-people",
    "org-design": "ops-people", "perf-feedback-craft": "ops-people",
    "throughput-vs-morale-tradeoff": "ops-people", "contracts-cognition": "ops-people",
    # Founder
    "build-buy-partner": "founder-strategy", "competitive-moat-analysis": "founder-strategy",
    "market-entry-analysis": "founder-strategy", "fundraising-narrative": "founder-strategy",
    "okr-tree-modeling": "founder-strategy", "vision-articulation": "founder-strategy",
    "launch-readiness": "founder-strategy",
    # AI video
    "character-consistency": "ai-video", "motion-choreographer": "ai-video",
    "pixar-storyteller": "ai-video", "scene-expander": "ai-video",
    "video-director": "ai-video", "canvas-design": "ai-video",
    # Meta (agent-config maintenance)
    "ai-council": "meta", "command-routing": "meta", "command-writing": "meta",
    "condense-memory": "meta", "context-authoring": "meta", "context-document": "meta",
    "copilot-agents-optimization": "meta", "copilot-config": "meta",
    "description-assist": "meta", "guideline-writing": "meta",
    "learning-to-rule-or-skill": "meta", "lint-skills": "meta",
    "module-management": "meta", "override-management": "meta",
    "persona-writing": "meta", "rule-refactor": "meta", "rule-writing": "meta",
    "skill-improvement-pipeline": "meta", "skill-management": "meta",
    "skill-reviewer": "meta", "skill-writing": "meta", "check-refs": "meta",
    "agent-docs-writing": "meta", "agents-md-thin-root": "meta",
    "analysis-skill-router": "meta", "judge-bug-hunter": "meta",
    "judge-code-quality": "meta", "judge-security-auditor": "meta",
    "judge-test-coverage": "meta", "subagent-orchestration": "meta",
    "upstream-contribute": "meta", "review-routing": "meta",
    "readme-reviewer": "meta", "prompt-engineering-patterns": "meta",
    "prompt-optimizer": "meta", "refine-prompt": "meta",
    "mcp": "meta", "mcp-builder": "meta", "ai-council": "meta",
    "memory-consolidation": "meta", "rtk-output-filtering": "meta",
    "token-optimizer": "meta", "doc-coauthoring": "meta",
    "markitdown": "meta", "md-language-check": "meta",
    "repomix-packer": "meta", "script-writing": "meta",
    "project-docs": "meta", "sequential-thinking": "meta",
    "readme-writing": "meta", "readme-writing-package": "meta",
    "decision-record": "meta", "adr-create": "meta",
    "jira-integration": "meta", "roadmap-management": "meta",
    "roadmap-writing": "meta", "file-editor": "meta",
    "analysis-autonomous-mode": "meta",
}


def classify(name: str, domain: str) -> str:
    if name in NAME_TO_PACK:
        return NAME_TO_PACK[name]
    # Fallback by domain (council Q3 default branches)
    if domain in ("engineering", "quality", "devops", "discovery"):
        return "engineering-base"
    if domain == "process":
        return "engineering-base"  # git/workflow-ish remainder
    if domain == "product":
        return "product-basic"
    return "engineering-base"


# Rule name → pack (default: meta).
RULE_TO_PACK: dict[str, str] = {
    "commit-policy": "engineering-base", "commit-conventions": "engineering-base",
    "non-destructive-by-default": "engineering-base", "scope-control": "engineering-base",
    "git-history-discipline": "engineering-base", "downstream-changes": "engineering-base",
    "minimal-safe-diff": "engineering-base", "verify-before-complete": "engineering-base",
    "docker-commands": "engineering-base", "security-sensitive-stop": "engineering-base",
    "think-before-action": "engineering-base", "improve-before-implement": "engineering-base",
    "php-coding": "php",
    "laravel-routing": "laravel", "laravel-translations": "laravel",
    "symfony-routing": "symfony",
}


def classify_rule(name: str) -> str:
    return RULE_TO_PACK.get(name, "meta")


# Commands: by default all agent slash-commands are meta. Stack-specific
# carve-outs (none today; update-form-request-messages lives in user .claude/
# skills, not in commands).
COMMAND_TO_PACK: dict[str, str] = {}


def classify_command(rel_no_ext: str) -> str:
    return COMMAND_TO_PACK.get(rel_no_ext, "meta")


def classify_template(_rel_no_ext: str) -> str:
    # All templates scaffold agent artefacts (skill.md, rule.md, persona.md, …).
    return "meta"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", help="emit paths for this pack")
    ap.add_argument("--check", action="store_true", help="emit CSV preview")
    ap.add_argument("--kind", choices=["skill", "rule", "command", "template", "all"],
                    default="all", help="restrict to one artefact kind")
    args = ap.parse_args()

    rows: list[tuple[str, str, str]] = []
    if args.kind in ("skill", "all"):
        for skill_md in sorted(SRC.glob("skills/*/SKILL.md")):
            name = skill_md.parent.name
            domain = ""
            for line in skill_md.read_text(encoding="utf-8").splitlines()[:10]:
                if line.startswith("domain:"):
                    domain = line.split(":", 1)[1].strip()
                    break
            pack = classify(name, domain)
            rows.append((pack, name, str(skill_md.relative_to(ROOT))))
    if args.kind in ("rule", "all"):
        for rule_md in sorted((SRC / "rules").glob("*.md")):
            name = rule_md.stem
            pack = classify_rule(name)
            rows.append((pack, name, str(rule_md.relative_to(ROOT))))
    if args.kind in ("command", "all"):
        for cmd_md in sorted((SRC / "commands").rglob("*.md")):
            rel = cmd_md.relative_to(SRC / "commands").with_suffix("")
            pack = classify_command(rel.as_posix())
            rows.append((pack, rel.as_posix(), str(cmd_md.relative_to(ROOT))))
    if args.kind in ("template", "all"):
        for tpl_md in sorted((SRC / "templates").rglob("*.md")):
            rel = tpl_md.relative_to(SRC / "templates").with_suffix("")
            pack = classify_template(rel.as_posix())
            rows.append((pack, rel.as_posix(), str(tpl_md.relative_to(ROOT))))

    if args.check:
        from collections import Counter
        counts = Counter(r[0] for r in rows)
        for pack, n in counts.most_common():
            print(f"{n:>4}  {pack}")
        return 0
    if args.pack:
        for pack, _name, path in rows:
            if pack == args.pack:
                print(path)
        return 0
    for pack, name, path in rows:
        print(f"{pack},{name},{path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
