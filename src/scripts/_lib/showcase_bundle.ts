/**
 * Showcase evidence bundles (road-to-a-baseline-that-has-to-catch-up step 1.1).
 *
 * A bundle is one directory `internal/bench/showcase/<stamp>-<task>/` holding
 * `summary.json`, `artifacts.sha256` and size-capped thumbnails under
 * `thumbs/`. Shape: `src/scripts/schemas/showcase-bundle.schema.json`. This
 * module enforces the same shape without a schema engine (the package ships no
 * JSON-schema runtime) plus the cross-field rules the draft cannot express.
 * Transcripts are never part of a bundle.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { PairedVerdictKind } from './paired_verdict.js';

export const THUMB_MAX_BYTES = 64 * 1024;
export const PARITY_CAP_MAX = 5;

/** Exhaustive by construction: adding a verdict kind upstream fails to compile here. */
const VERDICT_KINDS: Record<PairedVerdictKind, true> = { pass: true, regression: true, 'no-change': true, underpowered: true };
const FAMILIES = ['svg', 'page-form', 'login-security', 'php-endpoint', 'copy'];
const GRADERS = ['svg-render-gate', 'acceptance+axe', 'functional+exploits', 'hidden-tests', 'bench-ui'];
const ARM_IDS = ['package', 'vanilla', 'placebo', 'optimized-baseline'];
const COVERAGE = ['complete', 'partial', 'unknown'];
const OPS = ['>=', '<=', '=='];

export interface TokenBuckets {
    input: number | null;
    output: number | null;
    cache_read: number | null;
    cache_write: number | null;
    coverage: 'complete' | 'partial' | 'unknown';
}

export interface ShowcaseRun {
    run: number;
    score: number | null;
    passed: boolean | null;
    tokens: TokenBuckets;
    turns: number | null;
    model_requests: number | null;
    tool_calls: number | null;
    usd: number | null;
    infra_error: string | null;
    thumbnail: string | null;
    secondary: Record<string, number | null>;
}

export interface ShowcaseArm {
    id: string;
    label: string;
    infra_errors: number;
    runs: ShowcaseRun[];
}

export interface ParityArm {
    reached: number;
    censored: number;
    prompts: number | null;
    turns: number | null;
    tokens: number | null;
    usd_to_parity: number | null;
}

export interface ShowcaseSummary {
    schema_version: 1;
    fixture: boolean;
    stamp: string;
    task: {
        id: string;
        family: string;
        title: string;
        prompt: string;
        primary_grader: string;
        parity_bar: { metric: string; op: string; value: number };
    };
    claim_id: string;
    host: { name: string; version: string };
    model_id: string;
    k: number;
    pricing_sourced_on: string;
    arms: ShowcaseArm[];
    parity: {
        parity_bar: number;
        cap_k: number;
        with_arm_first_shot_median: number | null;
        arms: Record<string, ParityArm>;
    };
    verdict: { kind: PairedVerdictKind; reason: string };
    reproduce: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const numOrNull = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v));
const nonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Lower median of the non-null scores, and the lowest-numbered run carrying it.
 * The lower median is always an observed run, so the page can mark a real image.
 */
export function medianRun(runs: readonly ShowcaseRun[]): { score: number; run: number } | null {
    const scored = runs.filter((r) => r.score !== null).sort((a, b) => (a.score as number) - (b.score as number) || a.run - b.run);
    if (scored.length === 0) return null;
    const pick = scored[Math.floor((scored.length - 1) / 2)] as ShowcaseRun;
    const score = pick.score as number;
    const first = runs.filter((r) => r.score === score).sort((a, b) => a.run - b.run)[0] as ShowcaseRun;
    return { score, run: first.run };
}

function checkTokens(t: unknown, at: string, out: string[]): void {
    if (!isObj(t)) {
        out.push(`${at}.tokens must be an object`);
        return;
    }
    for (const b of ['input', 'output', 'cache_read', 'cache_write']) {
        if (!numOrNull(t[b])) out.push(`${at}.tokens.${b} must be a number or null`);
    }
    if (!COVERAGE.includes(String(t['coverage']))) out.push(`${at}.tokens.coverage must be complete|partial|unknown`);
    if (t['coverage'] === 'complete' && ['input', 'output', 'cache_read', 'cache_write'].some((b) => t[b] === null)) {
        out.push(`${at}.tokens: coverage complete needs all four buckets — use partial or unknown`);
    }
}

function checkRun(r: unknown, at: string, out: string[]): void {
    if (!isObj(r)) {
        out.push(`${at} is not an object`);
        return;
    }
    if (!nonNegInt(r['run']) || r['run'] < 1) out.push(`${at}.run must be an integer >= 1`);
    for (const k of ['score', 'turns', 'model_requests', 'tool_calls', 'usd']) {
        if (!numOrNull(r[k])) out.push(`${at}.${k} must be a number or null`);
    }
    if (!(r['passed'] === null || typeof r['passed'] === 'boolean')) out.push(`${at}.passed must be a boolean or null`);
    if (!(r['infra_error'] === null || str(r['infra_error']))) out.push(`${at}.infra_error must be a string or null`);
    if (!(r['thumbnail'] === null || str(r['thumbnail']))) out.push(`${at}.thumbnail must be a path or null`);
    if (str(r['thumbnail']) && !String(r['thumbnail']).startsWith('thumbs/')) out.push(`${at}.thumbnail must live under thumbs/`);
    if (!isObj(r['secondary']) || !Object.values(r['secondary']).every(numOrNull)) {
        out.push(`${at}.secondary must map names to numbers or null`);
    }
    checkTokens(r['tokens'], at, out);
}

/** Every problem with a parsed summary.json; an empty list means it is valid. */
export function validateBundleSummary(value: unknown): string[] {
    const out: string[] = [];
    if (!isObj(value)) return ['summary is not an object'];
    if (value['schema_version'] !== 1) out.push('schema_version must be 1');
    if (typeof value['fixture'] !== 'boolean') out.push('fixture must be a boolean');
    if (!/^[0-9]{8}T[0-9]{6}Z$/.test(String(value['stamp']))) out.push('stamp must be YYYYMMDDTHHMMSSZ');
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(value['pricing_sourced_on'] ?? ''))) {
        out.push('pricing_sourced_on is required (YYYY-MM-DD) — a priced USD figure names the day its prices were read');
    }
    for (const k of ['claim_id', 'model_id', 'reproduce']) if (!str(value[k])) out.push(`${k} is required`);
    const host = value['host'];
    if (!isObj(host) || !str(host['name']) || !str(host['version'])) out.push('host needs name and version');
    const k = value['k'];
    if (!nonNegInt(k) || k < 1) out.push('k must be an integer >= 1');

    const task = value['task'];
    if (!isObj(task)) {
        out.push('task must be an object');
    } else {
        if (!/^art-[a-z0-9-]+$/.test(String(task['id']))) out.push('task.id must match art-<slug>');
        if (!FAMILIES.includes(String(task['family']))) out.push(`task.family must be one of ${FAMILIES.join('|')}`);
        if (!GRADERS.includes(String(task['primary_grader']))) out.push(`task.primary_grader must be one of ${GRADERS.join('|')}`);
        for (const f of ['title', 'prompt']) if (!str(task[f])) out.push(`task.${f} is required`);
        const bar = task['parity_bar'];
        if (!isObj(bar) || !str(bar['metric']) || !OPS.includes(String(bar['op'])) || typeof bar['value'] !== 'number') {
            out.push('task.parity_bar needs metric, op (>=|<=|==) and a numeric value');
        }
    }

    const verdict = value['verdict'];
    if (!isObj(verdict) || !(String(verdict['kind']) in VERDICT_KINDS) || !str(verdict['reason'])) {
        out.push(`verdict needs kind (${Object.keys(VERDICT_KINDS).join('|')}) and a reason`);
    }

    const arms = value['arms'];
    if (!Array.isArray(arms) || arms.length < 2) {
        out.push('arms must list at least two arms');
        return out;
    }
    const ids: string[] = [];
    arms.forEach((a, i) => {
        if (!isObj(a)) {
            out.push(`arms[${i}] is not an object`);
            return;
        }
        const at = `arms[${i}] ${String(a['id'] ?? '?')}`;
        if (!ARM_IDS.includes(String(a['id']))) out.push(`${at}: id must be one of ${ARM_IDS.join('|')}`);
        if (ids.includes(String(a['id']))) out.push(`${at}: duplicate arm id`);
        ids.push(String(a['id']));
        if (!str(a['label'])) out.push(`${at}: label is required`);
        const runs = a['runs'];
        if (!Array.isArray(runs)) {
            out.push(`${at}: runs must be an array`);
            return;
        }
        runs.forEach((r, j) => checkRun(r, `${at}.runs[${j}]`, out));
        if (nonNegInt(k) && runs.length !== k) out.push(`${at}: ${runs.length} runs, k is ${k} — every run is reported`);
        const numbers = runs.map((r) => (isObj(r) ? r['run'] : null));
        if (nonNegInt(k) && numbers.slice().sort((x, y) => Number(x) - Number(y)).some((n, j) => n !== j + 1)) {
            out.push(`${at}: run numbers must be 1..k`);
        }
        const errs = runs.filter((r) => isObj(r) && str(r['infra_error'])).length;
        if (a['infra_errors'] !== errs) out.push(`${at}: infra_errors is ${String(a['infra_errors'])}, runs carry ${errs}`);
    });
    if (!ids.includes('package') || !ids.includes('vanilla')) out.push('arms must include package and vanilla');

    const parity = value['parity'];
    if (!isObj(parity)) {
        out.push('parity must be an object');
        return out;
    }
    if (typeof parity['parity_bar'] !== 'number') out.push('parity.parity_bar must be a number');
    if (isObj(task) && isObj(task['parity_bar']) && parity['parity_bar'] !== task['parity_bar']['value']) {
        out.push('parity.parity_bar must equal task.parity_bar.value');
    }
    if (!nonNegInt(parity['cap_k']) || parity['cap_k'] < 1 || parity['cap_k'] > PARITY_CAP_MAX) {
        out.push(`parity.cap_k must be 1..${PARITY_CAP_MAX}`);
    }
    if (!numOrNull(parity['with_arm_first_shot_median'])) out.push('parity.with_arm_first_shot_median must be a number or null');
    const pArms = parity['arms'];
    if (!isObj(pArms)) {
        out.push('parity.arms must be an object');
        return out;
    }
    if (Object.keys(pArms).sort().join(',') !== ids.slice().sort().join(',')) out.push('parity.arms must name exactly the bundle arms');
    for (const [id, p] of Object.entries(pArms)) {
        if (!isObj(p) || !nonNegInt(p['reached']) || !nonNegInt(p['censored'])) {
            out.push(`parity.arms.${id}: reached and censored must be integers >= 0`);
            continue;
        }
        for (const f of ['prompts', 'turns', 'tokens', 'usd_to_parity']) {
            if (!numOrNull(p[f])) out.push(`parity.arms.${id}.${f} must be a number or null`);
        }
        if (nonNegInt(k) && p['reached'] + p['censored'] > k) out.push(`parity.arms.${id}: reached + censored exceeds k`);
    }
    if (out.length > 0) return out;
    const pkg = (arms as ShowcaseArm[]).find((a) => a.id === 'package') as ShowcaseArm;
    const med = medianRun(pkg.runs);
    if ((med?.score ?? null) !== parity['with_arm_first_shot_median']) {
        out.push(`parity.with_arm_first_shot_median is ${String(parity['with_arm_first_shot_median'])}, the package arm's first-shot median is ${String(med?.score ?? null)}`);
    }
    return out;
}

export interface LoadedBundle {
    dir: string;
    name: string;
    summary: ShowcaseSummary;
    /** sha256 over summary.json bytes, a newline, and artifacts.sha256 bytes. */
    hash: string;
}

const sha256 = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex');

/** Parse `<64 hex>  <path>` lines; a malformed line is a problem, never skipped. */
export function parseSha256List(text: string): { entries: Map<string, string>; problems: string[] } {
    const entries = new Map<string, string>();
    const problems: string[] = [];
    text.split('\n').forEach((line, i) => {
        if (line.trim() === '') return;
        const m = /^([0-9a-f]{64}) {2}(\S.*)$/.exec(line);
        if (!m) problems.push(`artifacts.sha256 line ${i + 1} is not '<sha256>  <path>'`);
        else entries.set(m[2] as string, m[1] as string);
    });
    return { entries, problems };
}

/** Load and fully validate one bundle directory. Throws nothing; problems are returned. */
export function loadBundle(dir: string): { bundle: LoadedBundle | null; problems: string[] } {
    const name = path.basename(dir);
    const summaryPath = path.join(dir, 'summary.json');
    const shaPath = path.join(dir, 'artifacts.sha256');
    if (!fs.existsSync(summaryPath)) return { bundle: null, problems: [`${name}: summary.json missing`] };
    if (!fs.existsSync(shaPath)) return { bundle: null, problems: [`${name}: artifacts.sha256 missing`] };
    const summaryBytes = fs.readFileSync(summaryPath);
    const shaBytes = fs.readFileSync(shaPath);
    let parsed: unknown;
    try {
        parsed = JSON.parse(summaryBytes.toString('utf8'));
    } catch (exc) {
        return { bundle: null, problems: [`${name}: summary.json is not JSON — ${(exc as Error).message}`] };
    }
    const problems = validateBundleSummary(parsed).map((p) => `${name}: ${p}`);
    if (problems.length > 0) return { bundle: null, problems };
    const summary = parsed as ShowcaseSummary;
    if (name !== `${summary.stamp}-${summary.task.id}`) problems.push(`${name}: directory must be named ${summary.stamp}-${summary.task.id}`);
    const { entries, problems: shaProblems } = parseSha256List(shaBytes.toString('utf8'));
    problems.push(...shaProblems.map((p) => `${name}: ${p}`));
    for (const arm of summary.arms) {
        for (const run of arm.runs) {
            if (run.thumbnail === null) continue;
            const abs = path.join(dir, run.thumbnail);
            if (!fs.existsSync(abs)) {
                problems.push(`${name}: ${arm.id} run ${run.run} thumbnail ${run.thumbnail} missing`);
                continue;
            }
            const bytes = fs.readFileSync(abs);
            if (bytes.length > THUMB_MAX_BYTES) problems.push(`${name}: ${run.thumbnail} is ${bytes.length} bytes, cap ${THUMB_MAX_BYTES}`);
            const listed = entries.get(run.thumbnail);
            if (listed === undefined) problems.push(`${name}: ${run.thumbnail} not listed in artifacts.sha256`);
            else if (listed !== sha256(bytes)) problems.push(`${name}: ${run.thumbnail} does not match its artifacts.sha256 entry`);
        }
    }
    if (problems.length > 0) return { bundle: null, problems };
    const hash = sha256(Buffer.concat([summaryBytes, Buffer.from('\n'), shaBytes]));
    return { bundle: { dir, name, summary, hash }, problems: [] };
}
