#!/usr/bin/env tsx
/**
 * Structural validator for the RDP trigger-fixture corpus.
 *
 * `tests/reasoning-layer-eval/` shipped 21 fixtures and, after the Python
 * retirement, zero validators: `find … -name '*.ts' -o -name '*.py'` returned
 * nothing while the corpus's own README and `trigger-fixtures.json`'s
 * `description` still told a reader to run two deleted files. A corpus nothing
 * can check is a corpus nothing does check.
 *
 * Scope is deliberately the SHAPE and nothing else. Live scoring against a model
 * is `skill_trigger_eval.ts`, which is billable and already exists; nothing about
 * validating the corpus needs a model call. What the deleted `validate_fixtures.py`
 * ALSO did and this does not is check the cost-gating invariants — that half was
 * not ported and is not claimed here.
 *
 * Exit codes: 0 corpus well-formed · 1 a row is malformed · 2 the corpus is
 * missing or unparseable.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS_REL = 'tests/reasoning-layer-eval/trigger-fixtures.json';

/**
 * The five keys a row carries, and no others.
 *
 * Exact-set rather than a minimum: an unknown key is how a schema drifts in a
 * corpus with no reader, and the two additive fields this suite already has
 * over the per-skill `evals/triggers.json` convention (`discipline`, `host`)
 * are exactly what a permissive check would have let multiply.
 */
const REQUIRED_KEYS = ['q', 'trigger', 'discipline', 'host', 'note'] as const;
const HOSTS = ['standard', 'strong'] as const;

export interface Finding {
    where: string;
    reason: string;
}

export function validateCorpus(text: string): { findings: Finding[]; rows: number } {
    const findings: Finding[] = [];
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (exc) {
        return {
            findings: [{ where: CORPUS_REL, reason: `not valid JSON: ${String(exc)}` }],
            rows: 0,
        };
    }
    const top = doc as Record<string, unknown>;
    for (const k of ['suite', 'description', 'queries']) {
        if (top[k] === undefined) {
            findings.push({ where: CORPUS_REL, reason: `top level is missing '${k}'` });
        }
    }
    const queries = Array.isArray(top['queries']) ? (top['queries'] as unknown[]) : [];
    if (queries.length === 0) {
        findings.push({ where: CORPUS_REL, reason: "'queries' is empty or not an array" });
        return { findings, rows: 0 };
    }

    queries.forEach((raw, i) => {
        const where = `${CORPUS_REL}[${String(i)}]`;
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            findings.push({ where, reason: 'row is not an object' });
            return;
        }
        const row = raw as Record<string, unknown>;
        const keys = Object.keys(row).sort();
        const expected: string[] = [...REQUIRED_KEYS].sort();
        for (const k of expected) {
            if (!keys.includes(k)) findings.push({ where, reason: `missing key '${k}'` });
        }
        for (const k of keys) {
            if (!expected.includes(k)) findings.push({ where, reason: `unknown key '${k}'` });
        }
        if (row['q'] !== undefined && (typeof row['q'] !== 'string' || row['q'].trim() === '')) {
            findings.push({ where, reason: "'q' must be a non-empty string" });
        }
        if (row['note'] !== undefined && (typeof row['note'] !== 'string' || row['note'].trim() === '')) {
            findings.push({ where, reason: "'note' must be a non-empty string" });
        }
        if (row['discipline'] !== undefined && (typeof row['discipline'] !== 'string' || row['discipline'].trim() === '')) {
            findings.push({ where, reason: "'discipline' must be a non-empty string" });
        }
        if (row['trigger'] !== undefined && typeof row['trigger'] !== 'boolean') {
            findings.push({ where, reason: "'trigger' must be a boolean, not a string" });
        }
        if (row['host'] !== undefined && !(HOSTS as readonly unknown[]).includes(row['host'])) {
            findings.push({
                where,
                reason: `'host' must be one of ${HOSTS.join('|')}, got ${JSON.stringify(row['host'])}`,
            });
        }
    });
    return { findings, rows: queries.length };
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) return selfTest();
    const rootIdx = process.argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (process.argv[rootIdx + 1] ?? ROOT);
    const file = path.join(root, CORPUS_REL);
    if (!fs.existsSync(file)) {
        process.stderr.write(`❌  corpus not found: ${CORPUS_REL} (under ${root})\n`);
        return 2;
    }
    const { findings, rows } = validateCorpus(fs.readFileSync(file, 'utf-8'));
    // Emitted on the red path too: a gate that reports what it inspected only
    // when it passes leaves the coverage census blind exactly when it matters.
    reportScanned({
        gate: 'lint_reasoning_fixtures',
        scanned: rows,
        units: 'fixture row(s)',
        roots: [CORPUS_REL],
    });
    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(`❌  ${f.where}: ${f.reason}\n`);
        }
        process.stdout.write(`\n${String(findings.length)} malformed fixture finding(s).\n`);
        return 1;
    }
    process.stdout.write(
        `✅  lint_reasoning_fixtures: ${String(rows)} fixture row(s) well-formed ` +
            `(${REQUIRED_KEYS.join(', ')}; host ∈ ${HOSTS.join('|')}).\n`,
    );
    return 0;
}

/** The gate proving it still DISCRIMINATES — one rejecting case per rule the roadmap names. */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rdp-fixtures-selftest-'));
    const good = {
        q: 'a question',
        trigger: true,
        discipline: 'grounding',
        host: 'standard',
        note: 'why',
    };
    const write = (name: string, queries: unknown[]): string => {
        const dir = path.join(tmp, name, 'tests', 'reasoning-layer-eval');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'trigger-fixtures.json'),
            JSON.stringify({ suite: 's', description: 'd', queries }),
            'utf-8',
        );
        return path.join(tmp, name);
    };
    const run = (root: string): number =>
        runGateCli(ROOT, 'src/scripts/lint_reasoning_fixtures.ts', ['--root', root], root);

    try {
        return runSelfTest({
            gate: 'lint_reasoning_fixtures',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a row with a sixth key is rejected',
                    expect: 'reject',
                    run: () => run(write('sixth-key', [{ ...good, extra: 1 }])),
                },
                {
                    name: 'a row missing discipline is rejected',
                    expect: 'reject',
                    run: () => {
                        const { discipline: _drop, ...rest } = good;
                        return run(write('no-discipline', [rest]));
                    },
                },
                {
                    name: 'host: "medium" is rejected',
                    expect: 'reject',
                    run: () => run(write('bad-host', [{ ...good, host: 'medium' }])),
                },
                {
                    name: 'a well-formed row passes',
                    expect: 'accept',
                    run: () => run(write('good', [good])),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { CORPUS_REL, REQUIRED_KEYS, HOSTS, main };
