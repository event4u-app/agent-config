/**
 * The dispatch-policy table (`src/config/dispatch-policy.json`): one row per
 * dispatch default AC ships, each bound to the file that actually carries the
 * value and to the claim that backs it — or to a date by which it must be
 * measured (road-to-a-policy-the-measurements-write).
 *
 * The table is a record, not a source: the sinks stay where the host and the
 * installer read them. What this module adds is the check that the two agree,
 * and the delta a release prints.
 */
import fs from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

export const POLICY_REL = 'src/config/dispatch-policy.json';

/**
 * `yaml-file` reads a dotted key from a YAML file — the shipped settings
 * template, or the council example a consumer's config is copied from, whose
 * explicit value overrides the `council-default` fallback in code.
 */
export type SinkKind = 'subagent-frontmatter' | 'yaml-file' | 'council-default';

const SINK_KINDS: readonly SinkKind[] = ['subagent-frontmatter', 'yaml-file', 'council-default'];

export interface PolicySink {
    kind: SinkKind;
    file: string;
    key: string;
}

export interface PolicyRow {
    id: string;
    value: unknown;
    sink: PolicySink;
    /** Further files that carry the same value; each must agree with the row. */
    also?: PolicySink[];
    /** A closed claim id, or `unmeasured`. */
    claim: string;
    /** The open claim a measurement would settle. */
    measures?: string;
    review_by?: string;
    local: 'fixed' | 'learnable';
    floor?: boolean;
    forbid?: unknown[];
    note?: string;
}

export interface PolicyTable {
    rows: PolicyRow[];
}

export const UNMEASURED = 'unmeasured';

const CLOSED_STATUSES = new Set(['backed', 'resolved-null']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function loadPolicy(root: string): PolicyTable {
    return parsePolicy(fs.readFileSync(path.join(root, POLICY_REL), 'utf8'));
}

export function parsePolicy(text: string): PolicyTable {
    const raw = JSON.parse(text) as { rows?: PolicyRow[] };
    return { rows: Array.isArray(raw.rows) ? raw.rows : [] };
}

export interface ClaimRecord {
    status: string;
    review_by: string;
}

/** `id → { status, review_by }` for every `### claim:` block of a CLAIMS.md text. */
export function claimRecords(ledger: string): Map<string, ClaimRecord> {
    const out = new Map<string, ClaimRecord>();
    let cur: ClaimRecord | null = null;
    for (const line of ledger.split('\n')) {
        const head = /^###\s+claim:\s*([A-Za-z0-9._-]+)\s*$/.exec(line);
        if (head) {
            cur = { status: '', review_by: '' };
            out.set(head[1]!, cur);
            continue;
        }
        if (/^#{1,6}\s/.test(line)) {
            cur = null;
            continue;
        }
        const field = /^-\s+(status|review_by):\s*(.*)$/.exec(line);
        if (cur !== null && field && cur[field[1] as keyof ClaimRecord] === '') {
            cur[field[1] as keyof ClaimRecord] = field[2]!.trim();
        }
    }
    return out;
}

/** `id → status`, the view `checkPolicy` needs. */
export function claimStatuses(ledger: string): Map<string, string> {
    return new Map([...claimRecords(ledger)].map(([id, r]) => [id, r.status]));
}

function frontmatterOf(text: string): Record<string, unknown> {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m ? ((parseYaml(m[1]!) ?? {}) as Record<string, unknown>) : {};
}

function dig(data: unknown, dotted: string): unknown {
    let cur: unknown = data;
    for (const part of dotted.split('.')) {
        if (cur === null || typeof cur !== 'object') {
            return undefined;
        }
        cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
}

/** The value the sink carries in the tree under `root`; `undefined` when absent. */
export function readSink(root: string, sink: PolicySink): unknown {
    const file = path.join(root, sink.file);
    if (!fs.existsSync(file)) {
        return undefined;
    }
    const text = fs.readFileSync(file, 'utf8');
    switch (sink.kind) {
        case 'subagent-frontmatter':
            return frontmatterOf(text)[sink.key];
        case 'yaml-file':
            return dig(parseYaml(text), sink.key);
        case 'council-default': {
            const key = sink.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const m = new RegExp(`_get\\(d, '${key}', (-?\\d+)\\)`).exec(text);
            return m ? Number(m[1]) : undefined;
        }
        default:
            return undefined;
    }
}

export interface CheckDeps {
    readSink: (row: PolicyRow, sink: PolicySink) => unknown;
    claimStatus: (id: string) => string | undefined;
    /** The `review_by` of a claim, `''` when it has none. */
    claimReviewBy?: (id: string) => string | undefined;
}

/** Every disagreement between the table, its sinks and the claim ledger. */
export function checkPolicy(table: PolicyTable, deps: CheckDeps): string[] {
    const findings: string[] = [];
    const seen = new Set<string>();
    for (const row of table.rows) {
        const at = `dispatch-policy row \`${row.id}\``;
        if (seen.has(row.id)) {
            findings.push(`${at}: duplicate id`);
        }
        seen.add(row.id);
        const sinks = [row.sink, ...(row.also ?? [])];
        const unknown = sinks.find((s) => !SINK_KINDS.includes(s?.kind));
        if (unknown !== undefined) {
            findings.push(`${at}: unknown sink kind \`${String(unknown?.kind)}\``);
            continue;
        }
        for (const sink of sinks) {
            const actual = deps.readSink(row, sink);
            if (actual !== row.value) {
                findings.push(
                    `${at}: ${sink.file} ${sink.key} is ${JSON.stringify(actual)}, the row says ${JSON.stringify(row.value)}`,
                );
            }
            if ((row.forbid ?? []).includes(actual)) {
                findings.push(`${at}: ${JSON.stringify(actual)} is forbidden on this floor`);
            }
        }
        if (row.floor === true && row.local !== 'fixed') {
            findings.push(`${at}: a floor must be \`local: fixed\``);
        }
        if (row.claim === UNMEASURED) {
            if (typeof row.review_by !== 'string' || !ISO_DATE.test(row.review_by)) {
                findings.push(`${at}: an unmeasured row needs an ISO \`review_by\``);
            }
        } else {
            const status = deps.claimStatus(row.claim);
            if (status === undefined) {
                findings.push(`${at}: claim \`${row.claim}\` is not in docs/CLAIMS.md`);
            } else if (!CLOSED_STATUSES.has(status)) {
                findings.push(`${at}: claim \`${row.claim}\` is ${status || 'unbacked'}, not backed or resolved-null`);
            }
        }
        if (row.measures !== undefined) {
            if (deps.claimStatus(row.measures) === undefined) {
                findings.push(`${at}: measures \`${row.measures}\`, which is not in docs/CLAIMS.md`);
            } else {
                const due = deps.claimReviewBy?.(row.measures) ?? '';
                if (due !== '' && due !== row.review_by) {
                    findings.push(
                        `${at}: review_by ${String(row.review_by)} disagrees with claim \`${row.measures}\` (review_by ${due})`,
                    );
                }
            }
        }
    }
    return findings;
}

export interface PolicyChange {
    /** `constrained`: value and claim held, but `forbid`, `local` or `floor` changed. */
    kind: 'moved' | 'constrained' | 'added' | 'removed';
    id: string;
    before?: PolicyRow;
    after?: PolicyRow;
}

/**
 * What changed between two tables, by row id. `before === null` means the
 * previous release had no table, which is reported as one line rather than as
 * every row being added.
 */
export function policyDelta(before: PolicyTable | null, after: PolicyTable): PolicyChange[] {
    if (before === null) {
        return [];
    }
    const prev = new Map(before.rows.map((r) => [r.id, r]));
    const next = new Map(after.rows.map((r) => [r.id, r]));
    const out: PolicyChange[] = [];
    for (const r of after.rows) {
        const old = prev.get(r.id);
        if (old === undefined) {
            out.push({ kind: 'added', id: r.id, after: r });
        } else if (JSON.stringify(old.value) !== JSON.stringify(r.value) || old.claim !== r.claim) {
            out.push({ kind: 'moved', id: r.id, before: old, after: r });
        } else if (constraintsOf(old) !== constraintsOf(r)) {
            out.push({ kind: 'constrained', id: r.id, before: old, after: r });
        }
    }
    for (const r of before.rows) {
        if (!next.has(r.id)) {
            out.push({ kind: 'removed', id: r.id, before: r });
        }
    }
    return out;
}

/** Unmeasured rows whose `review_by` lies before `today` (both ISO dates). */
export function overdueRows(table: PolicyTable, today: string): PolicyRow[] {
    return table.rows.filter(
        (r) => r.claim === UNMEASURED && typeof r.review_by === 'string' && ISO_DATE.test(r.review_by) && r.review_by < today,
    );
}

function constraintsOf(r: PolicyRow): string {
    return JSON.stringify({ forbid: r.forbid ?? [], local: r.local, floor: r.floor === true });
}

function claimNote(r: PolicyRow): string {
    return r.claim === UNMEASURED ? 'unmeasured' : `claim \`${r.claim}\``;
}

/**
 * The changelog section a release prints: rows that moved and rows whose
 * measurement is overdue. Empty when there is nothing to say, so a release that
 * moved nothing carries no ceremony.
 */
export function renderMeasuredSection(
    delta: readonly PolicyChange[],
    overdue: readonly PolicyRow[],
    introduced: PolicyTable | null = null,
): string[] {
    const lines: string[] = [];
    if (introduced !== null) {
        lines.push(`- dispatch-policy table introduced with ${introduced.rows.length} row(s)`);
    }
    for (const d of delta) {
        if (d.kind === 'moved') {
            lines.push(
                `- \`${d.id}\`: ${JSON.stringify(d.before!.value)} → ${JSON.stringify(d.after!.value)} (${claimNote(d.after!)})`,
            );
        } else if (d.kind === 'constrained') {
            lines.push(`- \`${d.id}\` constraints changed: ${constraintsOf(d.before!)} → ${constraintsOf(d.after!)}`);
        } else if (d.kind === 'added') {
            lines.push(`- \`${d.id}\` added: ${JSON.stringify(d.after!.value)} (${claimNote(d.after!)})`);
        } else {
            lines.push(`- \`${d.id}\` removed (was ${JSON.stringify(d.before!.value)})`);
        }
    }
    if (overdue.length > 0) {
        lines.push('', '**Overdue** — unmeasured past their review date:', '');
        for (const r of overdue) {
            lines.push(`- \`${r.id}\` — unmeasured, review_by ${r.review_by}`);
        }
    }
    return lines.length === 0 ? [] : ['### Measured in this release', '', ...lines];
}
