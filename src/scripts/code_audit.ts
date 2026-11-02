/**
 * `agent-config audit:code <mode>` — the deterministic half of `/audit code`.
 *
 *   matrix [--root <dir>] [--skeleton]   the two-account matrix over the code graph's routes
 *   validate [<ledger.json>] [--root …]  check a ledger against security-ledger.schema.json
 *   show [--root <dir>]                  the report derived from the newest ledger, or "not checked"
 *   import <file.sarif> [--root …] [--run <id>]  an external scanner's SARIF 2.1.0 results as a
 *                                        new ledger: every result `needs_validation`, every location
 *                                        a `model` row — input to verify, never coverage
 *
 * No mode calls a model or touches the network. Ledgers live under the
 * gitignored `agents/runtime/state/security/<run>/ledger.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { type LedgerFinding, type LedgerRow, renderLedger, type SecurityLedger, validateLedger } from './_lib/security_ledger.js';
import { main as matrixMain } from './security_matrix.js';

const LEDGER_DIR = path.join('agents', 'runtime', 'state', 'security');

function rootOf(argv: readonly string[]): string {
    const i = argv.indexOf('--root');
    // The dispatcher consumes a global `--root` and hands it on in this variable.
    return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : (process.env['AGENT_CONFIG_PROJECT_ROOT'] ?? process.cwd());
}

/** Imported scanner results live beside the audit runs, never as one of them. */
export const IMPORT_PREFIX = 'import-';

/**
 * The newest audit ledger by run-directory mtime, or null when no run was
 * recorded. An `import-*` run is skipped: it is unverified input, and reading it
 * as "the" ledger would hide the real one's confirmed findings and coverage.
 */
export function newestLedger(root: string): string | null {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return null;
    const runs = fs
        .readdirSync(dir)
        .filter((d) => !d.startsWith(IMPORT_PREFIX))
        .map((d) => path.join(dir, d, 'ledger.json'))
        .filter((p) => fs.existsSync(p))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return runs[0] ?? null;
}

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Scanner text is data: one line, no control characters, bounded — it can never add a line or a heading to a report. */
function clean(v: unknown, fallback: string, max = 200): string {
    if (typeof v !== 'string') return fallback;
    const t = v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    return t === '' ? fallback : t;
}

interface SarifResult {
    ruleId?: unknown;
    message?: { text?: unknown };
    locations?: Array<{ physicalLocation?: { artifactLocation?: { uri?: unknown }; region?: { startLine?: unknown } } }>;
}

/**
 * Map SARIF 2.1.0 into a ledger. The text is the scanner's, so it is carried as
 * data — a title is never read as an instruction — and nothing it says is
 * counted: the verifier still has to walk every candidate.
 */
export function ledgerFromSarif(sarif: unknown, run: string, at: string): SecurityLedger | string {
    const doc = sarif as { version?: unknown; runs?: unknown };
    if (typeof doc !== 'object' || doc === null || doc.version !== '2.1.0' || !Array.isArray(doc.runs)) return 'not a SARIF 2.1.0 document';
    const rows: LedgerRow[] = [];
    const findings: LedgerFinding[] = [];
    for (const r of doc.runs as Array<{ tool?: { driver?: { name?: unknown } }; results?: unknown }>) {
        const tool = clean(r.tool?.driver?.name, 'unknown-tool', 80);
        for (const res of (Array.isArray(r.results) ? r.results : []) as SarifResult[]) {
            const loc = res.locations?.[0]?.physicalLocation;
            const uri = clean(loc?.artifactLocation?.uri, 'unknown-location');
            const line = Number.isInteger(loc?.region?.startLine) ? `:${String(loc!.region!.startLine)}` : '';
            const rule = clean(res.ruleId, 'unnamed-rule', 120);
            const text = clean(res.message?.text, rule);
            const id = `I${findings.length + 1}`;
            findings.push({ id, status: 'needs_validation', title: `${rule}: ${text}`, location: `${uri}${line}`, finder: `import:${tool}`, verifier: 'unassigned', open_fact: `imported from ${tool}, not re-verified` });
            rows.push({ surface: 'Imported external scanner result', endpoint: `${uri}${line}`, enumeration: 'model', reviewed: false, reason: `imported from ${tool}` });
        }
    }
    return { schema_version: 2, run, at, rows, findings };
}

function importMain(rest: readonly string[]): number {
    const file = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--root' && rest[i - 1] !== '--run');
    const ri = rest.indexOf('--run');
    const at = new Date().toISOString();
    const id = ri >= 0 ? (rest[ri + 1] ?? '') : at.replace(/[:.]/g, '-');
    const run = `${IMPORT_PREFIX}${id}`;
    if (file === undefined || !RUN_ID.test(id)) {
        process.stderr.write('usage: audit:code import <file.sarif> [--root <dir>] [--run <id: letters, digits, . _ ->]\n');
        return 2;
    }
    let ledger: SecurityLedger | string;
    try {
        ledger = ledgerFromSarif(read(file), run, at);
    } catch (e) {
        ledger = `unreadable: ${(e as Error).message}`;
    }
    if (typeof ledger === 'string') {
        process.stderr.write(`${file}: ${ledger}\n`);
        return 2;
    }
    const dir = path.join(rootOf(rest), LEDGER_DIR, run);
    if (fs.existsSync(path.join(dir, 'ledger.json'))) {
        process.stderr.write(`${path.join(LEDGER_DIR, run, 'ledger.json')} exists — an import never overwrites a run; pass another --run\n`);
        return 2;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
    process.stdout.write(
        `${ledger.findings.length} imported as needs_validation into ${path.join(LEDGER_DIR, run, 'ledger.json')} — none confirmed; \`show\` keeps reading the newest audit run, so its coverage is unchanged\n`,
    );
    return 0;
}

function read(file: string): unknown {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

export async function main(argv: readonly string[]): Promise<number> {
    const [mode, ...rest] = argv;
    if (mode === 'matrix') return matrixMain(rest);
    if (mode === 'import') return importMain(rest);
    if (mode === 'validate' || mode === 'show') {
        const explicit = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--root');
        const file = explicit ?? newestLedger(rootOf(rest));
        if (file === null) {
            process.stdout.write(renderLedger(null));
            return mode === 'validate' ? 1 : 0;
        }
        const ledger = read(file);
        const problems = validateLedger(ledger);
        if (problems.length > 0) {
            process.stderr.write(`${file}: invalid ledger\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
            return 1;
        }
        process.stdout.write(mode === 'show' ? renderLedger(ledger as SecurityLedger) : `${file}: valid\n`);
        return 0;
    }
    process.stderr.write('usage: audit:code matrix|validate|show|import [--root <dir>] [--skeleton] [<ledger.json> | <file.sarif>]\n');
    return 2;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
