#!/usr/bin/env tsx
/**
 * Fail when an owner-question id appears as a heading more than once.
 *
 * `agents/owner-questions.md` is append-heavy and edited on parallel branches.
 * Two branches that each take the next free number produce two `OQ-<N>`
 * headings that merge without a textual conflict, so git cannot catch it —
 * duplicates of OQ-36 and OQ-37 reached `main` exactly that way. An answer
 * recorded against "OQ-36" is then ambiguous.
 *
 * Exit 0 when every id is unique, 1 on a duplicate (each id with all its
 * lines) or when the file holds no question heading at all.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGateArgs } from './_lib/gate_args.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_FILE = path.join(REPO_ROOT, 'agents', 'owner-questions.md');

const HEADING = /^#{2,4} *OQ-(\d+)\b/;

export interface IdOccurrence {
    id: number;
    line: number;
}

export interface DuplicateId {
    id: number;
    lines: number[];
}

export function parseOwnerQuestionIds(text: string): IdOccurrence[] {
    const out: IdOccurrence[] = [];
    text.split('\n').forEach((raw, idx) => {
        const m = HEADING.exec(raw);
        if (m !== null) out.push({ id: Number(m[1]), line: idx + 1 });
    });
    return out;
}

export function findDuplicateIds(ids: readonly IdOccurrence[]): DuplicateId[] {
    const byId = new Map<number, number[]>();
    for (const { id, line } of ids) {
        const lines = byId.get(id) ?? [];
        lines.push(line);
        byId.set(id, lines);
    }
    return [...byId.entries()]
        .filter(([, lines]) => lines.length > 1)
        .map(([id, lines]) => ({ id, lines }))
        .sort((a, b) => a.id - b.id);
}


/** `--self-test` — drives the real CLI over synthetic registers. */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oq-ids-self-'));
    const run = (body: string): number => {
        const file = path.join(fs.mkdtempSync(path.join(tmp, 'case-')), 'owner-questions.md');
        fs.writeFileSync(file, body, 'utf-8');
        return runGateCli(REPO_ROOT, 'src/scripts/check_owner_question_ids.ts', ['--file', file], REPO_ROOT);
    };
    try {
        return runSelfTest({
            gate: 'check_owner_question_ids',
            exit: { finding: 1, cannot_run: 2 },
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'distinct ids pass',
                    expect: 'accept',
                    run: () => run('### OQ-1 — a\n### OQ-2 — b\n'),
                },
                {
                    name: 'the same id under two heading levels is rejected',
                    expect: 'reject',
                    names: /OQ-7 at lines 1, 3/,
                    run: () => run('### OQ-7 — a\nbody\n## OQ-7 — b\n'),
                },
                {
                    name: 'a register with no question heading is rejected, not passed',
                    expect: 'reject',
                    run: () => run('# Owner questions\n'),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseGateArgs('check_owner_question_ids', argv, {
        'self-test': { type: 'boolean' },
        file: { type: 'string' },
    });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return 2;
    }
    if (parsed.values['self-test']) return selfTest();
    const file = parsed.values.file !== undefined ? path.resolve(parsed.values.file) : DEFAULT_FILE;
    if (!fs.existsSync(file)) {
        process.stderr.write(`❌  check_owner_question_ids: ${file} does not exist\n`);
        return 2;
    }
    const ids = parseOwnerQuestionIds(fs.readFileSync(file, 'utf-8'));
    try {
        reportScanned({
            gate: 'check_owner_question_ids',
            scanned: ids.length,
            units: 'OQ heading(s)',
            roots: [path.relative(REPO_ROOT, file) || file],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const dups = findDuplicateIds(ids);
    if (dups.length === 0) {
        process.stdout.write(`✅  ${String(ids.length)} owner-question id(s), all unique.\n`);
        return 0;
    }
    process.stdout.write('❌  Duplicate owner-question ids (renumber the later one):\n');
    for (const d of dups) {
        process.stdout.write(`   OQ-${String(d.id)} at lines ${d.lines.join(', ')}\n`);
    }
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
