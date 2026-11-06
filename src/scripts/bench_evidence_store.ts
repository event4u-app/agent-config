#!/usr/bin/env node
/**
 * Durable benchmark evidence — copies a sweep's report out of the gitignored
 * `internal/bench/reports/` directory into a store outside any checkout, seals it
 * with a sha256 manifest, and re-scores it offline on demand.
 *
 *   ./scripts-run src/scripts/bench_evidence_store store <report> [--checkpoint <file>]...
 *   ./scripts-run src/scripts/bench_evidence_store verify <bundle-dir>
 *
 * **Where.** `<config-home>/bench-evidence/<report-name>/`, where `<config-home>`
 * is `$EVENT4U_CONFIG_HOME` or `~/.event4u/agent-config/` — the user-global root
 * every other machine-wide artefact of this package already uses. A report under
 * a checkout dies with a `git clean`, a worktree removal or a fresh clone; the
 * user-global root survives all three and is shared by every checkout and
 * worktree on the machine, which is the population a sweep is run from.
 *
 * **What a paired bundle holds.** The report byte-for-byte, any checkpoint passed
 * in, the `pricing.yaml` the numbers were priced with, `reference.json`, and
 * `manifest.json` mapping each of those files to its sha256.
 *
 * **What "the report's numbers" are.** A paired report carries raw per-run records,
 * not statistics — the statistics are computed by `bench_ab_v2_stats` on read. So
 * `store` computes them once, with the live code (`analyse` + `gate_verdict` and
 * `bench_ab_interpret.interpret`), and seals the result as `reference.json`.
 * `verify` checks every manifest hash, then recomputes the same three from the
 * stored records and the stored `pricing.yaml` and compares the result to the
 * reference field by field. No statistic is reimplemented here. The per-task
 * `nop` floor is deliberately left out: it reads the current task corpus, not the
 * report, so it is a property of the checkout and could not reproduce offline.
 *
 * The two checks are independent on purpose. The hash check catches any edit; the
 * re-score catches an edit whose manifest was re-sealed, and a change in the
 * stats code that would silently move a stored number.
 *
 * **Artifact sweeps** (`artifact-<stamp>.jsonl`) are stored with their transcript
 * directory and verified by hash only: no aggregation stage exists for them yet,
 * so there is no live code to re-score with, and `verify` says so instead of
 * implying a re-score happened.
 *
 * Bundles are write-once: storing the same report again is a no-op, storing a
 * differing one under an existing name is refused.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { event4u_root, type EnvMap } from './_lib/user_global_paths.js';
import { interpret } from './bench_ab_interpret.js';
import { PRICING_PATH, analyse, gate_verdict } from './bench_ab_v2_stats.js';

type Dict = Record<string, unknown>;

export const MANIFEST = 'manifest.json';
export const REFERENCE = 'reference.json';
export const PRICING = 'pricing.yaml';
const MANIFEST_SCHEMA = 'bench-evidence-manifest/1';
const REFERENCE_SCHEMA = 'bench-evidence-reference/1';
const MAX_DIFFS = 20;

export type BundleKind = 'ab-v2-paired' | 'artifact';

export interface Manifest {
    schema: string;
    kind: BundleKind;
    report: string;
    source: string;
    stored_at: string;
    files: Record<string, string>;
}

export interface StoreResult {
    dir: string;
    status: 'stored' | 'unchanged';
}

export interface VerifyResult {
    ok: boolean;
    rescored: boolean;
    files_checked: number;
    problems: string[];
}

export class EvidenceStoreError extends Error {}

/** `<config-home>/bench-evidence`. Never created here. */
export function evidence_root(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'bench-evidence');
}

export function sha256_file(file: string): string {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function kind_of(report: string): BundleKind {
    const base = path.basename(report);
    if (/^artifact-.*\.jsonl$/.test(base)) return 'artifact';
    if (base.endsWith('.json')) return 'ab-v2-paired';
    throw new EvidenceStoreError(`not a sweep report: ${base} (expected *-ab-v2-paired.json or artifact-*.jsonl)`);
}

/** A PyFloat from any module renders as its number; everything else as JSON would. */
function plain(v: unknown): unknown {
    return JSON.parse(
        JSON.stringify(v, (_k, x: unknown) => {
            if (x && typeof x === 'object' && (x as object).constructor?.name === 'PyFloat') {
                return (x as { value: number }).value;
            }
            return x;
        }),
    );
}

/** The numbers a paired report stands for, computed with the live stats code. */
export function score_paired(payload: Dict, pricingPath: string): Dict {
    const analysis = analyse(payload, pricingPath);
    analysis['gate'] = gate_verdict(analysis);
    return plain({
        schema: REFERENCE_SCHEMA,
        computed_by: ['bench_ab_v2_stats.analyse', 'bench_ab_v2_stats.gate_verdict', 'bench_ab_interpret.interpret'],
        analysis,
        interpretation: interpret(payload, pricingPath),
    }) as Dict;
}

function list_files(dir: string, rel = ''): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...list_files(dir, r));
        else out.push(r);
    }
    return out.sort();
}

function write_json(file: string, v: unknown): void {
    fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n');
}

/**
 * Assemble the bundle in a staging directory, then either rename it into place,
 * find an identical bundle already there (no-op), or refuse.
 */
export function store_bundle(
    report: string,
    opts: { root?: string; checkpoints?: string[]; pricingPath?: string } = {},
): StoreResult {
    const kind = kind_of(report);
    if (!fs.statSync(report).isFile()) throw new EvidenceStoreError(`report not found: ${report}`);
    const root = opts.root ?? evidence_root();
    const name = path.basename(report).replace(/\.jsonl?$/, '');
    const dest = path.join(root, name);
    fs.mkdirSync(root, { recursive: true });
    const stage = fs.mkdtempSync(path.join(root, `.staging-${name}-`));
    try {
        fs.copyFileSync(report, path.join(stage, path.basename(report)));
        for (const c of opts.checkpoints ?? []) {
            fs.mkdirSync(path.join(stage, 'checkpoints'), { recursive: true });
            fs.copyFileSync(c, path.join(stage, 'checkpoints', path.basename(c)));
        }
        if (kind === 'ab-v2-paired') {
            fs.copyFileSync(opts.pricingPath ?? PRICING_PATH, path.join(stage, PRICING));
            const payload = JSON.parse(fs.readFileSync(report, 'utf-8')) as Dict;
            write_json(path.join(stage, REFERENCE), score_paired(payload, path.join(stage, PRICING)));
        } else {
            const transcripts = report.replace(/\.jsonl$/, '-transcripts');
            if (fs.existsSync(transcripts)) fs.cpSync(transcripts, path.join(stage, 'transcripts'), { recursive: true });
        }
        const files: Record<string, string> = {};
        for (const f of list_files(stage)) files[f] = sha256_file(path.join(stage, f));

        if (fs.existsSync(dest)) {
            const prior = read_manifest(dest);
            if (prior !== null && JSON.stringify(prior.files) === JSON.stringify(files)) {
                return { dir: dest, status: 'unchanged' };
            }
            throw new EvidenceStoreError(`refusing to overwrite a differing bundle at ${dest}`);
        }
        const manifest: Manifest = {
            schema: MANIFEST_SCHEMA,
            kind,
            report: path.basename(report),
            source: path.resolve(report),
            stored_at: new Date().toISOString(),
            files,
        };
        write_json(path.join(stage, MANIFEST), manifest);
        fs.renameSync(stage, dest);
        return { dir: dest, status: 'stored' };
    } finally {
        fs.rmSync(stage, { recursive: true, force: true });
    }
}

function read_manifest(dir: string): Manifest | null {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf-8')) as Manifest;
    } catch {
        return null;
    }
}

/** Field paths where two JSON values differ, capped. */
export function json_diff(a: unknown, b: unknown, at = '', out: string[] = []): string[] {
    if (out.length >= MAX_DIFFS) return out;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) out.push(`${at || '<root>'}: length ${b.length} → ${a.length}`);
        for (let i = 0; i < Math.min(a.length, b.length); i += 1) json_diff(a[i], b[i], `${at}[${i}]`, out);
        return out;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = [...new Set([...Object.keys(a as Dict), ...Object.keys(b as Dict)])].sort();
        for (const k of keys) json_diff((a as Dict)[k], (b as Dict)[k], at ? `${at}.${k}` : k, out);
        return out;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        out.push(`${at || '<root>'}: reference ${JSON.stringify(b)} → recomputed ${JSON.stringify(a)}`);
    }
    return out;
}

export function verify_bundle(dir: string): VerifyResult {
    const problems: string[] = [];
    const manifest = read_manifest(dir);
    if (manifest === null || typeof manifest.files !== 'object') {
        return { ok: false, rescored: false, files_checked: 0, problems: [`no readable ${MANIFEST} in ${dir}`] };
    }
    const present = list_files(dir).filter((f) => f !== MANIFEST);
    for (const f of present) if (!(f in manifest.files)) problems.push(`not in manifest: ${f}`);
    for (const [f, want] of Object.entries(manifest.files)) {
        const p = path.join(dir, f);
        if (!fs.existsSync(p)) problems.push(`missing: ${f}`);
        else if (sha256_file(p) !== want) problems.push(`sha256 mismatch: ${f}`);
    }
    let rescored = false;
    if (manifest.kind === 'ab-v2-paired') {
        try {
            const payload = JSON.parse(fs.readFileSync(path.join(dir, manifest.report), 'utf-8')) as Dict;
            const reference = JSON.parse(fs.readFileSync(path.join(dir, REFERENCE), 'utf-8')) as Dict;
            const fresh = score_paired(payload, path.join(dir, PRICING));
            rescored = true;
            for (const d of json_diff(fresh, reference)) problems.push(`re-score differs: ${d}`);
        } catch (e) {
            problems.push(`re-score failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return { ok: problems.length === 0, rescored, files_checked: Object.keys(manifest.files).length, problems };
}

/**
 * The sweep runners' hook: store a just-written report, and never let a store
 * failure cost the report. Failure is printed loudly to stderr with the command
 * that retries it; the report stays where the sweep wrote it. Returns the bundle
 * directory, or null when storing failed.
 */
export function store_after_sweep(report: string, checkpoints: string[] = [], tag = 'bench_ab_v2'): string | null {
    try {
        const r = store_bundle(report, { checkpoints: checkpoints.filter((c) => fs.existsSync(c)) });
        process.stdout.write(`${tag}: evidence ${r.status} → ${r.dir}\n`);
        return r.dir;
    } catch (e) {
        process.stderr.write(
            `${tag}: EVIDENCE STORE FAILED — ${e instanceof Error ? e.message : String(e)}\n` +
                `${tag}: the report is kept at ${report}; retry with ` +
                `./scripts-run src/scripts/bench_evidence_store store ${report}\n`,
        );
        return null;
    }
}

const USAGE =
    'usage: bench_evidence_store store <report> [--checkpoint <file>]...\n' +
    '       bench_evidence_store verify <bundle-dir>\n';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const [verb, target, ...rest] = argv;
    if (verb === 'store' && target) {
        const checkpoints: string[] = [];
        for (let i = 0; i < rest.length; i += 1) {
            if (rest[i] === '--checkpoint' && rest[i + 1]) checkpoints.push(rest[(i += 1)] as string);
            else {
                process.stderr.write(USAGE);
                return 2;
            }
        }
        try {
            const r = store_bundle(target, { checkpoints });
            process.stdout.write(`bench_evidence_store: ${r.status} ${r.dir}\n`);
            return 0;
        } catch (e) {
            process.stderr.write(`bench_evidence_store: ${e instanceof Error ? e.message : String(e)}\n`);
            return 1;
        }
    }
    if (verb === 'verify' && target) {
        const r = verify_bundle(target);
        const how = r.rescored ? 're-scored offline, reference reproduced' : 'hashes only (no re-score stage for this kind)';
        if (r.ok) {
            process.stdout.write(`bench_evidence_store: OK ${target} — ${r.files_checked} file(s) hash-verified; ${how}\n`);
            return 0;
        }
        process.stdout.write(`bench_evidence_store: FAILED ${target} — ${r.problems.length} problem(s)\n`);
        for (const p of r.problems) process.stdout.write(`  ${p}\n`);
        return 1;
    }
    process.stderr.write(USAGE);
    return 2;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
