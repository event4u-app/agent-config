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

export type SinkKind = 'subagent-frontmatter' | 'settings-template' | 'council-default';

const SINK_KINDS: readonly SinkKind[] = ['subagent-frontmatter', 'settings-template', 'council-default'];

export interface PolicySink {
    kind: SinkKind;
    file: string;
    key: string;
}

export interface PolicyRow {
    id: string;
    value: unknown;
    sink: PolicySink;
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

/** `id → status` for every `### claim:` block of a CLAIMS.md text. */
export function claimStatuses(ledger: string): Map<string, string> {
    const out = new Map<string, string>();
    let id: string | null = null;
    for (const line of ledger.split('\n')) {
        const head = /^###\s+claim:\s*([A-Za-z0-9._-]+)\s*$/.exec(line);
        if (head) {
            id = head[1]!;
            out.set(id, '');
            continue;
        }
        const status = /^-\s+status:\s*(.*)$/.exec(line);
        if (id !== null && status && out.get(id) === '') {
            out.set(id, status[1]!.trim());
        }
    }
    return out;
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
        case 'settings-template':
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
    readSink: (row: PolicyRow) => unknown;
    claimStatus: (id: string) => string | undefined;
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
        if (!SINK_KINDS.includes(row.sink?.kind)) {
            findings.push(`${at}: unknown sink kind \`${String(row.sink?.kind)}\``);
            continue;
        }
        const actual = deps.readSink(row);
        if (actual !== row.value) {
            findings.push(
                `${at}: ${row.sink.file} ${row.sink.key} is ${JSON.stringify(actual)}, the row says ${JSON.stringify(row.value)}`,
            );
        }
        if ((row.forbid ?? []).includes(actual)) {
            findings.push(`${at}: ${JSON.stringify(actual)} is forbidden on this floor`);
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
        if (row.measures !== undefined && deps.claimStatus(row.measures) === undefined) {
            findings.push(`${at}: measures \`${row.measures}\`, which is not in docs/CLAIMS.md`);
        }
    }
    return findings;
}
