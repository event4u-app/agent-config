/**
 * The consumer security-audit ledger — `agents/runtime/state/security/<run>/ledger.json`.
 *
 * Shape: `src/scripts/schemas/security-ledger.schema.json`. The coverage field
 * names are borrowed from `review-findings.schema.json` on purpose, but this is
 * not that schema: that one is the release-ledger gate's, and a consumer audit
 * must never become something `check_finding_dispositions` reads.
 */

export type Enumeration = 'graph' | 'convention' | 'model';
export type FindingStatus = 'confirmed' | 'needs_validation' | 'rejected';
export type Proof = 'static-trace' | 'test';

export interface LedgerRow {
    surface: string;
    endpoint: string;
    enumeration: Enumeration;
    reviewed: boolean;
    reason?: string;
}

export interface LedgerFinding {
    id: string;
    status: FindingStatus;
    title: string;
    location: string;
    finder: string;
    verifier: string;
    review_independence?: 'single-member';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    proof?: Proof;
    proof_test?: string;
    open_fact?: string;
    reason?: string;
}

export interface SecurityLedger {
    schema_version: 1;
    run: string;
    at: string;
    rows: LedgerRow[];
    findings: LedgerFinding[];
}

const ENUMERATIONS: readonly string[] = ['graph', 'convention', 'model'];
const STATUSES: readonly string[] = ['confirmed', 'needs_validation', 'rejected'];
const PROOFS: readonly string[] = ['static-trace', 'test'];
const SEVERITIES: readonly string[] = ['low', 'medium', 'high', 'critical'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Every problem with the ledger; an empty list means it is valid. */
export function validateLedger(value: unknown): string[] {
    const out: string[] = [];
    if (!isObj(value)) return ['ledger is not an object'];
    if (value['schema_version'] !== 1) out.push('schema_version must be 1');
    if (!str(value['run'])) out.push('run is required');
    if (!str(value['at'])) out.push('at is required');
    const rows = value['rows'];
    const findings = value['findings'];
    if (!Array.isArray(rows)) out.push('rows must be an array');
    if (!Array.isArray(findings)) out.push('findings must be an array');
    if (out.length > 0) return out;

    (rows as unknown[]).forEach((r, i) => {
        if (!isObj(r) || !str(r['surface']) || !str(r['endpoint'])) {
            out.push(`rows[${i}]: surface and endpoint are required`);
            return;
        }
        if (!ENUMERATIONS.includes(String(r['enumeration']))) out.push(`rows[${i}]: enumeration must be graph|convention|model`);
        if (typeof r['reviewed'] !== 'boolean') out.push(`rows[${i}]: reviewed must be a boolean`);
        if (r['reviewed'] === false && !str(r['reason'])) out.push(`rows[${i}]: an unreviewed row names its reason`);
    });

    (findings as unknown[]).forEach((f, i) => {
        if (!isObj(f)) {
            out.push(`findings[${i}]: not an object`);
            return;
        }
        const at = `findings[${i}] ${String(f['id'] ?? '?')}`;
        for (const k of ['id', 'title', 'location', 'finder', 'verifier']) {
            if (!str(f[k])) out.push(`${at}: ${k} is required`);
        }
        const status = String(f['status']);
        if (!STATUSES.includes(status)) {
            out.push(`${at}: status must be confirmed|needs_validation|rejected`);
            return;
        }
        const seat = (v: unknown): string => String(v ?? '').trim().toLowerCase();
        if (seat(f['finder']) === seat(f['verifier']) && f['review_independence'] !== 'single-member') {
            out.push(`${at}: finder and verifier are the same — record review_independence: single-member`);
        }
        if (status === 'needs_validation') {
            if (f['severity'] !== undefined) out.push(`${at}: needs_validation carries no severity`);
            if (!str(f['open_fact'])) out.push(`${at}: needs_validation names the open fact`);
        }
        if (status === 'confirmed') {
            if (!SEVERITIES.includes(String(f['severity']))) out.push(`${at}: confirmed needs a severity`);
            if (!PROOFS.includes(String(f['proof']))) out.push(`${at}: confirmed needs proof static-trace|test`);
            if (f['proof'] === 'test' && !str(f['proof_test'])) out.push(`${at}: proof test needs its path`);
        }
        if (status === 'rejected' && !str(f['reason'])) out.push(`${at}: rejected names its reason`);
    });
    return out;
}

/** Coverage over deterministic rows only: a model-found surface is reported, never counted. */
export function coverage(ledger: SecurityLedger): { reviewed: number; total: number; percent: number } {
    const counted = ledger.rows.filter((r) => r.enumeration !== 'model');
    const reviewed = counted.filter((r) => r.reviewed).length;
    return { reviewed, total: counted.length, percent: counted.length === 0 ? 0 : Math.round((reviewed / counted.length) * 100) };
}

/** The report, derived from the record — open findings, then coverage, then rejected. */
export function renderLedger(ledger: SecurityLedger | null): string {
    if (ledger === null) return 'Security: not checked — no `/audit code` ledger in agents/runtime/state/security/.\n';
    const open = ledger.findings.filter((f) => f.status !== 'rejected');
    const confirmed = open.filter((f) => f.status === 'confirmed');
    const cov = coverage(ledger);
    const covText = cov.total === 0 ? 'coverage: not enumerated' : `coverage ${cov.percent} % (${cov.reviewed}/${cov.total} enumerated rows)`;
    const lines: string[] = [
        `Security ledger ${ledger.run} (${ledger.at})`,
        `open: ${confirmed.length} confirmed · ${open.length - confirmed.length} needs_validation · ${covText}`,
        '',
        '## Open findings',
    ];
    if (open.length === 0) {
        lines.push(cov.total === 0 ? 'none open — and nothing was enumerated, so this is not a clean result' : `none open — at ${cov.percent} % coverage; see Unreviewed below`);
    }
    for (const f of open) {
        lines.push(
            f.status === 'confirmed'
                ? `- [${f.severity}] ${f.id} ${f.title} — ${f.location} · proof ${f.proof}${f.proof_test ? ` ${f.proof_test}` : ''}`
                : `- [needs_validation] ${f.id} ${f.title} — ${f.location} · open fact: ${f.open_fact}`,
        );
    }
    lines.push('', '## Unreviewed');
    const unreviewed = ledger.rows.filter((r) => !r.reviewed || r.enumeration === 'model');
    if (unreviewed.length === 0) lines.push('none');
    for (const r of unreviewed) {
        lines.push(`- ${r.surface} · ${r.endpoint} — ${r.enumeration === 'model' ? 'model-found, not counted' : r.reason}`);
    }
    lines.push('', '## Rejected candidates');
    const rejected = ledger.findings.filter((f) => f.status === 'rejected');
    if (rejected.length === 0) lines.push('none');
    for (const f of rejected) lines.push(`- ${f.id} ${f.title} — ${f.reason}`);
    return `${lines.join('\n')}\n`;
}
