/**
 * reconstruction_ledger.ts — the closing check of an `adapt` or `rebuild`
 * transfer (docs/contracts/reconstruction-obligations.md).
 *
 * Pure: takes obligation rows, returns a verdict. A row counts as verified only
 * when every required case carries evidence and its verifier is not analyst
 * inference; `visible-only` never counts, because a screen proves the screen,
 * not the behavior behind it. No rows is `unknown`, never `closed`.
 *
 * The ledger can say no: an evidence id the run never recorded, an authority
 * outside the enum, or a `verified` row whose verifier is blank makes the row —
 * and so the ledger — `invalid`. That is why the recorded evidence ids are a
 * required argument: without them any string would close a row. The ids come
 * from the same file the run writes, so this catches dangling or unknown ids,
 * not evidence that was never produced: it does not look outside that file.
 */
import { EVIDENCE_AUTHORITIES, type EvidenceAuthority } from '../analysis_ledger.js';

export const EQUIVALENCE_TIERS = ['inspired-by', 'ux', 'behavior', 'protocol', 'byte'] as const;
export type EquivalenceTier = (typeof EQUIVALENCE_TIERS)[number];

export const OBLIGATION_STATUSES = ['open', 'visible-only', 'verified', 'waived'] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export interface Obligation {
    id: string;
    behavior: string;
    tier: EquivalenceTier;
    required_cases: string[];
    /** Per required case, the evidence ids that show it in the destination. */
    evidence: Record<string, string[]>;
    verifier: string;
    verifier_authority: EvidenceAuthority;
    status: ObligationStatus;
    waiver_reason?: string;
}

export interface LedgerVerdict {
    state: 'unknown' | 'open' | 'closed' | 'invalid';
    verified: number;
    /** Rows in the parity denominator: every row except `waived`. */
    counted: number;
    parity: number | null;
    errors: string[];
}

function missingCases(o: Obligation): string[] {
    return o.required_cases.filter((c) => (o.evidence[c] ?? []).length === 0);
}

export function canVerify(o: Obligation): boolean {
    return o.required_cases.length > 0 && missingCases(o).length === 0 && o.verifier_authority !== 'analyst-inference';
}

/** A verifier written as `provider:<server>` is an observation provider (contract § Observation providers). */
export const PROVIDER_VERIFIER_PREFIX = 'provider:';
/** Byte equality needs a byte comparison and `inspired-by` promises nothing observable. */
export const PROVIDER_VERIFIABLE_TIERS: readonly EquivalenceTier[] = ['ux', 'behavior', 'protocol'];

export const OBSERVATION_KINDS = ['runtime', 'browser', 'binary', 'device'] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

/** One entry of `reconstruction.observation_providers`. */
export interface ObservationProvider {
    server: string;
    kinds: ObservationKind[];
}

/** Read the slot as written; a malformed entry is an error, never a silently dropped provider. */
export function parseObservationProviders(raw: unknown): { providers: ObservationProvider[]; errors: string[] } {
    if (raw === undefined || raw === null) return { providers: [], errors: [] };
    if (!Array.isArray(raw)) return { providers: [], errors: ['reconstruction.observation_providers must be a list'] };
    const providers: ObservationProvider[] = [];
    const errors: string[] = [];
    raw.forEach((entry, i) => {
        const e = entry as { server?: unknown; kinds?: unknown } | null;
        const server = e !== null && typeof e === 'object' && typeof e.server === 'string' ? e.server.trim() : '';
        const kinds = e !== null && typeof e === 'object' && Array.isArray(e.kinds) ? e.kinds : [];
        if (server === '') errors.push(`provider ${i}: \`server\` must be a non-empty MCP server name`);
        else if (!/^[A-Za-z0-9._-]+$/.test(server)) errors.push(`provider ${i}: \`server\` ${server} must be a bare MCP server name`);
        else if (providers.some((p) => p.server === server)) errors.push(`provider ${i}: \`server\` ${server} is listed twice`);
        const bad = kinds.filter((k) => !(OBSERVATION_KINDS as readonly unknown[]).includes(k));
        if (kinds.length === 0) errors.push(`provider ${i}: \`kinds\` must name at least one of ${OBSERVATION_KINDS.join(', ')}`);
        if (bad.length > 0) errors.push(`provider ${i}: unknown kind ${bad.map(String).join(', ')}`);
        if (/^[A-Za-z0-9._-]+$/.test(server) && !providers.some((p) => p.server === server) && kinds.length > 0 && bad.length === 0) providers.push({ server, kinds: kinds as ObservationKind[] });
    });
    return { providers, errors };
}

export function isProviderVerifier(verifier: string | undefined): boolean {
    return (verifier ?? '').startsWith(PROVIDER_VERIFIER_PREFIX);
}

export function validateObligation(o: Obligation): string[] {
    const errors: string[] = [];
    if (!EQUIVALENCE_TIERS.includes(o.tier)) errors.push(`${o.id}: unknown equivalence tier ${String(o.tier)}`);
    if (!OBLIGATION_STATUSES.includes(o.status)) errors.push(`${o.id}: unknown status ${String(o.status)}`);
    if (o.status === 'verified' && isProviderVerifier(o.verifier) && !PROVIDER_VERIFIABLE_TIERS.includes(o.tier)) {
        errors.push(`${o.id}: an observation provider cannot verify tier ${String(o.tier)}`);
    }
    if (o.status === 'verified') {
        if (o.required_cases.length === 0) errors.push(`${o.id}: verified without any required case`);
        const missing = missingCases(o);
        if (missing.length > 0) errors.push(`${o.id}: verified without evidence for ${missing.join(', ')}`);
        if (o.verifier_authority === 'analyst-inference') errors.push(`${o.id}: verified on analyst-inference alone`);
    }
    if (o.status === 'waived' && (o.waiver_reason ?? '').trim() === '') errors.push(`${o.id}: waived without a waiver_reason`);
    return errors;
}

function isStringList(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Shape errors for a row read from an untrusted file. The verdict functions
 * assume a well-formed `Obligation`; a row missing `evidence` or
 * `required_cases` would otherwise crash them instead of reading `invalid`.
 */
export function shapeErrors(row: unknown, index: number): string[] {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return [`row ${index}: not an object`];
    const r = row as Record<string, unknown>;
    const id = typeof r['id'] === 'string' && r['id'] !== '' ? r['id'] : `row ${index}`;
    const errors: string[] = [];
    if (typeof r['id'] !== 'string' || r['id'] === '') errors.push(`${id}: \`id\` must be a non-empty string`);
    if (!isStringList(r['required_cases'])) errors.push(`${id}: \`required_cases\` must be a list of strings`);
    const ev = r['evidence'];
    if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
        errors.push(`${id}: \`evidence\` must be an object of case → evidence ids`);
    } else if (!Object.values(ev).every(isStringList)) {
        errors.push(`${id}: every \`evidence\` entry must be a list of strings`);
    }
    for (const key of ['tier', 'status', 'verifier_authority'] as const) {
        if (typeof r[key] !== 'string') errors.push(`${id}: \`${key}\` must be a string`);
    }
    if (r['verifier'] !== undefined && typeof r['verifier'] !== 'string') errors.push(`${id}: \`verifier\` must be a string`);
    return errors;
}

/** What the run recorded, so a row's evidence ids can be resolved. */
export interface LedgerContext {
    evidenceIds: ReadonlySet<string>;
    /** Servers the observation-provider slot names; a `provider:` verifier outside it is refused. */
    providers?: ReadonlySet<string>;
}

/** Errors only the run's own records can see: ids that resolve, an authority in the enum, a named verifier. */
export function resolveObligation(o: Obligation, ctx: LedgerContext): string[] {
    const errors: string[] = [];
    const unknown = [...new Set(Object.values(o.evidence).flat())].filter((id) => !ctx.evidenceIds.has(id));
    if (unknown.length > 0) errors.push(`${o.id}: unknown evidence id ${unknown.join(', ')}`);
    if (!(EVIDENCE_AUTHORITIES as readonly string[]).includes(o.verifier_authority)) {
        errors.push(`${o.id}: unknown verifier_authority ${String(o.verifier_authority)}`);
    }
    if (o.status === 'verified' && (o.verifier ?? '').trim() === '') errors.push(`${o.id}: verified with an empty verifier`);
    if (o.status === 'verified' && isProviderVerifier(o.verifier)) {
        const server = (o.verifier ?? '').slice(PROVIDER_VERIFIER_PREFIX.length).trim();
        if (server === '') errors.push(`${o.id}: provider verifier names no server`);
        else if (ctx.providers !== undefined && !ctx.providers.has(server)) {
            errors.push(`${o.id}: provider ${server} is not in reconstruction.observation_providers`);
        }
    }
    return errors;
}

export function evaluateLedger(rows: readonly Obligation[], ctx: LedgerContext): LedgerVerdict {
    if (rows.length === 0) return { state: 'unknown', verified: 0, counted: 0, parity: null, errors: [] };
    const perRow = rows.map((o) => [...validateObligation(o), ...resolveObligation(o, ctx)]);
    const errors = perRow.flat();
    const verified = rows.filter((o, i) => o.status === 'verified' && canVerify(o) && (perRow[i] as string[]).length === 0).length;
    const counted = rows.filter((o) => o.status !== 'waived').length;
    const parity = counted === 0 ? null : verified / counted;
    let state: LedgerVerdict['state'];
    if (errors.length > 0) state = 'invalid';
    else if (rows.some((o) => o.status === 'open' || o.status === 'visible-only')) state = 'open';
    else state = 'closed';
    return { state, verified, counted, parity, errors };
}
