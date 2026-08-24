#!/usr/bin/env tsx
/**
 * Offline staleness + CSV-integrity gate for the grounding corpora.
 *
 * ## The two gaps this closes, both measured
 *
 * 1. **A declared refresh cadence nothing enforced.** Six corpus manifests
 *    declare `refresh_cadence` (`design-intelligence`, `brand`, `database`,
 *    `accessibility-auditor`, `api-design`, `threat-modeling`), and
 *    `design-intelligence` pins `upstream.last_checked: 2026-06-07` against a
 *    `quarterly` cadence. Nothing read either field. A cadence with no gate is a
 *    promise, not a control.
 *
 * 2. **A CSV path nothing opened.** `corpus-grounding/scripts/schema_validator.ts`
 *    validates that `domains.*.file` is a well-formed relative path and then
 *    never opens it — its only filesystem calls are an `existsSync` and a
 *    `readFileSync` of the MANIFEST. So a re-vendor could land a CSV that is
 *    missing, empty, or whose header no longer carries the declared
 *    `search_cols` / `output_cols`, and every gate would stay green.
 *
 * The ordering is load-bearing and is the roadmap's, not a preference: this gate
 * lands BEFORE any re-vendor. After one, it can only certify whatever arrived.
 *
 * ## OFFLINE AND DETERMINISTIC BY CONSTRUCTION
 *
 * Manifests and CSV headers are read from disk and compared against a date. No
 * subprocess, no socket, no PATH lookup. Time is the only external input, so it
 * is INJECTABLE: `--today YYYY-MM-DD` overrides the clock, which is why the
 * fixtures pin it. A test whose verdict flips 91 days from now is a broken test,
 * not a passing one. Same doctrine as `check_reach_staleness`, whose CLI shape
 * this deliberately mirrors — one staleness idiom, not two.
 *
 * A `last_checked` in the FUTURE is a violation of its own class rather than a
 * negative age silently reading as fresh: the only ways to get one are a typo
 * and a hand-edit, and both should surface.
 *
 * ## What it does NOT check
 *
 * Row semantics. A header carrying every declared column says the shape
 * survived, not that the content is still true — that judgement is the corpus
 * owner's and no offline gate can make it. Claiming otherwise would be the
 * over-reach this file exists to replace.
 *
 * Exit codes: 0 clean · 1 violations · 3 unusable input (missing / unparseable
 * manifest, bad `--today`, or a dead scan scope).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where corpus manifests live: `src/skills/<skill>/data/manifest.json`. */
export const SKILLS_DIR =
    process.env['CHECK_CORPUS_STALENESS_SKILLS_DIR'] ?? path.join(ROOT, 'src', 'skills');

/**
 * Days after which a `quarterly` corpus is stale.
 *
 * 100, not 90: a quarter is ~91 days and a cadence met on the day it comes due
 * would otherwise red for the maintainer who honoured it. The slack is the
 * grace, stated rather than hidden in an off-by-one.
 */
export const QUARTERLY_STALE_DAYS = 100;

/** Days for the other declarable cadences. Absent cadence → no staleness check. */
export const CADENCE_DAYS: Readonly<Record<string, number>> = {
    monthly: 40,
    quarterly: QUARTERLY_STALE_DAYS,
    'semi-annual': 190,
    annual: 380,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Every finding carries the locator that makes it actionable without a grep. */
export interface CorpusFinding {
    /** `design-intelligence` or `design-intelligence:domains.colors`. */
    readonly locator: string;
    /** Machine-stable violation class — tests assert on this, not on prose. */
    readonly kind:
        | 'stale-corpus'
        | 'unparseable-date'
        | 'future-date'
        | 'missing-csv'
        | 'empty-csv'
        | 'missing-column'
        | 'attribution-date-mismatch';
    readonly message: string;
}

function as_object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Parse an ISO calendar date to UTC midnight. Returns null for anything that is
 * not a `YYYY-MM-DD` string, so a JSON number or a loose date is rejected rather
 * than silently coerced.
 */
export function parse_iso_date(value: unknown): number | null {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
        return null;
    }
    const stamp = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(stamp)) {
        return null;
    }
    // Round-trip guard: `2026-02-31` parses in some engines but is not a date.
    return new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

/** Whole days between two UTC-midnight stamps. */
export function days_between(fromStamp: number, toStamp: number): number {
    return Math.floor((toStamp - fromStamp) / MS_PER_DAY);
}

/** Today as `YYYY-MM-DD` in UTC — the only place the clock is read. */
export function today_iso(now: Date = asOf()): string {
    return now.toISOString().slice(0, 10);
}

/**
 * Split one CSV header line into field names.
 *
 * Quote-aware because a declared column may legitimately contain a comma. Not a
 * full CSV parser and does not pretend to be one — only the header is read, and
 * only to compare a set of names.
 */
export function parse_csv_header(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            if (quoted && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (ch === ',' && !quoted) {
            out.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    // Strip a UTF-8 BOM off the first field — an editor artefact, not a column.
    if (out.length > 0 && out[0] !== undefined) {
        out[0] = out[0].replace(/^﻿/, '');
    }
    return out;
}

export interface Corpus {
    /** Skill slug — the directory name under src/skills. */
    readonly slug: string;
    readonly manifestPath: string;
    readonly manifest: Record<string, unknown>;
}

/** Every `src/skills/<slug>/data/manifest.json` on disk, sorted by slug. */
export function discover_corpora(skillsDir: string = SKILLS_DIR): Corpus[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: Corpus[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) {
            continue;
        }
        const manifestPath = path.join(skillsDir, entry.name, 'data', 'manifest.json');
        let raw: string;
        try {
            raw = fs.readFileSync(manifestPath, 'utf-8');
        } catch {
            continue;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // A corpus whose manifest does not parse is unusable input, not a
            // clean corpus — surfaced by the caller as exit 3.
            throw new Error(`${path.relative(ROOT, manifestPath)}: manifest is not valid JSON`);
        }
        const obj = as_object(parsed);
        if (obj === null) {
            throw new Error(`${path.relative(ROOT, manifestPath)}: manifest is not an object`);
        }
        out.push({ slug: entry.name, manifestPath, manifest: obj });
    }
    return out;
}

/** Staleness half — the declared cadence against `upstream.last_checked`. */
export function check_staleness(corpus: Corpus, todayStamp: number): CorpusFinding[] {
    const provenance = as_object(corpus.manifest['provenance']) ?? corpus.manifest;
    const cadence = provenance['refresh_cadence'];
    if (typeof cadence !== 'string') {
        // No declared cadence → nothing promised, nothing to enforce.
        return [];
    }
    const limit = CADENCE_DAYS[cadence];
    if (limit === undefined) {
        return [
            {
                locator: corpus.slug,
                kind: 'unparseable-date',
                message:
                    `refresh_cadence: "${cadence}" is not one of ` +
                    `${Object.keys(CADENCE_DAYS).join(' | ')} — a cadence this gate cannot ` +
                    `read is a cadence it cannot enforce`,
            },
        ];
    }
    const upstream = as_object(provenance['upstream']);
    if (upstream === null) {
        // `upstream: null` is legitimate — a corpus this project authored has no
        // upstream to re-check. brand/data/manifest.json is exactly that case.
        return [];
    }
    const stamp = parse_iso_date(upstream['last_checked']);
    if (stamp === null) {
        return [
            {
                locator: `${corpus.slug}:upstream.last_checked`,
                kind: 'unparseable-date',
                message:
                    `declares refresh_cadence: ${cadence} but upstream.last_checked is ` +
                    `${JSON.stringify(upstream['last_checked'])} — expected YYYY-MM-DD`,
            },
        ];
    }
    const age = days_between(stamp, todayStamp);
    if (age < 0) {
        return [
            {
                locator: `${corpus.slug}:upstream.last_checked`,
                kind: 'future-date',
                message: `upstream.last_checked is ${String(upstream['last_checked'])}, ${String(-age)} day(s) in the future`,
            },
        ];
    }
    if (age > limit) {
        return [
            {
                locator: `${corpus.slug}:upstream.last_checked`,
                kind: 'stale-corpus',
                message:
                    `last checked ${String(upstream['last_checked'])} — ${String(age)} days ago, over the ` +
                    `${String(limit)}-day bound for refresh_cadence: ${cadence}. Re-check upstream and ` +
                    `update last_checked in BOTH data/manifest.json and ATTRIBUTION.md`,
            },
        ];
    }
    return [];
}

/**
 * The human-readable twin can drift from the machine one.
 *
 * `ATTRIBUTION.md` carries `Last checked: <date>` and the manifest carries
 * `upstream.last_checked`. Two copies of one fact is a drift source, and this is
 * the cheap half of the fix — detect it. (Deriving one from the other would be
 * the other half and is not this gate's business.)
 */
export function check_attribution_pin(corpus: Corpus): CorpusFinding[] {
    const provenance = as_object(corpus.manifest['provenance']) ?? corpus.manifest;
    const upstream = as_object(provenance['upstream']);
    const declared = upstream?.['last_checked'];
    if (typeof declared !== 'string') {
        return [];
    }
    const attribution = path.join(path.dirname(path.dirname(corpus.manifestPath)), 'ATTRIBUTION.md');
    let text: string;
    try {
        text = fs.readFileSync(attribution, 'utf-8');
    } catch {
        // No ATTRIBUTION.md → nothing to disagree with.
        return [];
    }
    const m = /^[-*]?\s*Last checked:\s*(\S+)\s*$/m.exec(text);
    if (m === null || m[1] === undefined) {
        return [];
    }
    if (m[1] !== declared) {
        return [
            {
                locator: `${corpus.slug}:ATTRIBUTION.md`,
                kind: 'attribution-date-mismatch',
                message:
                    `ATTRIBUTION.md says "Last checked: ${m[1]}" while data/manifest.json says ` +
                    `upstream.last_checked: ${declared} — one fact, two copies, already diverged`,
            },
        ];
    }
    return [];
}

interface CsvScan {
    readonly findings: CorpusFinding[];
    /** How many CSV files were actually opened — the scan-scope unit. */
    readonly opened: number;
}

/**
 * Integrity half — every declared CSV exists, is non-empty, and its header
 * carries every declared column.
 *
 * This is the check `schema_validator.ts` stops short of: it computes the path
 * and refuses an escape, then never opens the file.
 */
export function check_csv_integrity(corpus: Corpus): CsvScan {
    const findings: CorpusFinding[] = [];
    let opened = 0;
    const dataDir = path.dirname(corpus.manifestPath);

    const domains = as_object(corpus.manifest['domains']) ?? {};
    const stacks = as_object(corpus.manifest['stacks']) ?? {};

    /** `{ relative-csv-path: required column names }`, merged per file. */
    const required = new Map<string, Set<string>>();
    const note = (rel: unknown, cols: readonly unknown[]): void => {
        if (typeof rel !== 'string' || rel === '') {
            return;
        }
        const set = required.get(rel) ?? new Set<string>();
        for (const c of cols) {
            if (typeof c === 'string' && c !== '') {
                set.add(c);
            }
        }
        required.set(rel, set);
    };

    for (const spec of Object.values(domains)) {
        const d = as_object(spec);
        if (d === null) {
            continue;
        }
        const search = Array.isArray(d['search_cols']) ? d['search_cols'] : [];
        const output = Array.isArray(d['output_cols']) ? d['output_cols'] : [];
        const stack = Array.isArray(d['stack_cols']) ? d['stack_cols'] : [];
        note(d['file'], [...search, ...output, ...stack]);
    }
    const reasoning = as_object(corpus.manifest['reasoning']);
    if (reasoning !== null) {
        const mc = reasoning['match_column'];
        note(reasoning['file'], typeof mc === 'string' ? [mc] : []);
    }
    for (const rel of Object.values(stacks)) {
        // Stack entries are `stack-id → csv path`; their columns are not declared
        // per stack, so only existence and non-emptiness are checkable.
        note(rel, []);
    }

    for (const rel of [...required.keys()].sort()) {
        const cols = required.get(rel) ?? new Set<string>();
        const abs = path.join(dataDir, rel);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            findings.push({
                locator: `${corpus.slug}:${rel}`,
                kind: 'missing-csv',
                message: `declared in data/manifest.json but not present on disk`,
            });
            continue;
        }
        opened += 1;
        const lines = text.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) {
            findings.push({
                locator: `${corpus.slug}:${rel}`,
                kind: 'empty-csv',
                message: 'file is empty — no header, no rows',
            });
            continue;
        }
        if (lines.length === 1) {
            findings.push({
                locator: `${corpus.slug}:${rel}`,
                kind: 'empty-csv',
                message: 'header only, zero data rows — a corpus of nothing reads exactly like a clean one',
            });
            continue;
        }
        const header = new Set(parse_csv_header(lines[0] as string));
        const missing = [...cols].filter((c) => !header.has(c)).sort();
        if (missing.length > 0) {
            findings.push({
                locator: `${corpus.slug}:${rel}`,
                kind: 'missing-column',
                message:
                    `header is missing declared column(s) ${missing.join(', ')} — ` +
                    `the manifest promises them to every consumer of this corpus`,
            });
        }
    }
    return { findings, opened };
}

export interface RunResult {
    readonly findings: CorpusFinding[];
    /** Corpora inspected — the scan-scope unit. */
    readonly corpora: number;
    /** CSVs actually opened, reported so "checked nothing" cannot read as clean. */
    readonly csvs: number;
    /** Per-corpus completeness accounting — every discovered corpus reaches one outcome. */
    readonly ledger: GateLedger;
}

export function run_checks(todayStamp: number, skillsDir: string = SKILLS_DIR): RunResult {
    const corpora = discover_corpora(skillsDir);
    const ledger = new GateLedger('check_corpus_staleness');
    ledger.plan(corpora.map((c) => c.slug));
    const findings: CorpusFinding[] = [];
    let csvs = 0;
    for (const corpus of corpora) {
        const found: CorpusFinding[] = [
            ...check_staleness(corpus, todayStamp),
            ...check_attribution_pin(corpus),
        ];
        const csv = check_csv_integrity(corpus);
        found.push(...csv.findings);
        csvs += csv.opened;
        findings.push(...found);
        if (found.length > 0) {
            ledger.fail(corpus.slug, `${String(found.length)} corpus finding(s)`);
        } else {
            ledger.complete(corpus.slug);
        }
    }
    return { findings, corpora: corpora.length, csvs, ledger };
}

const HELP = `check_corpus_staleness — offline staleness + CSV-integrity gate for the grounding corpora

Usage:
  tsx src/scripts/check_corpus_staleness.ts [options]

Options:
  --today <YYYY-MM-DD>  Reference date (default: the real UTC date). Time is the
                        only external input, so it is injectable — the fixtures
                        pin it instead of expiring on a calendar boundary.
  --quiet               Suppress the success line
  --help                This text

Checks (all offline — no network, no subprocess):
  stale-corpus                upstream.last_checked older than the declared refresh_cadence
  future-date                 upstream.last_checked in the future (typo or hand-edit)
  unparseable-date            a cadence this gate cannot read, or a non-ISO last_checked
  attribution-date-mismatch   ATTRIBUTION.md and data/manifest.json disagree
  missing-csv                 a declared CSV is not on disk
  empty-csv                   a declared CSV has no rows (header-only counts)
  missing-column              a declared search/output/stack/match column is not in the header

Cadence bounds: ${Object.entries(CADENCE_DAYS).map(([k, v]) => `${k}=${String(v)}d`).join(' · ')}
A corpus with no refresh_cadence, or with upstream: null, is exempt by declaration.

Exit codes: 0 clean · 1 violations · 3 unusable input (unparseable manifest, bad --today, dead scope).
`;

/**
 * `--self-test` — drives the REAL binary over synthetic corpora.
 *
 * Not optional for a new gate: `gate-self-test:registered-non-adopters` is a
 * shrink-only count over the enforced manifest, so registering this gate without
 * a self-test would raise it and red CI. That is the ratchet working as designed
 * — the cheapest moment to prove a gate discriminates is when it is written.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-'));
    /** Build a one-corpus skills tree and return its root. */
    const mk = (manifest: unknown, files: Readonly<Record<string, string>> = {}): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'skills-'));
        const dataDir = path.join(root, 'c', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
        for (const [rel, body] of Object.entries(files)) {
            const p = path.join(dataDir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body, 'utf-8');
        }
        return root;
    };
    const run = (root: string): number => {
        process.env['CHECK_CORPUS_STALENESS_SKILLS_DIR'] = root;
        try {
            return runGateCli(
                ROOT,
                'src/scripts/check_corpus_staleness.ts',
                ['--quiet', '--today', '2026-08-06'],
                ROOT,
            );
        } finally {
            delete process.env['CHECK_CORPUS_STALENESS_SKILLS_DIR'];
        }
    };
    const fresh = { refresh_cadence: 'quarterly', upstream: { last_checked: '2026-07-01' } };
    const csv = 'a,b\n1,2\n';
    try {
        return runSelfTest({
            gate: 'check_corpus_staleness',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a corpus inside its cadence with a complete CSV passes',
                    expect: 'accept',
                    run: () =>
                        run(
                            mk(
                                { ...fresh, domains: { d: { file: 'x.csv', search_cols: ['a'], output_cols: ['b'] } } },
                                { 'x.csv': csv },
                            ),
                        ),
                },
                {
                    name: 'a corpus past its declared cadence is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            mk(
                                {
                                    refresh_cadence: 'quarterly',
                                    upstream: { last_checked: '2026-01-01' },
                                    domains: { d: { file: 'x.csv', search_cols: ['a'], output_cols: ['b'] } },
                                },
                                { 'x.csv': csv },
                            ),
                        ),
                },
                {
                    name: 'a declared CSV missing from disk is rejected — the gap schema_validator leaves',
                    expect: 'reject',
                    run: () => run(mk({ ...fresh, domains: { d: { file: 'gone.csv', search_cols: ['a'], output_cols: ['b'] } } })),
                },
                {
                    name: 'a header missing a declared column is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            mk(
                                { ...fresh, domains: { d: { file: 'x.csv', search_cols: ['nope'], output_cols: ['b'] } } },
                                { 'x.csv': csv },
                            ),
                        ),
                },
                {
                    name: 'a header-only CSV is rejected — zero rows reads exactly like a clean corpus',
                    expect: 'reject',
                    run: () =>
                        run(
                            mk(
                                { ...fresh, domains: { d: { file: 'x.csv', search_cols: ['a'], output_cols: ['b'] } } },
                                { 'x.csv': 'a,b\n' },
                            ),
                        ),
                },
                {
                    name: 'upstream: null is exempt by declaration — a corpus this project authored',
                    expect: 'accept',
                    run: () =>
                        run(
                            mk(
                                { refresh_cadence: 'quarterly', upstream: null, domains: { d: { file: 'x.csv', search_cols: ['a'], output_cols: ['b'] } } },
                                { 'x.csv': csv },
                            ),
                        ),
                },
                {
                    name: 'an empty skills tree is a DEAD SCOPE (exit 3), never a clean pass',
                    expect: 'reject',
                    run: () => run(fs.mkdtempSync(path.join(tmp, 'empty-'))),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(HELP);
        return 0;
    }
    if (argv.includes('--self-test')) {
        return selfTest();
    }
    const quiet = argv.includes('--quiet');

    let today: string | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined) {
            continue;
        }
        if (arg === '--today') {
            const value = argv[index + 1];
            if (!value) {
                process.stderr.write('check_corpus_staleness: --today needs a date\n');
                return 3;
            }
            today = value;
            index += 1;
        } else if (arg.startsWith('--today=')) {
            today = arg.slice('--today='.length);
        } else if (arg !== '--quiet') {
            process.stderr.write(`check_corpus_staleness: unrecognized argument: ${arg}\n`);
            return 3;
        }
    }

    const todayStamp = parse_iso_date(today ?? today_iso());
    if (todayStamp === null) {
        process.stderr.write(`check_corpus_staleness: --today must be YYYY-MM-DD, got ${String(today)}\n`);
        return 3;
    }

    let result: RunResult;
    try {
        result = run_checks(todayStamp);
    } catch (err) {
        process.stderr.write(`❌  ${String(err instanceof Error ? err.message : err)}\n`);
        return 3;
    }

    // No `allowEmpty`: zero corpora means the gate could not run, and that reads
    // exactly like a clean tree. Exit 3 (unusable input) over 0.
    try {
        assertScanned({
            gate: 'check_corpus_staleness',
            scanned: result.corpora,
            units: 'corpus manifest(s)',
            roots: [`${path.relative(ROOT, SKILLS_DIR)}/*/data/manifest.json`],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 3;
        }
        throw err;
    }

    // gate-coverage contract (src/config/gate-coverage.yml): corpora inspected.
    process.stdout.write(`scanned: ${String(result.corpora)}\n`);
    result.ledger.report();

    if (result.findings.length > 0) {
        process.stdout.write(`❌  ${String(result.findings.length)} corpus finding(s):\n`);
        for (const f of result.findings) {
            process.stdout.write(`  - [${f.kind}] ${f.locator}: ${f.message}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  ${String(result.corpora)} corpus manifest(s), ${String(result.csvs)} CSV(s) opened: ` +
                `every declared cadence is met, every declared CSV exists with its declared columns ` +
                `(offline check, reference date ${today ?? today_iso()}).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
