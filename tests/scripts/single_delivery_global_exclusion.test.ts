// ADR-236 single delivery, step 2.2 — the partition from the OTHER side.
//
// 2.1 stops the project layer from emitting anything but the package-only set.
// On its own that holds the invariant in ONE direction: a global install would
// still carry the same 16 rules, so the next `agent-config install` would
// re-create exactly the overlap the projection had just removed. This file pins
// the second direction.
//
// The assertion runs over the REAL shipped tree (`dist/agent-src/rules/`) rather
// than a fixture, deliberately: the number that matters is how many rules
// actually carry `workspaces: [agent-config-maintainer]` exclusively today, and a
// fixture cannot go red when someone adds the seventeenth.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isExclusivelyPackageOnly } from '../../src/install/partitionEligibility.js';
import { _resolve_global_rule_scope, _rule_filter_for_source } from '../../src/scripts/install.js';
import { RULE_SOURCE_REL } from '../../src/install/wizard-plan.js';

const REPO = path.resolve(__dirname, '..', '..');
const DIST_RULES = path.join(REPO, 'dist', 'agent-src', 'rules');

function distRuleFiles(): string[] {
    return fs
        .readdirSync(DIST_RULES)
        .filter((n) => n.endsWith('.md'))
        .sort()
        .map((n) => path.join(DIST_RULES, n));
}

describe('the global install excludes exclusively-package-only rules', () => {
    it('the shipped tree still carries a non-empty package-only set', () => {
        // A guard on the guard: if this ever reads 0 the two assertions below
        // become vacuously true and would pass while covering nothing.
        const packageOnly = distRuleFiles().filter(isExclusivelyPackageOnly);
        expect(packageOnly.length).toBeGreaterThan(0);
    });

    it('the global rule filter rejects every package-only rule and accepts nothing else by that name', () => {
        const scope = _resolve_global_rule_scope(REPO);
        const filter = _rule_filter_for_source(RULE_SOURCE_REL, scope);
        expect(filter).not.toBeNull();

        const rejectedPackageOnly: string[] = [];
        const leaked: string[] = [];
        for (const file of distRuleFiles()) {
            const arrives = filter!(file);
            if (isExclusivelyPackageOnly(file)) {
                if (arrives) leaked.push(path.basename(file));
                else rejectedPackageOnly.push(path.basename(file));
            }
        }
        // Named rather than counted: a diff that renames one should read as a
        // rename, not as a count that happens to still add up.
        expect(leaked).toEqual([]);
        expect(rejectedPackageOnly).toContain('source-of-truth.md');
        expect(rejectedPackageOnly).toContain('package-ci-checks.md');
        // 15, not 16. The source set is 16; `telegraph-speak` is compile-disabled
        // by default and therefore has NO `dist/agent-src/rules/` counterpart, so
        // it cannot be excluded from a global install that never carried it.
        // Verified 2026-08-20 by diffing the two directories — the number is
        // measured here rather than borrowed from the roadmap's source-side count.
        expect(rejectedPackageOnly.length).toBeGreaterThanOrEqual(15);
    });

    it('a rule that is NOT package-only still arrives globally', () => {
        const scope = _resolve_global_rule_scope(REPO);
        const filter = _rule_filter_for_source(RULE_SOURCE_REL, scope);
        // `non-destructive-by-default` is the Hard Floor — it must reach every
        // consumer. If the exclusion ever widened to swallow it, the partition
        // would be removing governance rather than de-duplicating it.
        const hardFloor = path.join(DIST_RULES, 'non-destructive-by-default.md');
        expect(fs.existsSync(hardFloor)).toBe(true);
        expect(isExclusivelyPackageOnly(hardFloor)).toBe(false);
        expect(filter!(hardFloor)).toBe(true);
    });

    it('a non-rule source produces no filter at all', () => {
        const scope = _resolve_global_rule_scope(REPO);
        expect(_rule_filter_for_source('dist/agent-src/skills', scope)).toBeNull();
    });
});

describe('installer and build fingerprint the SAME layers', () => {
    // The failure this guards is silent and total: if the installer fingerprints
    // one set of directories and the build another, every comparison mismatches,
    // every branch falls back to `standalone/full` with a plausible-sounding
    // reason, and the partition is unreachable forever while nothing fails. A
    // shared definition is the only way to make that impossible rather than
    // merely unlikely — so the test is that both sides IMPORT it and neither
    // re-lists the directories inline.
    const SOURCES = [
        path.join(REPO, 'src', 'scripts', 'condense.ts'),
        path.join(REPO, 'src', 'scripts', 'install.ts'),
    ];

    it('both consumers import hostLayerInputs', () => {
        for (const file of SOURCES) {
            const text = fs.readFileSync(file, 'utf-8');
            expect(text, `${path.basename(file)} must import hostLayerInputs`).toContain(
                'hostLayerInputs',
            );
        }
    });

    it('neither consumer re-lists the host layer directories inline', () => {
        // `.claude/commands` / `.claude/skills` as a joined path pair is the shape
        // an inline re-listing takes. The single definition lives in
        // `hostLayerFingerprint.ts`; a second one here is the drift.
        for (const file of SOURCES) {
            const text = fs.readFileSync(file, 'utf-8');
            const inlineLayerList = /label:\s*'(rules|skills|commands)'/.test(text);
            expect(inlineLayerList, `${path.basename(file)} re-lists host layers inline`).toBe(
                false,
            );
        }
    });
});
