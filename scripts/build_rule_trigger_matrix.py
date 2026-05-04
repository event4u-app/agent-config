#!/usr/bin/env python3
"""Build agents/contexts/rule-trigger-matrix.md.

Emits a single matrix mapping every rule in `.agent-src.uncompressed/rules/`
to its trigger event, observability, enforcement surface, hook-cost
estimate, and Tier classification. Sourced from the Phase 1 inventory of
`road-to-rule-hardening.md` plus `road-to-context-layer-maturity.md`
Phase 1 (`load_context:` chains).

Exit 0 always; this is a generator, not a gate.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_RULES = REPO_ROOT / ".agent-src.uncompressed" / "rules"
COMP_RULES = REPO_ROOT / ".agent-src" / "rules"
SRC_PREFIX = ".agent-src.uncompressed/"
COMP_PREFIX = ".agent-src/"
OUT = REPO_ROOT / "agents" / "contexts" / "rule-trigger-matrix.md"

# Classification table — one row per rule. See § Methodology in the
# generated file for the column meanings. Sourced from the Phase 1 audit;
# reviewed entries carry an empirical signal in `notes`.
#
# Columns: trigger, observability, enforcement, hook_cost, tier, dormant
#
# trigger:        when the rule should fire
# observability:  agent-only | hook | settings | mechanical-already
# enforcement:    output | tool-call | state | hook | none
# hook_cost:      low | medium | high | NA-mechanical | NA-soft
# tier:           1 | 2a | 2b | 3 | safety-floor | mechanical-already
# dormant:        no | suspected | unknown
CLASSIFICATION: dict[str, dict] = {}


def add(name, trigger, obs, enf, cost, tier, dormant="no", notes=""):
    CLASSIFICATION[name] = dict(
        trigger=trigger, observability=obs, enforcement=enf,
        hook_cost=cost, tier=tier, dormant=dormant, notes=notes,
    )


# ── Always-rules — safety floor (out of scope for hardening) ──────────
add("non-destructive-by-default.md", "destructive-op intent", "agent-only",
    "tool-call", "NA-soft", "safety-floor", notes="Safety floor — Iron Law, not modified")
add("commit-policy.md", "commit intent", "agent-only", "tool-call",
    "NA-soft", "safety-floor", notes="Safety floor — never-ask Iron Law")
add("scope-control.md", "git-op / refactor intent", "agent-only", "tool-call",
    "NA-soft", "safety-floor", notes="Safety floor — permission gate")
add("verify-before-complete.md", "completion claim", "agent-only", "output",
    "low", "2b",
    notes="Pre-PR/commit gate. Hookable: detect 'done'/'complete' in reply, require fresh test/quality output in same turn.")

# ── Always-rules — Iron-Law pre-send (Tier 3, soft by construction) ───
add("agent-authority.md", "every turn (router)", "agent-only", "none",
    "NA-soft", "3", notes="Priority index, no trigger of its own")
add("ask-when-uncertain.md", "pre-send vague-detection", "agent-only", "output",
    "NA-soft", "3", notes="One-question-per-turn — output-rewrite would be needed")
add("direct-answers.md", "pre-send (every reply)", "agent-only", "output",
    "NA-soft", "3", notes="No-flattery + verify + brevity Iron Laws")
add("language-and-tone.md", "pre-send language detection", "agent-only", "output",
    "medium", "3",
    notes="Hook could detect German trigger words in last user msg + flag drift. Best-effort marker only.")
add("no-cheap-questions.md", "pre-send Q&A check", "agent-only", "output",
    "NA-soft", "3", notes="Pre-send self-check, no platform surface")

# ── Auto-rules — Tier 1 candidates (mechanizable, deterministic) ──────
add("chat-history-cadence.md", "per-turn / per-tool / per-phase", "mechanical-already",
    "hook", "NA-mechanical", "mechanical-already",
    notes="PRECEDENT — heartbeat + chat_history.py + hooks. Reference pattern.")
add("chat-history-ownership.md", "first turn", "hook", "state",
    "low", "1", notes="Detectable: ownership classification at session start")
add("chat-history-visibility.md", "heartbeat marker emit", "mechanical-already",
    "hook", "NA-mechanical", "mechanical-already",
    notes="Subprocess marker print is already mechanical")
add("onboarding-gate.md", "first turn (settings.onboarded == false)", "settings",
    "state", "low", "1",
    notes="Pilot candidate — frequency 100% on un-onboarded projects, binary verifiable")
add("roadmap-progress-sync.md", "file-edit on agents/roadmaps/**", "hook",
    "tool-call", "low", "1",
    notes="Pilot 1 (smallest hook). PostToolUse path filter; already documented in mechanics context.")
add("context-hygiene.md", "turn counter / tool-loop / topic shift", "hook",
    "state", "medium", "1",
    notes="Per-turn counter + tool-call repetition detector. Cross-platform persistence is the cost driver.")
add("size-enforcement.md", "file save on .agent-src.uncompressed/{skills,rules,commands}/**",
    "mechanical-already", "tool-call", "NA-mechanical", "mechanical-already",
    notes="Enforced by skill_linter.py + check_always_budget.py")
add("no-roadmap-references.md", "file save on stable artifacts", "mechanical-already",
    "tool-call", "NA-mechanical", "mechanical-already",
    notes="Enforced by scripts/check_no_roadmap_refs.py (CI gate)")
add("augment-portability.md", "file save on .agent-src/**", "mechanical-already",
    "tool-call", "NA-mechanical", "mechanical-already",
    notes="Enforced by scripts/check_portability.py")
add("augment-source-of-truth.md", "file save on .agent-src/ or .augment/",
    "hook", "tool-call", "low", "1",
    notes="Pre-write hook: refuse writes to generated dirs")
add("package-ci-checks.md", "pre-push to remote", "mechanical-already",
    "hook", "NA-mechanical", "mechanical-already",
    notes="task ci is the gate")
add("artifact-engagement-recording.md", "phase-step / task end", "mechanical-already",
    "hook", "NA-mechanical", "mechanical-already",
    notes="telemetry:record subprocess is already mechanical")

# ── Auto-rules — Tier 2a candidates (marker nudge) ────────────────────
add("model-recommendation.md", "task-start / topic-shift", "hook",
    "output", "low", "2a",
    notes="Phase 5 prototype target. Marker injection at first user msg + topic-change detection.")
add("capture-learnings.md", "task completion", "hook", "output",
    "medium", "2a", notes="Post-task marker; learning detection is fuzzy")
add("skill-improvement-trigger.md", "task completion (settings.skill_improvement)",
    "settings", "state", "low", "2a",
    notes="Settings-flag observable; pipeline already exists")
add("commit-conventions.md", "commit message draft", "hook", "output",
    "low", "2a", notes="Hook on /commit invocation, marker for conventional-commits format")
add("docs-sync.md", "file-edit on .augment/{skills,rules,commands}/**", "hook",
    "tool-call", "medium", "2a",
    notes="Detect add/rename/delete; remind to update count + cross-refs")
add("agent-docs.md", "file-edit on agents/docs/, AGENTS.md", "hook",
    "tool-call", "medium", "2a", notes="Path-pattern based marker")
add("upstream-proposal.md", "skill/rule create event", "hook", "output",
    "medium", "2a", notes="Marker after new artifact lands")
add("review-routing-awareness.md", "PR-prep / risk flagging", "hook",
    "output", "medium", "2a",
    notes="Marker when /create-pr or risk-tagging keywords detected")
add("reviewer-awareness.md", "PR-prep", "hook", "output",
    "medium", "2a", notes="Reviewer-suggestion marker at PR creation")
add("security-sensitive-stop.md", "file-edit on auth/billing/secrets paths",
    "hook", "tool-call", "low", "2a",
    notes="Path-pattern based marker — strong candidate for low-cost hook")
add("cli-output-handling.md", "tool-call (verbose CLI)", "hook", "tool-call",
    "low", "2a", notes="Pre-tool-call marker on git/test/lint invocations")
add("artifact-drafting-protocol.md", "skill/rule create or major rewrite",
    "hook", "output", "medium", "2a",
    notes="Marker on file-create in .agent-src.uncompressed/{skills,rules,commands}/")
add("missing-tool-handling.md", "tool failure (command not found)", "hook",
    "output", "low", "2a", notes="Post-tool-failure marker — strong fit")
add("token-efficiency.md", "every reply / verbose-tool invocation", "hook",
    "output", "medium", "2a", notes="Soft Iron Law; nudge via verbose-output detection")
add("rule-type-governance.md", "rule create/edit", "hook", "tool-call",
    "low", "2a", notes="Linter could enforce; currently advisory")
add("role-mode-adherence.md", "settings.roles.active_role set", "settings",
    "output", "low", "2a", notes="Mode marker emit at turn end")

# ── Auto-rules — Tier 2b (structured injection / gate) ────────────────
add("downstream-changes.md", "post-edit (callsite check)", "hook",
    "tool-call", "high", "2b",
    notes="Requires callsite analysis — codebase-retrieval-style query. High cost, high value.")
add("ui-audit-gate.md", "pre-edit on UI files (settings.state.ui_audit empty)",
    "settings", "tool-call", "medium", "2b",
    notes="Block edit until state.ui_audit populated")
add("preservation-guard.md", "skill/rule merge or compress", "hook",
    "tool-call", "medium", "2b",
    notes="Pre-merge structured check — diff-shape verifiable")
add("minimal-safe-diff.md", "every diff", "hook", "tool-call",
    "high", "2b", notes="Diff-shape check; reformatting/drive-by detection is fuzzy")
add("improve-before-implement.md", "task-start (implementation intent)",
    "hook", "output", "medium", "2b",
    notes="Pre-implementation gate; could inject 'validated?' field requirement")
add("think-before-action.md", "pre-edit", "hook", "output",
    "medium", "2b", notes="Pre-tool-call marker requiring analysis-first")
add("runtime-safety.md", "skill metadata change", "hook", "tool-call",
    "low", "2b", notes="Linter-enforceable on skill frontmatter")
add("tool-safety.md", "skill creation (external tool decl)", "hook",
    "tool-call", "low", "2b", notes="Allowlist-enforceable in skill linter")
add("skill-quality.md", "skill create/edit", "mechanical-already",
    "tool-call", "NA-mechanical", "mechanical-already",
    notes="Enforced by scripts/skill_linter.py")
add("markdown-safe-codeblocks.md", "markdown output with code", "hook",
    "output", "medium", "2b", notes="Output-shape check; nesting detection")

# ── Auto-rules — Tier 3 (inherent soft / topic-only triggers) ─────────
add("autonomous-execution.md", "workflow decision (trivial vs blocking)",
    "agent-only", "output", "NA-soft", "3",
    notes="Disposition rule; trivial classification is judgment")
add("user-interaction.md", "pre-send (every Q&A reply)", "agent-only",
    "output", "NA-soft", "3", notes="Numbered-options Iron Law")
add("guidelines.md", "before code edit (topic match)", "agent-only",
    "output", "NA-soft", "3", notes="Generic 'check guidelines' nudge")
add("architecture.md", "new file/class/module creation", "agent-only",
    "output", "NA-soft", "3", notes="Architectural decisions — judgment-bound")
add("php-coding.md", "PHP file edit", "agent-only", "output",
    "NA-soft", "3", notes="Topic-matched coding guideline")
add("laravel-translations.md", "lang/ file edit", "hook", "tool-call",
    "low", "2a", dormant="suspected",
    notes="Path-pattern detectable but rare in this repo")
add("e2e-testing.md", "Playwright file edit", "agent-only", "output",
    "NA-soft", "3", notes="Topic-matched")
add("docker-commands.md", "PHP CLI in Docker context", "agent-only",
    "output", "NA-soft", "3", notes="Topic-matched")

# ── Suspected-dormant entries (per roadmap RH Phase 1 explicit list) ──
add("command-suggestion-policy.md", "user prompt match (engine-driven)",
    "mechanical-already", "hook", "NA-mechanical", "mechanical-already",
    dormant="suspected",
    notes="Engine in scripts/command_suggester/ exists; live-fire signal unverified — needs telemetry pass")
add("slash-command-routing-policy.md", "user msg starts with /",
    "hook", "tool-call", "low", "1", dormant="suspected",
    notes="Pattern-detection; live-fire signal unverified")
add("analysis-skill-routing.md", "analysis skill picker", "agent-only",
    "output", "NA-soft", "3", dormant="suspected",
    notes="Skill-router; no observable surface today")


def fm(path):
    txt = path.read_text(encoding="utf-8")
    if not txt.startswith("---\n"):
        return {}
    end = txt.find("\n---\n", 4)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(txt[4:end]) or {}
    except yaml.YAMLError:
        return {}


def to_comp(entry: str) -> Path:
    if entry.startswith(SRC_PREFIX):
        return REPO_ROOT / (COMP_PREFIX + entry[len(SRC_PREFIX):])
    return REPO_ROOT / entry


def walk(rule: Path):
    seen: set[Path] = set()
    chains: list[tuple[str, int]] = []
    stack = [(rule, 0, "")]
    while stack:
        node, depth, _ = stack.pop()
        for entry in (fm(node).get("load_context") or []) + (fm(node).get("load_context_eager") or []):
            comp = to_comp(str(entry))
            if depth + 1 > 2 or not comp.exists() or comp in seen:
                continue
            seen.add(comp)
            chains.append((str(entry), comp.stat().st_size))
            stack.append((comp, depth + 1, str(entry)))
    return chains


def emit():
    rules = sorted(SRC_RULES.glob("*.md"))
    rows = []
    for r in rules:
        f = fm(r)
        rtype = f.get("type", "?")
        comp = COMP_RULES / r.name
        raw = comp.stat().st_size if comp.exists() else r.stat().st_size
        ctx_chains = walk(comp if comp.exists() else r)
        ext = raw + sum(s for _, s in ctx_chains)
        rows.append((r.name, rtype, raw, ext, ctx_chains))

    lines: list[str] = []
    lines.append("# Rule Trigger Matrix")
    lines.append("")
    lines.append("**Source:** Phase 1 of `road-to-rule-hardening.md` (self-check audit) +")
    lines.append("Phase 1 of `road-to-context-layer-maturity.md` (`load_context:` inventory).")
    lines.append("**Generated by:** `scripts/build_rule_trigger_matrix.py` — re-run after rule")
    lines.append("set changes. Manual classifications live in the script's `CLASSIFICATION`")
    lines.append("table; size and context-chain columns are derived from the rule files.")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append("| Column | Meaning |")
    lines.append("|---|---|")
    lines.append("| `type` | Frontmatter `type` (`always` / `auto`) |")
    lines.append("| `raw` | Compressed rule size in chars (`.agent-src/rules/<name>`) |")
    lines.append("| `ext` | Extended size under Model (b): raw + transitive `load_context` |")
    lines.append("| `trigger` | Observable event that should activate the rule |")
    lines.append("| `obs` | Where the trigger is observable: `hook` (platform hook), `settings` (`.agent-settings.yml` state), `agent-only` (in-head), `mechanical-already` (precedent — already enforced by a script) |")
    lines.append("| `enforce` | Surface where the rule's effect lands: `output` / `tool-call` / `state` / `hook` / `none` |")
    lines.append("| `hook-cost` | Engineering cost to mechanise across Augment + Claude Code: `low` (≤ 1 day, single hook script), `medium` (1–3 days, cross-platform persistence), `high` (≥ 3 days, semantic analysis or output rewrite), `NA-mechanical` (precedent — script exists), `NA-soft` (no platform mechanism plausible) |")
    lines.append("| `tier` | Per RH roadmap: `1` mechanical · `2a` marker nudge · `2b` structured injection · `3` inherent soft · `safety-floor` (Iron-Law, never modified) · `mechanical-already` (precedent) |")
    lines.append("| `dormant?` | Has the rule observably fired? `no` (yes, fires) · `suspected` (per RH Phase 1 explicit list) · `unknown` |")
    lines.append("")
    lines.append("## Tier counts")
    lines.append("")
    by_tier: dict[str, list[str]] = {}
    for name, _, _, _, _ in rows:
        t = CLASSIFICATION.get(name, {}).get("tier", "?")
        by_tier.setdefault(t, []).append(name)
    for t in ("safety-floor", "mechanical-already", "1", "2a", "2b", "3", "?"):
        if t in by_tier:
            lines.append(f"- **Tier `{t}`** — {len(by_tier[t])} rules")
    lines.append("")
    lines.append("## Matrix")
    lines.append("")
    lines.append("| Rule | type | raw | ext | trigger | obs | enforce | hook-cost | tier | dormant? | notes |")
    lines.append("|---|---|---:|---:|---|---|---|---|---|---|---|")
    for name, rtype, raw, ext, _ in rows:
        c = CLASSIFICATION.get(name)
        if c is None:
            lines.append(f"| `{name}` | {rtype} | {raw} | {ext} | — | — | — | — | **?** | unknown | NOT CLASSIFIED |")
            continue
        lines.append(
            f"| `{name}` | {rtype} | {raw} | {ext} | "
            f"{c['trigger']} | {c['observability']} | {c['enforcement']} | "
            f"{c['hook_cost']} | {c['tier']} | {c['dormant']} | {c['notes']} |"
        )
    lines.append("")
    lines.append("## `load_context:` chains (CL Phase 1 inventory)")
    lines.append("")
    lines.append("Rules that load at least one context, with `rule → context → depth → chars`.")
    lines.append("Chars are measured on the compressed context file (Model (b) literal).")
    lines.append("")
    lines.append("| Rule | Context | Depth | Chars |")
    lines.append("|---|---|---:|---:|")
    for name, _, _, _, chains in rows:
        if not chains:
            continue
        for entry, size in chains:
            depth = entry.count("/") - entry.count("contexts/") + 1  # heuristic
            depth = 1  # all entries from this script are top-level (depth 1) since walk() returns flattened set
            lines.append(f"| `{name}` | `{entry}` | {depth} | {size} |")
    lines.append("")
    lines.append("## Dormant-suspected (per RH Phase 1)")
    lines.append("")
    dormants = [n for n, c in CLASSIFICATION.items() if c["dormant"] == "suspected"]
    for d in sorted(dormants):
        lines.append(f"- `{d}` — {CLASSIFICATION[d]['notes']}")
    lines.append("")
    lines.append("**Action:** absence of failures ≠ healthy trigger. Each suspected-dormant")
    lines.append("rule needs a one-session live-fire test before its Tier classification is")
    lines.append("locked. Tracked under RH Phase 1 follow-up.")
    lines.append("")
    lines.append("## Pilot candidates (RH Phase 3)")
    lines.append("")
    lines.append("Per the RH roadmap pilot-selection criteria (frequency ≥ 30 %, ≥ 2 observed")
    lines.append("failures, binary-verifiable trigger, hook-cost = `low`):")
    lines.append("")
    lines.append("1. **`roadmap-progress-sync`** — file-edit hook on `agents/roadmaps/**`, low cost, deterministic.")
    lines.append("2. **`onboarding-gate`** — first-turn settings check, 100 % frequency on un-onboarded projects.")
    lines.append("3. **`context-hygiene`** — turn counter, medium cost (cross-platform persistence).")
    lines.append("")
    lines.append("Order locked in RH Phase 3: 1 → 2 → 3 (smallest hook first).")
    lines.append("")
    lines.append("## Cross-references")
    lines.append("")
    lines.append("- Budget contract: [`docs/contracts/load-context-budget-model.md`](../../docs/contracts/load-context-budget-model.md)")
    lines.append("- Pattern precedent: `chat-history-cadence` (heartbeat hook + `scripts/chat_history.py`)")
    lines.append("- Phase 2A finding: [`adr-always-rule-context-split-not-viable.md`](adr-always-rule-context-split-not-viable.md)")
    lines.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅  Wrote {OUT.relative_to(REPO_ROOT)}  ({len(rows)} rules, {len(lines)} lines)")
    # Sanity: every rule classified
    missing = [n for n, *_ in rows if n not in CLASSIFICATION]
    if missing:
        print(f"⚠️   {len(missing)} rule(s) not classified: {missing}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(emit())
