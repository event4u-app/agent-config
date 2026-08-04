/**
 * Finding-disposition gate (release-truth Phase 3).
 *
 * The recorded failure: the 9.14.0 release-PR self-review reported a critical
 * symlink-traversal finding; the PR merged, the release head said "Security
 * and correctness: none", and whether the finding was fixed or adjudicated
 * false-positive was not reconstructable from the record.
 *
 * The record is a COMMITTED ledger — `agents/evidence/release-findings/
 * <version>.json` — never the PR comment (council 2026-08-03: a comment is
 * mutable and unaudited; it is transport, not a record). Every blocking/high
 * finding in the ledger must carry a complete disposition
 * `{status: fixed|false_positive|accepted_risk, commit (when fixed),
 * rationale, verified_by}`; the release workflow is red while one does not.
 *
 * Modes:
 *   --release X.Y.Z [--dir <ledger dir>]      validate the committed ledger
 *   --pr <n>                                  additionally treat the gate's PR
 *       comment (machine block) as a TRIGGER: every blocking finding the
 *       comment reports must exist in the ledger — an un-ingested blocking
 *       finding is red. Deleting the comment can evade the trigger, but the
 *       committed ledger stays the durable record either way.
 *   --ingest <findings.json> --release X.Y.Z  merge findings (from
 *       self_review_gate --findings-out) into the ledger with an empty
 *       disposition, so validation is red until a human fills it.
 *
 * Exit codes: 0 complete · 1 missing/incomplete dispositions · 2 usage or
 * schema error. Deliberately NOT fail-open: this script never calls a model;
 * a broken ledger file is a hard error, not a neutral skip.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const LEDGER_DIR = 'agents/evidence/release-findings';
export const DISPOSITION_STATUSES = ['fixed', 'false_positive', 'accepted_risk'] as const;
export type DispositionStatus = (typeof DISPOSITION_STATUSES)[number];

export interface LedgerFinding {
    finding_id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    kind: 'security' | 'claim' | 'correctness' | 'style';
    title: string;
    file?: string | null;
    status?: string;
    commit?: string;
    rationale?: string;
    verified_by?: string;
    date?: string;
}

export interface Ledger {
    schema_version: number;
    release: string;
    findings: LedgerFinding[];
}

/** Mirrors self_review_gate.classifyBlocking — security/claim × critical/high. */
export function isBlocking(f: Pick<LedgerFinding, 'kind' | 'severity'>): boolean {
    return (
        (f.kind === 'security' || f.kind === 'claim') &&
        (f.severity === 'critical' || f.severity === 'high')
    );
}

/**
 * Pure core: every blocking finding must carry a complete disposition.
 * Returns one problem string per violation; empty array = gate green.
 * Empty rationale / verified_by is a hygiene violation (waiver precedent:
 * "empty string = hygiene violation"); status `fixed` requires a commit.
 */
export function missing_dispositions(findings: readonly LedgerFinding[]): string[] {
    const problems: string[] = [];
    for (const f of findings) {
        if (!isBlocking(f)) {
            continue;
        }
        const label = `${f.finding_id} (${f.severity} ${f.kind}: ${f.title})`;
        const status = (f.status ?? '').trim();
        if (!status) {
            problems.push(`${label}: no disposition status`);
            continue;
        }
        if (!(DISPOSITION_STATUSES as readonly string[]).includes(status)) {
            problems.push(`${label}: unknown status ${JSON.stringify(status)}`);
            continue;
        }
        if (!(f.rationale ?? '').trim()) {
            problems.push(`${label}: empty rationale`);
        }
        if (!(f.verified_by ?? '').trim()) {
            problems.push(`${label}: empty verified_by`);
        }
        if (status === 'fixed' && !(f.commit ?? '').trim()) {
            problems.push(`${label}: status "fixed" without a commit`);
        }
    }
    return problems;
}

/** Findings the gate comment reported but the ledger never ingested. */
export function unrecorded_findings(
    reported: ReadonlyArray<Pick<LedgerFinding, 'finding_id' | 'severity' | 'kind' | 'title'>>,
    ledger: readonly LedgerFinding[],
): string[] {
    const known = new Set(ledger.map((f) => f.finding_id));
    return reported
        .filter((f) => isBlocking(f) && !known.has(f.finding_id))
        .map((f) => `${f.finding_id} (${f.severity} ${f.kind}: ${f.title}) reported by the self-review but not in the ledger`);
}

export function parse_ledger(raw: string, source: string): Ledger {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        throw new Error(`${source}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
    }
    const obj = data as Partial<Ledger>;
    if (obj.schema_version !== 1 || typeof obj.release !== 'string' || !Array.isArray(obj.findings)) {
        throw new Error(`${source}: expected {schema_version: 1, release, findings[]}`);
    }
    for (const f of obj.findings) {
        if (!f || typeof f.finding_id !== 'string' || !f.finding_id.trim()) {
            throw new Error(`${source}: finding without a finding_id`);
        }
    }
    return obj as Ledger;
}

const _MACHINE_BLOCK_RE = /<!-- release-findings-json: (\[.*?\]) -->/su;

/** Extract reported findings from the gate's PR comments (latest block wins). */
export function parse_comment_findings(commentBodies: readonly string[]): LedgerFinding[] {
    for (let i = commentBodies.length - 1; i >= 0; i--) {
        const m = _MACHINE_BLOCK_RE.exec(commentBodies[i]!);
        if (m) {
            try {
                return JSON.parse(m[1]!) as LedgerFinding[];
            } catch {
                return [];
            }
        }
    }
    return [];
}

function _ledger_path(dir: string, release: string): string {
    return path.join(dir, `${release}.json`);
}

function _gh_comment_bodies(pr: string): string[] {
    const r = spawnSync(
        'gh',
        ['pr', 'view', pr, '--json', 'comments', '-q', '[.comments[].body] | @json'],
        { encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    if (r.status !== 0) {
        process.stderr.write(`gh pr view ${pr} failed: ${r.stderr}\n`);
        process.exit(2);
    }
    try {
        return JSON.parse(JSON.parse(r.stdout.trim())) as string[];
    } catch {
        return [];
    }
}

function main(argv: readonly string[]): number {
    let release: string | null = null;
    let dir = path.join(REPO_ROOT, LEDGER_DIR);
    let pr: string | null = null;
    let ingest: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--release') release = argv[++i] ?? null;
        else if (a === '--dir') dir = argv[++i] ?? dir;
        else if (a === '--pr') pr = argv[++i] ?? null;
        else if (a === '--ingest') ingest = argv[++i] ?? null;
        else {
            process.stderr.write(`unknown argument: ${a}\n`);
            return 2;
        }
    }
    if (!release) {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
        ) as Record<string, unknown>;
        release = String(pkg['version']);
    }
    const ledgerPath = _ledger_path(dir, release);

    if (ingest) {
        const incoming = parse_ledger(
            JSON.stringify({
                schema_version: 1,
                release,
                findings: (JSON.parse(fs.readFileSync(ingest, 'utf-8')) as { findings: LedgerFinding[] }).findings,
            }),
            ingest,
        );
        let ledger: Ledger = { schema_version: 1, release, findings: [] };
        if (fs.existsSync(ledgerPath)) {
            ledger = parse_ledger(fs.readFileSync(ledgerPath, 'utf-8'), ledgerPath);
        }
        const known = new Set(ledger.findings.map((f) => f.finding_id));
        let added = 0;
        for (const f of incoming.findings) {
            if (!known.has(f.finding_id)) {
                ledger.findings.push(f);
                added++;
            }
        }
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
        process.stdout.write(
            `📥  ingested ${added} new finding(s) into ${path.relative(REPO_ROOT, ledgerPath)} — ` +
                'fill dispositions before the release validation goes green\n',
        );
        return 0;
    }

    let ledger: Ledger = { schema_version: 1, release, findings: [] };
    if (fs.existsSync(ledgerPath)) {
        try {
            ledger = parse_ledger(fs.readFileSync(ledgerPath, 'utf-8'), ledgerPath);
        } catch (e) {
            process.stderr.write(`❌  ${e instanceof Error ? e.message : String(e)}\n`);
            return 2;
        }
    }

    // Scope declaration, not a scope guard. The ledger is written per release by
    // `--ingest`, so "no <release>.json" is the normal state of a release whose
    // self-review reported nothing — the gate's own success line says so. That
    // makes an absent file indistinguishable from a moved ledger dir here, and
    // the honest reading is that the corpus count cannot carry that signal: the
    // durable trigger for an un-ingested finding is `--pr` mode, which compares
    // the ledger against what the self-review actually reported.
    try {
        assertScanned({
            gate: 'check_finding_dispositions',
            scanned: ledger.findings.length,
            units: 'recorded finding(s)',
            roots: [path.relative(REPO_ROOT, ledgerPath)],
            allowEmpty:
                'EMPTY_VALID: zero recorded findings IS the pass state for a release whose '
                + 'self-review reported none — the ledger file is created on first --ingest, so a '
                + 'clean release legitimately has no <version>.json. Un-ingested findings are '
                + 'caught by --pr (unrecorded_findings), never by this count.',
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const problems = missing_dispositions(ledger.findings);
    if (pr) {
        const reported = parse_comment_findings(_gh_comment_bodies(pr));
        problems.push(...unrecorded_findings(reported, ledger.findings));
    }

    if (problems.length === 0) {
        const n = ledger.findings.length;
        process.stdout.write(
            n === 0
                ? `✅  no recorded findings for ${release} (ledger ${fs.existsSync(ledgerPath) ? 'empty' : 'absent'})\n`
                : `✅  all ${n} recorded finding(s) for ${release} dispositioned (blocking ones completely)\n`,
        );
        return 0;
    }
    process.stderr.write(`❌  undispositioned blocking finding(s) for ${release}:\n`);
    for (const p of problems) {
        process.stderr.write(`    - ${p}\n`);
    }
    process.stderr.write(
        `    Record dispositions in ${path.relative(REPO_ROOT, ledgerPath)} ` +
            '({finding_id, status: fixed|false_positive|accepted_risk, commit, rationale, verified_by}).\n' +
            '    Ingest reported findings: ./scripts-run src/scripts/check_finding_dispositions ' +
            `--ingest <findings.json> --release ${release}\n`,
    );
    return 1;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    process.exit(main(process.argv.slice(2)));
}
