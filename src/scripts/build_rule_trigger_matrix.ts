#!/usr/bin/env tsx
/**
 * Build agents/settings/contexts/rule-trigger-matrix.md.
 *
 * TypeScript twin of `src/scripts/build_rule_trigger_matrix.py` (ADR-090,
 * Phase 8 / Wave 8g). Mirrors the Python contract EXACTLY — same generated
 * markdown (byte-identical), same `CLASSIFICATION` table, same stdout
 * (`✅  Wrote …` line) + stderr (unclassified-rule warning) split, exit codes
 * (0 always when every rule is classified, 2 if any rule is unclassified).
 * No behaviour changes.
 *
 * Emits a single matrix mapping every rule in `src/rules/` to its trigger
 * event, observability, enforcement surface, hook-cost estimate, and Tier
 * classification. Sourced from the Phase 1 inventory of
 * `road-to-rule-hardening.md` plus `road-to-context-layer-maturity.md`
 * Phase 1 (`load_context:` chains).
 *
 * Exit 0 always; this is a generator, not a gate (except the final
 * all-classified sanity check, which can return 2).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
const SRC_RULES = path.join(REPO_ROOT, 'src', 'rules');
const COMP_RULES = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
const SRC_PREFIX = 'src/';
const COMP_PREFIX = 'dist/agent-src/';
const OUT = path.join(REPO_ROOT, 'agents', 'settings', 'contexts', 'rule-trigger-matrix.md');

interface Classification {
    trigger: string;
    observability: string;
    enforcement: string;
    hook_cost: string;
    tier: string;
    dormant: string;
    notes: string;
}

// Classification table — one row per rule. Insertion order matches the Python
// `add(...)` call order (the dormant-suspected listing sorts independently).
const CLASSIFICATION: Record<string, Classification> = {};

function add(
    name: string,
    trigger: string,
    obs: string,
    enf: string,
    cost: string,
    tier: string,
    dormant = 'no',
    notes = '',
): void {
    CLASSIFICATION[name] = {
        trigger,
        observability: obs,
        enforcement: enf,
        hook_cost: cost,
        tier,
        dormant,
        notes,
    };
}

// ── Always-rules — safety floor (out of scope for hardening) ──────────
add('non-destructive-by-default.md', 'destructive-op intent', 'agent-only',
    'tool-call', 'NA-soft', 'safety-floor', 'no', 'Safety floor — Iron Law, not modified');
add('commit-policy.md', 'commit intent', 'agent-only', 'tool-call',
    'NA-soft', 'safety-floor', 'no', 'Safety floor — never-ask Iron Law');
add('scope-control.md', 'git-op / refactor intent', 'agent-only', 'tool-call',
    'NA-soft', 'safety-floor', 'no', 'Safety floor — permission gate');
add('verify-before-complete.md', 'completion claim', 'agent-only', 'output',
    'low', '2b', 'no',
    "Pre-PR/commit gate. Hookable: detect 'done'/'complete' in reply, require fresh test/quality output in same turn.");

// ── Always-rules — Iron-Law pre-send (Tier 3, soft by construction) ───
add('agent-authority.md', 'every turn (router)', 'agent-only', 'none',
    'NA-soft', '3', 'no', 'Priority index, no trigger of its own');
add('ask-when-uncertain.md', 'pre-send vague-detection', 'agent-only', 'output',
    'NA-soft', '3', 'no', 'One-question-per-turn — output-rewrite would be needed');
add('direct-answers.md', 'pre-send (every reply)', 'agent-only', 'output',
    'NA-soft', '3', 'no', 'No-flattery + verify + brevity Iron Laws');
add('language-and-tone.md', 'pre-send language detection', 'agent-only', 'output',
    'medium', '3', 'no',
    'Hook could detect German trigger words in last user msg + flag drift. Best-effort marker only.');
add('no-cheap-questions.md', 'pre-send Q&A check', 'agent-only', 'output',
    'NA-soft', '3', 'no', 'Pre-send self-check, no platform surface');

// ── Auto-rules — Tier 1 candidates (mechanizable, deterministic) ──────
add('onboarding-gate.md', 'first turn (settings.onboarded == false)', 'settings',
    'state', 'low', '1', 'no',
    'Pilot candidate — frequency 100% on un-onboarded projects, binary verifiable');
add('roadmap-progress-sync.md', 'file-edit on agents/roadmaps/**', 'hook',
    'tool-call', 'low', '1', 'no',
    'Pilot 1 (smallest hook). PostToolUse path filter; already documented in mechanics context.');
add('context-hygiene.md', 'turn counter / tool-loop / topic shift', 'hook',
    'state', 'medium', '1', 'no',
    'Per-turn counter + tool-call repetition detector. Cross-platform persistence is the cost driver.');
add('size-enforcement.md', 'file save on src/{skills,rules} or src/agent-src/commands/**',
    'mechanical-already', 'tool-call', 'NA-mechanical', 'mechanical-already', 'no',
    'Enforced by skill_linter.py + check_always_budget.py');
add('no-roadmap-references.md', 'file save on stable artifacts', 'mechanical-already',
    'tool-call', 'NA-mechanical', 'mechanical-already', 'no',
    'Enforced by scripts/check_no_roadmap_refs.py (CI gate)');
add('augment-portability.md', 'file save on dist/agent-src/**', 'mechanical-already',
    'tool-call', 'NA-mechanical', 'mechanical-already', 'no',
    'Enforced by scripts/check_portability.py');
add('source-of-truth.md', 'file save on dist/agent-src/ or .augment/',
    'hook', 'tool-call', 'low', '1', 'no',
    'Pre-write hook: refuse writes to generated dirs');
add('package-ci-checks.md', 'pre-push to remote', 'mechanical-already',
    'hook', 'NA-mechanical', 'mechanical-already', 'no',
    'task ci is the gate');
add('artifact-engagement-recording.md', 'phase-step / task end', 'mechanical-already',
    'hook', 'NA-mechanical', 'mechanical-already', 'no',
    'telemetry:record subprocess is already mechanical');

// ── Auto-rules — Tier 2a candidates (marker nudge) ────────────────────
add('model-recommendation.md', 'task-start / topic-shift', 'hook',
    'output', 'low', '2a', 'no',
    'Phase 5 prototype target. Marker injection at first user msg + topic-change detection.');
add('capture-learnings.md', 'task completion', 'hook', 'output',
    'medium', '2a', 'no', 'Post-task marker; learning detection is fuzzy');
add('skill-improvement-trigger.md', 'task completion (settings.skill_improvement)',
    'settings', 'state', 'low', '2a', 'no',
    'Settings-flag observable; pipeline already exists');
add('commit-conventions.md', 'commit message draft', 'hook', 'output',
    'low', '2a', 'no', 'Hook on /commit invocation, marker for conventional-commits format');
add('docs-sync.md', 'file-edit on .augment/{skills,rules,commands}/**', 'hook',
    'tool-call', 'medium', '2a', 'no',
    'Detect add/rename/delete; remind to update count + cross-refs');
add('agent-docs.md', 'file-edit on agents/reference/docs/, AGENTS.md', 'hook',
    'tool-call', 'medium', '2a', 'no', 'Path-pattern based marker');
add('upstream-proposal.md', 'skill/rule create event', 'hook', 'output',
    'medium', '2a', 'no', 'Marker after new artifact lands');
add('reviewer-awareness.md', 'PR-prep / reviewer-suggestion / risk flagging',
    'hook', 'output', 'medium', '2a', 'no',
    'Reviewer-suggestion + risk-tagging marker at PR creation; consolidates former review-routing-awareness');
add('security-sensitive-stop.md', 'file-edit on auth/billing/secrets paths',
    'hook', 'tool-call', 'low', '2a', 'no',
    'Path-pattern based marker — strong candidate for low-cost hook');
add('cli-output-handling.md', 'tool-call (verbose CLI)', 'hook', 'tool-call',
    'low', '2a', 'no', 'Pre-tool-call marker on git/test/lint invocations');
add('artifact-drafting-protocol.md', 'skill/rule create or major rewrite',
    'hook', 'output', 'medium', '2a', 'no',
    'Marker on file-create in src/{skills,rules} + src/agent-src/commands/');
add('missing-tool-handling.md', 'tool failure (command not found)', 'hook',
    'output', 'low', '2a', 'no', 'Post-tool-failure marker — strong fit');
add('token-efficiency.md', 'every reply / verbose-tool invocation', 'hook',
    'output', 'medium', '2a', 'no', 'Soft Iron Law; nudge via verbose-output detection');
add('rule-type-governance.md', 'rule create/edit', 'hook', 'tool-call',
    'low', '2a', 'no', 'Linter could enforce; currently advisory');
add('role-mode-adherence.md', 'settings.roles.active_role set', 'settings',
    'output', 'low', '2a', 'no', 'Mode marker emit at turn end');

// ── Auto-rules — Tier 2b (structured injection / gate) ────────────────
add('downstream-changes.md', 'post-edit (callsite check)', 'hook',
    'tool-call', 'high', '2b', 'no',
    'Requires callsite analysis — codebase-retrieval-style query. High cost, high value.');
add('ui-audit-gate.md', 'pre-edit on UI files (settings.state.ui_audit empty)',
    'settings', 'tool-call', 'medium', '2b', 'no',
    'Block edit until state.ui_audit populated');
add('preservation-guard.md', 'skill/rule merge or condense', 'hook',
    'tool-call', 'medium', '2b', 'no',
    'Pre-merge structured check — diff-shape verifiable');
add('minimal-safe-diff.md', 'every diff', 'hook', 'tool-call',
    'high', '2b', 'no', 'Diff-shape check; reformatting/drive-by detection is fuzzy');
add('improve-before-implement.md', 'task-start (implementation intent)',
    'hook', 'output', 'medium', '2b', 'no',
    "Pre-implementation gate; could inject 'validated?' field requirement");
add('think-before-action.md', 'pre-edit', 'hook', 'output',
    'medium', '2b', 'no', 'Pre-tool-call marker requiring analysis-first');
add('runtime-safety.md', 'skill metadata change', 'hook', 'tool-call',
    'low', '2b', 'no', 'Linter-enforceable on skill frontmatter');
add('tool-safety.md', 'skill creation (external tool decl)', 'hook',
    'tool-call', 'low', '2b', 'no', 'Allowlist-enforceable in skill linter');
add('skill-quality.md', 'skill create/edit', 'mechanical-already',
    'tool-call', 'NA-mechanical', 'mechanical-already', 'no',
    'Enforced by scripts/skill_linter.py');
add('markdown-safe-codeblocks.md', 'markdown output with code', 'hook',
    'output', 'medium', '2b', 'no', 'Output-shape check; nesting detection');

// ── Auto-rules — Tier 3 (inherent soft / topic-only triggers) ─────────
add('autonomous-execution.md', 'workflow decision (trivial vs blocking)',
    'agent-only', 'output', 'NA-soft', '3', 'no',
    'Disposition rule; trivial classification is judgment');
add('user-interaction.md', 'pre-send (every Q&A reply)', 'agent-only',
    'output', 'NA-soft', '3', 'no', 'Numbered-options Iron Law');
add('guidelines.md', 'before code edit (topic match)', 'agent-only',
    'output', 'NA-soft', '3', 'no', "Generic 'check guidelines' nudge");
add('architecture.md', 'new file/class/module creation', 'agent-only',
    'output', 'NA-soft', '3', 'no', 'Architectural decisions — judgment-bound');
add('php-coding.md', 'PHP file edit', 'agent-only', 'output',
    'NA-soft', '3', 'no', 'Topic-matched coding guideline');
add('laravel-translations.md', 'lang/ file edit', 'hook', 'tool-call',
    'low', '2a', 'suspected',
    'Path-pattern detectable but rare in this repo');
add('e2e-testing.md', 'Playwright file edit', 'agent-only', 'output',
    'NA-soft', '3', 'no', 'Topic-matched');
add('docker-commands.md', 'PHP CLI in Docker context', 'agent-only',
    'output', 'NA-soft', '3', 'no', 'Topic-matched');

// ── Suspected-dormant entries (per roadmap RH Phase 1 explicit list) ──
add('command-suggestion-policy.md', 'user prompt match (engine-driven)',
    'mechanical-already', 'hook', 'NA-mechanical', 'mechanical-already',
    'suspected',
    'Engine in scripts/command_suggester/ exists; live-fire signal unverified — needs telemetry pass');
add('slash-command-routing-policy.md', 'user msg starts with /',
    'hook', 'tool-call', 'low', '1', 'suspected',
    'Pattern-detection; live-fire signal unverified');
add('analysis-skill-routing.md', 'analysis skill picker', 'agent-only',
    'output', 'NA-soft', '3', 'suspected',
    'Skill-router; no observable surface today');

type FmDict = Record<string, unknown>;

/**
 * Mirror of `fm(path)`: parse a leading `---\n...\n---\n` frontmatter block.
 * Returns `{}` when there is no frontmatter or the YAML fails to parse.
 * Note: the closing delimiter is `\n---\n` (with trailing newline), exactly
 * as the Python `txt.find("\n---\n", 4)`.
 */
function fm(p: string): FmDict {
    const txt = fs.readFileSync(p, 'utf-8');
    if (!txt.startsWith('---\n')) {
        return {};
    }
    const end = txt.indexOf('\n---\n', 4);
    if (end === -1) {
        return {};
    }
    let parsed: unknown;
    try {
        parsed = parseYaml(txt.slice(4, end), { version: '1.1' });
    } catch {
        return {};
    }
    if (parsed !== null && parsed !== undefined && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as FmDict;
    }
    return {};
}

/** Mirror of `to_comp(entry)`. */
function to_comp(entry: string): string {
    if (entry.startsWith(SRC_PREFIX)) {
        return path.join(REPO_ROOT, COMP_PREFIX + entry.slice(SRC_PREFIX.length));
    }
    return path.join(REPO_ROOT, entry);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _size(p: string): number {
    return fs.statSync(p).size;
}

function _asList(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

/**
 * Mirror of `walk(rule)`: flatten the `load_context` + `load_context_eager`
 * chain to depth ≤ 2, returning `(entry, size)` tuples. Uses a LIFO stack
 * exactly like the Python (`stack.pop()` from the end).
 */
function walk(rule: string): Array<[string, number]> {
    const seen = new Set<string>();
    const chains: Array<[string, number]> = [];
    const stack: Array<[string, number]> = [[rule, 0]];
    while (stack.length > 0) {
        const [node, depth] = stack.pop()!;
        const f = fm(node);
        const entries = [
            ..._asList(f['load_context']),
            ..._asList(f['load_context_eager']),
        ];
        for (const entry of entries) {
            const comp = to_comp(String(entry));
            if (depth + 1 > 2 || !_exists(comp) || seen.has(comp)) {
                continue;
            }
            seen.add(comp);
            chains.push([String(entry), _size(comp)]);
            stack.push([comp, depth + 1]);
        }
    }
    return chains;
}

interface Row {
    name: string;
    rtype: string;
    raw: number;
    ext: number;
    chains: Array<[string, number]>;
}

function _globSortedMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

function emit(): number {
    const rules = _globSortedMd(SRC_RULES);
    const rows: Row[] = [];
    for (const r of rules) {
        const f = fm(r);
        const rtype = f['type'] !== undefined && f['type'] !== null ? String(f['type']) : '?';
        const comp = path.join(COMP_RULES, path.basename(r));
        const raw = _exists(comp) ? _size(comp) : _size(r);
        const ctx_chains = walk(_exists(comp) ? comp : r);
        const ext = raw + ctx_chains.reduce((acc, [, s]) => acc + s, 0);
        rows.push({ name: path.basename(r), rtype, raw, ext, chains: ctx_chains });
    }

    const lines: string[] = [];
    lines.push('# Rule Trigger Matrix');
    lines.push('');
    lines.push('**Source:** Phase 1 of `road-to-rule-hardening.md` (self-check audit) +');
    lines.push('Phase 1 of `road-to-context-layer-maturity.md` (`load_context:` inventory).');
    lines.push('**Generated by:** `scripts/build_rule_trigger_matrix.py` — re-run after rule');
    lines.push("set changes. Manual classifications live in the script's `CLASSIFICATION`");
    lines.push('table; size and context-chain columns are derived from the rule files.');
    lines.push('');
    lines.push('## Methodology');
    lines.push('');
    lines.push('| Column | Meaning |');
    lines.push('|---|---|');
    lines.push('| `type` | Frontmatter `type` (`always` / `auto`) |');
    lines.push('| `raw` | Condensed rule size in chars (`dist/agent-src/rules/<name>`) |');
    lines.push('| `ext` | Extended size under Model (b): raw + transitive `load_context` |');
    lines.push('| `trigger` | Observable event that should activate the rule |');
    lines.push('| `obs` | Where the trigger is observable: `hook` (platform hook), `settings` (`.agent-settings.yml` state), `agent-only` (in-head), `mechanical-already` (precedent — already enforced by a script) |');
    lines.push('| `enforce` | Surface where the rule\'s effect lands: `output` / `tool-call` / `state` / `hook` / `none` |');
    lines.push('| `hook-cost` | Engineering cost to mechanise across Augment + Claude Code: `low` (≤ 1 day, single hook script), `medium` (1–3 days, cross-platform persistence), `high` (≥ 3 days, semantic analysis or output rewrite), `NA-mechanical` (precedent — script exists), `NA-soft` (no platform mechanism plausible) |');
    lines.push('| `tier` | Per RH roadmap: `1` mechanical · `2a` marker nudge · `2b` structured injection · `3` inherent soft · `safety-floor` (Iron-Law, never modified) · `mechanical-already` (precedent) |');
    lines.push('| `dormant?` | Has the rule observably fired? `no` (yes, fires) · `suspected` (per RH Phase 1 explicit list) · `unknown` |');
    lines.push('');
    lines.push('## Tier counts');
    lines.push('');
    const by_tier: Record<string, string[]> = {};
    for (const row of rows) {
        const t = CLASSIFICATION[row.name]?.tier ?? '?';
        (by_tier[t] ??= []).push(row.name);
    }
    for (const t of ['safety-floor', 'mechanical-already', '1', '2a', '2b', '3', '?']) {
        if (t in by_tier) {
            lines.push(`- **Tier \`${t}\`** — ${by_tier[t]!.length} rules`);
        }
    }
    lines.push('');
    lines.push('## Matrix');
    lines.push('');
    lines.push('| Rule | type | raw | ext | trigger | obs | enforce | hook-cost | tier | dormant? | notes |');
    lines.push('|---|---|---:|---:|---|---|---|---|---|---|---|');
    for (const row of rows) {
        const c = CLASSIFICATION[row.name];
        if (c === undefined) {
            lines.push(`| \`${row.name}\` | ${row.rtype} | ${row.raw} | ${row.ext} | — | — | — | — | **?** | unknown | NOT CLASSIFIED |`);
            continue;
        }
        lines.push(
            `| \`${row.name}\` | ${row.rtype} | ${row.raw} | ${row.ext} | ` +
                `${c.trigger} | ${c.observability} | ${c.enforcement} | ` +
                `${c.hook_cost} | ${c.tier} | ${c.dormant} | ${c.notes} |`,
        );
    }
    lines.push('');
    lines.push('## `load_context:` chains (CL Phase 1 inventory)');
    lines.push('');
    lines.push('Rules that load at least one context, with `rule → context → depth → chars`.');
    lines.push('Chars are measured on the condensed context file (Model (b) literal).');
    lines.push('');
    lines.push('| Rule | Context | Depth | Chars |');
    lines.push('|---|---|---:|---:|');
    for (const row of rows) {
        if (row.chains.length === 0) {
            continue;
        }
        for (const [entry, size] of row.chains) {
            // Mirror the Python: depth heuristic computed then overwritten to 1.
            const depth = 1;
            lines.push(`| \`${row.name}\` | \`${entry}\` | ${depth} | ${size} |`);
        }
    }
    lines.push('');
    lines.push('## Dormant-suspected (per RH Phase 1)');
    lines.push('');
    const dormants = Object.entries(CLASSIFICATION)
        .filter(([, c]) => c.dormant === 'suspected')
        .map(([n]) => n);
    dormants.sort();
    for (const d of dormants) {
        lines.push(`- \`${d}\` — ${CLASSIFICATION[d]!.notes}`);
    }
    lines.push('');
    lines.push('**Action:** absence of failures ≠ healthy trigger. Each suspected-dormant');
    lines.push('rule needs a one-session live-fire test before its Tier classification is');
    lines.push('locked. Tracked under RH Phase 1 follow-up.');
    lines.push('');
    lines.push('## Pilot candidates (RH Phase 3)');
    lines.push('');
    lines.push('Per the RH roadmap pilot-selection criteria (frequency ≥ 30 %, ≥ 2 observed');
    lines.push('failures, binary-verifiable trigger, hook-cost = `low`):');
    lines.push('');
    lines.push('1. **`roadmap-progress-sync`** — file-edit hook on `agents/roadmaps/**`, low cost, deterministic.');
    lines.push('2. **`onboarding-gate`** — first-turn settings check, 100 % frequency on un-onboarded projects.');
    lines.push('3. **`context-hygiene`** — turn counter, medium cost (cross-platform persistence).');
    lines.push('');
    lines.push('Order locked in RH Phase 3: 1 → 2 → 3 (smallest hook first).');
    lines.push('');
    lines.push('## Cross-references');
    lines.push('');
    lines.push('- Budget contract: [`docs/contracts/load-context-budget-model.md`](../../docs/contracts/load-context-budget-model.md)');
    lines.push('- Pattern precedent: `roadmap-progress-sync` (PostToolUse path-filter hook)');
    lines.push('- Phase 2A finding: [`adr-always-rule-context-split-not-viable.md`](adr-always-rule-context-split-not-viable.md)');
    lines.push('');

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, lines.join('\n'), 'utf-8');
    process.stdout.write(
        `✅  Wrote ${path.relative(REPO_ROOT, OUT)}  (${rows.length} rules, ${lines.length} lines)\n`,
    );
    // Sanity: every rule classified.
    const missing = rows.filter((row) => !(row.name in CLASSIFICATION)).map((row) => row.name);
    if (missing.length > 0) {
        process.stderr.write(
            `⚠️   ${missing.length} rule(s) not classified: ${_pyReprList(missing)}\n`,
        );
        return 2;
    }
    return 0;
}

/** Mirror Python `print(f"... {missing}")` — list repr with single quotes. */
function _pyReprList(items: string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = emit();
}

export { CLASSIFICATION, fm, to_comp, walk, emit, OUT, REPO_ROOT, SRC_RULES, COMP_RULES };
