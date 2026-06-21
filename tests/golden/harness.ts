/**
 * Replay each Golden Transcript and compare against the locked baseline (TS
 * twin of the retired `harness.py`). Drives the same recipe modules used by
 * the capture step against the current `.ts` work_engine and reports
 * structural drift.
 *
 * Comparison strategy:
 * - **exit codes** per cycle — exact match.
 * - **state snapshot** per cycle — recursive *structure* match (key names,
 *   types, list lengths). Leaf scalars may drift; `questions` is validated
 *   separately as halt markers, `report` as the delivery report.
 * - **halt markers** per cycle — exit code + `recipe_action` exact, plus
 *   *Strict-Verb* shape on `questions`: directive verb identity, per-line
 *   class (directive / numbered / blockquote / text), and option count.
 * - **delivery report** — `^## ` headings exact-equal as an ordered list.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RECIPES, type RecipeModule } from './sandbox/recipes/index.js';
import { run_capture, type CaptureResult, type Dict, type RecipeStep } from './sandbox/runner.js';

const GOLDEN_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_ROOT = path.join(GOLDEN_ROOT, 'baseline');
export const SANDBOX_ROOT = path.join(GOLDEN_ROOT, 'sandbox');

export interface Diff {
    path: string;
    kind: string;
    message: string;
}

function diffStr(d: Diff): string {
    return `[${d.kind}] ${d.path}: ${d.message}`;
}

export interface ReplayResult {
    gt_id: string;
    cycles_state: Dict[];
    cycles_exit: number[];
    cycles_directive: (string | null)[];
    cycles_recipe_action: (string | null)[];
    delivery_report: string;
}

export interface HaltMarker {
    cycle: number;
    exit_code: number;
    directive: string | null;
    recipe_action: string | null;
    questions: unknown[];
}

export function haltMarkers(r: ReplayResult): HaltMarker[] {
    return r.cycles_state.map((state, idx) => ({
        cycle: idx + 1,
        exit_code: r.cycles_exit[idx]!,
        directive: r.cycles_directive[idx]!,
        recipe_action: r.cycles_recipe_action[idx]!,
        questions: (state['questions'] as unknown[] | undefined) ?? [],
    }));
}

export interface Baseline {
    gt_id: string;
    exit_codes: number[];
    halt_markers: Record<string, unknown>[];
    delivery_report: string;
    state_snapshots: Dict[];
}

// ── recipe lookup ──────────────────────────────────────────────────────────

function metaGtId(m: RecipeModule): string {
    return m.META.gt_id;
}

function loadModuleFor(gt_id: string): RecipeModule {
    const m = RECIPES.find((mod) => metaGtId(mod) === gt_id);
    if (!m) throw new Error(`unknown GT id: ${gt_id}`);
    return m;
}

export function allGtIds(): string[] {
    return RECIPES.map(metaGtId);
}

function resolveInput(meta: RecipeModule['META']): {
    ticket_file: string | null;
    prompt_file: string | null;
    diff_file: string | null;
    file_file: string | null;
} {
    const rels = [meta.ticket_relpath, meta.prompt_relpath, meta.diff_relpath, meta.file_relpath];
    const supplied = rels.filter((r) => r != null);
    if (supplied.length !== 1) {
        throw new Error(
            `META for ${meta.gt_id} must declare exactly one of ticket_relpath / ` +
                `prompt_relpath / diff_relpath / file_relpath`,
        );
    }
    const abs = (rel: string | undefined): string | null =>
        rel != null ? path.join(SANDBOX_ROOT, rel) : null;
    return {
        ticket_file: abs(meta.ticket_relpath),
        prompt_file: abs(meta.prompt_relpath),
        diff_file: abs(meta.diff_relpath),
        file_file: abs(meta.file_relpath),
    };
}

// ── replay ──────────────────────────────────────────────────────────────────

/**
 * Drive a scenario through the live `.ts` work_engine and return the full
 * `CaptureResult` (per-cycle cmd / stdout / stderr / state + final outcome).
 * The temp workspace is removed before returning — the transcript is fully
 * in-memory and the fixture is the input file under `SANDBOX_ROOT`, so no
 * caller needs the workspace afterwards. `replay()` trims this to the
 * structural `ReplayResult` the comparators consume; `capture.ts` serialises
 * the full result into the locked baseline pack.
 */
export function captureFull(gt_id: string): CaptureResult {
    const module = loadModuleFor(gt_id);
    const meta = module.META;
    const inputs = resolveInput(meta);
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), `replay-${gt_id}-`));
    const workspace = path.join(tmpBase, 'ws');
    try {
        const recipe: Record<string, RecipeStep> = module.buildRecipe(workspace);
        const seed = module.seedState ? module.seedState(workspace) : null;
        return run_capture({
            gt_id,
            workspace,
            recipe,
            ticket_file: inputs.ticket_file,
            prompt_file: inputs.prompt_file,
            diff_file: inputs.diff_file,
            file_file: inputs.file_file,
            persona: meta.persona ?? null,
            cycle_cap: meta.cycle_cap,
            seed_state: seed,
        });
    } finally {
        fs.rmSync(tmpBase, { recursive: true, force: true });
    }
}

export function replay(gt_id: string): ReplayResult {
    const cap = captureFull(gt_id);
    const cyclesState = cap.cycles.map((c) => c.state_after);
    const finalState = cyclesState.length > 0 ? cyclesState[cyclesState.length - 1]! : {};
    return {
        gt_id,
        cycles_state: cyclesState,
        cycles_exit: cap.cycles.map((c) => c.exit_code),
        cycles_directive: cap.cycles.map((c) => c.directive),
        cycles_recipe_action: cap.cycles.map((c) => c.recipe_action),
        delivery_report: (finalState['report'] as string | undefined) ?? '',
    };
}

export function loadBaseline(gt_id: string, baselineRoot: string = BASELINE_ROOT): Baseline {
    const pack = path.join(baselineRoot, gt_id);
    const read = (f: string): string => fs.readFileSync(path.join(pack, f), 'utf-8');
    const exitCodes = (JSON.parse(read('exit-codes.json')) as { exit_code: number }[]).map(
        (e) => e.exit_code,
    );
    const haltMarkersJson = JSON.parse(read('halt-markers.json')) as Record<string, unknown>[];
    const deliveryReport = read('delivery-report.md');
    const snapDir = path.join(pack, 'state-snapshots');
    const snapshots = fs
        .readdirSync(snapDir)
        .filter((p) => /^cycle-.*\.json$/.test(p))
        .sort()
        .map((p) => JSON.parse(fs.readFileSync(path.join(snapDir, p), 'utf-8')) as Dict);
    return {
        gt_id,
        exit_codes: exitCodes,
        halt_markers: haltMarkersJson,
        delivery_report: deliveryReport,
        state_snapshots: snapshots,
    };
}

// ── comparators ──────────────────────────────────────────────────────────────

const STATE_DELEGATED = new Set(['questions', 'report']);

/** Structural class of one `questions` entry. */
export function classifyQuestion(line: unknown): (string | number)[] {
    if (typeof line !== 'string') return ['invalid'];
    if (line.startsWith('@agent-directive:')) {
        const rest = line.split(':').slice(1).join(':').trim();
        const verb = rest ? rest.split(/\s+/)[0]! : '';
        return ['directive', verb];
    }
    const m = /^> (\d+)\./.exec(line);
    if (m) return ['numbered', Number(m[1])];
    if (line.startsWith('> ')) return ['blockquote'];
    return ['text'];
}

function jsonType(v: unknown): string {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
}

/** Recursive *structure* comparison — types, keys, list lengths. */
export function shapeDiff(
    base: unknown,
    repl: unknown,
    p: string,
    skipTopKeys: Set<string> = new Set(),
): Diff[] {
    const diffs: Diff[] = [];
    const bt = jsonType(base);
    const rt = jsonType(repl);
    if (bt !== rt) {
        return [{ path: p, kind: 'state.shape', message: `type ${bt} → ${rt}` }];
    }
    if (bt === 'object') {
        const b = base as Dict;
        const r = repl as Dict;
        const baseKeys = Object.keys(b).filter((k) => !skipTopKeys.has(k));
        const replKeys = Object.keys(r).filter((k) => !skipTopKeys.has(k));
        const missing = baseKeys.filter((k) => !replKeys.includes(k)).sort();
        const added = replKeys.filter((k) => !baseKeys.includes(k)).sort();
        if (missing.length) {
            diffs.push({ path: p, kind: 'state.keys', message: `keys missing in replay: [${missing.join(', ')}]` });
        }
        if (added.length) {
            diffs.push({ path: p, kind: 'state.keys', message: `unexpected keys in replay: [${added.join(', ')}]` });
        }
        for (const key of baseKeys.filter((k) => replKeys.includes(k)).sort()) {
            diffs.push(...shapeDiff(b[key], r[key], `${p}.${key}`));
        }
        return diffs;
    }
    if (bt === 'array') {
        const b = base as unknown[];
        const r = repl as unknown[];
        if (b.length !== r.length) {
            return [{ path: p, kind: 'state.length', message: `len ${b.length} → ${r.length}` }];
        }
        for (let i = 0; i < b.length; i += 1) diffs.push(...shapeDiff(b[i], r[i], `${p}[${i}]`));
        return diffs;
    }
    // Primitives — accept any leaf value drift.
    return diffs;
}

export function compareExitCodes(base: Baseline, repl: ReplayResult): Diff[] {
    if (JSON.stringify(base.exit_codes) !== JSON.stringify(repl.cycles_exit)) {
        return [{
            path: 'exit_codes',
            kind: 'exit',
            message: `[${base.exit_codes.join(', ')}] → [${repl.cycles_exit.join(', ')}]`,
        }];
    }
    return [];
}

export function compareStateSnapshots(base: Baseline, repl: ReplayResult): Diff[] {
    if (base.state_snapshots.length !== repl.cycles_state.length) {
        return [{
            path: 'state_snapshots',
            kind: 'state.length',
            message: `cycles ${base.state_snapshots.length} → ${repl.cycles_state.length}`,
        }];
    }
    const diffs: Diff[] = [];
    for (let idx = 0; idx < base.state_snapshots.length; idx += 1) {
        const cyc = String(idx + 1).padStart(2, '0');
        diffs.push(...shapeDiff(base.state_snapshots[idx], repl.cycles_state[idx], `cycle-${cyc}`, STATE_DELEGATED));
    }
    return diffs;
}

export function compareHaltMarkers(base: Baseline, repl: ReplayResult): Diff[] {
    const replMarkers = haltMarkers(repl);
    if (base.halt_markers.length !== replMarkers.length) {
        return [{
            path: 'halt_markers',
            kind: 'halt.length',
            message: `cycles ${base.halt_markers.length} → ${replMarkers.length}`,
        }];
    }
    const diffs: Diff[] = [];
    for (let i = 0; i < base.halt_markers.length; i += 1) {
        const b = base.halt_markers[i]!;
        const r = replMarkers[i]!;
        const cyc = String(b['cycle']).padStart(2, '0');
        const prefix = `halt[cycle-${cyc}]`;
        for (const field of ['exit_code', 'directive', 'recipe_action'] as const) {
            if (JSON.stringify(b[field]) !== JSON.stringify((r as unknown as Dict)[field])) {
                diffs.push({
                    path: `${prefix}.${field}`,
                    kind: 'halt.field',
                    message: `${JSON.stringify(b[field])} → ${JSON.stringify((r as unknown as Dict)[field])}`,
                });
            }
        }
        const bq = (b['questions'] as unknown[] | undefined) ?? [];
        const rq = r.questions;
        if (bq.length !== rq.length) {
            diffs.push({ path: `${prefix}.questions`, kind: 'halt.questions', message: `len ${bq.length} → ${rq.length}` });
            continue;
        }
        for (let j = 0; j < bq.length; j += 1) {
            const bc = JSON.stringify(classifyQuestion(bq[j]));
            const rc = JSON.stringify(classifyQuestion(rq[j]));
            if (bc !== rc) {
                diffs.push({ path: `${prefix}.questions[${j}]`, kind: 'halt.questions.shape', message: `${bc} → ${rc}` });
            }
        }
    }
    return diffs;
}

function headings(report: string): string[] {
    return report.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.replace(/\s+$/, ''));
}

export function compareDeliveryReport(base: Baseline, repl: ReplayResult): Diff[] {
    const bh = headings(base.delivery_report);
    const rh = headings(repl.delivery_report);
    if (JSON.stringify(bh) !== JSON.stringify(rh)) {
        return [{
            path: 'delivery_report.headings',
            kind: 'report.headings',
            message: `${JSON.stringify(bh)} → ${JSON.stringify(rh)}`,
        }];
    }
    return [];
}

export function compare(base: Baseline, repl: ReplayResult): Diff[] {
    return [
        ...compareExitCodes(base, repl),
        ...compareHaltMarkers(base, repl),
        ...compareStateSnapshots(base, repl),
        ...compareDeliveryReport(base, repl),
    ];
}

export function replayAndCompare(
    gt_id: string,
    baselineRoot: string = BASELINE_ROOT,
): { base: Baseline; repl: ReplayResult; diffs: Diff[] } {
    const base = loadBaseline(gt_id, baselineRoot);
    const repl = replay(gt_id);
    return { base, repl, diffs: compare(base, repl) };
}

export { diffStr };
