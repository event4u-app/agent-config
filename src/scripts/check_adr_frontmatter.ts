#!/usr/bin/env tsx
/**
 * ADR frontmatter gate — and the `review_trigger` field that makes a decision
 * revisitable on purpose rather than by archaeology.
 *
 * Two findings drive this. First, ADR frontmatter was **entirely unvalidated**:
 * `validate_frontmatter.ts` covers skills, rules, commands, and personas, and
 * nothing covered `docs/decisions/`. That is why `review_date` drifted into 11
 * ADRs and back out again with nobody noticing.
 *
 * Second, of 128 ADRs, zero named the condition under which they should be
 * reconsidered — while `decision-record` SKILL § step 4 already *mandates* a
 * "Revisit-if" line and `decision-revisit-gate` already treats an ADR as a lock
 * that must be re-openable. The doctrine was canon; the template just never
 * emitted a slot for it, so 33 authors wrote it in prose and it stayed
 * unfindable. This is a missing field, not a missing idea.
 *
 * `review_trigger` is a named CONDITION, never a date. "Review annually" is
 * ignored by everyone and rots into ceremony; "when a second consumer reports a
 * preservation surprise" fires exactly when it should.
 *
 * Grandfathering is by authorship date, not an allowlist: ADRs dated before the
 * switch warn, ADRs dated on or after it fail. No list to maintain and no
 * exemption to forget — a retrofit of 128 files would be busywork that teaches
 * nobody anything.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_adr_frontmatter          # gate
 *   ./scripts-run src/scripts/check_adr_frontmatter --json
 *
 * Exit codes: 0 ok (warnings allowed) · 1 violation · 2 usage/env error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs', 'decisions');

/**
 * Grandfathering switch. ADRs dated before this warn on a missing
 * `review_trigger`; ADRs dated on or after it fail.
 */
export const REVIEW_TRIGGER_SINCE = '2026-07-25';

/** Fields every ADR must carry — the shape that already exists in practice. */
const REQUIRED = ['adr', 'status', 'date', 'decision'] as const;

const ALLOWED_STATUS = new Set([
    'accepted',
    'proposed',
    'superseded',
    'rejected',
    'deprecated',
    'draft',
]);

export interface AdrFinding {
    file: string;
    level: 'error' | 'warn';
    message: string;
}

export function parse_frontmatter(text: string): Record<string, string> | null {
    if (!text.startsWith('---\n')) return null;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return null;
    const out: Record<string, string> = {};
    let key: string | null = null;
    for (const raw of text.slice(4, end).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;
        // Continuation of a folded/indented value.
        if (/^\s/.test(line) && key) {
            out[key] = `${out[key]} ${line.trim()}`.trim();
            continue;
        }
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        key = line.slice(0, idx).trim();
        out[key] = line
            .slice(idx + 1)
            .trim()
            .replace(/^["'](.*)["']$/, '$1');
    }
    return out;
}

/** A trigger must name a condition. A bare cadence is the failure mode. */
export function trigger_is_meaningful(value: string): boolean {
    const v = value.trim();
    if (v.length < 20) return false;
    // "annually" / "every 6 months" / a bare date is a calendar, not a condition.
    if (/^(annually|yearly|quarterly|monthly|every\s+\d+\s+\w+|\d{4}-\d{2}-\d{2})\.?$/i.test(v)) {
        return false;
    }
    return true;
}

/** Every frontmatter finding for one ADR file. Pure — no I/O, no enumeration. */
export function check_one(rel: string, text: string): AdrFinding[] {
    const findings: AdrFinding[] = [];
    const fm = parse_frontmatter(text);

    if (fm === null) {
        findings.push({ file: rel, level: 'error', message: 'no YAML frontmatter block' });
        return findings;
    }
    for (const req of REQUIRED) {
        if (!fm[req]) findings.push({ file: rel, level: 'error', message: `missing \`${req}\`` });
    }
    if (fm['status'] && !ALLOWED_STATUS.has(fm['status'])) {
        findings.push({
            file: rel,
            level: 'error',
            message: `status \`${fm['status']}\` is not one of: ${[...ALLOWED_STATUS].sort().join(', ')}`,
        });
    }

    const date = fm['date'] ?? '';
    const grandfathered = date !== '' && date < REVIEW_TRIGGER_SINCE;
    const trigger = fm['review_trigger'];

    if (!trigger) {
        findings.push({
            file: rel,
            level: grandfathered ? 'warn' : 'error',
            message: grandfathered
                ? `no \`review_trigger\` (grandfathered — dated ${date}, before ${REVIEW_TRIGGER_SINCE})`
                : `missing \`review_trigger\` — name the CONDITION that would reopen this decision`,
        });
    } else if (!trigger_is_meaningful(trigger)) {
        findings.push({
            file: rel,
            level: grandfathered ? 'warn' : 'error',
            message: `\`review_trigger\` is a cadence, not a condition: "${trigger}". A calendar review is ignored; an event fires.`,
        });
    }
    return findings;
}

/**
 * Check every ADR in `dir`, optionally recording per-file completeness.
 *
 * The candidate set is every `*.md` in the directory, not the `ADR-*.md` subset:
 * the name filter used to be a bare `continue`, so a decision record saved as
 * `adr-131-foo.md` (lower case) or `131-foo.md` left the corpus without a trace
 * and the gate still printed a green line over the files it did read. It is now
 * an out-of-scope outcome with a reason, and it prints.
 *
 * A `warn`-level finding resolves as `complete`: warnings are allowed by this
 * gate's exit-code contract, so `fail` is reserved for what actually reds it.
 */
export function check(dir: string = ADR_DIR, ledger?: GateLedger): AdrFinding[] {
    const findings: AdrFinding[] = [];
    if (!fs.existsSync(dir)) return findings;

    const candidates = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
    ledger?.plan(candidates);

    for (const name of candidates) {
        if (!/^ADR-.*\.md$/.test(name)) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        const rel = path.relative(REPO_ROOT, path.join(dir, name));
        const own = check_one(rel, fs.readFileSync(path.join(dir, name), 'utf-8'));
        findings.push(...own);

        const errors = own.filter((f) => f.level === 'error').length;
        if (errors > 0) {
            ledger?.fail(name, `${String(errors)} frontmatter error(s)`);
        } else {
            ledger?.complete(name);
        }
    }
    return findings;
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const ledger = new GateLedger('check_adr_frontmatter');
    const findings = check(ADR_DIR, ledger);
    // Finalized here, printed later by `report()` (which re-finalizes — the call
    // is pure): the denominator is needed for the scope assertion below, which
    // runs before any output. It is the ledger's own per-file accounting — the
    // ADRs that actually reached a checked outcome — where it used to be a SECOND
    // `readdirSync` of the same directory, independent of the loop that did the
    // work, so the printed count could not disagree with the scan even when the
    // scan had skipped files.
    const tally = ledger.finalize();
    const total = tally.completed + tally.failed;

    // `check()` returns findings, never a count, so a moved `docs/decisions/`
    // yields an empty list — reported as "0 ADR(s) · 0 error(s)" and green.
    // Exit 1 is the violation code; 2 stays reserved for usage/env errors.
    try {
        assertScanned({
            gate: 'check_adr_frontmatter',
            scanned: total,
            units: 'ADR file(s)',
            roots: ['docs/decisions'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (as_json) {
        // The tally rides in the payload rather than on stdout: `ledger.report()`
        // would print beside the JSON and break every parser of this mode.
        process.stdout.write(JSON.stringify({ findings, ledger: tally }, null, 2) + '\n');
        return 0;
    }

    const errors = findings.filter((f) => f.level === 'error');
    const warns = findings.filter((f) => f.level === 'warn');

    process.stdout.write(
        `ADR frontmatter: ${total} ADR(s) · ${errors.length} error(s) · ` +
            `${warns.length} grandfathered without a revisit condition\n`,
    );
    ledger.report();
    for (const e of errors) process.stderr.write(`    ❌ ${e.file}: ${e.message}\n`);

    if (errors.length > 0) {
        process.stderr.write(
            `\n❌  check_adr_frontmatter: ${errors.length} error(s). ` +
                `ADRs dated ${REVIEW_TRIGGER_SINCE} or later must name a \`review_trigger\`.\n`,
        );
        return 1;
    }
    process.stdout.write('✅  check_adr_frontmatter: no errors\n');
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main(process.argv.slice(2)));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main(process.argv.slice(2)));
        }
    }
}
