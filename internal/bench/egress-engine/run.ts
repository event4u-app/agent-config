#!/usr/bin/env tsx
/**
 * PREREG endpoints (a) credential half, (b) credential half, (c) idempotence
 * and (f) of `internal/bench/egress-placeholders-PREREG.md`, on the engine as
 * it stands. The W2 corpus is generated from a fixed seed at run time, so no
 * credential-shaped value is ever committed; the generator below and the seed
 * ARE the frozen corpus. Each scorer first rejects a planted defect.
 *
 *   ./scripts-run internal/bench/egress-engine/run.ts [--json <out>]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detect, EGRESS_RULES, type EgressRule } from '../../../src/scripts/_lib/egress_rules.js';
import { replaceValues, TokenScope } from '../../../src/scripts/_lib/egress_token.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SEED = 20261020;
const PER_TYPE = 100;

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UPPER_DIGIT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** One synthetic value per credential row; prefixes are read from the table, never spelled. */
function generators(rnd: () => number): Record<string, () => string> {
    const pick = (set: string, n: number): string => {
        let s = '';
        for (let i = 0; i < n; i += 1) s += set[Math.floor(rnd() * set.length)];
        // A run of one class is not a key; force a digit and both cases.
        return `${s.slice(0, -3)}a7Z`;
    };
    const p = (rule: string): string => (EGRESS_RULES.find((r) => r.rule === rule)?.prefixes ?? [''])[0] as string;
    return {
        'anthropic-api-key': () => `${p('anthropic-api-key')}api03-${pick(ALNUM, 40)}`,
        'anthropic-project-key': () => `${p('anthropic-project-key')}${pick(ALNUM, 32)}`,
        'aws-access-key': () => `${p('aws-access-key')}${pick(UPPER_DIGIT, 13)}A7Z`.toUpperCase(),
        'google-api-key': () => `${p('google-api-key')}${pick(ALNUM, 35)}`,
        'github-pat': () => `${p('github-pat')}${pick(ALNUM, 36)}`,
        'github-fine-grained-pat': () => `${p('github-fine-grained-pat')}${pick(ALNUM, 40)}`,
        'openai-api-key': () => `${p('openai-api-key')}${pick(ALNUM, 40)}`,
        'google-oauth-token': () => `${p('google-oauth-token')}${pick(ALNUM, 40)}`,
        'github-app-token': () => `${p('github-app-token')}${pick(ALNUM, 36)}`,
        'xai-api-key': () => `${p('xai-api-key')}${pick(ALNUM, 40)}`,
        'perplexity-api-key': () => `${p('perplexity-api-key')}${pick(ALNUM, 40)}`,
        'groq-api-key': () => `${p('groq-api-key')}${pick(ALNUM, 40)}`,
        jwt: () => `eyJ${pick(ALNUM, 20)}.${pick(ALNUM, 30)}.${pick(ALNUM, 25)}`,
        'stripe-secret-key': () => `${p('stripe-secret-key')}${pick(ALNUM, 24)}`,
        'slack-token': () => `${p('slack-token')}${pick(ALNUM, 24)}`,
        'pem-private-key': () => `-----BEGIN RSA PRIVATE KEY-----\n${pick(ALNUM, 64)}\n-----END RSA PRIVATE KEY-----`,
        'db-connection-uri': () => `postgres://app:${pick(ALNUM, 16)}@db.example.com:5432/app`,
        'generic-assignment': () => pick(ALNUM, 24),
    };
}

/** Where a value sits in a W2 document; generic-assignment needs a keyword. */
const CARRIERS: ReadonlyArray<(v: string, rule: string) => string> = [
    (v, r) => (r === 'generic-assignment' ? `DB_PASSWORD=${v}` : `TOKEN_VALUE=${v}`),
    (v, r) => (r === 'generic-assignment' ? `password: "${v}"` : `credential: ${JSON.stringify(v)}`),
    (v, r) => (r === 'generic-assignment' ? `{"api_key": "${v}"}` : `{"value": ${JSON.stringify(v)}}`),
    (v, r) => (r === 'generic-assignment' ? `export SECRET="${v}"` : `export VALUE="${v}"`),
];

export interface Planted {
    readonly rule: string;
    readonly value: string;
    readonly doc: string;
}

export function w2Corpus(seed: number = SEED): Planted[] {
    const rnd = mulberry32(seed);
    const gen = generators(rnd);
    const out: Planted[] = [];
    for (const [rule, make] of Object.entries(gen)) {
        for (let i = 0; i < PER_TYPE; i += 1) {
            const value = make();
            const carrier = CARRIERS[i % CARRIERS.length] as (v: string, r: string) => string;
            out.push({ rule, value, doc: `# fixture ${String(i)}\n${carrier(value, rule)}\n` });
        }
    }
    return out;
}

type Replacer = (text: string, scope: TokenScope) => string;

export function recallByType(corpus: readonly Planted[], replace: Replacer): Map<string, { hit: number; n: number }> {
    const out = new Map<string, { hit: number; n: number }>();
    for (const c of corpus) {
        const row = out.get(c.rule) ?? { hit: 0, n: 0 };
        row.n += 1;
        let after: string;
        try {
            after = replace(c.doc, new TokenScope());
        } catch {
            after = '';
        }
        if (!after.includes(c.value)) row.hit += 1;
        out.set(c.rule, row);
    }
    return out;
}

export function idempotenceMismatches(corpus: readonly Planted[], replace: Replacer): number {
    let bad = 0;
    for (const c of corpus) {
        const scope = new TokenScope();
        const once = replace(c.doc, scope);
        if (replace(once, scope) !== once) bad += 1;
    }
    return bad;
}

function withoutRow(rule: string): Replacer {
    const rules: EgressRule[] = EGRESS_RULES.filter((r) => r.rule !== rule);
    return (text, scope) => {
        // A replacer blind to one row: values of that type pass through.
        const spans = detect(text, rules);
        return spans.length === 0 ? text : replaceValues(text, scope);
    };
}

function trackedTextFiles(): string[] {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf-8' });
    return out
        .split('\0')
        .filter((f) => /\.(ts|mts|js|mjs|md|yml|yaml|json|sh|txt)$/.test(f) && !f.startsWith('dist/'));
}

export function falsePositiveFiles(files: readonly string[]): { flagged: string[]; n: number } {
    const flagged: string[] = [];
    let n = 0;
    for (const f of files) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(ROOT, f), 'utf-8');
        } catch {
            continue;
        }
        n += 1;
        if (detect(text).some((s) => s.class === 'credential' && s.rule !== 'generic-assignment')) flagged.push(f);
    }
    return { flagged, n };
}

function latency(corpus: readonly Planted[], iterations = 200): { p50: number; p95: number; bytes: number } {
    const filler = fs.readFileSync(path.join(ROOT, 'src/scripts/_lib/egress_rules.ts'), 'utf-8');
    let body = corpus.slice(0, 200).map((c) => c.doc).join('\n');
    while (Buffer.byteLength(body) < 64 * 1024) body += filler;
    body = Buffer.from(body).subarray(0, 64 * 1024).toString('utf-8');
    const times: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
        const t0 = process.hrtime.bigint();
        try {
            replaceValues(body, new TokenScope());
        } catch {
            // an unproven extent still costs the scan
        }
        times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    times.sort((a, b) => a - b);
    const q = (p: number): number => times[Math.min(times.length - 1, Math.floor(p * times.length))] as number;
    return { p50: q(0.5), p95: q(0.95), bytes: Buffer.byteLength(body) };
}

function main(argv: readonly string[]): number {
    const corpus = w2Corpus();
    const real: Replacer = (t, s) => replaceValues(t, s);
    // Falsification first: the recall scorer must see a row removed, and the
    // idempotence scorer a replacer that grows its output.
    const blind = recallByType(corpus, withoutRow('github-pat')).get('github-pat');
    const growing = idempotenceMismatches(corpus.slice(0, 10), (t) => `${t}x`);
    if (blind === undefined || blind.hit / blind.n >= 0.99 || growing !== 10) {
        process.stderr.write('egress-engine bench: a scorer did not reject its planted defect — no reading taken\n');
        return 2;
    }
    const recall = recallByType(corpus, real);
    const idem = idempotenceMismatches(corpus, real);
    const files = trackedTextFiles();
    const fp = falsePositiveFiles(files);
    const lat = latency(corpus);
    const result = {
        seed: SEED,
        per_type: PER_TYPE,
        falsification: { recall_without_github_pat: blind.hit / blind.n, growing_replacer_mismatches: growing },
        recall: Object.fromEntries([...recall].map(([k, v]) => [k, { hit: v.hit, n: v.n, rate: v.hit / v.n }])),
        idempotence_mismatches: idem,
        precision_credential: { files: fp.n, flagged: fp.flagged.length, rate: fp.flagged.length / fp.n, flagged_files: fp.flagged },
        latency_ms: lat,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
    };
    const i = argv.indexOf('--json');
    if (i !== -1 && argv[i + 1] !== undefined) fs.writeFileSync(argv[i + 1] as string, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
}

process.exit(main(process.argv.slice(2)));
