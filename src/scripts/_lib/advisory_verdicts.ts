/**
 * From raw source answers to a finding a person can act on
 * (road-to-advisories-heard-the-same-day Phases 2.2–2.5 and 3).
 *
 * Deterministic and pure: no file, no network. The closed verdict vocabulary,
 * the alias merge, the tiers, the delta ledger, acceptance with expiry and the
 * noise budget all live here so each is testable over fixtures alone.
 */

import type { InventoryEntry } from './advisory_inventory.js';
import type { RawFinding, Severity, SourceReport } from './advisory_sources.js';
import { isVendorPatched } from './advisory_sources.js';

export type Verdict =
    | 'affected'
    | 'fix-available'
    | 'fix-fresh'
    | 'no-fix'
    | 'malware'
    | 'eol'
    | 'eol-soon'
    | 'pre-announced'
    | 'unknown'
    | 'accepted';

export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

export interface Finding {
    /** Stable across runs: canonical ID + package + version. */
    key: string;
    /** The canonical ID — a CVE when one is among the aliases, else the first seen. */
    id: string;
    aliases: string[];
    verdict: Verdict;
    tier: Tier;
    ecosystem: string;
    package: string;
    version: string | null;
    fixed: string | null;
    severity: Severity;
    score: number | null;
    kev: boolean;
    date: string | null;
    scope: 'runtime' | 'dev' | null;
    sources: string[];
    /** Newest source-side `modified` stamp; a change means a corrected advisory. */
    modified: string | null;
    file: string;
    line: number;
    /** Why the verdict is what it is, when it is not obvious (`vendor-patched`, `source-unavailable`). */
    note: string | null;
}

export interface Acceptance {
    id: string;
    reason: string;
    /** ISO day; past it the acceptance lapses and the finding returns. */
    expires: string;
}

const SEVERITY_RANK: Record<NonNullable<Severity>, number> = { low: 1, moderate: 2, high: 3, critical: 4 };

function stronger(a: Severity, b: Severity): Severity {
    if (a === null) return b;
    if (b === null) return a;
    return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** A CVE is the alias most people search for; prefer it as the canonical ID. */
function canonical(ids: string[]): string {
    return ids.find((i) => i.startsWith('CVE-')) ?? ids.find((i) => i.startsWith('GHSA-')) ?? ids[0]!;
}

/**
 * Merge source answers that describe the same thing: the same package version
 * and overlapping ID sets (a GHSA, its CVE and its OSV record are one finding,
 * reported once with every source that saw it — 2.4).
 */
export function mergeFindings(raw: RawFinding[]): RawFinding[][] {
    const groups: Array<{ ids: Set<string>; items: RawFinding[]; pkg: string }> = [];
    for (const f of raw) {
        const pkg = `${f.ecosystem}\0${f.package}\0${f.version ?? ''}`;
        const ids = [f.id, ...f.aliases];
        const hit = groups.find((g) => g.pkg === pkg && ids.some((i) => g.ids.has(i)));
        if (hit) {
            for (const i of ids) hit.ids.add(i);
            hit.items.push(f);
        } else {
            groups.push({ ids: new Set(ids), items: [f], pkg });
        }
    }
    return groups.map((g) => g.items);
}

/** The verdict, from the strongest fact any source asserted (2.2). */
export function verdictOf(items: RawFinding[], now: Date, acceptances: Acceptance[], ids: string[]): { verdict: Verdict; note: string | null } {
    const today = now.toISOString().slice(0, 10);
    if (acceptances.some((a) => ids.includes(a.id) && a.expires >= today)) return { verdict: 'accepted', note: null };
    if (items.some((f) => f.kind === 'malware')) return { verdict: 'malware', note: null };
    const kinds = new Set(items.map((f) => f.kind));
    if (kinds.has('pre-announced')) return { verdict: 'pre-announced', note: 'patched versions not yet named' };
    if (kinds.has('eol')) return { verdict: 'eol', note: null };
    if (kinds.has('eol-soon')) return { verdict: 'eol-soon', note: null };
    const version = items[0]!.version;
    if (version !== null && isVendorPatched(version)) {
        // A distro carries its own backports; the upstream number says nothing (2.5).
        return { verdict: 'unknown', note: 'vendor-patched — judge by the distro advisory' };
    }
    const fixed = items.map((f) => f.fixed).find((v) => v !== null) ?? null;
    if (fixed !== null) return { verdict: 'fix-available', note: null };
    if (items.every((f) => f.source === 'native-npm' || f.source === 'native-composer')) {
        // A native audit names the problem without a per-advisory fixed version.
        return { verdict: 'affected', note: null };
    }
    return { verdict: 'no-fix', note: null };
}

/**
 * Deterministic tiers (3.1). T0 interrupts, T1 is today, T2 is the digest, T3
 * is the ledger. KEV raises a tier and never lowers one.
 */
export function tierOf(f: Pick<Finding, 'verdict' | 'severity' | 'score' | 'kev' | 'scope' | 'ecosystem'>): Tier {
    const runtimeScope = f.scope !== 'dev';
    const critical = f.severity === 'critical' || (f.score !== null && f.score >= 9);
    const high = f.severity === 'high' || (f.score !== null && f.score >= 7);
    let tier: Tier;
    switch (f.verdict) {
        case 'malware':
            return 'T0';
        case 'accepted':
            return 'T3';
        case 'pre-announced':
            tier = critical && f.ecosystem === 'runtime' ? 'T0' : 'T1';
            break;
        case 'eol':
            tier = 'T1';
            break;
        case 'eol-soon':
        case 'unknown':
            tier = 'T2';
            break;
        default:
            if (critical && runtimeScope && (f.verdict === 'fix-available' || f.verdict === 'fix-fresh')) tier = 'T0';
            else if ((critical || high) && runtimeScope) tier = 'T1';
            else if (critical || high || f.severity === 'moderate') tier = 'T2';
            else tier = 'T3';
    }
    if (f.kev && runtimeScope && tier !== 'T0') tier = tier === 'T1' ? 'T0' : 'T1';
    return tier;
}

/** Raw source answers → findings, one per real thing. */
export function buildFindings(
    raw: RawFinding[],
    inventory: InventoryEntry[],
    reports: SourceReport[],
    opts: { now?: Date; acceptances?: Acceptance[] } = {},
): Finding[] {
    const now = opts.now ?? new Date();
    const out: Finding[] = [];
    for (const items of mergeFindings(raw)) {
        const ids = [...new Set(items.flatMap((f) => [f.id, ...f.aliases]))];
        const id = canonical(ids);
        const first = items[0]!;
        const scope = inventory.find((e) => e.name === first.package && e.file === first.file)?.scope ?? null;
        const { verdict, note } = verdictOf(items, now, opts.acceptances ?? [], ids);
        const base = {
            verdict,
            severity: items.map((f) => f.severity).reduce(stronger, null as Severity),
            score: items.map((f) => f.score).find((s) => s !== null) ?? null,
            kev: items.some((f) => f.kev),
            scope,
            ecosystem: first.ecosystem,
        };
        out.push({
            key: `${id}|${first.package}|${first.version ?? ''}`,
            id,
            aliases: ids.filter((i) => i !== id).sort(),
            tier: tierOf(base),
            package: first.package,
            version: first.version,
            fixed: items.map((f) => f.fixed).find((v) => v !== null) ?? null,
            date: items.map((f) => f.date).find((v) => v !== null) ?? null,
            sources: [...new Set(items.map((f) => f.source))].sort(),
            modified: items.map((f) => f.modified).filter((m): m is string => m !== null).sort().pop() ?? null,
            file: first.file,
            line: first.line,
            note,
            ...base,
        });
    }
    // Silence is a verdict, never an empty list (F6): every source that did not
    // answer becomes one `unknown` finding naming it.
    for (const r of reports) {
        if (r.status === 'ok') continue;
        if (r.reason === 'private-names-present') continue; // a deliberate skip, not silence
        out.push({
            key: `UNKNOWN-${r.source}`,
            id: `UNKNOWN-${r.source}`,
            aliases: [],
            verdict: 'unknown',
            tier: 'T2',
            ecosystem: 'runtime',
            package: r.source,
            version: null,
            fixed: null,
            severity: null,
            score: null,
            kev: false,
            date: null,
            scope: null,
            sources: [r.source],
            modified: null,
            file: '',
            line: 0,
            note: `source-${r.status}${r.reason === null ? '' : `: ${r.reason}`}`,
        });
    }
    const order: Record<Tier, number> = { T0: 0, T1: 1, T2: 2, T3: 3 };
    return out.sort((a, b) => order[a.tier] - order[b.tier] || a.key.localeCompare(b.key));
}

/**
 * A source that did not answer cannot retract what it reported last time. A
 * previous finding every one of whose sources failed this run is carried over —
 * while the same package at the same version is still installed — so a 429 or
 * a timeout never reads as "fixed". A source that answered `ok` is the only one
 * that can drop a finding.
 */
export function carryForward(findings: Finding[], previous: Finding[], reports: SourceReport[], entries: InventoryEntry[]): Finding[] {
    const failed = new Set(reports.filter((r) => r.status !== 'ok').map((r) => r.source as string));
    if (failed.size === 0) return findings;
    const have = new Set(findings.map((f) => f.key));
    const carried = previous.filter(
        (f) =>
            !f.key.startsWith('UNKNOWN-') &&
            !have.has(f.key) &&
            f.sources.length > 0 &&
            f.sources.every((s) => failed.has(s)) &&
            entries.some((e) => e.name === f.package && e.version === f.version),
    );
    return [...findings, ...carried.map((f) => ({ ...f, note: `carried — ${f.sources.join(', ')} did not answer this run` }))];
}

// ---------------------------------------------------------------------------
// The delta ledger and the noise budget
// ---------------------------------------------------------------------------

export interface LedgerEntry {
    tier: Tier;
    verdict: Verdict;
    modified: string | null;
    first_seen: string;
    announced_at: string | null;
}

export interface Ledger {
    entries: Record<string, LedgerEntry>;
    /** ISO stamps of interrupting announcements, pruned to the last seven days. */
    interrupts: string[];
    /** Recorded transitions — a corrected advisory or a verdict change (2.5). */
    transitions: Array<{ at: string; key: string; from: string; to: string }>;
}

/** At most this many interrupting notices per project per week; the rest go to the digest (0.3). */
export const INTERRUPT_BUDGET_PER_WEEK = 3;

export function emptyLedger(): Ledger {
    return { entries: {}, interrupts: [], transitions: [] };
}

const RANK: Record<Tier, number> = { T0: 0, T1: 1, T2: 2, T3: 3 };

export interface Announcement {
    interrupt: Finding[];
    digest: Finding[];
    ledger: Ledger;
}

/**
 * Only what is new, escalated or corrected is announced (3.2). T0/T1 interrupt
 * until the weekly budget is spent, then fall into the digest — a fourth T1 in
 * a week is still reported, just not as an interruption.
 */
export function announce(findings: Finding[], previous: Ledger, now: Date = new Date()): Announcement {
    const at = now.toISOString();
    const weekAgo = now.getTime() - 7 * 86400000;
    const ledger: Ledger = {
        entries: { ...previous.entries },
        interrupts: previous.interrupts.filter((t) => Date.parse(t) >= weekAgo),
        transitions: [...previous.transitions],
    };
    const interrupt: Finding[] = [];
    const digest: Finding[] = [];
    for (const f of findings) {
        const old = ledger.entries[f.key];
        const isNew = old === undefined;
        const escalated = old !== undefined && RANK[f.tier] < RANK[old.tier];
        const corrected = old !== undefined && f.modified !== null && old.modified !== null && f.modified !== old.modified;
        const verdictMoved = old !== undefined && old.verdict !== f.verdict;
        if (corrected || verdictMoved) {
            ledger.transitions.push({ at, key: f.key, from: `${old!.verdict}/${old!.tier}`, to: `${f.verdict}/${f.tier}` });
        }
        ledger.entries[f.key] = {
            tier: f.tier,
            verdict: f.verdict,
            modified: f.modified,
            first_seen: old?.first_seen ?? at,
            announced_at: old?.announced_at ?? null,
        };
        if (!(isNew || escalated || corrected || verdictMoved)) continue;
        if ((f.tier === 'T0' || f.tier === 'T1') && ledger.interrupts.length < INTERRUPT_BUDGET_PER_WEEK) {
            interrupt.push(f);
            ledger.interrupts.push(at);
        } else if (f.tier !== 'T3') {
            digest.push(f);
        }
        ledger.entries[f.key]!.announced_at = at;
    }
    return { interrupt, digest, ledger };
}

/** An acceptance needs a reason and an expiry; a grep-negative is not a reason (3.3, K4). */
export function validateAcceptance(a: Partial<Acceptance>): string | null {
    if (typeof a.id !== 'string' || a.id === '') return 'an acceptance names the finding ID';
    if (typeof a.reason !== 'string' || a.reason.trim().length < 10) return 'an acceptance carries a reason of at least a sentence';
    if (/\b(grep|not (found|used|reachable)|no (hits|matches|usage))\b/i.test(a.reason)) {
        return 'absence of a hit is not unreachability — name what makes the code path unreachable';
    }
    if (typeof a.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.expires)) return 'an acceptance carries an expiry day (YYYY-MM-DD)';
    return null;
}
