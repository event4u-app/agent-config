#!/usr/bin/env node
/**
 * explain-run — read-only "why did this happen" report over EXISTING
 * on-disk artefacts (road-to-feedback-8.11.md, Phase 7 — Explainability v0).
 *
 * Given `--task <id>` and/or `--since <ISO date>`, renders one Markdown
 * report covering:
 *   0. A plain-language `## Summary` — one line per section below, derived
 *      from the same parsed values (no extra data sources).
 *   1. The resolved rule set for this repo — kernel (always-on) vs
 *      trigger-routed (tier_1 / tier_2), with each trigger-routed rule's
 *      full trigger set. Source: `dist/router.json`.
 *   2. Rules the audit log actually observed firing in the window (the
 *      `rules_applied` field of audit-log-v1 lines — /work and
 *      /implement-ticket phase-ends only). Source:
 *      `agents/runtime/state/audit/*.jsonl`.
 *   3. Artefact engagement (consulted vs applied) per kind, in window.
 *      Source: `.agent-engagement.jsonl` (telemetry.artifact_engagement).
 *   4. Subagent dispatches in window — mode, tiers, token deltas,
 *      first_pass_success/escalated. Source: same audit-log-v1 files,
 *      `orchestration` sub-object.
 *   4b. (opt-in via `--decision "<task text>"`) Dispatch-decision trace —
 *      the judgment-ladder rung taken, every rung rejected with its
 *      detector's own reason (why-not-team / why-not-council /
 *      why-no-spawn), and the token/cost estimate from the most recent
 *      matching orchestration-telemetry record. No record in window → an
 *      honest "no telemetry record" line, never a fabricated estimate.
 *      Sources: `_lib/judgment_ladder.ts::explainLadder` + the same
 *      audit-log-v1 files as §4.
 *   5. Hook / loop / freshness state snapshot. Source:
 *      `agents/state/context-hygiene.json` (the code path the hook
 *      actually writes — see `context_hygiene_hook.ts::STATE_FILE`) or
 *      the doc-referenced `agents/runtime/state/context-hygiene.json`.
 *   6. A parked list of "why" questions this v0 cannot answer today,
 *      with the reason — these are NOT silently omitted.
 *
 * Every section states its source file and prints an honest
 * "no data — <source> absent or empty" instead of inventing rows. No new
 * state, no daemon, no new capture — this reads artefacts other parts of
 * the suite already write.
 *
 * Kill criterion: if unused after 3 releases (zero invocations/citations),
 * delete — same honest-null convention as `orchestration_savings_report.ts`
 * and the Phase 5 kill criteria in road-to-feedback-8.11.md.
 *
 * Usage:
 *   ./scripts-run src/scripts/explain_run \
 *     [--task <id>] [--since <ISO-8601>] \
 *     [--router <path>] [--audit-dir <path>] [--engagement <path>] \
 *     [--hygiene <path>] [--output <path>] \
 *     [--decision "<task text>"] [--size-estimate <n>] [--slices <n>] \
 *     [--ordered-plan] [--agent-teams] [--halted] [--no-spawn-primitive] \
 *     [--inside-subagent] [--approval-required]
 *
 * Defaults: --router dist/router.json · --audit-dir agents/runtime/state/audit
 * · --engagement .agent-engagement.jsonl · --hygiene tries
 * agents/state/context-hygiene.json then agents/runtime/state/context-hygiene.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { EngagementSchemaError, parse_event, type EngagementEvent } from '../agent-src/templates/scripts/telemetry/engagement.js';
import { explainLadder, type LadderExplanation, type LadderInputs } from './_lib/judgment_ladder.js';
import { readAuditLines } from './orchestration_savings_report.js';

// ── CLI ──────────────────────────────────────────────────────────────────

const DEFAULT_ROUTER = 'dist/router.json';
const DEFAULT_AUDIT_DIR = 'agents/runtime/state/audit';
const DEFAULT_ENGAGEMENT = '.agent-engagement.jsonl';
// The rule prose (`context-hygiene.md`) cites `agents/runtime/state/…`; the
// actual writer (`context_hygiene_hook.ts::STATE_FILE`) uses `agents/state/…`
// — a documented latent divergence (ADR-200 "replicate latent bugs"). Try
// the real path first, then the documented one, so the report works either
// way and is honest about which it found.
const DEFAULT_HYGIENE_CANDIDATES = ['agents/state/context-hygiene.json', 'agents/runtime/state/context-hygiene.json'];

/** Cap on how many artefact ids render inline per row before "…+N more". */
const ID_CAP = 10;

export interface Options {
    task: string | null;
    since: string | null;
    router: string;
    auditDir: string;
    engagement: string;
    hygiene: string | null;
    output: string | null;
    /**
     * Dispatch-decision task text (§4b); null/absent → the section is not
     * rendered. Optional (with the flags below) so pre-existing callers
     * constructing `Options` literals stay source-compatible.
     */
    decision?: string | null;
    /** Ladder signal flags — map 1:1 onto `LadderInputs`; nothing is inferred. */
    sizeEstimate?: number;
    slices?: number;
    orderedPlan?: boolean;
    agentTeams?: boolean;
    halted?: boolean;
    noSpawnPrimitive?: boolean;
    insideSubagent?: boolean;
    approvalRequired?: boolean;
}

const USAGE = `usage: explain_run [--task <id>] [--since <ISO-8601>] [--output <path>]
                   [--decision "<task text>"] [--size-estimate <int>] [--slices <int>]
                   [--ordered-plan] [--agent-teams] [--halted] [--no-spawn-primitive]
                   [--inside-subagent] [--approval-required]

Window:
  --task <id>            restrict to one task id in the audit log
  --since <ISO-8601>     cutoff timestamp / date
  --output <path>        write the report to a file instead of stdout

Dispatch decision (all optional; absent --decision omits the section):
  --decision <text>      classify this task text through the judgment ladder and
                         render the rung taken, the rungs rejected with their
                         detector's reason, and the rungs never reached
  --size-estimate <int>  size signal; at or below the floor nothing delegates
  --slices <int>         number of independent slices
  --ordered-plan         the slices are ordered, not independent
  --agent-teams          the host reports the agent_teams capability
  --halted               emergency.orchestration_halt is set
  --no-spawn-primitive   the host has no subagent_spawn primitive
  --inside-subagent      classification runs inside a subagent (recursive guard)
  --approval-required    a human decision is pending; resolves before every rung

Exit: 0 report rendered · 2 bad argument.
`;

function parseArgs(argv: string[]): Options {
    const opts: Options = {
        task: null,
        since: null,
        router: DEFAULT_ROUTER,
        auditDir: DEFAULT_AUDIT_DIR,
        engagement: DEFAULT_ENGAGEMENT,
        hygiene: null,
        output: null,
        decision: null,
        sizeEstimate: 0,
        slices: 0,
        orderedPlan: false,
        agentTeams: false,
        halted: false,
        noSpawnPrimitive: false,
        insideSubagent: false,
        approvalRequired: false,
    };
    const intValue = (flag: string, raw: string | undefined): number => {
        const n = Number(raw);
        if (raw === undefined || raw === '' || !Number.isInteger(n)) {
            process.stderr.write(`explain_run: ${flag} requires an integer, got: ${raw ?? '(missing)'}\n`);
            process.exit(2);
        }
        return n;
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        const next = (): string | undefined => argv[++i];
        if (a === '--task') opts.task = next() ?? opts.task;
        else if (a.startsWith('--task=')) opts.task = a.slice('--task='.length);
        else if (a === '--since') opts.since = next() ?? opts.since;
        else if (a.startsWith('--since=')) opts.since = a.slice('--since='.length);
        else if (a === '--router') opts.router = next() ?? opts.router;
        else if (a.startsWith('--router=')) opts.router = a.slice('--router='.length);
        else if (a === '--audit-dir') opts.auditDir = next() ?? opts.auditDir;
        else if (a.startsWith('--audit-dir=')) opts.auditDir = a.slice('--audit-dir='.length);
        else if (a === '--engagement') opts.engagement = next() ?? opts.engagement;
        else if (a.startsWith('--engagement=')) opts.engagement = a.slice('--engagement='.length);
        else if (a === '--hygiene') opts.hygiene = next() ?? opts.hygiene;
        else if (a.startsWith('--hygiene=')) opts.hygiene = a.slice('--hygiene='.length);
        else if (a === '--output') opts.output = next() ?? opts.output;
        else if (a.startsWith('--output=')) opts.output = a.slice('--output='.length);
        else if (a === '--decision') {
            const v = next();
            // Exit rather than no-op: silently dropping the value produced a full
            // report with the dispatch section absent and exit 0, so a typo read
            // as "this run had no dispatch decision". `--size-estimate` already
            // exits 2 on the same mistake; the flags now behave alike.
            if (v === undefined || v === '') {
                process.stderr.write('explain_run: --decision requires a value (the task text to classify)\n');
                process.exit(2);
            }
            opts.decision = v;
        } else if (a.startsWith('--decision=')) opts.decision = a.slice('--decision='.length);
        else if (a === '--size-estimate') opts.sizeEstimate = intValue('--size-estimate', next());
        else if (a.startsWith('--size-estimate=')) opts.sizeEstimate = intValue('--size-estimate', a.slice('--size-estimate='.length));
        else if (a === '--slices') opts.slices = intValue('--slices', next());
        else if (a.startsWith('--slices=')) opts.slices = intValue('--slices', a.slice('--slices='.length));
        else if (a === '--ordered-plan') opts.orderedPlan = true;
        else if (a === '--agent-teams') opts.agentTeams = true;
        else if (a === '--halted') opts.halted = true;
        else if (a === '--no-spawn-primitive') opts.noSpawnPrimitive = true;
        else if (a === '--inside-subagent') opts.insideSubagent = true;
        else if (a === '--approval-required') opts.approvalRequired = true;
        else if (a === '--help' || a === '-h') {
            process.stdout.write(USAGE);
            process.exit(0);
        } else {
            // The usage text goes to stderr with the error, so a typo shows the
            // whole surface rather than only the rejected token. Nine of these
            // flags landed at once (the dispatch-decision trace); a script whose
            // only discovery path is reading its source is a script whose flags
            // do not exist for the person at the terminal.
            process.stderr.write(`explain_run: unrecognized argument: ${a}\n\n${USAGE}`);
            process.exit(2);
        }
    }
    return opts;
}

/** Parse `--since` into an epoch-ms cutoff; exits 2 on an unparsable value. */
function parseSince(since: string | null): number | null {
    if (since === null) return null;
    const t = Date.parse(since);
    if (!Number.isFinite(t)) {
        process.stderr.write(`explain_run: --since is not a parsable date: ${since}\n`);
        process.exit(2);
    }
    return t;
}

// ── Router (rule) reading ───────────────────────────────────────────────

export interface TriggerSpec {
    keyword?: string;
    phrase?: string;
    file_pattern?: string;
    path_prefix?: string;
    command?: string;
    reason?: string;
}

export interface RouterRuleEntry {
    id: string;
    triggers: TriggerSpec[];
    routes_to: string[];
    workspaces: string[];
    packs: string[];
}

export interface RouterFile {
    schema_version: number;
    kernel: string[];
    tier_1: RouterRuleEntry[];
    tier_2: RouterRuleEntry[];
    profiles?: Record<string, string[]>;
}

/** Read + parse `dist/router.json`. Returns null on missing/malformed file. */
export function readRouter(routerPath: string): RouterFile | null {
    if (!fs.existsSync(routerPath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(routerPath, 'utf8')) as RouterFile;
        if (!raw || !Array.isArray(raw.kernel) || !Array.isArray(raw.tier_1) || !Array.isArray(raw.tier_2)) {
            return null;
        }
        return raw;
    } catch {
        return null;
    }
}

/** Render one trigger spec compactly, e.g. `keyword:commit`. */
function formatTrigger(t: TriggerSpec): string {
    const entry = Object.entries(t).find(([k]) => k !== 'reason');
    if (!entry) return '(empty trigger)';
    return `${entry[0]}:${entry[1]}`;
}

function formatTriggers(triggers: TriggerSpec[]): string {
    if (triggers.length === 0) return '(none)';
    return triggers.map(formatTrigger).join(', ');
}

// ── Audit-log-v1 reading (orchestration + rules_applied) ────────────────

export interface ExplainOrchestrationRecord {
    spawn_count?: number;
    tiers?: string[];
    token_delta?: number;
    token_delta_provenance?: string;
    dispatch_mode?: string | null;
    tier_chosen?: string | null;
    task_class?: string | null;
    first_pass_success?: boolean | null;
    escalated?: boolean | null;
    outcome?: string;
}

export interface ExplainAuditLine {
    id?: string;
    ts?: string;
    work_id?: string;
    phase?: string;
    outcome?: string;
    rules_applied?: string[];
    input_kind?: string;
    orchestration?: ExplainOrchestrationRecord;
}

function matchesWindow(ts: string | undefined, task: string | null, taskField: string | undefined, since: number | null): boolean {
    if (task !== null && (taskField === undefined || !taskField.includes(task))) return false;
    if (since !== null) {
        if (ts === undefined) return false;
        const t = Date.parse(ts);
        if (!Number.isFinite(t) || t < since) return false;
    }
    return true;
}

/** Filter audit-log-v1 lines to those matching --task (on `work_id`) and/or --since. */
export function filterAuditLines(lines: ExplainAuditLine[], task: string | null, since: number | null): ExplainAuditLine[] {
    return lines.filter((l) => matchesWindow(l.ts, task, l.work_id, since));
}

/** Tally `rules_applied` across matching lines: rule id → number of phase-lines it appeared in. */
export function tallyRulesApplied(lines: ExplainAuditLine[]): Map<string, number> {
    const tally = new Map<string, number>();
    for (const line of lines) {
        for (const ruleId of line.rules_applied ?? []) {
            tally.set(ruleId, (tally.get(ruleId) ?? 0) + 1);
        }
    }
    return tally;
}

/** Lines that carry a real dispatch (`orchestration.spawn_count > 0`). */
export function dispatchLines(lines: ExplainAuditLine[]): ExplainAuditLine[] {
    return lines.filter((l) => (l.orchestration?.spawn_count ?? 0) > 0);
}

// ── Engagement JSONL reading ─────────────────────────────────────────────

export interface EngagementReadResult {
    exists: boolean;
    totalLines: number;
    skippedLines: number;
    events: EngagementEvent[];
}

/** Read + parse an engagement JSONL log. Malformed lines are counted, never thrown. */
export function readEngagementEvents(logPath: string): EngagementReadResult {
    if (!fs.existsSync(logPath)) {
        return { exists: false, totalLines: 0, skippedLines: 0, events: [] };
    }
    const text = fs.readFileSync(logPath, 'utf8');
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    let totalLines = 0;
    let skippedLines = 0;
    const events: EngagementEvent[] = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        totalLines += 1;
        try {
            events.push(parse_event(`${line}\n`));
        } catch (exc) {
            if (exc instanceof EngagementSchemaError) {
                skippedLines += 1;
                continue;
            }
            throw exc;
        }
    }
    return { exists: true, totalLines, skippedLines, events };
}

export function filterEngagement(events: EngagementEvent[], task: string | null, since: number | null): EngagementEvent[] {
    return events.filter((e) => matchesWindow(e.ts, task, e.task_id, since));
}

const ENGAGEMENT_KINDS = ['skills', 'rules', 'commands', 'guidelines', 'personas'] as const;

export interface KindSummary {
    consulted: number;
    applied: number;
    consultedIds: Set<string>;
    appliedIds: Set<string>;
}

/** Per-kind consulted/applied counts + distinct ids across the filtered events. */
export function summarizeEngagement(events: EngagementEvent[]): Record<string, KindSummary> {
    const summary: Record<string, KindSummary> = {};
    for (const kind of ENGAGEMENT_KINDS) {
        summary[kind] = { consulted: 0, applied: 0, consultedIds: new Set(), appliedIds: new Set() };
    }
    for (const event of events) {
        for (const [kind, ids] of Object.entries(event.consulted)) {
            const s = summary[kind];
            if (!s) continue;
            for (const id of ids) {
                s.consulted += 1;
                s.consultedIds.add(id);
            }
        }
        for (const [kind, ids] of Object.entries(event.applied)) {
            const s = summary[kind];
            if (!s) continue;
            for (const id of ids) {
                s.applied += 1;
                s.appliedIds.add(id);
            }
        }
    }
    return summary;
}

// ── Context-hygiene state reading ────────────────────────────────────────

export interface HygieneReadResult {
    path: string | null;
    checkedPaths: string[];
    state: Record<string, unknown> | null;
}

/** Try each candidate path in order; first one that parses as a JSON object wins. */
export function readHygieneState(candidates: string[]): HygieneReadResult {
    for (const p of candidates) {
        if (!fs.existsSync(p)) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { path: p, checkedPaths: candidates, state: parsed as Record<string, unknown> };
            }
        } catch {
            // fall through to next candidate
        }
    }
    return { path: null, checkedPaths: candidates, state: null };
}

// ── Rendering helpers ─────────────────────────────────────────────────────

/** One plain-language line per section, for a reader who has never seen the internals. */
function renderSummarySection(
    router: RouterFile | null,
    engagementRead: EngagementReadResult,
    filteredEngagement: EngagementEvent[],
    engagementSummary: Record<string, KindSummary> | null,
    dispatches: ExplainAuditLine[],
    hygiene: HygieneReadResult,
): string[] {
    const out: string[] = [];
    out.push('## Summary');
    out.push('');
    if (router === null) {
        out.push('- Rules: no rule data (router file absent or malformed).');
    } else {
        const triggerRouted = router.tier_1.length + router.tier_2.length;
        out.push(`- Rules: ${router.kernel.length} always-on (kernel), ${triggerRouted} available on triggers.`);
    }
    if (!engagementRead.exists || filteredEngagement.length === 0 || engagementSummary === null) {
        out.push('- Skill usage: no engagement data recorded in this window (telemetry off or no boundaries logged).');
    } else {
        let consulted = 0;
        let applied = 0;
        for (const s of Object.values(engagementSummary)) {
            consulted += s.consulted;
            applied += s.applied;
        }
        out.push(`- Skill usage: ${consulted} artifact(s) consulted, ${applied} applied across ${filteredEngagement.length} task boundary(ies).`);
    }
    if (dispatches.length === 0) {
        out.push('- Subagent dispatches: none in window.');
    } else {
        const totalDelta = dispatches.reduce((sum, l) => sum + (l.orchestration?.token_delta ?? 0), 0);
        out.push(`- Subagent dispatches: ${dispatches.length} dispatch(es), total token delta ${totalDelta}.`);
    }
    if (hygiene.state === null) {
        out.push('- Session health: no state recorded.');
    } else {
        const s = hygiene.state;
        out.push(`- Session health: ${String(s['tool_calls'] ?? '(unset)')} tool call(s) recorded, loop detected: ${String(s['loop_detected'] ?? '(unset)')}.`);
    }
    return out;
}

function capList(ids: Iterable<string>): string {
    const arr = [...ids].sort();
    if (arr.length === 0) return '(none)';
    if (arr.length <= ID_CAP) return arr.join(', ');
    return `${arr.slice(0, ID_CAP).join(', ')}, …+${arr.length - ID_CAP} more`;
}

function windowLabel(opts: Options): string {
    const task = opts.task ?? 'any';
    const since = opts.since ?? 'any';
    return `task=${task} · since=${since}`;
}

function renderRulesSection(router: RouterFile | null, opts: Options, rulesTally: Map<string, number>, auditDirExists: boolean): string[] {
    const out: string[] = [];
    out.push('## Resolved rule set');
    out.push(`_Source: \`${opts.router}\`_`);
    out.push('');
    if (router === null) {
        out.push(`no data — \`${opts.router}\` absent or malformed`);
        return out;
    }
    out.push(`- Kernel (always-on, no triggers, ${router.kernel.length} rule(s)): ${router.kernel.slice().sort().join(', ') || '(none)'}`);
    out.push('');
    for (const [label, entries] of [['Tier-1', router.tier_1], ['Tier-2', router.tier_2]] as const) {
        out.push(`### ${label} (trigger-routed, ${entries.length} rule(s))`);
        out.push('');
        out.push('| rule | triggers |');
        out.push('|---|---|');
        for (const entry of [...entries].sort((a, b) => (a.id < b.id ? -1 : 1))) {
            out.push(`| ${entry.id} | ${formatTriggers(entry.triggers)} |`);
        }
        out.push('');
    }
    out.push('### Observed firing in window (audit-log-v1 `rules_applied`)');
    out.push(`_Source: \`${DEFAULT_AUDIT_DIR}/*.jsonl\` → \`rules_applied\` field — emitted only at /work and /implement-ticket phase boundaries, not for ad hoc chat turns_`);
    out.push('');
    if (!auditDirExists) {
        out.push(`no data — audit directory absent (no /work or /implement-ticket run has written telemetry yet)`);
    } else if (rulesTally.size === 0) {
        out.push('no data — no audit-log-v1 line in window carries `rules_applied`');
    } else {
        const rows = [...rulesTally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        for (const [ruleId, count] of rows) {
            out.push(`- ${ruleId} (${count} phase-line(s))`);
        }
    }
    return out;
}

function renderEngagementSection(opts: Options, read: EngagementReadResult, filtered: EngagementEvent[], summary: Record<string, KindSummary> | null): string[] {
    const out: string[] = [];
    out.push('## Artefact engagement (consulted vs applied)');
    out.push(`_Source: \`${opts.engagement}\` (telemetry.artifact_engagement)_`);
    out.push('');
    if (!read.exists) {
        out.push(`no data — \`${opts.engagement}\` absent (telemetry.artifact_engagement is likely disabled, or nothing has been recorded yet)`);
        return out;
    }
    if (filtered.length === 0 || summary === null) {
        out.push(`no data — 0 event(s) match ${windowLabel(opts)} (${read.totalLines} total line(s) in file, ${read.skippedLines} skipped as malformed)`);
        return out;
    }
    out.push(`${filtered.length} event(s) match ${windowLabel(opts)} (of ${read.totalLines} total line(s), ${read.skippedLines} skipped as malformed).`);
    out.push('');
    out.push('| kind | consulted | applied | consulted ids |');
    out.push('|---|---|---|---|');
    for (const kind of ENGAGEMENT_KINDS) {
        const s = summary[kind];
        if (!s || (s.consulted === 0 && s.applied === 0)) continue;
        out.push(`| ${kind} | ${s.consulted} | ${s.applied} | ${capList(s.consultedIds)} |`);
    }
    return out;
}

function renderOrchestrationSection(opts: Options, auditDirExists: boolean, dispatches: ExplainAuditLine[]): string[] {
    const out: string[] = [];
    out.push('## Subagent dispatches');
    out.push(`_Source: \`${opts.auditDir}/*.jsonl\` (\`orchestration\` sub-object, audit-log-v1)_`);
    out.push('');
    if (!auditDirExists) {
        out.push(`no data — \`${opts.auditDir}\` absent (no orchestration telemetry recorded yet)`);
        return out;
    }
    if (dispatches.length === 0) {
        out.push(`no data — 0 dispatch(es) match ${windowLabel(opts)}`);
        return out;
    }
    out.push(`${dispatches.length} dispatch(es) match ${windowLabel(opts)}.`);
    out.push('');
    out.push('| ts | work_id | mode | tiers | token_delta (provenance) | first_pass_success | escalated |');
    out.push('|---|---|---|---|---|---|---|');
    for (const line of dispatches) {
        const o = line.orchestration ?? {};
        const mode = o.dispatch_mode ?? '(unset)';
        const tiers = (o.tiers ?? []).join(',') || '(unset)';
        const delta = `${o.token_delta ?? 0} (${o.token_delta_provenance ?? 'estimated'})`;
        const fps = o.first_pass_success === null || o.first_pass_success === undefined ? 'n/a' : String(o.first_pass_success);
        const esc = o.escalated === null || o.escalated === undefined ? 'n/a' : String(o.escalated);
        out.push(`| ${line.ts ?? '(unset)'} | ${line.work_id ?? '(unset)'} | ${mode} | ${tiers} | ${delta} | ${fps} | ${esc} |`);
    }
    return out;
}

// ── Dispatch-decision trace (§4b — judgment ladder + telemetry estimate) ─

/** Map the CLI signal flags 1:1 onto `LadderInputs` — nothing inferred. */
export function ladderInputsFromOptions(opts: Options): LadderInputs {
    return {
        taskText: opts.decision ?? '',
        signals: {
            size_estimate: opts.sizeEstimate ?? 0,
            independent_slices: opts.slices ?? 0,
            ordered_plan: opts.orderedPlan ?? false,
        },
        activation: { halted: opts.halted ?? false, subagent_spawn: !(opts.noSpawnPrimitive ?? false) },
        agentTeams: opts.agentTeams ?? false,
        interactiveApprovalRequired: opts.approvalRequired ?? false,
        insideSubagentSession: opts.insideSubagent ?? false,
    };
}

/** Most recent dispatch line by `ts` (undefined ts sorts oldest). */
export function latestDispatch(dispatches: ExplainAuditLine[]): ExplainAuditLine | null {
    let latest: ExplainAuditLine | null = null;
    let latestTs = Number.NEGATIVE_INFINITY;
    for (const line of dispatches) {
        const t = line.ts === undefined ? Number.NEGATIVE_INFINITY : Date.parse(line.ts);
        const ts = Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
        if (latest === null || ts >= latestTs) {
            latest = line;
            latestTs = ts;
        }
    }
    return latest;
}

function renderDecisionSection(
    opts: Options,
    explanation: LadderExplanation,
    auditDirExists: boolean,
    dispatches: ExplainAuditLine[],
): string[] {
    const out: string[] = [];
    out.push('## Dispatch decision (judgment ladder)');
    out.push(
        `_Source: \`src/scripts/_lib/judgment_ladder.ts\` (\`explainLadder\`) over the \`--decision\` text + signal flags; token/cost estimate from \`${opts.auditDir}/*.jsonl\` orchestration telemetry_`,
    );
    out.push('');
    out.push(`Decision text: ${JSON.stringify(opts.decision ?? '')}`);
    const r = explanation.result;
    const rungLabel = r.rung === null ? '∅ (never spawns)' : String(r.rung);
    const modeSuffix = r.mode !== undefined && r.mode !== null ? ` (mode ${r.mode})` : '';
    const degradedSuffix = r.degraded_from !== undefined ? ` [degraded from rung ${r.degraded_from}]` : '';
    out.push(`Resolved: rung ${rungLabel} — verdict \`${r.verdict}\`${modeSuffix}${degradedSuffix} — ${r.reason}`);
    out.push('');
    out.push('### Ladder trail (priority order 0 → 4 → 3 → 2 → 1)');
    out.push('');
    out.push('| rung | resolves to | status | reason |');
    out.push('|---|---|---|---|');
    for (const step of explanation.trail) {
        out.push(`| ${step.rung} | ${step.resolves_to} | ${step.status} | ${step.reason} |`);
    }
    if (explanation.no_spawn_reason !== undefined) {
        out.push('');
        out.push(`Why no spawn: ${explanation.no_spawn_reason}`);
    }
    out.push('');
    out.push('### Token/cost estimate');
    if (!auditDirExists) {
        out.push(`no telemetry record — \`${opts.auditDir}\` absent; no token/cost estimate (a fabricated number would be worse than none)`);
        return out;
    }
    const latest = latestDispatch(dispatches);
    if (latest === null) {
        out.push(`no telemetry record matches ${windowLabel(opts)}; no token/cost estimate (a fabricated number would be worse than none)`);
        return out;
    }
    const o = latest.orchestration ?? {};
    // NOT matched to this decision, and the label must say so. The record shape
    // carries no key that ties a line to a decision text — `latestDispatch` sorts
    // by `ts` alone — so calling it "matching" made an unrelated run's cost read
    // as this decision's estimate, in a section whose own header promises never
    // to fabricate one. Printing it is still useful (it is the freshest real
    // measurement on this host); claiming correspondence was the defect.
    out.push(
        `most recent dispatch in ${windowLabel(opts)} — NOT matched to this decision ` +
            `(the record carries no decision key; sorted by ts alone): ` +
            `ts ${latest.ts ?? '(unset)'}, work_id ${latest.work_id ?? '(unset)'}, ` +
            `token_delta ${o.token_delta ?? 0} (${o.token_delta_provenance ?? 'estimated'}), ` +
            `mode ${o.dispatch_mode ?? '(unset)'}, tiers ${(o.tiers ?? []).join(',') || '(unset)'}`,
    );
    const resolved = explanation.result.verdict;
    const recordMode = o.dispatch_mode;
    if (recordMode !== undefined && resolved === 'in-session') {
        out.push(
            `  ⚠️  this decision resolves to \`${resolved}\` (no dispatch), so the mode above describes a different run.`,
        );
    }
    return out;
}

function renderHygieneSection(hygiene: HygieneReadResult): string[] {
    const out: string[] = [];
    out.push('## Hook / loop state (context-hygiene)');
    out.push(`_Source: tried ${hygiene.checkedPaths.map((p) => `\`${p}\``).join(', then ')}_`);
    out.push('');
    if (hygiene.state === null) {
        out.push('no data — none of the candidate paths exist yet (no PostToolUse hook has run this session, or no PostToolUse hook is bound on this host)');
        return out;
    }
    const s = hygiene.state;
    out.push(`Found at \`${hygiene.path}\`.`);
    out.push('');
    out.push(`- tool_calls: ${String(s['tool_calls'] ?? '(unset)')}`);
    out.push(`- consecutive_same_tool: ${String(s['consecutive_same_tool'] ?? '(unset)')}`);
    out.push(`- last_tool: ${String(s['last_tool'] ?? '(unset)')}`);
    out.push(`- loop_detected: ${String(s['loop_detected'] ?? '(unset)')}`);
    out.push(`- freshness_threshold: ${String(s['freshness_threshold'] ?? '(unset)')}`);
    out.push(`- checked_at: ${String(s['checked_at'] ?? '(unset)')}`);
    return out;
}

function renderParkedSection(): string[] {
    return [
        '## Not answerable today (parked — revisit-if new capture ships)',
        '',
        '1. **Which specific trigger phrase matched, for a given chat turn** —',
        '   `rules_applied` (above) records THAT a rule fired, never WHICH',
        '   trigger fired it, and is only emitted at /work · /implement-ticket',
        '   phase boundaries — never for ad hoc chat turns. Revisit-if a',
        '   per-turn trigger-match log ships.',
        '2. **What content was trimmed/omitted from context due to a token or',
        '   thin-projector budget decision** — no on-disk record of "artefact',
        '   considered but dropped for budget" exists today. Revisit-if such a',
        '   record ships.',
        '3. **Which memory entry id influenced a specific answer**, when the run',
        '   did NOT opt into `decision_engine.surface_traces` — the',
        '   `🧠 Memory: n/m · ids=[...]` line is printed to stdout only, never',
        '   persisted. The durable form (`memory.ids` in',
        '   `agents/runtime/state/work/<id>/decision-trace-<phase>.json`) exists',
        '   ONLY when `decision_engine.surface_traces: true` (off by default) and',
        '   the run went through /work or /implement-ticket — see `explain last`',
        '   for that narrower, per-run case; not duplicated here.',
        '4. **Why a given subagent primitive was/wasn\'t available on this host**',
        '   — the host-capability manifest is resolved in-session by the agent',
        '   from its own knowledge (+ an optional settings override) and is never',
        '   written to disk. Nothing for this script to read.',
    ];
}

// ── Report assembly ──────────────────────────────────────────────────────

export function buildReport(opts: Options): string {
    const since = parseSince(opts.since);
    const hygieneCandidates = opts.hygiene !== null ? [opts.hygiene] : DEFAULT_HYGIENE_CANDIDATES;

    const router = readRouter(opts.router);

    const auditDirExists = fs.existsSync(opts.auditDir);
    const rawAuditLines = (auditDirExists ? readAuditLines(opts.auditDir) : []) as unknown as ExplainAuditLine[];
    const matchedAuditLines = filterAuditLines(rawAuditLines, opts.task, since);
    const rulesTally = tallyRulesApplied(matchedAuditLines);
    const dispatches = dispatchLines(matchedAuditLines);

    const engagementRead = readEngagementEvents(opts.engagement);
    const filteredEngagement = filterEngagement(engagementRead.events, opts.task, since);
    const engagementSummary = filteredEngagement.length > 0 ? summarizeEngagement(filteredEngagement) : null;

    const hygiene = readHygieneState(hygieneCandidates);

    const out: string[] = [];
    out.push('# explain-run');
    out.push('');
    out.push(`Window: ${windowLabel(opts)} · generated_at: ${new Date().toISOString()}`);
    out.push('');
    out.push(...renderSummarySection(router, engagementRead, filteredEngagement, engagementSummary, dispatches, hygiene));
    out.push('');
    out.push(...renderRulesSection(router, opts, rulesTally, auditDirExists));
    out.push('');
    out.push(...renderEngagementSection(opts, engagementRead, filteredEngagement, engagementSummary));
    out.push('');
    out.push(...renderOrchestrationSection(opts, auditDirExists, dispatches));
    out.push('');
    if (opts.decision !== null && opts.decision !== undefined) {
        out.push(...renderDecisionSection(opts, explainLadder(ladderInputsFromOptions(opts)), auditDirExists, dispatches));
        out.push('');
    }
    out.push(...renderHygieneSection(hygiene));
    out.push('');
    out.push(...renderParkedSection());
    return `${out.join('\n')}\n`;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const report = buildReport(opts);
    if (opts.output) {
        fs.mkdirSync(path.dirname(opts.output) || '.', { recursive: true });
        fs.writeFileSync(opts.output, report, 'utf8');
    } else {
        process.stdout.write(report);
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
