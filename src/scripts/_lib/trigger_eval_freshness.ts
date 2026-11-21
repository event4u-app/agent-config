/**
 * Trigger-eval freshness ledger — live measurements as freshness evidence.
 *
 * `check_trigger_evals` asks every `triggers.json` for a measurement no older
 * than 90 days. The weekly rotation (`trigger_eval_rotation.ts`) measures every
 * suite live once per 12-week cycle, but it runs in CI and cannot edit the
 * corpus files. This ledger closes that loop: `import_trigger_eval_rotation`
 * records each suite that PASSED its floors in a rotation run, and the gate
 * accepts that record as the suite's freshness date.
 *
 * A record is bound to the exact corpus it measured (`blob`, the git blob id of
 * `triggers.json` at the measured commit). An edited corpus no longer matches,
 * so a measurement can never vouch for cases it did not run. It lives outside
 * the corpus file so recording a measurement is not an edit of the corpus.
 *
 * Imports node builtins only: `check_trigger_evals` tests copy this file into a
 * fixture tree beside the gate.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const FRESHNESS_LEDGER_REL = 'agents/evidence/metrics/trigger-eval-freshness.json';
export const FRESHNESS_LEDGER_SCHEMA = 1;

export interface FreshnessRecord {
    /** UTC date (`YYYY-MM-DD`) of the passing live run. */
    date: string;
    /** Git blob id of the measured `triggers.json`. */
    blob: string;
    /** GitHub Actions run that produced the measurement. */
    run_id: string;
    model: string;
    precision: number;
    recall: number;
}

export interface FreshnessLedger {
    schema: number;
    suites: Record<string, FreshnessRecord>;
}

/** Git's blob id for `content` (`git hash-object`), computed without git. */
export function git_blob_sha(content: Buffer): string {
    return createHash('sha1')
        .update(`blob ${String(content.length)}\0`)
        .update(content)
        .digest('hex');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

function isRecord(v: unknown): v is FreshnessRecord {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const r = v as Record<string, unknown>;
    return (
        typeof r['date'] === 'string' &&
        DATE_RE.test(r['date']) &&
        typeof r['blob'] === 'string' &&
        SHA_RE.test(r['blob']) &&
        typeof r['run_id'] === 'string' &&
        typeof r['model'] === 'string' &&
        typeof r['precision'] === 'number' &&
        typeof r['recall'] === 'number'
    );
}

/**
 * Read the ledger. A missing file is an empty ledger; a malformed file or a
 * malformed record throws, so a broken ledger is a red gate rather than a
 * silently ignored source of evidence.
 */
export function read_freshness_ledger(root: string): FreshnessLedger {
    const p = path.join(root, FRESHNESS_LEDGER_REL);
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        if ((exc as NodeJS.ErrnoException).code === 'ENOENT') {
            return { schema: FRESHNESS_LEDGER_SCHEMA, suites: {} };
        }
        throw exc;
    }
    const data = JSON.parse(text) as Record<string, unknown>;
    if (data['schema'] !== FRESHNESS_LEDGER_SCHEMA) {
        throw new Error(`${FRESHNESS_LEDGER_REL}: unsupported schema ${String(data['schema'])}`);
    }
    const suites = data['suites'];
    if (suites === null || typeof suites !== 'object' || Array.isArray(suites)) {
        throw new Error(`${FRESHNESS_LEDGER_REL}: \`suites\` must be an object`);
    }
    for (const [skill, rec] of Object.entries(suites as Record<string, unknown>)) {
        if (!isRecord(rec)) {
            throw new Error(`${FRESHNESS_LEDGER_REL}: malformed record for \`${skill}\``);
        }
    }
    return { schema: FRESHNESS_LEDGER_SCHEMA, suites: suites as Record<string, FreshnessRecord> };
}

export function write_freshness_ledger(root: string, ledger: FreshnessLedger): void {
    const p = path.join(root, FRESHNESS_LEDGER_REL);
    const sorted: Record<string, FreshnessRecord> = {};
    for (const k of Object.keys(ledger.suites).sort()) sorted[k] = ledger.suites[k]!;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
        p,
        JSON.stringify({ schema: FRESHNESS_LEDGER_SCHEMA, suites: sorted }, null, 2) + '\n',
        'utf-8',
    );
}

/** The ledger date for `skill` when it measured exactly `content`, else null. */
export function ledger_date_for(
    ledger: FreshnessLedger,
    skill: string,
    content: Buffer,
): string | null {
    const rec = ledger.suites[skill];
    if (!rec) return null;
    return rec.blob === git_blob_sha(content) ? rec.date : null;
}
