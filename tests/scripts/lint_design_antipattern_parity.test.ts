import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CLASSES,
    REMEDIATION_VERBS,
    STATUSES,
    VERIFICATIONS,
    catalogEntries,
    censusCells,
    parityFindings,
    registryCatalogIds,
    statusRows,
} from '../../src/scripts/lint_design_antipattern_parity.js';

const REPO = path.resolve(__dirname, '..', '..');
const CATALOG = fs.readFileSync(path.join(REPO, 'docs', 'guidelines', 'design-antipatterns.md'), 'utf-8');
const REGISTRY = fs.readFileSync(path.join(REPO, 'src', 'scripts', 'design_slop_rules.ts'), 'utf-8');

/**
 * A minimal pair that satisfies the invariant, used as the base every negative
 * case mutates by exactly one edit. Building the failures from a passing base is
 * what makes each assertion attributable to the mutation rather than to the
 * fixture being malformed in some unrelated way.
 */
const OK_CATALOG = [
    '## Visual',
    '',
    '| V1 | side stripe | why | instead | floor | delete | static |',
    '| V2 | glass | why | instead | floor | retune | render |',
    '',
    '---',
    '',
    '## Detector status',
    '',
    '| Status | Meaning |',
    '|---|---|',
    '| `backed` | a rule exists |',
    '',
    '| Entry | Status | Note |',
    '|---|---|---|',
    '| V1 | backed | |',
    '| V2 | judgment-only | intent is not greppable |',
    '',
    '## See also',
    '',
].join('\n');

const OK_REGISTRY = ['    catalogId: "V1",'].join('\n');

describe('parityFindings — the tree as it stands', () => {
    it('is clean on the real catalog and the real registry', () => {
        expect(parityFindings(CATALOG, REGISTRY)).toEqual([]);
    });

    it('classifies every catalog entry exactly once', () => {
        const entries = catalogEntries(CATALOG);
        const rows = statusRows(CATALOG);
        expect(entries.length).toBeGreaterThan(0);
        expect(new Set(entries).size).toBe(entries.length);
        for (const id of entries) expect(rows.has(id)).toBe(true);
    });

    it('marks exactly the registry ids as backed', () => {
        const backed = new Set([...statusRows(CATALOG)].filter(([, r]) => r.status === 'backed').map(([id]) => id));
        expect(backed).toEqual(new Set(registryCatalogIds(REGISTRY)));
    });

    it('uses only the five declared statuses', () => {
        for (const [, row] of statusRows(CATALOG)) {
            expect(STATUSES as readonly string[]).toContain(row.status);
        }
    });
});

describe('parityFindings — the base fixture', () => {
    it('passes, so every negative below is attributable to its one mutation', () => {
        expect(parityFindings(OK_CATALOG, OK_REGISTRY)).toEqual([]);
    });
});

describe('parityFindings — it fails in both directions', () => {
    // Direction 1: a rule cites a catalog id that no entry carries. This is the
    // exact hole the shape-only unit test left open — `Z99` matched /^[A-Z]+\d+$/
    // and nothing ever resolved it.
    it('a registry rule citing an unknown catalog id', () => {
        const findings = parityFindings(OK_CATALOG, `${OK_REGISTRY}\n    catalogId: "Z99",`);
        expect(findings.map((f) => f.kind)).toContain('rule-without-backed');
        expect(findings.some((f) => f.msg.includes('Z99'))).toBe(true);
    });

    // Direction 2: a catalog entry classified as neither backed, floor,
    // judgment-only, deferred, nor candidate.
    it('a catalog entry missing from the status table', () => {
        const withExtra = OK_CATALOG.replace(
            '| V2 | glass | why | instead | floor | retune | render |',
            '| V2 | glass | why | instead | floor | retune | render |\n| V3 | ghost card | why | instead | invariant | delete | static |',
        );
        const findings = parityFindings(withExtra, OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('unclassified');
        expect(findings.some((f) => f.msg.includes('V3'))).toBe(true);
    });

    it('a backed row with no rule behind it', () => {
        const findings = parityFindings(OK_CATALOG, '');
        expect(findings.map((f) => f.kind)).toContain('backed-without-rule');
    });

    it('a rule whose entry is classified judgment-only', () => {
        const findings = parityFindings(OK_CATALOG, `${OK_REGISTRY}\n    catalogId: "V2",`);
        expect(findings.some((f) => f.kind === 'rule-without-backed' && f.msg.includes('judgment-only'))).toBe(true);
    });

    it('a status outside the vocabulary', () => {
        const findings = parityFindings(OK_CATALOG.replace('| V2 | judgment-only |', '| V2 | maybe |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('bad-status');
    });

    it('a non-backed row with no reason', () => {
        const findings = parityFindings(OK_CATALOG.replace('| V2 | judgment-only | intent is not greppable |', '| V2 | judgment-only | |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('missing-reason');
    });

    it('a status row for an entry no catalog table defines', () => {
        const findings = parityFindings(OK_CATALOG.replace('| V2 | judgment-only |', '| M9 | judgment-only |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('orphan-status');
    });

    // A gate that scans nothing exits green; this is the guard against that.
    it('a catalog with no status section at all', () => {
        const findings = parityFindings('| V1 | side stripe | why | instead | floor | delete | static |', OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toEqual(['no-status-section']);
    });
});

describe('the census columns — class, remediation, verification', () => {
    it('every shipped catalog entry carries all three, from the closed vocabularies', () => {
        const cells = censusCells(CATALOG);
        const entries = catalogEntries(CATALOG);
        expect(entries.length).toBeGreaterThan(0);
        for (const id of entries) {
            const c = cells.get(id);
            expect(c, `${id} has no census cells`).toBeDefined();
            expect(CLASSES as readonly string[]).toContain(c?.class);
            expect(VERIFICATIONS as readonly string[]).toContain(c?.verification);
            for (const verb of (c?.remediation ?? '').split('\u2192').map((v) => v.trim())) {
                expect(REMEDIATION_VERBS as readonly string[]).toContain(verb);
            }
        }
    });

    it('a row with no census cells is a finding', () => {
        const findings = parityFindings(
            OK_CATALOG.replace('| V2 | glass | why | instead | floor | retune | render |', '| V2 | glass | why | instead |'),
            OK_REGISTRY,
        );
        expect(findings.map((f) => f.kind)).toContain('missing-census');
    });

    it('a class outside the vocabulary is a finding', () => {
        const findings = parityFindings(OK_CATALOG.replace('| floor | retune | render |', '| vibes | retune | render |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('bad-class');
    });

    it('a verification mode outside the vocabulary is a finding', () => {
        const findings = parityFindings(OK_CATALOG.replace('| floor | retune | render |', '| floor | retune | eyeball |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('bad-verification');
    });

    it('a remediation verb outside the vocabulary is a finding', () => {
        const findings = parityFindings(OK_CATALOG.replace('| floor | retune | render |', '| floor | ponder | render |'), OK_REGISTRY);
        expect(findings.map((f) => f.kind)).toContain('bad-remediation');
    });

    // Risk 3 of road-to-one-motion-authority: the class column exists to say
    // what KIND of rule an entry is, and the status column to say how its
    // enforcement is wired. If class ever determines status the second axis has
    // collapsed into the first and is carrying no information.
    it('the two axes stay independent on the shipped catalog', () => {
        expect(parityFindings(CATALOG, REGISTRY).map((f) => f.kind)).not.toContain('axes-collapsed');
    });

    it('a catalog where class determines status is a finding', () => {
        const collapsed = OK_CATALOG.replace('| V2 | glass | why | instead | floor |', '| V2 | glass | why | instead | invariant |');
        expect(parityFindings(collapsed, OK_REGISTRY).map((f) => f.kind)).toContain('axes-collapsed');
    });
});
