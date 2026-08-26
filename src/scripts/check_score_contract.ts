#!/usr/bin/env tsx
/**
 * Score-contract gate — an unreferenced prose "10" becomes impossible.
 *
 * `agents/evidence/ac-capability-scorecard.yaml` records, per rubric category,
 * the current claim, the evidence classes that would support it, and a status.
 * This gate makes the status a DERIVED field: a row whose status disagrees with
 * its own evidence arrays is a finding, so nobody can hand-award a `ten` and no
 * closed roadmap checkbox can buy one.
 *
 * Register class 4 of 4 — `agents/evidence/README.md` says what the other three
 * are (`docs/CLAIMS.md`, `provenance/borrows.jsonl`,
 * `provenance/harvests.jsonl`) and why this is none of them. It is modelled on
 * `check_claims.ts`: same "a claim may not stand without a resolvable evidence
 * reference" culture, applied to an external reviewer's rubric axes instead of
 * to public marketing claims.
 *
 * WHAT IT DELIBERATELY DOES NOT DO — the whole point of the contract:
 *   It never judges outcome QUALITY. A threshold applied to how good an outcome
 *   was is a judgement behind a gate, which is score theatre. Quality belongs in
 *   a report on the green path, gating nothing. Emptiness and resolvability are
 *   mechanical; "is this evidence good enough" is not, and is not attempted.
 *
 * Checks:
 *   1. Shape — the file parses, carries `rubric:` and `categories:`, and every
 *      row has the closed field set with a `status` from the six-value enum.
 *   2. Manifest honesty — `recovered + missing == reported`; `state: complete`
 *      is REFUSED while `authority: unavailable-external-review`; the row count
 *      equals `recovered_category_count`; no duplicate category ids; no row id
 *      appearing in `excluded_from_manifest`.
 *   3. Evidence resolvability — every non-empty URI resolves, at every status.
 *   4. The class rule, per status (see STATUS_RULES). `ten` needs every
 *      required class non-empty and resolvable plus a production window;
 *      `max-boundary` needs a standing constraint and nothing else may carry
 *      one; `measured-null` needs a window and resolvable outcome evidence.
 *   5. Stale pins — a `path@<sha>` URI whose sha is not an ancestor of HEAD.
 *
 * Evidence-URI grammar (deliberately narrower than check_claims'):
 *   <repo-path>              → the path exists
 *   <repo-path>:<line>       → the path exists (line advisory)
 *   <repo-path>#<substring>  → the path exists AND contains <substring>
 *   <repo-path>@<sha>        → the path exists AND <sha> is an ancestor of HEAD
 *   https://… (YYYY-MM-DD)   → external cite with a dated stamp (never fetched)
 *   fixture:<repo-path>      → explicitly a FIXTURE; may never satisfy the
 *                              adoption, production, or outcome classes
 *
 * `fixture:` exists because the contract's own definition of 10 says synthetic
 * fixtures can never satisfy adoption, production or outcome. Without a marker
 * the gate could not tell a fixture path from a production one, and the rule
 * would be prose only.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_score_contract
 *     ./scripts-run src/scripts/check_score_contract --quiet
 *     ./scripts-run src/scripts/check_score_contract --file <path>
 *
 * Exit codes: 0 = clean · 2 = any finding OR usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { GateLedger } from './_lib/gate_ledger.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');
const DEFAULT_REL = path.join('agents', 'evidence', 'ac-capability-scorecard.yaml');
/** This script's repo-relative path, for the self-test's real CLI invocations. */
const SELF = path.join('src', 'scripts', 'check_score_contract.ts');
const TWIN_DIR = path.join('tests', 'fixtures', 'score-contract', 'twins');
const SELF_TEST_MIN_CASES = 8;
const SELF_TEST_MIN_REJECT = 6;

class ExitCode extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

/** The six legal statuses. `max-boundary` and `measured-null` are TERMINAL. */
export const STATUSES = [
    'missing-mechanism',
    'missing-adoption',
    'missing-proof',
    'measured-null',
    'max-boundary',
    'ten',
] as const;
export type Status = (typeof STATUSES)[number];

/** Classes a `fixture:` URI may never satisfy — from the frozen definition of 10. */
const FIXTURE_FORBIDDEN = ['adoption_evidence', 'production_window', 'outcome_evidence'] as const;

const EVIDENCE_ARRAYS = [
    'mechanism_evidence',
    'adoption_evidence',
    'negative_control_evidence',
    'outcome_evidence',
    'non_regression_evidence',
] as const;

const ROW_FIELDS = [
    'category',
    'baseline',
    'claim',
    'closing_path',
    ...EVIDENCE_ARRAYS,
    'production_window',
    'status',
] as const;

export interface Finding {
    readonly where: string;
    readonly code: string;
    readonly detail: string;
}

/* ── evidence URIs ─────────────────────────────────────────────────────────── */

const _isAncestor = (sha: string): boolean => {
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
            cwd: REPO,
            stdio: 'ignore',
        });
        return true;
    } catch {
        return false;
    }
};

/** Resolve one URI. Returns null when it resolves, else the reason it does not. */
export function resolveUri(uri: string): string | null {
    const raw = uri.trim();
    if (raw === '') return 'empty URI';

    if (raw.startsWith('https://') || raw.startsWith('http://')) {
        // Never fetched — an undated external cite cannot be re-verified later.
        return /\(\d{4}-\d{2}-\d{2}\)\s*$/.test(raw) ? null : 'external cite carries no (YYYY-MM-DD) stamp';
    }

    const body = raw.startsWith('fixture:') ? raw.slice('fixture:'.length).trim() : raw;

    let rel = body;
    let needle: string | null = null;
    let sha: string | null = null;

    const hash = body.indexOf('#');
    const at = body.lastIndexOf('@');
    if (hash !== -1) {
        rel = body.slice(0, hash);
        needle = body.slice(hash + 1);
    } else if (at > 0) {
        rel = body.slice(0, at);
        sha = body.slice(at + 1);
    } else {
        rel = body.replace(/:\d+$/, '');
    }

    if (rel === '' || path.isAbsolute(rel) || rel.split('/').includes('..')) {
        return `path must be repo-relative and inside the repo: ${rel}`;
    }
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) return `path does not exist: ${rel}`;

    if (needle !== null && needle !== '') {
        let text = '';
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            return `path is not readable as text: ${rel}`;
        }
        if (!text.includes(needle)) return `\`${rel}\` does not contain \`${needle}\``;
    }
    if (sha !== null) {
        if (!/^[0-9a-f]{7,40}$/.test(sha)) return `not a sha: ${sha}`;
        if (!_isAncestor(sha)) return `stale pin: ${sha} is not an ancestor of HEAD`;
    }
    return null;
}

const nonEmpty = (v: unknown): boolean =>
    Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined;

/* ── the class rule ────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

/**
 * Per-status requirements. `require`/`forbid` name row fields that must be
 * non-empty / empty. The precedence is deliberate: a status is a CLAIM about
 * which class is the first one missing, so `missing-adoption` asserts mechanism
 * evidence exists — otherwise the row would be `missing-mechanism` and two
 * statuses would describe the same evidence shape.
 */
export const STATUS_RULES: Record<Status, { require: string[]; forbid: string[] }> = {
    'missing-mechanism': { require: [], forbid: ['mechanism_evidence', 'standing_constraint'] },
    'missing-adoption': {
        require: ['mechanism_evidence'],
        forbid: ['adoption_evidence', 'standing_constraint'],
    },
    'missing-proof': {
        require: ['mechanism_evidence', 'adoption_evidence'],
        forbid: ['standing_constraint'],
    },
    'measured-null': {
        require: ['production_window', 'outcome_evidence'],
        forbid: ['standing_constraint'],
    },
    'max-boundary': { require: ['standing_constraint'], forbid: [] },
    ten: {
        require: [
            'mechanism_evidence',
            'adoption_evidence',
            'negative_control_evidence',
            'production_window',
            'outcome_evidence',
            'non_regression_evidence',
        ],
        forbid: ['standing_constraint'],
    },
};

export function checkRow(row: Row, where: string): Finding[] {
    const out: Finding[] = [];
    const push = (code: string, detail: string): void => void out.push({ where, code, detail });

    for (const f of ROW_FIELDS) {
        if (!(f in row)) push('missing_field', `row has no \`${f}\``);
    }
    const status = row['status'];
    if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) {
        push('bad_status', `\`${String(status)}\` is not one of ${STATUSES.join(' | ')}`);
        return out; // every later rule keys on the status
    }

    // 3. every non-empty URI resolves, at every status
    for (const key of EVIDENCE_ARRAYS) {
        const arr = row[key];
        if (arr === undefined || arr === null) continue;
        if (!Array.isArray(arr)) {
            push('bad_shape', `\`${key}\` must be a list`);
            continue;
        }
        for (const uri of arr) {
            if (typeof uri !== 'string') {
                push('bad_shape', `\`${key}\` holds a non-string entry`);
                continue;
            }
            const why = resolveUri(uri);
            if (why !== null) push('unresolvable_evidence', `${key}: ${why}`);
            if (uri.trim().startsWith('fixture:') && (FIXTURE_FORBIDDEN as readonly string[]).includes(key)) {
                push('fixture_in_production_class', `${key} may not be satisfied by a fixture: ${uri}`);
            }
        }
    }
    const window_ = row['production_window'];
    if (typeof window_ === 'string' && window_.trim() !== '') {
        const why = resolveUri(window_);
        if (why !== null) push('unresolvable_evidence', `production_window: ${why}`);
        if (window_.trim().startsWith('fixture:')) {
            push('fixture_in_production_class', `production_window may not be a fixture: ${window_}`);
        }
    }

    // 4. the class rule
    const rule = STATUS_RULES[status as Status];
    for (const f of rule.require) {
        if (!nonEmpty(row[f])) push('class_rule', `status \`${status}\` requires a non-empty \`${f}\``);
    }
    for (const f of rule.forbid) {
        if (nonEmpty(row[f])) push('class_rule', `status \`${status}\` forbids a non-empty \`${f}\``);
    }
    return out;
}

/* ── manifest honesty ──────────────────────────────────────────────────────── */

export function checkRubric(rubric: Row, rowCount: number, ids: string[]): Finding[] {
    const out: Finding[] = [];
    const where = 'rubric';
    const push = (code: string, detail: string): void => void out.push({ where, code, detail });

    const num = (k: string): number | null => (typeof rubric[k] === 'number' ? (rubric[k] as number) : null);
    const reported = num('reported_category_count');
    const recovered = num('recovered_category_count');
    const missing = num('missing_category_count');
    const state = rubric['state'];
    const authority = rubric['authority'];

    if (reported === null || recovered === null || missing === null) {
        push('missing_field', 'rubric needs numeric reported/recovered/missing counts');
    } else if (recovered + missing !== reported) {
        push('bad_arithmetic', `${recovered} recovered + ${missing} missing != ${reported} reported`);
    }
    if (recovered !== null && rowCount !== recovered) {
        push('row_count_mismatch', `${rowCount} rows present, rubric declares ${recovered} recovered`);
    }
    // The one that matters: incompleteness must not be silently redeclared away.
    if (state === 'complete' && authority === 'unavailable-external-review') {
        push(
            'false_completeness',
            'state `complete` is refused while authority is `unavailable-external-review` — ' +
                'an authoritative manifest must be present first',
        );
    }
    if (state !== 'complete' && state !== 'incomplete') {
        push('bad_state', `state must be \`complete\` or \`incomplete\`, got \`${String(state)}\``);
    }
    const excluded = Array.isArray(rubric['excluded_from_manifest']) ? (rubric['excluded_from_manifest'] as unknown[]) : [];
    for (const id of ids) {
        if (excluded.includes(id)) push('excluded_row_present', `\`${id}\` is both a row and excluded_from_manifest`);
    }
    const seen = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) push('duplicate_category', `\`${id}\` appears more than once`);
        seen.add(id);
    }
    return out;
}

/* ── driver ────────────────────────────────────────────────────────────────── */

export function check(rel: string, ledger?: GateLedger): Finding[] {
    // An absolute `--file` must be honoured as given. path.join(REPO, '/abs')
    // silently produces REPO + '/abs', which reports `missing_file` for a file
    // that exists — the shape a test using a temp copy hits first.
    const abs = path.isAbsolute(rel) ? rel : path.join(REPO, rel);
    if (!fs.existsSync(abs)) {
        ledger?.plan([rel]);
        ledger?.fail(rel, 'scorecard does not exist');
        return [{ where: rel, code: 'missing_file', detail: 'scorecard does not exist' }];
    }
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(abs, 'utf8'));
    } catch (exc) {
        ledger?.plan([rel]);
        ledger?.fail(rel, 'unparseable YAML');
        return [{ where: rel, code: 'unparseable', detail: String(exc) }];
    }
    if (doc === null || typeof doc !== 'object') {
        ledger?.plan([rel]);
        ledger?.fail(rel, 'top level is not a mapping');
        return [{ where: rel, code: 'unparseable', detail: 'top level is not a mapping' }];
    }
    const top = doc as Row;
    const rubric = top['rubric'];
    const cats = top['categories'];
    if (rubric === undefined || typeof rubric !== 'object' || rubric === null) {
        ledger?.plan([rel]);
        ledger?.fail(rel, 'no `rubric:` block');
        return [{ where: rel, code: 'missing_field', detail: 'no `rubric:` block' }];
    }
    if (!Array.isArray(cats)) {
        ledger?.plan([rel]);
        ledger?.fail(rel, '`categories:` must be a list');
        return [{ where: rel, code: 'missing_field', detail: '`categories:` must be a list' }];
    }
    const rows = cats as Row[];
    const ids = rows.map((r) => String(r['category'] ?? '<unnamed>'));
    // Per-row accounting. Every early return above aborts BEFORE any row is
    // read, and until this ledger existed those aborts produced a one-line
    // finding indistinguishable, in the coverage record, from a full pass over
    // 23 rows. The ledger separates "checked every row and found one problem"
    // from "never reached a row".
    ledger?.plan(ids.map((id, i) => `${id}#${String(i)}`));
    const findings = [...checkRubric(rubric as Row, rows.length, ids)];
    rows.forEach((r, i) => {
        const target = `${ids[i] ?? '<unnamed>'}#${String(i)}`;
        const rowFindings = checkRow(r, `${rel} → ${ids[i] ?? `row ${i}`}`);
        findings.push(...rowFindings);
        if (rowFindings.length > 0) ledger?.fail(target, `${String(rowFindings.length)} finding(s)`);
        else ledger?.complete(target);
    });
    return findings;
}

/**
 * Prove, through the real binary, that the rejections still fire.
 *
 * Unit tests here call `check()` in-process. That cannot catch the failure this
 * repository has actually had: a CLI whose argv parsing or entry guard silently
 * no-ops while the imported function still works. So every case below shells out
 * to this file's own CLI.
 *
 * The committed twins ARE the fixtures — six of the eight cases point at them
 * rather than re-authoring the same defects inline, so a twin that drifts breaks
 * the self-test too instead of only the unit suite.
 */
export function selfTest(): number {
    const made: string[] = [];
    const runFile = (rel: string): number => runGateCli(REPO, SELF, ['--quiet', '--file', rel], REPO);
    const runText = (text: string): number => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'score-selftest-'));
        made.push(d);
        const f = path.join(d, 'scorecard.yaml');
        fs.writeFileSync(f, text, 'utf8');
        return runFile(f);
    };

    const twin = (name: string): number => runFile(path.join(TWIN_DIR, `${name}.yaml`));

    const cases: SelfTestCase[] = [
        { name: 'accepts the real seeded scorecard', expect: 'accept', run: () => runFile(DEFAULT_REL) },
        { name: 'rejects a `ten` with an empty required class', expect: 'reject', run: () => twin('a-ten-with-empty-class') },
        { name: 'rejects a stale pin', expect: 'reject', run: () => twin('b-stale-pin') },
        { name: 'rejects a fixture as the production window', expect: 'reject', run: () => twin('c-fixture-as-production') },
        { name: 'rejects an unresolvable evidence path', expect: 'reject', run: () => twin('d-unresolvable-path') },
        { name: 'rejects incompleteness redeclared as complete', expect: 'reject', run: () => twin('e-false-completeness') },
        { name: 'rejects max-boundary naming no standing constraint', expect: 'reject', run: () => twin('f-max-boundary-no-constraint') },
        {
            // The dead-scan-root case: a moved scorecard must exit 2, never green.
            // This is the shape gate-coverage.yml exists to catch, and the one a
            // twin cannot express.
            name: 'rejects a missing scorecard rather than reporting clean',
            expect: 'reject',
            run: () => runFile(path.join('agents', 'evidence', 'no-such-scorecard.yaml')),
        },
        {
            name: 'accepts a minimal hand-built scorecard with one seeded row',
            expect: 'accept',
            run: () =>
                runText(
                    'schema_version: 1\nrubric:\n  state: incomplete\n' +
                        '  authority: unavailable-external-review\n  reported_category_count: 32\n' +
                        '  recovered_category_count: 1\n  missing_category_count: 31\n' +
                        '  manifest_version: baseline_v1\n  recovery_source: agents/roadmaps/road-to-ten-across-the-board.md\n' +
                        '  excluded_from_manifest: []\ncategories:\n  - category: security\n' +
                        '    baseline: 9.6\n    claim: "x"\n    closing_path: "x"\n' +
                        '    mechanism_evidence: []\n    adoption_evidence: []\n' +
                        '    negative_control_evidence: []\n    production_window: null\n' +
                        '    outcome_evidence: []\n    non_regression_evidence: []\n' +
                        '    status: missing-mechanism\n',
                ),
        },
    ];
    try {
        return runSelfTest({
            gate: 'check_score_contract',
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        for (const d of made) fs.rmSync(d, { recursive: true, force: true });
    }
}

/** Rows the gate actually inspected — 0 when the file is missing or unparseable. */
export function countRows(rel: string): number {
    const abs = path.isAbsolute(rel) ? rel : path.join(REPO, rel);
    try {
        const doc = parseYaml(fs.readFileSync(abs, 'utf8')) as Row;
        const cats = doc['categories'];
        return Array.isArray(cats) ? cats.length : 0;
    } catch {
        return 0;
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const quiet = argv.includes('--quiet');
    const fi = argv.indexOf('--file');
    const rel = fi !== -1 ? argv[fi + 1] : DEFAULT_REL;
    if (rel === undefined) {
        process.stderr.write('usage: check_score_contract [--quiet] [--file <path>]\n');
        return 2;
    }
    const ledger = new GateLedger('check_score_contract');
    const findings = check(rel, ledger);
    ledger.report(quiet ? () => undefined : undefined);
    // Rule 1 of the gate-coverage contract: exactly one `scanned: <N>` line,
    // emitted on the red path too — a gate that only reports coverage when it
    // passes cannot be caught going blind at the moment it matters.
    process.stdout.write(`scanned: ${countRows(rel)}\n`);
    if (findings.length > 0) {
        process.stderr.write(`\n❌  ${findings.length} score-contract finding(s):\n\n`);
        for (const f of findings) {
            process.stderr.write(`  🔴 ${f.where} — [${f.code}] ${f.detail}\n`);
        }
        return 2;
    }
    if (!quiet) {
        // A gate that scans nothing and exits green is indistinguishable from a
        // broken one, so the green path prints what it actually examined.
        const shown = path.isAbsolute(rel) ? rel : path.join(REPO, rel);
        const doc = parseYaml(fs.readFileSync(shown, 'utf8')) as Row;
        const rubric = doc['rubric'] as Row;
        const rows = doc['categories'] as Row[];
        const byStatus = new Map<string, number>();
        for (const r of rows) byStatus.set(String(r['status']), (byStatus.get(String(r['status'])) ?? 0) + 1);
        const tally = [...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join(' · ');
        process.stdout.write(
            `✅  ${rel} — ${rows.length} row(s) · ${tally}\n` +
                `    rubric: ${String(rubric['state'])} — ${String(rubric['recovered_category_count'])} recovered, ` +
                `${String(rubric['missing_category_count'])} of ${String(rubric['reported_category_count'])} unknown ` +
                `(authority: ${String(rubric['authority'])})\n` +
                `    quality is NOT judged here: emptiness and resolvability only.\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) process.exit(exc.code);
        throw exc;
    }
}

export { REPO, DEFAULT_REL, ExitCode };
