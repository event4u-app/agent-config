#!/usr/bin/env tsx
/**
 * When a council record owes the owner an options block — and when it must not.
 *
 * The output contract used to end every council run with a numbered-options
 * block carrying the host verdict, unconditionally. Under an ownership axis
 * that is wrong in one specific case and right in every other: a **conclusive
 * technical** verdict is a resolution, and handing it to the owner as options
 * routes a technical decision to a person because it was hard — the move
 * ADR-268 § 10 forbids by name.
 *
 * So the block becomes conditional, on exactly two readable fields:
 *
 *   owed          the verdict is owner-owned (`product-owned`, `business-owned`,
 *                 `destructive-owned`), OR the council did not converge. Both
 *                 are cases where nobody but the owner can close it, and the
 *                 block carries the council's PROPOSAL for them to confirm.
 *   forbidden     the verdict is technical AND conclusive. The record states
 *                 the resolution; the run continues.
 *
 * Convergence is read, not inferred: a record that does not say whether its
 * members converged is itself the finding, because "conclusive" would then be
 * the author's word for it rather than a property of the run.
 *
 * This is an evaluator over a record, not a gate over the tree — the tree's
 * council records are gitignored and pruned (they are dev-time scratch; the
 * durable record is the convergence inlined into the artefact). It exists so
 * the contract is checkable against a fixture rather than asserted in prose.
 *
 * Exit codes: 0 conforming · 1 findings · 2 bad argv.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'council_record_shape';

/** Owner-owned classes — the only ones a council may not close for the owner. */
export const OWNER_OWNED: ReadonlySet<string> = new Set([
    'product-owned',
    'business-owned',
    'destructive-owned',
]);

// Emphasis is stripped before these run (see `_plain`): the label is written
// `Ownership:`, `**Ownership:**` and `- **Ownership**:` across the corpus, and
// a pattern that tries to spell all three is how one spelling ends up silently
// unreadable.
const OWNERSHIP_RE = /^\s*[-*]?\s*Ownership\s*:\s*`?([a-z-]+)`?/im;
const CONVERGENCE_RE = /^\s*[-*]?\s*Convergence\s*:\s*(.+)$/im;
const OPTIONS_HEADING_RE = /^#{2,4}\s+(?:Options|Owner options|User options)\b/im;
const NUMBERED_OPTION_RE = /^\s*1\.\s+\S/m;

export interface RecordShape {
    readonly ownership: string | null;
    readonly convergence: string | null;
    readonly convergent: boolean;
    readonly hasOptionsBlock: boolean;
}

/**
 * A convergence line is conclusive when it says so in the vocabulary the
 * council already uses: `2/2`, `unanimous`, `convergent`. `split`, `1/2` and
 * `no quorum` are the other side, and they win on conflict — a line reading
 * "2/2 but split" is not a resolution.
 */
export function isConvergent(line: string): boolean {
    if (/\b(?:split|divergent|no quorum|abstain|inconclusive)\b/i.test(line)) return false;
    if (/\b(?:unanimous|convergent|conclusive)\b/i.test(line)) return true;
    const m = /(\d+)\s*\/\s*(\d+)/.exec(line);
    if (m) return m[1] === m[2];
    return false;
}

/** Markdown emphasis removed, line structure kept. */
export function _plain(text: string): string {
    return text.replace(/\*+/g, '');
}

export function parseRecord(text: string): RecordShape {
    const plain = _plain(text);
    const o = OWNERSHIP_RE.exec(plain);
    const c = CONVERGENCE_RE.exec(plain);
    const convergence = c ? (c[1] as string).trim() : null;
    const headingIdx = OPTIONS_HEADING_RE.exec(plain);
    return {
        ownership: o ? (o[1] as string) : null,
        convergence,
        convergent: convergence === null ? false : isConvergent(convergence),
        hasOptionsBlock: headingIdx !== null && NUMBERED_OPTION_RE.test(plain.slice(headingIdx.index)),
    };
}

/** True when the record must carry an owner-facing options block. */
export function owesOwnerOptions(shape: RecordShape): boolean {
    if (shape.ownership !== null && OWNER_OWNED.has(shape.ownership)) return true;
    return !shape.convergent;
}

export function checkRecord(rel: string, text: string): string[] {
    const out: string[] = [];
    const shape = parseRecord(text);
    if (shape.ownership === null) {
        out.push(`${rel}: no \`Ownership:\` line — the routing cannot be read`);
    }
    if (shape.convergence === null) {
        out.push(
            `${rel}: no \`Convergence:\` line — "conclusive" would be the author's word for it ` +
                `rather than a property of the run`,
        );
        return out;
    }
    const owed = owesOwnerOptions(shape);
    if (owed && !shape.hasOptionsBlock) {
        out.push(
            `${rel}: owner-owned or non-convergent, and carries no owner-facing options block — ` +
                `the owner still has to confirm the council's proposal`,
        );
    }
    if (!owed && shape.hasOptionsBlock) {
        out.push(
            `${rel}: a conclusive technical verdict carries an owner-facing options block — ` +
                `that routes a technical decision to the owner because it was hard (ADR-268 § 10)`,
        );
    }
    return out;
}

function _usage(): string {
    return `usage: ${_PROG} [-h] [--self-test] <record.md>...\n`;
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const paths: string[] = [];
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        }
        if (a === '--self-test') return _selfTest();
        if (a.startsWith('-')) {
            process.stderr.write(`${_usage()}${_PROG}: error: unrecognized arguments: ${a}\n`);
            return 2;
        }
        paths.push(a);
    }
    if (!paths.length) {
        process.stderr.write(`${_usage()}${_PROG}: error: at least one record path is required\n`);
        return 2;
    }
    const findings: string[] = [];
    for (const p of paths) {
        let text: string;
        try {
            text = fs.readFileSync(path.resolve(p), 'utf-8');
        } catch {
            process.stderr.write(`${_PROG}: error: cannot read ${p}\n`);
            return 2;
        }
        findings.push(...checkRecord(p, text));
    }
    if (findings.length) {
        for (const f of findings) process.stderr.write(`❌  ${f}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${_PROG}: ${String(paths.length)} record(s) conform\n`);
    return 0;
}

function _selfTest(): number {
    const technical = '- Ownership: contested-technical\n- Convergence: 2/2 convergent\n';
    const product = '- Ownership: product-owned\n- Convergence: 2/2 convergent\n';
    const options = '\n## Options\n\n1. Take the council proposal\n2. Something else\n';
    const failures: string[] = [];
    if (checkRecord('a', technical).length !== 0) failures.push('a conclusive technical verdict red');
    if (checkRecord('b', technical + options).length === 0) {
        failures.push('an options block on a conclusive technical verdict did not red');
    }
    if (checkRecord('c', product + options).length !== 0) failures.push('an owner-owned proposal red');
    if (checkRecord('d', product).length === 0) {
        failures.push('an owner-owned verdict with no proposal did not red');
    }
    if (checkRecord('e', '- Ownership: contested-technical\n- Convergence: 1/2 split\n').length === 0) {
        failures.push('a non-convergent technical verdict with no proposal did not red');
    }
    if (failures.length) {
        for (const f of failures) process.stderr.write(`❌  ${_PROG} --self-test: ${f}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${_PROG} --self-test: all five directions hold\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
