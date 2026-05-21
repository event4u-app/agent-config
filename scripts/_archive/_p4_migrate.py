#!/usr/bin/env python3
"""P4.1 + P4.2 migration: rule → skill / guideline / command / contract stub.

Replaces 25 rules with thin stubs declaring `triggers:` + `routes_to:`.
For move-to-guideline, copies the rule body into a new guideline file.
For move-to-skill / command / contract, the target already carries the
procedure — stub keeps an Iron-Law one-liner only.
"""
from __future__ import annotations
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RULES = ROOT / ".agent-src.uncompressed" / "rules"
GUIDELINES = ROOT / "docs" / "guidelines"

# (rule_id, route, triggers, iron_law_one_liner)
# route format: "kind:id"
SKILL_MIGRATIONS = [
    ("agent-docs", "skill:agent-docs-writing",
     [("path_prefix", "agents/"), ("path_prefix", ".github/copilot-instructions"), ("keyword", "AGENTS.md"), ("keyword", "roadmap")],
     "Read agent docs (`AGENTS.md`, `agents/`, module `agents/`) before work; update them after structural changes."),
    ("analysis-skill-routing", "skill:analysis-skill-router",
     [("keyword", "analyze"), ("keyword", "analysis"), ("phrase", "dig into the codebase")],
     "Route analysis tasks to the narrowest matching `project-analysis-*` skill, not the broad fallback."),
    ("capture-learnings", "skill:learning-to-rule-or-skill",
     [("phrase", "after completing a task"), ("keyword", "learning"), ("keyword", "lesson")],
     "After a task, capture repeated mistakes / successful patterns as a rule or skill — never lose the learning."),
    ("cli-output-handling", "skill:rtk-output-filtering",
     [("keyword", "git"), ("keyword", "phpstan"), ("keyword", "rector"), ("keyword", "phpunit"), ("keyword", "composer")],
     "Wrap verbose CLI output with `rtk` when installed; fall back to `tail`/`grep` only when missing."),
    ("commit-conventions", "skill:conventional-commits-writing",
     [("keyword", "commit"), ("keyword", "branch"), ("phrase", "conventional commits")],
     "Use Conventional Commits (`feat:`, `fix:`, `chore:` …); branches `<type>/<short-slug>`; never invent your own format."),
    ("docker-commands", "skill:docker",
     [("keyword", "docker"), ("keyword", "artisan"), ("keyword", "composer"), ("phrase", "inside the container")],
     "Run PHP / artisan / composer / phpstan / rector / ecs / phpunit inside the project container, never on the host."),
    ("docs-sync", "skill:agent-docs-writing",
     [("path_prefix", ".agent-src.uncompressed/"), ("path_prefix", ".augment/"), ("keyword", "rename"), ("keyword", "delete")],
     "On any add / rename / delete of skill / rule / command / guideline, update counts and cross-references in the same edit."),
    ("e2e-testing", "command:e2e-heal",
     [("keyword", "playwright"), ("keyword", "e2e"), ("phrase", "page object")],
     "Playwright E2E: stable locators, no `waitForTimeout`, Page Objects for shared flows, fixtures over `beforeEach`."),
    ("laravel-translations", "skill:laravel",
     [("path_prefix", "lang/"), ("keyword", "translation"), ("keyword", "__()"), ("keyword", "trans(")],
     "Use `__()`/`trans()` with language keys for every user-visible string; mirror keys across `lang/<locale>/` files."),
    ("model-recommendation", "command:set-cost-profile",
     [("phrase", "switch task"), ("phrase", "new task"), ("phrase", "which model")],
     "On task / model switch, recommend the optimal model for the task complexity before any work begins."),
    ("onboarding-gate", "command:onboard",
     [("phrase", "first turn"), ("keyword", "onboarding"), ("path_prefix", ".agent-settings.yml")],
     "First turn of a project: if `onboarding.onboarded` is false, prompt `/onboard` before executing any other request."),
    ("package-ci-checks", "skill:lint-skills",
     [("phrase", "task ci"), ("phrase", "before push"), ("phrase", "before pr")],
     "Run `task ci` locally and confirm green before pushing or opening a PR in this package."),
    # review-routing-awareness was merged into reviewer-awareness on 2026-05-08
    # (see agents/settings/contexts/adr-auto-rule-consolidation.md) as part of the
    # Augment literal-budget relief work — Lever D consolidation.
    ("reviewer-awareness", "skill:review-routing",
     [("keyword", "reviewer"), ("phrase", "suggest reviewers"), ("phrase", "risk hotspot"), ("phrase", "ownership map")],
     "Anchor reviewer choice in paths and risk, never seniority; consult ownership-map + historical-bug-patterns; medium / high risk requires primary + secondary role."),
    ("skill-improvement-trigger", "skill:skill-improvement-pipeline",
     [("phrase", "after completing"), ("keyword", "improvement"), ("keyword", "pipeline")],
     "After a meaningful task, trigger the post-task learning capture if `pipelines.skill_improvement` is enabled."),
    ("slash-command-routing-policy", "skill:command-routing",
     [("keyword", "/create-pr"), ("keyword", "/commit"), ("keyword", "/fix-ci"), ("phrase", "slash command")],
     "On a slash-command invocation or pasted command body, route to the matching command file; never improvise."),
    ("ui-audit-gate", "skill:existing-ui-audit",
     [("path_prefix", "resources/views/"), ("path_prefix", "resources/js/"), ("keyword", "component"), ("keyword", "design token")],
     "Before any non-trivial UI change, require `state.ui_audit` findings — gate, not suggestion."),
    ("upstream-proposal", "skill:upstream-contribute",
     [("phrase", "after creating"), ("phrase", "after improving"), ("keyword", "upstream")],
     "After creating or significantly improving a skill / rule / guideline / command, ask whether to upstream it."),
]

GUIDELINE_MIGRATIONS = [
    ("artifact-engagement-recording", "contract:artifact-engagement-flow",
     [("phrase", "/implement-ticket"), ("phrase", "/work"), ("keyword", "telemetry")],
     "After a `/implement-ticket` or `/work` phase-step, emit one `telemetry:record` call with consulted + applied ids when telemetry is enabled."),
    ("augment-portability", "guideline:augment-portability-patterns",
     [("path_prefix", ".augment/"), ("path_prefix", ".agent-src.uncompressed/"), ("keyword", "portable")],
     "Files inside `.augment/` and `.agent-src.uncompressed/` MUST stay project-agnostic — no project names, domains, stacks."),
    ("command-suggestion-policy", "contract:command-suggestion-flow",
     [("phrase", "free-form prompt"), ("phrase", "command suggestion")],
     "When a free-form prompt matches a command, surface matches as numbered options with as-is escape; never auto-execute."),
    ("php-coding", "guideline:php/php-coding-patterns",
     [("file_pattern", "*.php"), ("keyword", "phpstan"), ("keyword", "ecs")],
     "PHP: strict types, named comparisons, early returns, Eloquent conventions — full pattern library in the guideline."),
    ("roadmap-progress-sync", "guideline:agent-infra/roadmap-progress-mechanics",
     [("path_prefix", "agents/roadmaps/")],
     "Any touch to `agents/roadmaps/` regenerates the dashboard in the same response; archive the roadmap when 0 open items remain."),
    ("rule-type-governance", "guideline:agent-infra/rule-type-governance",
     [("path_prefix", ".agent-src.uncompressed/rules/")],
     "Choose `always` vs `auto` per the governance table; over-broad `always` rules degrade the kernel budget."),
    ("skill-quality", "guideline:agent-infra/skill-quality-checklist",
     [("path_prefix", ".agent-src.uncompressed/skills/")],
     "Every skill must be executable, validated, and self-contained — full checklist in the guideline."),
]



def yaml_triggers(triggers: list[tuple[str, str]]) -> str:
    lines = []
    for kind, val in triggers:
        v = val.replace('"', '\\"')
        lines.append(f'  - {kind}: "{v}"')
    return "\n".join(lines)


def parse_existing_frontmatter(text: str) -> tuple[dict, str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not m:
        return {}, text
    fm_text, body = m.group(1), m.group(2)
    fm = {}
    for line in fm_text.split("\n"):
        if ":" not in line or line.startswith(" "):
            continue
        k, _, v = line.partition(":")
        fm[k.strip()] = v.strip().strip('"')
    return fm, body


def build_stub(rule_id: str, route: str, triggers: list[tuple[str, str]],
               iron_law: str, existing_fm: dict) -> str:
    desc = existing_fm.get("description", "")
    tier = existing_fm.get("tier", "3")
    rtype = existing_fm.get("type", "auto")
    source = existing_fm.get("source", "package")
    new_tier = {"1": "tier-1", "2a": "tier-2", "2b": "tier-2", "3": "tier-2",
                "mechanical-already": "tier-2", "mech": "tier-2"}.get(tier, "tier-2")
    fm_lines = [
        "---",
        f'type: "{rtype}"',
        f'tier: "{new_tier}"',
        f'description: "{desc}"',
        f'source: {source}',
        "triggers:",
        yaml_triggers(triggers),
        "routes_to:",
        f'  - "{route}"',
        "---",
        "",
        f"# {rule_id.replace('-', ' ').title()}",
        "",
        f"**Iron Law.** {iron_law}",
        "",
        f"Body migrated to `{route}` (per P4 of `road-to-kernel-and-router.md`).",
        "Trigger-set above activates this routing under the `balanced` and `full` profiles.",
    ]
    return "\n".join(fm_lines) + "\n"


def write_guideline(rule_id: str, route: str, body: str, existing_fm: dict) -> pathlib.Path:
    kind, _, gid = route.partition(":")
    if kind == "guideline":
        target = GUIDELINES / f"{gid}.md"
    elif kind == "contract":
        target = ROOT / "docs" / "contracts" / f"{gid}.md"
    else:
        raise ValueError(f"unsupported route kind for guideline migration: {kind}")
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    desc = existing_fm.get("description", "")
    header = (f"# {rule_id.replace('-', ' ').title()}\n\n"
              f"> {desc}\n\n"
              f"_Origin: migrated from `.agent-src.uncompressed/rules/{rule_id}.md` "
              f"per P4.2 of `road-to-kernel-and-router.md`._\n\n")
    target.write_text(header + body.lstrip())
    return target


def main() -> int:
    written = []
    for rule_id, route, triggers, iron_law in SKILL_MIGRATIONS:
        rule_path = RULES / f"{rule_id}.md"
        if not rule_path.exists():
            print(f"  ✗ MISSING rule: {rule_id}"); continue
        fm, body = parse_existing_frontmatter(rule_path.read_text())
        stub = build_stub(rule_id, route, triggers, iron_law, fm)
        rule_path.write_text(stub)
        written.append(("skill-stub", rule_id, route, len(stub)))
    for rule_id, route, triggers, iron_law in GUIDELINE_MIGRATIONS:
        rule_path = RULES / f"{rule_id}.md"
        if not rule_path.exists():
            print(f"  ✗ MISSING rule: {rule_id}"); continue
        fm, body = parse_existing_frontmatter(rule_path.read_text())
        write_guideline(rule_id, route, body, fm)
        stub = build_stub(rule_id, route, triggers, iron_law, fm)
        rule_path.write_text(stub)
        written.append(("guideline", rule_id, route, len(stub)))
    print(f"\nMigrated {len(written)} rules:")
    for kind, rid, route, sz in written:
        print(f"  {kind:14s} {rid:35s} → {route:55s} stub={sz}c")
    return 0


if __name__ == "__main__":
    sys.exit(main())
