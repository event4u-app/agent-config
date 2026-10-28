/**
 * Primary graders for the artifact corpus, plus the
 * labelled secondary column.
 *
 * Primary graders are ones agent-config does not own: an XML
 * render gate, held-back DOM acceptance tests, scripted HTTP exploits, a hidden
 * test scenario and the reference-fidelity UI bench. Agent-config's own linters
 * run only as `secondary`, are reported under that label, and never feed the
 * primary score or the parity decision.
 *
 * A grader whose toolchain is missing returns `unknown` — never `pass`. The
 * axe column is `unknown` until `axe-core` is installed; no dependency is added
 * to make it otherwise.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { ArtifactTask, GraderRef } from './bench_artifact_corpus.js';
import { grade_hidden_tests, grade_login, SEC_CHECKS, type LoginContract } from './bench_artifact_php.js';
import { svg_render_gate, type GateCheck, type GateStatus } from './bench_artifact_svg_gate.js';

const HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..', '..');
export const AB_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');

/** Frozen render conditions shared by every browser-shaped grader. */
export const FROZEN_RENDER = {
    breakpoints: [375, 768, 1280],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezone: 'UTC',
    reduced_motion: 'reduce',
    fonts: 'generic families only (system-ui, serif, sans-serif, monospace)',
} as const;

export interface GraderResult {
    grader: string;
    role: 'primary' | 'secondary';
    status: GateStatus;
    score: number | null;
    checks: GateCheck[];
    /** Extra columns reported beside the score (axe, sec_pass); `unknown(<reason>)` when unmeasured. */
    columns: Record<string, string>;
    reason?: string;
}

export interface GradeOpts {
    /** Override for tests: a PHP binary path, or `null` to force "not installed". */
    php?: string | null;
    /** Override for tests: whether a browser is usable for bench:ui. */
    browser?: boolean;
    timeout_ms?: number;
}

export function fold(grader: string, role: GraderResult['role'], checks: GateCheck[], columns: Record<string, string> = {}): GraderResult {
    const failed = checks.some((c) => c.status === 'fail');
    const unknown = checks.filter((c) => c.status === 'unknown');
    const status: GateStatus = failed ? 'fail' : unknown.length > 0 || checks.length === 0 ? 'unknown' : 'pass';
    const score = unknown.length > 0 || checks.length === 0 ? null : checks.filter((c) => c.status === 'pass').length / checks.length;
    return { grader, role, status, score, checks, columns, ...(unknown.length ? { reason: unknown[0]?.detail ?? 'unmeasured' } : {}) };
}

function tsx_loader(): string | null {
    try {
        return pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href;
    } catch {
        return null;
    }
}

function axe_column(): string {
    try {
        createRequire(import.meta.url).resolve('axe-core');
    } catch {
        return 'unknown(axe-core not installed)';
    }
    // Installed but not wired: injecting it needs a real browser at three
    // breakpoints, which this grader does not start. Reported, not guessed.
    return 'unknown(axe-core present, browser pass not wired)';
}

/** Held-back DOM acceptance tests, run in a hardened child process. */
export function grade_dom(workspace: string, task: ArtifactTask, args: Record<string, unknown>, opts: GradeOpts = {}): GraderResult {
    const columns = { axe: axe_column() };
    const html_path = path.join(workspace, task.deliverable.path);
    const spec_file = path.join(AB_ROOT, String(args['spec']));
    if (!fs.existsSync(html_path)) return fold('acceptance+axe', 'primary', [{ id: 'deliverable-exists', status: 'fail', detail: task.deliverable.path }], columns);
    const loader = tsx_loader();
    if (loader === null) return fold('acceptance+axe', 'primary', [{ id: 'dom', status: 'unknown', detail: 'tsx loader not resolvable' }], columns);
    const tests = (JSON.parse(fs.readFileSync(spec_file, 'utf-8')) as { tests: unknown[] }).tests;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-dom-'));
    const spec_path = path.join(tmp, 'spec.json');
    fs.writeFileSync(spec_path, JSON.stringify({ html_path, tests, render: { ...FROZEN_RENDER.viewport, locale: FROZEN_RENDER.locale } }));
    const worker = path.join(path.dirname(HERE), `bench_artifact_dom_worker${path.extname(HERE)}`);
    const r = spawnSync(process.execPath, ['--disallow-code-generation-from-strings', '--frozen-intrinsics', '--no-warnings', '--import', loader, worker, spec_path], {
        encoding: 'utf-8',
        timeout: opts.timeout_ms ?? 60_000,
        cwd: tmp,
        env: { ...process.env, HOME: tmp, TZ: FROZEN_RENDER.timezone, LANG: 'en_US.UTF-8' },
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    const line = (r.stdout ?? '').trim().split('\n').pop() ?? '';
    let parsed: { results?: { name: string; status: GateStatus; detail?: string }[]; unavailable?: string } = {};
    try {
        parsed = JSON.parse(line) as typeof parsed;
    } catch {
        return fold('acceptance+axe', 'primary', [{ id: 'worker', status: 'fail', detail: r.error ? String(r.error.message) : `worker exit ${r.status}` }], columns);
    }
    if (parsed.unavailable) return fold('acceptance+axe', 'primary', [{ id: 'dom', status: 'unknown', detail: parsed.unavailable }], columns);
    return fold('acceptance+axe', 'primary', (parsed.results ?? []).map((x) => ({ id: x.name, status: x.status, ...(x.detail ? { detail: x.detail } : {}) })), columns);
}

export function browser_available(): boolean {
    const r = spawnSync(process.execPath, ['-e', "import('@playwright/test').then(m=>process.exit(require('fs').existsSync(m.chromium.executablePath())?0:1),()=>process.exit(1))"], {
        cwd: REPO_ROOT,
        timeout: 20_000,
    });
    return r.status === 0;
}

/** T6: delegate to `internal/bench/ui/run.ts` with a per-run config, lock and report. */
export function grade_ui_fidelity(workspace: string, task: ArtifactTask, args: Record<string, unknown>, opts: GradeOpts = {}): GraderResult {
    const truth = path.join(AB_ROOT, String(args['truth']));
    const candidate = path.join(workspace, task.deliverable.path);
    const pinned = String(args['truth_sha256'] ?? '');
    const actual = createHash('sha256').update(fs.readFileSync(truth)).digest('hex');
    if (actual !== pinned) return fold('bench-ui', 'primary', [{ id: 'truth-pinned', status: 'fail', detail: `truth sha ${actual.slice(0, 12)} ≠ pin` }]);
    if (!fs.existsSync(candidate)) return fold('bench-ui', 'primary', [{ id: 'deliverable-exists', status: 'fail' }]);
    const src = fs.readFileSync(candidate, 'utf-8');
    const shortcut = /<iframe|<object|<embed|\.\.\/|file:/i.test(src);
    if (shortcut) return fold('bench-ui', 'primary', [{ id: 'self-contained', status: 'fail', detail: 'embeds or references the original instead of reproducing it' }]);
    if (!(opts.browser ?? browser_available())) return fold('bench-ui', 'primary', [{ id: 'bench-ui', status: 'unknown', detail: 'no playwright chromium installed' }]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-uifid-'));
    const base = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'internal', 'bench', 'ui', 'bench.config.json'), 'utf-8')) as Record<string, unknown>;
    const config = { ...base, truth, candidates: [candidate], breakpoints: FROZEN_RENDER.breakpoints, interactions: args['interactions'] ?? [] };
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify(config));
    const r = spawnSync(
        path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'),
        ['internal/bench/ui/run.ts', '--json', '--update-lock', '--config', path.join(tmp, 'config.json'), '--lock', path.join(tmp, 'lock.json'), '--report', path.join(tmp, 'report.json')],
        { cwd: REPO_ROOT, encoding: 'utf-8', timeout: opts.timeout_ms ?? 180_000 },
    );
    fs.rmSync(tmp, { recursive: true, force: true });
    const out = r.stdout ?? '';
    const brace = out.indexOf('{');
    let weighted: number | null = null;
    try {
        weighted = (JSON.parse(out.slice(brace)) as { reports: { weighted: number }[] }).reports[0]?.weighted ?? null;
    } catch {
        weighted = null;
    }
    if (weighted === null) return fold('bench-ui', 'primary', [{ id: 'bench-ui', status: 'unknown', detail: `bench:ui produced no score (exit ${r.status})` }]);
    const bar = Number(args['pass_threshold'] ?? task.parity_bar);
    return { grader: 'bench-ui', role: 'primary', status: weighted >= bar ? 'pass' : 'fail', score: weighted, checks: [{ id: 'bench-ui-weighted', status: weighted >= bar ? 'pass' : 'fail', detail: String(weighted) }], columns: {} };
}

/** Agent-config's own linters, reported in a labelled secondary column only. */
export function grade_secondary(workspace: string, task: ArtifactTask, ref: GraderRef): GraderResult {
    const target = path.join(workspace, task.deliverable.path);
    const argv: Record<string, string[]> = {
        lint_svg_asset: ['src/scripts/lint_svg_asset.ts', '--file', target],
        lint_design_slop: ['src/scripts/lint_design_slop.ts', '--dir', path.dirname(target)],
        check_account_surface: ['src/scripts/check_account_surface.ts', workspace],
    };
    const cmd = argv[ref.id];
    if (cmd === undefined) return fold(ref.id, 'secondary', [{ id: ref.id, status: 'unknown', detail: 'unknown secondary grader' }]);
    const r = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), cmd, { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 60_000 });
    const status: GateStatus = r.status === 0 ? 'pass' : r.status === 2 || r.status === 1 ? 'fail' : 'unknown';
    return { ...fold(ref.id, 'secondary', [{ id: ref.id, status, detail: `exit ${r.status}` }]), columns: { label: 'secondary — agent-config own linter, not a primary grader' } };
}

export async function grade_primary(workspace: string, task: ArtifactTask, opts: GradeOpts = {}): Promise<GraderResult> {
    const ref = task.graders.find((g) => g.role === 'primary') as GraderRef;
    const args = ref.args ?? {};
    switch (ref.id) {
        case 'svg-render-gate': {
            const file = path.join(workspace, task.deliverable.path);
            if (!fs.existsSync(file)) return fold(ref.id, 'primary', [{ id: 'deliverable-exists', status: 'fail' }]);
            return fold(ref.id, 'primary', svg_render_gate(fs.readFileSync(file, 'utf-8'), args as { palette?: string[]; palette_min?: number }));
        }
        case 'acceptance+axe':
            return grade_dom(workspace, task, args, opts);
        case 'functional+exploits': {
            const checks = await grade_login(workspace, args as unknown as LoginContract, opts.php === undefined ? undefined : opts.php);
            const sec = checks.filter((c) => SEC_CHECKS.has(c.id));
            const sec_pass = sec.some((c) => c.status === 'unknown') ? 'unknown(php not installed)' : String(sec.every((c) => c.status === 'pass'));
            return fold(ref.id, 'primary', checks, { sec_pass });
        }
        case 'hidden-tests':
            return fold(ref.id, 'primary', await grade_hidden_tests(workspace, path.join(AB_ROOT, String(args['scenario'])), opts.php === undefined ? undefined : opts.php));
        case 'bench-ui':
            return grade_ui_fidelity(workspace, task, args, opts);
        default:
            return fold(ref.id, 'primary', [{ id: ref.id, status: 'unknown', detail: 'no such grader' }]);
    }
}

/** Primary first, then every secondary — the secondary never alters the primary. */
export async function grade_all(workspace: string, task: ArtifactTask, opts: GradeOpts = {}): Promise<GraderResult[]> {
    const out = [await grade_primary(workspace, task, opts)];
    for (const g of task.graders.filter((x) => x.role === 'secondary')) out.push(grade_secondary(workspace, task, g));
    return out;
}
