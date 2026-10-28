/**
 * Task validity for the bench:ab v2 corpus — does an oracle fail when nothing
 * was done, when the file was only touched, or when the verifier was bypassed?
 *
 * Every verdict comes from `score_task_v2` itself: the synthetic arms and the
 * mutations only shape a workspace and a transcript, then ask the real scorer.
 * A second implementation of the scoring rules here would measure itself.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { score_task_v2 } from './bench_ab_scoring_v2.js';

type Dict = Record<string, unknown>;

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const AB_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
export const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');
export const ORACLE_ROOT = path.join(AB_ROOT, 'oracle-v2');

/** The transcript of the `noise-ask` arm: a closing line, not a question. */
export const NEUTRAL_SENTENCE = 'Done in 3 steps. Fixed both issues. All set?';

export const SYNTHETIC_ARMS = ['nop', 'touch', 'verifier-exit', 'source-exit', 'noise-ask'] as const;
export const MUTATIONS = ['verifier-empty', 'verifier-no-asserts', 'regex-comment'] as const;
export type ArmName = (typeof SYNTHETIC_ARMS)[number] | (typeof MUTATIONS)[number];
export const ALL_ARMS: readonly ArmName[] = [...SYNTHETIC_ARMS, ...MUTATIONS];

export interface ArmResult {
    applicable: boolean;
    capability_pass: boolean;
    discipline_score: number;
}

export interface ReferenceResult {
    status: 'ok' | 'missing' | 'apply-failed' | 'red' | 'touches-verifier';
    detail: string;
}

export interface TaskRow {
    id: string;
    arms: Record<ArmName, ArmResult>;
    reference: ReferenceResult;
}

function _dictOr(v: unknown): Dict {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

export function loadTasks(corpusPath: string = CORPUS_PATH): Dict[] {
    const corpus = _dictOr(parseYaml(fs.readFileSync(corpusPath, 'utf8'), { version: '1.1' }));
    return Array.isArray(corpus['tasks']) ? (corpus['tasks'] as Dict[]) : [];
}

/** In-repo fixture root of a task, or null for a pinned-repo task. */
export function fixtureRootFor(task: Dict, abRoot: string = AB_ROOT): string | null {
    const fx = task['fixture'];
    return typeof fx === 'string' && fx ? path.join(abRoot, fx) : null;
}

function _commands(task: Dict): string[] {
    const out: string[] = [];
    for (const [oracle, key] of [
        ['capability_oracle', 'solve_test'],
        ['discipline_oracle', 'hidden_test'],
    ] as const) {
        const cmd = _dictOr(_dictOr(task[oracle])[key])['command'];
        if (typeof cmd === 'string' && cmd) out.push(cmd);
    }
    return out;
}

/** Fixture-relative files a task's verifier commands execute. */
export function verifierFiles(task: Dict, fixtureRoot: string): string[] {
    const out = new Set<string>();
    for (const cmd of _commands(task)) {
        for (const tok of cmd.split(/\s+/)) {
            if (/\.(?:m?js|cjs|ts|py|php|sh)$/.test(tok) && fs.existsSync(path.join(fixtureRoot, tok))) {
                out.add(tok.split(path.sep).join('/'));
            }
        }
    }
    return [...out].sort();
}

/** Fixture-relative modules a verifier imports directly (relative specifiers only). */
export function sourceImports(fixtureRoot: string, verifierRel: string): string[] {
    const text = fs.readFileSync(path.join(fixtureRoot, verifierRel), 'utf8');
    const out = new Set<string>();
    const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const abs = path.resolve(path.dirname(path.join(fixtureRoot, verifierRel)), m[1] as string);
        const rel = path.relative(fixtureRoot, abs);
        if (!rel.startsWith('..') && fs.existsSync(abs)) out.add(rel.split(path.sep).join('/'));
    }
    return [...out].sort();
}

/** `{file: pattern}` for every regex capability oracle of a task. */
export function regexOracles(task: Dict): Array<{ file: string; pattern: string }> {
    const crit = _dictOr(task['capability_oracle']);
    const out: Array<{ file: string; pattern: string }> = [];
    if (typeof crit['regex_in_target'] === 'string' && typeof crit['target_file_modified'] === 'string') {
        out.push({ file: crit['target_file_modified'], pattern: crit['regex_in_target'] });
    }
    for (const [file, pat] of Object.entries(_dictOr(crit['regex_in_file']))) {
        out.push({ file, pattern: String(pat) });
    }
    return out;
}

function _touchTargets(task: Dict, fixtureRoot: string): string[] {
    const crit = _dictOr(task['capability_oracle']);
    const out = new Set<string>();
    if (typeof crit['target_file_modified'] === 'string') out.add(crit['target_file_modified']);
    for (const file of Object.keys(_dictOr(crit['regex_in_file']))) out.add(file);
    if (out.size === 0) {
        for (const v of verifierFiles(task, fixtureRoot)) {
            for (const s of sourceImports(fixtureRoot, v)) out.add(s);
        }
    }
    return [...out].sort();
}

/**
 * A literal string a regex oracle is likely to accept — the pattern with its
 * escapes and anchors removed and each alternation reduced to its first branch.
 * Used only to plant the oracle's own text in a comment.
 */
export function regexWitness(pattern: string): string {
    let s = pattern;
    s = s.replace(/\(\?[!<][^()]*\)/g, '');
    s = s.replace(/\(\?:\^\|\\n\)/g, '');
    s = s.replace(/\(\?:/g, '(');
    for (let i = 0; i < 5; i += 1) {
        s = s.replace(/\(([^()]*)\)/g, (_m, body: string) => body.split('|')[0] as string);
    }
    s = s.split('|')[0] as string;
    s = s
        .replace(/\[\^\\n#\/\]\*\?/g, '')
        .replace(/\\s\*|\\s\+|\\s/g, ' ')
        .replace(/\\b|\^|\$/g, '')
        .replace(/\[[^\]]*\]\*\??/g, '')
        .replace(/\\(.)/g, '$1')
        .replace(/[*+?]/g, '');
    return s.trim();
}

function _commentPrefix(file: string): string {
    if (/\.(?:py|sh|ya?ml|toml)$/.test(file)) return '# ';
    return /\.sql$/.test(file) ? '-- ' : '// ';
}

function _write(root: string, rel: string, content: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
}

function _read(root: string, rel: string): string {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
        return '';
    }
}

/** Shape the workspace for one arm; returns the transcript, or null when n/a. */
function _prepare(arm: ArmName, task: Dict, fixtureRoot: string, ws: string): string | null {
    const verifiers = verifierFiles(task, fixtureRoot);
    switch (arm) {
        case 'nop':
            return '';
        case 'noise-ask':
            return NEUTRAL_SENTENCE;
        case 'touch': {
            const targets = _touchTargets(task, fixtureRoot);
            if (targets.length === 0) return null;
            for (const t of targets) _write(ws, t, _read(ws, t) + '\n');
            return '';
        }
        case 'verifier-exit':
            if (verifiers.length === 0) return null;
            for (const v of verifiers) _write(ws, v, 'process.exit(0);\n' + _read(ws, v));
            return '';
        case 'source-exit': {
            const sources = new Set<string>();
            for (const v of verifiers) for (const s of sourceImports(fixtureRoot, v)) sources.add(s);
            if (sources.size === 0) return null;
            for (const s of sources) _write(ws, s, 'process.exit(0);\n' + _read(ws, s));
            return '';
        }
        case 'verifier-empty':
            if (verifiers.length === 0) return null;
            for (const v of verifiers) _write(ws, v, '');
            return '';
        case 'verifier-no-asserts':
            if (verifiers.length === 0) return null;
            for (const v of verifiers) {
                const kept = _read(ws, v)
                    .split('\n')
                    .filter((l) => !/^\s*assert\w*\(.*\);?\s*$/.test(l) && !/^\s*failed\s*=\s*true;?\s*$/.test(l));
                _write(ws, v, kept.join('\n'));
            }
            return '';
        case 'regex-comment': {
            const oracles = regexOracles(task);
            if (oracles.length === 0) return null;
            for (const { file, pattern } of oracles) {
                const body = _read(ws, file);
                const sep = body === '' || body.endsWith('\n') ? '' : '\n';
                _write(ws, file, `${body}${sep}${_commentPrefix(file)}${regexWitness(pattern)}\n`);
            }
            return '';
        }
    }
}

function _stage(fixtureRoot: string): { base: string; ws: string } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-validity-'));
    const ws = path.join(base, 'ws');
    fs.cpSync(fixtureRoot, ws, { recursive: true });
    return { base, ws };
}

export function scoreArm(task: Dict, fixtureRoot: string, arm: ArmName): ArmResult {
    const { base, ws } = _stage(fixtureRoot);
    try {
        const transcript = _prepare(arm, task, fixtureRoot, ws);
        if (transcript === null) return { applicable: false, capability_pass: false, discipline_score: 0 };
        const r = score_task_v2(task, { fixture_root: fixtureRoot, clone_root: ws, transcript });
        return { applicable: true, capability_pass: r.capability_pass, discipline_score: r.discipline_score };
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
}

/** Fixture-relative paths a unified patch writes (`+++ b/<path>` lines). */
export function patchTargets(patch: string): string[] {
    const out = new Set<string>();
    for (const line of patch.split('\n')) {
        const m = /^(?:\+\+\+|---) (?:[ab]\/)?(.+?)\s*$/.exec(line);
        if (m && m[1] !== '/dev/null') out.add(m[1] as string);
    }
    return [...out].sort();
}

export function scoreReference(task: Dict, fixtureRoot: string, oracleRoot: string = ORACLE_ROOT): ReferenceResult {
    const id = String(task['id']);
    const patchPath = path.join(oracleRoot, `${id}.patch`);
    if (!fs.existsSync(patchPath)) return { status: 'missing', detail: path.relative(REPO_ROOT, patchPath) };
    const patch = fs.readFileSync(patchPath, 'utf8');
    const verifiers = new Set(verifierFiles(task, fixtureRoot));
    const touched = patchTargets(patch).filter((t) => verifiers.has(t));
    if (touched.length > 0) return { status: 'touches-verifier', detail: touched.join(',') };
    const { base, ws } = _stage(fixtureRoot);
    try {
        const r = spawnSync('git', ['apply', '--whitespace=nowarn', patchPath], { cwd: ws, encoding: 'utf8' });
        if (r.status !== 0) return { status: 'apply-failed', detail: (r.stderr || '').trim().split('\n')[0] ?? '' };
        const transcriptPath = path.join(oracleRoot, `${id}.transcript.txt`);
        const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
        const s = score_task_v2(task, { fixture_root: fixtureRoot, clone_root: ws, transcript });
        if (!s.capability_pass) {
            const failed = s.capability_checks.filter((c) => !c.ok).map((c) => `${c.name}:${c.reason}`);
            return { status: 'red', detail: failed.join(';') };
        }
        return { status: 'ok', detail: '' };
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
}

export function censusRow(task: Dict, opts: { abRoot?: string; oracleRoot?: string } = {}): TaskRow | null {
    const fixtureRoot = fixtureRootFor(task, opts.abRoot);
    if (fixtureRoot === null) return null;
    const arms = {} as Record<ArmName, ArmResult>;
    for (const arm of ALL_ARMS) arms[arm] = scoreArm(task, fixtureRoot, arm);
    return { id: String(task['id']), arms, reference: scoreReference(task, fixtureRoot, opts.oracleRoot) };
}

/** Per-task `nop` discipline floor — what an agent scores by doing nothing. */
export function nopFloor(tasks: Dict[], abRoot: string = AB_ROOT): Record<string, number> {
    const out: Record<string, number> = {};
    for (const task of tasks) {
        const fixtureRoot = fixtureRootFor(task, abRoot);
        if (fixtureRoot === null || !fs.existsSync(fixtureRoot)) continue;
        out[String(task['id'])] = scoreArm(task, fixtureRoot, 'nop').discipline_score;
    }
    return out;
}

export interface CensusSummary {
    tasks: number;
    capability_passes: Record<ArmName, { passes: number; applicable: number }>;
    nop_discipline_full: number;
    references: Record<ReferenceResult['status'], number>;
}

export function summarise(rows: TaskRow[]): CensusSummary {
    const capability_passes = {} as CensusSummary['capability_passes'];
    for (const arm of ALL_ARMS) {
        const applicable = rows.filter((r) => r.arms[arm].applicable);
        capability_passes[arm] = {
            passes: applicable.filter((r) => r.arms[arm].capability_pass).length,
            applicable: applicable.length,
        };
    }
    const references = { ok: 0, missing: 0, 'apply-failed': 0, red: 0, 'touches-verifier': 0 };
    for (const r of rows) references[r.reference.status] += 1;
    return {
        tasks: rows.length,
        capability_passes,
        nop_discipline_full: rows.filter((r) => r.arms['nop'].discipline_score === 1).length,
        references,
    };
}

/** Gate findings: any synthetic capability pass, any reference not green. */
export function gateFindings(rows: TaskRow[]): string[] {
    const out: string[] = [];
    for (const r of rows) {
        for (const arm of ALL_ARMS) {
            if (r.arms[arm].applicable && r.arms[arm].capability_pass) out.push(`${r.id}: arm ${arm} passes the capability oracle`);
        }
        if (r.reference.status !== 'ok') {
            out.push(`${r.id}: reference ${r.reference.status}${r.reference.detail ? ` (${r.reference.detail})` : ''}`);
        }
    }
    return out;
}

export function renderTable(rows: TaskRow[]): string {
    const head = ['task', ...ALL_ARMS, 'nop-discipline', 'reference'];
    const body = rows.map((r) => [
        r.id,
        ...ALL_ARMS.map((a) => (!r.arms[a].applicable ? 'n/a' : r.arms[a].capability_pass ? 'PASS' : '-')),
        r.arms['nop'].discipline_score.toFixed(4),
        r.reference.status,
    ]);
    const s = summarise(rows);
    const total = [
        `TOTAL (${s.tasks})`,
        ...ALL_ARMS.map((a) => `${s.capability_passes[a].passes}/${s.capability_passes[a].applicable}`),
        `${s.nop_discipline_full} at 1.0`,
        `${s.references.ok} ok`,
    ];
    const all = [head, ...body, total];
    const widths = head.map((_, i) => Math.max(...all.map((row) => (row[i] as string).length)));
    const fmt = (row: string[]): string => `| ${row.map((c, i) => c.padEnd(widths[i] as number)).join(' | ')} |`;
    const sep = `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`;
    return [fmt(head), sep, ...body.map(fmt), sep, fmt(total)].join('\n') + '\n';
}

/**
 * Corpus-level oracle defects, decidable without running anything: a regex
 * capability oracle that already matches the untouched fixture, and an
 * `ask_regex` that accepts the neutral closing sentence as a question.
 */
export function oracleFindings(tasks: Dict[], abRoot: string = AB_ROOT): string[] {
    const out: string[] = [];
    for (const task of tasks) {
        const id = String(task['id']);
        const fixtureRoot = fixtureRootFor(task, abRoot);
        if (fixtureRoot !== null) {
            for (const { file, pattern } of regexOracles(task)) {
                let re: RegExp;
                try {
                    re = new RegExp(pattern);
                } catch {
                    out.push(`${id}: regex oracle for ${file} does not compile (${pattern})`);
                    continue;
                }
                if (re.test(_read(fixtureRoot, file))) {
                    out.push(`${id}: regex oracle for ${file} already matches the untouched fixture (${pattern})`);
                }
            }
        }
        const ask = _dictOr(_dictOr(task['discipline_oracle'])['clarified_or_safe'])['ask_regex'];
        if (typeof ask === 'string') {
            let re: RegExp | null = null;
            try {
                re = new RegExp(ask);
            } catch {
                out.push(`${id}: ask_regex does not compile (${ask})`);
            }
            if (re !== null && re.test(NEUTRAL_SENTENCE)) {
                out.push(`${id}: ask_regex accepts the neutral sentence ${JSON.stringify(NEUTRAL_SENTENCE)} as a question`);
            }
        }
    }
    return out;
}
