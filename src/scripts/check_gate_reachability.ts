#!/usr/bin/env node
/**
 * Which gate-shaped task targets can CI actually reach?
 *
 * A gate nobody invokes is not a gate. It can be written, registered,
 * documented and red for months while every pipeline stays green — which is
 * exactly what happened to `lint_positioning`, whose closing roadmap step
 * recorded CI wiring that never existed.
 *
 * ## What "reachable" means here
 *
 * A target is reachable when it is in the transitive closure of `task ci`, or
 * when a workflow under `.github/workflows/` invokes it directly. Both halves
 * are needed and neither is sufficient: a workflow-only target never runs in a
 * local `task ci`, and a `task ci`-only target never runs on a PR that skips
 * that job.
 *
 * ## What "gate-shaped" means, and why the predicate is deliberately loose
 *
 * A target whose command runs a `check_*` / `lint_*` / `verify_*` script, or
 * whose name starts with `check-` / `lint-` / `verify-`. Loose on purpose: the
 * cost of a false positive is one classified row saying "variant of X", and the
 * cost of a false negative is precisely the silence this script exists to end.
 *
 * ## Stability
 *
 * Everything is sorted and the parse is line-based over committed files, so two
 * runs on one tree print the same set. That is asserted rather than assumed —
 * the 1.1 verify line asks for it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as os from 'node:os';

import { reportScanned } from './_lib/scan_scope.js';
import { runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import {
    INVENTORY_REL,
    inventoryVerdict,
    resetSourceCache,
    type InventoryVerdict,
} from './_lib/loop_surfaces.js';

const REPO_ROOT = process.cwd();
const TASKFILES_DIR = 'taskfiles';
const ROOT_TASKFILE = 'Taskfile.yml';
const WORKFLOWS_DIR = '.github/workflows';

/** `  <name>:` at two-space indent inside a `tasks:` map — one target. */
const TARGET_DECL = /^ {2}([a-z_][a-z0-9:_-]*):\s*$/;
/** `- task: <name>` — a dependency edge. */
const TASK_EDGE = /^\s*-\s*task:\s*([a-z_][a-z0-9:_-]*)\s*$/;
/** `defer: { task: <name> }` — also an edge. */
const DEFER_EDGE = /defer:\s*\{\s*task:\s*([a-z_][a-z0-9:_-]*)\s*\}/;
/**
 * `deps: [a, b]` — a THIRD edge kind, and one it is easy to miss.
 *
 * Missing it does not merely undercount: it reports a target as unreachable
 * when CI does run it, which is the one error this script must not make. Found
 * by the count disagreeing with the roadmap's own two-command reading.
 */
const DEPS_EDGE = /^\s*deps:\s*\[([^\]]*)\]/;
/** `task <name>` inside a workflow `run:` line. */
const WORKFLOW_CALL = /\btask\s+([a-z_][a-z0-9:_-]*)/g;

/** A target is gate-shaped by NAME or by the script its command runs. */
const GATE_NAME = /^(check|lint|verify)[-:]/;
const GATE_CMD = /\b(check|lint|verify)_[a-z0-9_]+/;

export interface TargetDef {
    name: string;
    /** Targets it depends on. */
    edges: string[];
    /** Raw command lines, for the gate-shape predicate. */
    cmds: string[];
    /** Which file declared it. */
    file: string;
}

function taskfilePaths(root: string): string[] {
    const out = [path.join(root, ROOT_TASKFILE)];
    const dir = path.join(root, TASKFILES_DIR);
    if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir).sort()) {
            if (f.endsWith('.yml') || f.endsWith('.yaml')) out.push(path.join(dir, f));
        }
    }
    return out.filter((p) => fs.existsSync(p));
}

/**
 * Parse targets and their edges.
 *
 * A hand parse rather than a YAML load, deliberately: `task` merges several
 * files into one namespace and the includes carry prefixes, so a structural
 * load would have to reimplement `task`'s own resolution to be more correct
 * than this — and would still be a second implementation of it. Line-based
 * keeps the failure mode legible: a target this misses is absent from BOTH
 * sides of the diff, so it cannot create a false unreachable.
 */
export function parseTargets(root = REPO_ROOT): Map<string, TargetDef> {
    const defs = new Map<string, TargetDef>();
    for (const file of taskfilePaths(root)) {
        const rel = path.relative(root, file);
        let current: TargetDef | null = null;
        for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
            const decl = TARGET_DECL.exec(line);
            if (decl !== null) {
                current = { name: decl[1] as string, edges: [], cmds: [], file: rel };
                // Later files win, matching `task`'s own override order.
                defs.set(current.name, current);
                continue;
            }
            if (current === null) continue;
            // A column-0 key ends the tasks block.
            if (/^[a-z_]/.test(line)) {
                current = null;
                continue;
            }
            const deps = DEPS_EDGE.exec(line);
            if (deps !== null) {
                for (const d of (deps[1] as string).split(',')) {
                    const t = d.trim().replace(/^["']|["']$/g, '');
                    if (t !== '') current.edges.push(t);
                }
                continue;
            }
            const edge = TASK_EDGE.exec(line) ?? DEFER_EDGE.exec(line);
            if (edge !== null) current.edges.push(edge[1] as string);
            else current.cmds.push(line);
        }
    }
    return defs;
}

/** Transitive closure from a set of roots, following `task:` edges. */
export function closure(defs: Map<string, TargetDef>, roots: readonly string[]): Set<string> {
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
        const n = stack.pop() as string;
        if (seen.has(n)) continue;
        seen.add(n);
        for (const e of defs.get(n)?.edges ?? []) if (!seen.has(e)) stack.push(e);
    }
    return seen;
}

/** Every `task <name>` a workflow invokes. */
export function workflowCalls(root = REPO_ROOT): Set<string> {
    const out = new Set<string>();
    const dir = path.join(root, WORKFLOWS_DIR);
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.yml') && !f.endsWith('.yaml')) continue;
        const text = fs.readFileSync(path.join(dir, f), 'utf-8');
        for (const m of text.matchAll(WORKFLOW_CALL)) out.add(m[1] as string);
    }
    return out;
}

/** Every workflow file's text, concatenated — for direct-script detection. */
function workflowSources(root: string): string {
    const dir = path.join(root, WORKFLOWS_DIR);
    if (!fs.existsSync(dir)) return '';
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort()
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
        .join('\n');
}

export function isGateShaped(d: TargetDef): boolean {
    if (GATE_NAME.test(d.name)) return true;
    return d.cmds.some((c) => GATE_CMD.test(c));
}

export interface Reachability {
    /** Gate-shaped targets reachable from `task ci` or a `task <name>` workflow call. */
    reachable: string[];
    /**
     * Target unwired, but the SCRIPT it runs is invoked directly by a workflow.
     *
     * This distinction is the difference between "this gate does not run" and
     * "this convenience alias is not wired", and conflating them overstates the
     * hole by a factor of two on this tree. A workflow step that calls
     * `./scripts-run src/scripts/foo` runs the gate whether or not any task
     * target points at it — the target is then a local ergonomic, not a hole.
     */
    scriptInWorkflow: string[];
    /** Neither the target nor its script is reached. THE SET THIS EXISTS FOR. */
    unreachable: string[];
}

/** The script a target runs, as a repo-relative path, or `null`. */
export function scriptOf(d: TargetDef): string | null {
    const m = d.cmds.join(' ').match(/src\/scripts\/[a-z0-9_/]+/);
    return m === null ? null : m[0];
}

export function analyse(root = REPO_ROOT): Reachability {
    const defs = parseTargets(root);
    const fromCi = closure(defs, ['ci']);
    const fromWorkflows = workflowCalls(root);
    // A workflow may call a target that itself has dependencies.
    const viaWorkflows = closure(defs, [...fromWorkflows].filter((n) => defs.has(n)));

    const workflowText = workflowSources(root);
    const reachable: string[] = [];
    const scriptInWorkflow: string[] = [];
    const unreachable: string[] = [];
    for (const [name, d] of [...defs].sort(([a], [b]) => a.localeCompare(b))) {
        if (!isGateShaped(d)) continue;
        if (fromCi.has(name) || viaWorkflows.has(name)) {
            reachable.push(name);
            continue;
        }
        const script = scriptOf(d);
        if (script !== null && workflowText.includes(script)) scriptInWorkflow.push(name);
        else unreachable.push(name);
    }
    return {
        reachable: reachable.sort(),
        scriptInWorkflow: scriptInWorkflow.sort(),
        unreachable: unreachable.sort(),
    };
}

export const EXEMPTIONS_REL = 'src/config/gate-reachability-exemptions.json';

/** Targets recorded as deliberately unreachable, id → reason. */
export function readExemptions(root = REPO_ROOT): Map<string, string> {
    const p = path.join(root, EXEMPTIONS_REL);
    if (!fs.existsSync(p)) return new Map();
    const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as { exempt?: Record<string, string> };
    return new Map(Object.entries(doc.exempt ?? {}));
}

export interface GateVerdict {
    /** Unreachable and NOT recorded — the failure. */
    unreasoned: string[];
    /** Recorded exemptions that are no longer unreachable — stale rows. */
    stale: string[];
    /**
     * The `_lib-export-reach` axis: a declared loop instrument nothing calls.
     *
     * A second axis in this one script rather than a second gate, because it
     * asks the same question one layer down. The first axis asks whether CI
     * reaches a gate TARGET; this asks whether production code reaches a
     * declared INSTRUMENT. A separate gate would need its own registration,
     * its own coverage row and its own wiring — and would then be the thing
     * this family exists to detect if any of that were missed.
     *
     * Deliberately scoped to the instruments named in `loop-surfaces.yaml`
     * rather than to every `_lib` export. Measured on `loop_guards.ts`, the
     * unscoped version reports nine of fourteen exports dead; a gate whose
     * signal is a minority of its own output gets allowlisted rather than
     * answered.
     */
    inventory: InventoryVerdict;
}

/**
 * The gate verdict.
 *
 * Both directions, because a one-way check rots. An unreachable target with no
 * row is the defect this roadmap is about; a row for a target that is now
 * reachable is an exemption nobody withdrew, and a registry full of those stops
 * being read.
 */
export function gateVerdict(root = REPO_ROOT): GateVerdict {
    const r = analyse(root);
    const exempt = readExemptions(root);
    const unreachable = new Set(r.unreachable);
    return {
        unreasoned: r.unreachable.filter((n) => !exempt.has(n)).sort(),
        stale: [...exempt.keys()].filter((n) => !unreachable.has(n)).sort(),
        inventory: inventoryVerdict(root),
    };
}

/** The `_lib-export-reach` half of the verdict, written to stderr. */
function reportInventory(inv: InventoryVerdict): void {
    for (const f of inv.shape) {
        process.stderr.write(
            `❌  ${INVENTORY_REL}: surface \`${f.id}\` — ${f.detail} (${f.reason}). Every surface ` +
                'carries every field, and a bound resolves to something that exists.\n',
        );
    }
    for (const f of inv.reach) {
        const fix =
            f.reason === 'dead'
                ? 'Give it a production consumer, declare it `status: experimental` with a future ' +
                  '`expires:`, or delete it. A built instrument nothing calls is not built.'
                : 'An exemption is a dated deferral, not a label. Decide it, or move the date and ' +
                  'say why in `note:`.';
        process.stderr.write(`❌  ${f.id} (${f.file}) — ${f.detail}. ${fix}\n`);
    }
}

function runGate(root: string): number {
    const v = gateVerdict(root);
    const exempt = readExemptions(root);
    const inv = v.inventory;
    const declared = inv.live.length + inv.exempt.length + inv.reach.length;
    reportScanned({
        gate: 'check_gate_reachability',
        scanned: exempt.size + analyse(root).unreachable.length + declared,
        units: 'exemption row(s) + unreachable target(s) + declared loop instrument(s)',
        roots: [EXEMPTIONS_REL, INVENTORY_REL, ROOT_TASKFILE, TASKFILES_DIR],
    });
    const inventoryClean = inv.shape.length === 0 && inv.reach.length === 0;
    if (v.unreasoned.length === 0 && v.stale.length === 0 && inventoryClean) {
        process.stdout.write(
            `✅  check_gate_reachability: every unreachable gate target carries a recorded reason ` +
                `(${String(exempt.size)} exempt); every declared loop instrument is called or ` +
                `dated (${String(inv.live.length)} live, ${String(inv.exempt.length)} experimental` +
                `${inv.proseBound.length > 0 ? `, ${String(inv.proseBound.length)} prose-bound surface(s)` : ''}).\n`,
        );
        return 0;
    }
    reportInventory(inv);
    for (const n of v.unreasoned) {
        process.stderr.write(
            `❌  ${n} is gate-shaped, unreachable from \`task ci\` and every workflow, and carries ` +
                `no row in ${EXEMPTIONS_REL}. Wire it, or record why it is manual AND what would make it run.\n`,
        );
    }
    for (const n of v.stale) {
        process.stderr.write(
            `❌  ${n} is exempt in ${EXEMPTIONS_REL} but is now reachable. Remove the row — an ` +
                'exemption nobody withdrew is how a registry stops being read.\n',
        );
    }
    return 1;
}

/**
 * The self-test builds throwaway trees rather than touching this one, so both
 * directions are proven without a canary that has to be removed again.
 */
function selfTest(): number {
    const roots: string[] = [];
    const fixture = (opts: { target: string; wired: boolean; exempt: Record<string, string> }): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-selftest-'));
        roots.push(dir);
        fs.mkdirSync(path.join(dir, TASKFILES_DIR), { recursive: true });
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(dir, WORKFLOWS_DIR), { recursive: true });
        fs.writeFileSync(
            path.join(dir, ROOT_TASKFILE),
            ['tasks:', '  ci:', '    cmds:', ...(opts.wired ? [`      - task: ${opts.target}`] : [])].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(dir, TASKFILES_DIR, 'a.yml'),
            ['tasks:', `  ${opts.target}:`, '    cmd: ./scripts-run src/scripts/check_thing'].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(dir, EXEMPTIONS_REL),
            JSON.stringify({ exempt: opts.exempt }, null, 2),
            'utf-8',
        );
        const v = gateVerdict(dir);
        return v.unreasoned.length === 0 && v.stale.length === 0 ? 0 : 1;
    };

    /**
     * A throwaway tree for the `_lib-export-reach` axis.
     *
     * `surface` and `instrument` are written verbatim into the inventory, so a
     * case can plant a malformed row without the builder silently repairing
     * it — which is the whole point of a planted failure.
     */
    const inventoryFixture = (opts: { surface: string; instrument: string; calls: boolean }): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-inv-'));
        roots.push(dir);
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'src', 'lib'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'src', 'lib', 'thing.ts'),
            [
                'export const CEILING = 3;',
                'export function stalled(): boolean { return false; }',
                'export function helper(): number { return CEILING; }',
                ...(opts.calls ? ['export const used = helper();'] : []),
            ].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(dir, 'src', 'config', 'loop-surfaces.yaml'),
            `surfaces:\n${opts.surface}\ninstruments:\n${opts.instrument}\n`,
            'utf-8',
        );
        resetSourceCache();
        const v = inventoryVerdict(dir);
        resetSourceCache();
        return v.shape.length === 0 && v.reach.length === 0 ? 0 : 1;
    };

    const wholeSurface = [
        '  s:',
        '    kind: code',
        '    bound_kind: code',
        '    cap: src/lib/thing.ts:CEILING',
        '    no_progress: src/lib/thing.ts:stalled',
        '    success_stop: a stated stop',
        '    checker: a stated checker',
        '    human_gate: none',
        '    terminal_vocabulary: none',
        '    production_consumers: [src/lib/thing.ts]',
    ].join('\n');
    // Identical but for the one missing field — so a red can only be the cap.
    const cappedSurface = wholeSurface
        .split('\n')
        .filter((l) => !l.includes('cap:'))
        .join('\n');
    const plainInstrument = ['  helper:', '    file: src/lib/thing.ts', '    role: a stated role'].join('\n');

    const cases: SelfTestCase[] = [
        {
            name: 'a wired gate target → accept',
            expect: 'accept',
            run: () => fixture({ target: 'check-x', wired: true, exempt: {} }),
        },
        {
            name: 'an unreachable gate target with no row → reject',
            expect: 'reject',
            run: () => fixture({ target: 'check-x', wired: false, exempt: {} }),
        },
        {
            name: 'an unreachable gate target WITH a row → accept',
            expect: 'accept',
            run: () => fixture({ target: 'check-x', wired: false, exempt: { 'check-x': 'a stated reason' } }),
        },
        {
            // The other direction. Without it a registry accumulates rows for
            // targets that were wired long ago, and stops being read.
            name: 'a row for a target that IS reachable → reject (stale exemption)',
            expect: 'reject',
            run: () => fixture({ target: 'check-x', wired: true, exempt: { 'check-x': 'stale' } }),
        },
        // The `_lib-export-reach` axis. The accept case comes first so a
        // builder that reds on everything is caught before the three planted
        // failures can be read as the axis working.
        {
            name: 'a whole surface and a called instrument → accept',
            expect: 'accept',
            run: () =>
                inventoryFixture({ surface: wholeSurface, instrument: plainInstrument, calls: true }),
        },
        {
            name: 'a surface with no `cap` → reject',
            expect: 'reject',
            run: () =>
                inventoryFixture({ surface: cappedSurface, instrument: plainInstrument, calls: true }),
        },
        {
            name: 'an instrument with no consumer → reject',
            expect: 'reject',
            run: () =>
                inventoryFixture({ surface: wholeSurface, instrument: plainInstrument, calls: false }),
        },
        {
            // The reason `expires:` is a required field rather than a nicety:
            // a declared-inactive instrument with no deadline is the same dead
            // code wearing a label.
            name: 'an exception whose `expires:` has passed → reject',
            expect: 'reject',
            run: () =>
                inventoryFixture({
                    surface: wholeSurface,
                    instrument: `${plainInstrument}\n    status: experimental\n    expires: '2020-01-01'`,
                    calls: false,
                }),
        },
        {
            name: 'an `experimental` exception with no `expires:` → reject',
            expect: 'reject',
            run: () =>
                inventoryFixture({
                    surface: wholeSurface,
                    instrument: `${plainInstrument}\n    status: experimental`,
                    calls: false,
                }),
        },
        {
            name: 'an unexpired `experimental` exception on a dead instrument → accept',
            expect: 'accept',
            run: () =>
                inventoryFixture({
                    surface: wholeSurface,
                    instrument: `${plainInstrument}\n    status: experimental\n    expires: '2099-01-01'`,
                    calls: false,
                }),
        },
    ];
    try {
        return runSelfTest({ gate: 'check_gate_reachability', cases, minCases: 10, minRejectCases: 6 });
    } finally {
        for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    if (argv.includes('--gate')) return runGate(root);
    const r = analyse(root);
    const inv = inventoryVerdict(root);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ ...r, inventory: inv }, null, 2)}\n`);
        return 0;
    }
    // Emitted on the DEFAULT invocation too, not only under `--gate`: the
    // coverage gate reads a bare run, and a gate that reports what it inspected
    // only in one mode is a gate that reports nothing in the other.
    const declared = inv.live.length + inv.exempt.length + inv.reach.length;
    reportScanned({
        gate: 'check_gate_reachability',
        scanned: readExemptions(root).size + r.unreachable.length + declared,
        units: 'exemption row(s) + unreachable target(s) + declared loop instrument(s)',
        roots: [EXEMPTIONS_REL, INVENTORY_REL, ROOT_TASKFILE, TASKFILES_DIR],
    });
    const total = r.reachable.length + r.scriptInWorkflow.length + r.unreachable.length;
    process.stdout.write(
        `gate-shaped targets: ${String(total)} · target-reachable ${String(r.reachable.length)} · ` +
            `script-runs-in-workflow ${String(r.scriptInWorkflow.length)} · ` +
            `UNREACHABLE ${String(r.unreachable.length)}\n`,
    );
    for (const n of r.unreachable) process.stdout.write(`  · ${n}\n`);
    process.stdout.write(
        `declared loop instruments: ${String(declared)} · live ${String(inv.live.length)} · ` +
            `experimental ${String(inv.exempt.length)} · DEAD ${String(inv.reach.length)} · ` +
            `prose-bound surfaces ${String(inv.proseBound.length)}\n`,
    );
    for (const f of inv.reach) process.stdout.write(`  · ${f.id} — ${f.detail}\n`);
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_gate_reachability')) {
    process.exit(main());
}
