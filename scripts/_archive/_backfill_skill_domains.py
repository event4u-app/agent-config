#!/usr/bin/env python3
"""One-shot back-fill: inject `domain:` frontmatter into every SKILL.md.

Removed after B3 lands. Source-of-truth = SKILL_DOMAIN_MAP below.
Fails loudly if the map and on-disk skill set diverge.
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

SKILL_DOMAIN_MAP: dict[str, str] = {
    "adr-create": "process", "adversarial-review": "quality",
    "agent-docs-writing": "process", "agents-md-thin-root": "process",
    "ai-council": "process", "analysis-autonomous-mode": "discovery",
    "analysis-skill-router": "discovery", "api-design": "engineering",
    "api-endpoint": "engineering", "api-testing": "quality",
    "artisan-commands": "engineering", "async-python-patterns": "engineering",
    "authz-review": "quality", "aws-infrastructure": "devops",
    "blade-ui": "engineering", "blast-radius-analyzer": "discovery",
    "bug-analyzer": "discovery", "check-refs": "process",
    "code-refactoring": "engineering", "code-review": "quality",
    "command-routing": "process", "command-writing": "process",
    "composer-packages": "engineering", "context-authoring": "process",
    "context-document": "process", "conventional-commits-writing": "process",
    "copilot-agents-optimization": "process", "copilot-config": "process",
    "dashboard-design": "devops", "data-flow-mapper": "discovery",
    "database": "engineering", "dcf-modeling": "product",
    "deep-reading-analyst": "discovery", "defense-in-depth": "quality",
    "dependency-upgrade": "engineering", "description-assist": "process",
    "design-review": "quality", "devcontainer": "devops",
    "developer-like-execution": "process", "docker": "devops",
    "dto-creator": "engineering", "eloquent": "engineering",
    "error-handling-patterns": "engineering", "estimate-ticket": "product",
    "existing-ui-audit": "discovery", "fe-design": "engineering",
    "feature-planning": "product", "file-editor": "process",
    "finishing-a-development-branch": "process", "flux": "engineering",
    "funnel-analysis": "product", "git-workflow": "process",
    "github-ci": "devops", "grafana": "devops",
    "guideline-writing": "process", "jira-integration": "process",
    "jobs-events": "engineering", "judge-bug-hunter": "quality",
    "judge-code-quality": "quality", "judge-security-auditor": "quality",
    "judge-test-coverage": "quality", "laravel": "engineering",
    "laravel-horizon": "engineering", "laravel-mail": "engineering",
    "laravel-middleware": "engineering", "laravel-notifications": "engineering",
    "laravel-pennant": "engineering", "laravel-pulse": "engineering",
    "laravel-reverb": "engineering", "laravel-scheduling": "engineering",
    "laravel-validation": "engineering", "learning-to-rule-or-skill": "process",
    "lint-skills": "process", "livewire": "engineering",
    "logging-monitoring": "devops", "markitdown": "process",
    "mcp": "process", "mcp-builder": "process",
    "md-language-check": "process", "merge-conflicts": "process",
    "migration-creator": "engineering", "mobile-e2e-strategy": "quality",
    "module-management": "process", "multi-tenancy": "engineering",
    "okr-tree-modeling": "product", "openapi": "engineering",
    "override-management": "process", "performance": "engineering",
    "performance-analysis": "discovery", "persona-writing": "process",
    "pest-testing": "quality", "php-coder": "engineering",
    "php-debugging": "engineering", "php-service": "engineering",
    "playwright-testing": "quality", "project-analysis-core": "discovery",
    "project-analysis-hypothesis-driven": "discovery",
    "project-analysis-laravel": "discovery", "project-analysis-nextjs": "discovery",
    "project-analysis-node-express": "discovery",
    "project-analysis-react": "discovery", "project-analysis-symfony": "discovery",
    "project-analysis-zend-laminas": "discovery", "project-analyzer": "discovery",
    "project-docs": "process", "prompt-engineering-patterns": "product",
    "prompt-optimizer": "product", "quality-tools": "quality",
    "react-native-setup": "devops", "react-shadcn-ui": "engineering",
    "readme-reviewer": "quality", "readme-writing": "process",
    "readme-writing-package": "process", "receiving-code-review": "process",
    "refine-prompt": "product", "refine-ticket": "product",
    "repomix-packer": "process", "requesting-code-review": "process",
    "review-routing": "quality", "rice-prioritization": "product",
    "roadmap-management": "process", "roadmap-writing": "process",
    "rtk-output-filtering": "process", "rule-writing": "process",
    "script-writing": "process", "secrets-management": "devops",
    "security": "quality", "security-audit": "quality",
    "sentry-integration": "devops", "sequential-thinking": "process",
    "skill-improvement-pipeline": "process", "skill-management": "process",
    "skill-reviewer": "quality", "skill-writing": "process",
    "sql-writing": "engineering", "subagent-orchestration": "process",
    "systematic-debugging": "discovery", "technical-specification": "product",
    "terraform": "devops", "terragrunt": "devops",
    "test-driven-development": "quality", "test-performance": "quality",
    "testing-anti-patterns": "quality", "threat-modeling": "quality",
    "token-optimizer": "process", "traefik": "devops",
    "unit-economics-modeling": "product", "universal-project-analysis": "discovery",
    "upstream-contribute": "process", "using-git-worktrees": "process",
    "validate-feature-fit": "quality", "verify-completion-evidence": "quality",
    "websocket": "engineering",
}
VALID_DOMAINS = {"engineering", "product", "quality", "devops", "process", "discovery"}


def main() -> int:
    # Default: source-of-truth tree. Pass --target=compressed to mirror into .agent-src/.
    target = ".agent-src.uncompressed/skills"
    for arg in sys.argv[1:]:
        if arg == "--target=compressed":
            target = ".agent-src/skills"
    skills_root = Path(target)
    on_disk = sorted(p.name for p in skills_root.iterdir() if p.is_dir())
    in_map = sorted(SKILL_DOMAIN_MAP.keys())
    missing = set(on_disk) - set(in_map)
    extra = set(in_map) - set(on_disk)
    if missing or extra:
        print(f"DRIFT: missing={sorted(missing)} extra={sorted(extra)}", file=sys.stderr)
        return 2
    bad = {k: v for k, v in SKILL_DOMAIN_MAP.items() if v not in VALID_DOMAINS}
    if bad:
        print(f"INVALID DOMAIN VALUES: {bad}", file=sys.stderr)
        return 2

    fm_pat = re.compile(r"^(---\n)(.*?)(\n---\n)", re.DOTALL)
    domain_line_pat = re.compile(r"^domain:[ \t]*[A-Za-z]+[ \t]*$", re.MULTILINE)
    source_line_pat = re.compile(r"^(source:[ \t]*\S+)$", re.MULTILINE)
    edited = 0
    for slug, domain in SKILL_DOMAIN_MAP.items():
        skill_md = skills_root / slug / "SKILL.md"
        text = skill_md.read_text()
        m = fm_pat.match(text)
        if not m:
            print(f"NO FRONTMATTER: {skill_md}", file=sys.stderr)
            return 2
        fm_body = m.group(2)
        if domain_line_pat.search(fm_body):
            new_fm = domain_line_pat.sub(f"domain: {domain}", fm_body)
        elif source_line_pat.search(fm_body):
            new_fm = source_line_pat.sub(rf"\1\ndomain: {domain}", fm_body)
        else:
            new_fm = fm_body.rstrip("\n") + f"\ndomain: {domain}"
        if new_fm != fm_body:
            skill_md.write_text(m.group(1) + new_fm + m.group(3) + text[m.end():])
            edited += 1
    print(f"Back-filled {edited}/{len(SKILL_DOMAIN_MAP)} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
