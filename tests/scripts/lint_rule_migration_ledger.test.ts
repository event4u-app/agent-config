// Tests for src/scripts/lint_rule_migration_ledger.ts.
//
// The gate's own `--self-test` drives the real binary through five cases, so
// this file covers what that cannot: the shipped corpus (every migrated rule
// really has a ledger, and the recorded losses are real rows rather than an
// empty formality) and the two predicates whose exact boundary decides whether
// an author can slip a hollow row past the gate.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
    DISPOSITIONS,
    LEDGER_DIR,
    SOURCE_KINDS,
    headingsOf,
    migratedRules,
    normHeading,
    reasonIsAcceptable,
} from '../../src/scripts/lint_rule_migration_ledger.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Ledger {
    rule: string;
    source: string;
    source_headings?: string[];
    rows?: Array<{ heading: string; disposition: string; target?: string; reason: string }>;
}

function allLedgers(): Ledger[] {
    const dir = path.join(REPO, LEDGER_DIR);
    return fs
        .readdirSync(dir)
        .filter((n) => n.endsWith('.yml'))
        .sort()
        .map((n) => parseYaml(fs.readFileSync(path.join(dir, n), 'utf-8')) as Ledger);
}

describe('lint_rule_migration_ledger — the shipped corpus', () => {
    it('every rule carrying a migration line has a ledger', () => {
        const rules = new Set(migratedRules(REPO));
        const ledgered = new Set(allLedgers().map((l) => l.rule));
        expect([...rules].filter((r) => !ledgered.has(r))).toEqual([]);
    });

    it('every ledger declares a known source kind and known dispositions', () => {
        for (const l of allLedgers()) {
            expect(SOURCE_KINDS as readonly string[], l.rule).toContain(l.source);
            for (const row of l.rows ?? []) {
                expect(DISPOSITIONS as readonly string[], `${l.rule}/${row.heading}`).toContain(
                    row.disposition,
                );
            }
        }
    });

    it('every pre-migration heading has exactly one row', () => {
        for (const l of allLedgers()) {
            const counts = new Map<string, number>();
            for (const row of l.rows ?? []) {
                const k = normHeading(row.heading);
                counts.set(k, (counts.get(k) ?? 0) + 1);
            }
            for (const h of l.source_headings ?? []) {
                expect(counts.get(normHeading(h)), `${l.rule} — "${h}"`).toBe(1);
            }
        }
    });

    it('records real losses — a ledger of only `carried` rows would be a formality', () => {
        // The point of the transform being lossy is that some of it was lost.
        // If this ever drops to zero, the likely cause is a populator that
        // defaulted the hard rows to `carried`, not a repo that lost nothing.
        const dropped = allLedgers().flatMap((l) =>
            (l.rows ?? []).filter((r) => r.disposition === 'dropped'),
        );
        expect(dropped.length).toBeGreaterThan(0);
        for (const row of dropped) {
            expect(row.target, `dropped row "${row.heading}" must not name a target`).toBeUndefined();
            expect(reasonIsAcceptable(row.reason).ok, `dropped row "${row.heading}"`).toBe(true);
        }
    });

    it('born_thin ledgers carry no rows — "no body existed" is not "the body is lost"', () => {
        for (const l of allLedgers().filter((x) => x.source === 'born_thin')) {
            expect(l.rows ?? [], l.rule).toEqual([]);
            expect(l.source_headings ?? [], l.rule).toEqual([]);
        }
    });
});

describe('lint_rule_migration_ledger — the two predicates', () => {
    it.each([
        ['secondary', false],
        ['redundant', false],
        ['Consolidated.', false],
        ['moved to the skill', false],
        ['the whole section moved verbatim into the skill body', true],
    ])('reasonIsAcceptable(%j) === %s', (reason, ok) => {
        expect(reasonIsAcceptable(reason).ok).toBe(ok);
    });

    it('heading identity survives `##` → `###` demotion, emphasis and spacing', () => {
        // The two functions compose: `headingsOf` drops the level marker,
        // `normHeading` drops emphasis and collapses whitespace. Demotion is the
        // norm in these migration targets, so this pair IS the completeness
        // check — a level-keyed comparison would miss every demoted section.
        const before = headingsOf('## **Banned classes**\n').map(normHeading);
        const after = headingsOf('### Banned  classes\n').map(normHeading);
        expect(before).toEqual(after);
        expect(before).toEqual(['banned classes']);
    });

    it('headingsOf reads H1 too, because three migrated rules are stubs with no `##`', () => {
        // Excluding H1 would force those rows to invent a subsection that does
        // not exist — the anchor fabrication this gate exists to prevent.
        expect(headingsOf('# Title\n\n## Sub\n')).toEqual(['Title', 'Sub']);
    });

    it('headingsOf ignores headings inside fenced blocks', () => {
        expect(headingsOf('## Real\n\n```md\n## Not a heading\n```\n')).toEqual(['Real']);
    });
});
