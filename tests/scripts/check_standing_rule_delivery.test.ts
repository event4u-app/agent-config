// Unit tests for the standing-rule-delivery gate
// (`check_standing_rule_delivery.ts`) — P1.2 of
// `road-to-rule-delivery-integrity`.
//
// Two pure surfaces carry the gate's honesty and both are pinned here:
//
// 1. **The budget must come from config or not at all.** A budget gate that
//    falls back to an invented ceiling certifies a number nobody chose, which is
//    the same class of failure as a gate that scans nothing. An incomplete block
//    resolves to `null` and the caller exits 2.
// 2. **A cap raise needs a stated cause.** `cap_raise_reason` exists so a
//    ceiling cannot be bumped silently; a placeholder must not satisfy it.
//
// The measured numbers themselves are not asserted here — they are per-machine
// (both layers are machine-local; `.claude/rules/` is gitignored). The live
// readings and the derivation of the 110,000 cap live in
// `agents/evidence/analysis/standing-rule-delivery-topologies.md`.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    instructionsLoadedRecord,
    readBudget,
    reasonIsStated,
    reinstallRows,
} from '../../src/scripts/check_standing_rule_delivery.js';
import { lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';
import { lawDigest, STUB_LAW_OPEN, THIN_ENTRY_MARKER } from '../../src/scripts/_lib/thin_rules.js';

const BLOCK = [
    'standing_rule_delivery:',
    '  # a comment line is skipped',
    '  total_cap_tokens: 110000',
    '  warn_threshold: 0.85',
    "  cap_raise_reason: 'initial cap — derived from the 2026-08-08 measurement'",
    '',
    'next_top_level_key:',
    '  total_cap_tokens: 999',
].join('\n');

describe('readBudget', () => {
    it('reads the three keys and stops at the next top-level key', () => {
        expect(readBudget(BLOCK)).toEqual({
            total_cap_tokens: 110000,
            warn_threshold: 0.85,
            cap_raise_reason: 'initial cap — derived from the 2026-08-08 measurement',
        });
    });

    it('returns null when the block is absent — never a default ceiling', () => {
        expect(readBudget('some_other_key:\n  a: 1\n')).toBeNull();
    });

    it('returns null when any required key is missing', () => {
        const partial = 'standing_rule_delivery:\n  total_cap_tokens: 110000\n';
        expect(readBudget(partial)).toBeNull();
    });

    it('returns null on a non-numeric cap rather than coercing it', () => {
        const bad = [
            'standing_rule_delivery:',
            '  total_cap_tokens: lots',
            '  warn_threshold: 0.85',
            '  cap_raise_reason: x',
        ].join('\n');
        expect(readBudget(bad)).toBeNull();
    });

    it('strips surrounding quotes from the reason', () => {
        const quoted = [
            'standing_rule_delivery:',
            '  total_cap_tokens: 1',
            '  warn_threshold: 0.5',
            '  cap_raise_reason: "quoted reason"',
        ].join('\n');
        expect(readBudget(quoted)?.cap_raise_reason).toBe('quoted reason');
    });
});

describe('reasonIsStated', () => {
    it('accepts a real sentence', () => {
        expect(reasonIsStated('raised 4k for the new tenancy rule (PR #1234)')).toBe(true);
    });

    it.each(['', ' ', '-', 'TBD', 'todo', 'N/A', 'none', 'bump'])(
        'rejects the placeholder %j',
        (placeholder) => {
            expect(reasonIsStated(placeholder)).toBe(false);
        },
    );
});

describe('the shipped budgets.yml block is complete and its reason is stated', () => {
    // The gate is not in CI — it measures a MACHINE rather than a commit, so a
    // runner would report the runner (see the script's docstring, corrected
    // 2026-10-05: a runner CAN stage a user-scope install, it just has no
    // reason to). This test is therefore the only automatic check that its
    // config block has not been half-edited or silently bumped.
    const text = fs.readFileSync(
        path.join(process.cwd(), 'src', 'config', 'budgets.yml'),
        'utf-8',
    );

    it('parses', () => {
        expect(readBudget(text)).not.toBeNull();
    });

    it('carries a stated cap_raise_reason', () => {
        expect(reasonIsStated(readBudget(text)!.cap_raise_reason)).toBe(true);
    });

    it('keeps the cap inside the measured band 101,247 … 176,354', () => {
        // Below the band a complete single layer would fail; above it the doubled
        // corpus would pass. Both readings are from the 2026-08-08 measurement.
        const cap = readBudget(text)!.total_cap_tokens;
        expect(cap).toBeGreaterThan(101247);
        expect(cap).toBeLessThan(176354);
    });
});

describe('instructionsLoadedRecord', () => {
    it('points at the metrics dir under the given repo root', () => {
        expect(instructionsLoadedRecord('/repo')).toBe(
            path.join('/repo', 'agents', 'runtime', 'metrics', 'instructions-loaded.jsonl'),
        );
    });
});

// `road-to-a-default-install-served-once` step 1.2 — a source reduction shows
// as pending reinstall instead of as nothing.
describe('reinstallRows — pending reinstall column', () => {
    const SRC_BODY = '---\ntype: auto\n---\n\n# Rule\n\nFull body that the source now shortened.\n';
    const LAW = 'NEVER DO THE THING.';
    const lawRule = (law: string): string =>
        `---\ntype: auto\n---\n\n# Law rule\n\n## The Iron Law\n\n\`\`\`\n${law}\n\`\`\`\n\nMore prose.\n`;

    function layers(): { inst: string; src: string } {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-reinstall-'));
        const inst = path.join(base, 'installed');
        const src = path.join(base, 'source');
        fs.mkdirSync(inst);
        fs.mkdirSync(src);
        return { inst, src };
    }

    it('marks pending reinstall when the source body shrank after the install', () => {
        const { inst, src } = layers();
        fs.writeFileSync(path.join(src, 'a-rule.md'), SRC_BODY.replace(' that the source now shortened', ''));
        // The installer rewrites frontmatter into host form; only the body counts.
        fs.writeFileSync(path.join(inst, 'a-rule.md'), SRC_BODY.replace('type: auto', 'paths: []'));
        const [row] = reinstallRows('global', inst, src);
        expect(row).toMatchObject({ id: 'a-rule', compared: 'body', status: 'pending reinstall' });
        expect(row?.installed).not.toBe(row?.source);
    });

    it('a matching body under rewritten frontmatter is current, not pending reinstall', () => {
        const { inst, src } = layers();
        fs.writeFileSync(path.join(src, 'a-rule.md'), SRC_BODY);
        fs.writeFileSync(path.join(inst, 'a-rule.md'), SRC_BODY.replace('type: auto', 'package: x'));
        expect(reinstallRows('global', inst, src)[0]?.status).toBe('current');
    });

    it('a stub compares its copied law digest — pending reinstall when the source law moved', () => {
        const { inst, src } = layers();
        const stub = (digest: string): string =>
            `# law-rule\n\n${THIN_ENTRY_MARKER}\n\n${STUB_LAW_OPEN}${digest} -->\n${LAW}\n<!-- /law -->\n`;
        // Positive control first: a stub written from the CURRENT law is current.
        fs.writeFileSync(path.join(src, 'law-rule.md'), lawRule(LAW));
        const now = reinstallRows('global', src, src)[0];
        expect(now?.compared).toBe('body');
        fs.writeFileSync(path.join(inst, 'law-rule.md'), stub(reinstallLawDigest(src)));
        expect(reinstallRows('global', inst, src)[0]).toMatchObject({ compared: 'law', status: 'current' });
        // Then the source law changes and the installed stub does not.
        fs.writeFileSync(path.join(src, 'law-rule.md'), lawRule('NEVER DO THE OTHER THING.'));
        expect(reinstallRows('global', inst, src)[0]).toMatchObject({
            compared: 'law',
            status: 'pending reinstall',
        });
    });

    it('a stub with no copied text cannot go stale, and a missing source is named, not pending reinstall', () => {
        const { inst, src } = layers();
        fs.writeFileSync(path.join(src, 'thin.md'), SRC_BODY);
        fs.writeFileSync(path.join(inst, 'thin.md'), `# thin\n\n${THIN_ENTRY_MARKER}\n`);
        fs.writeFileSync(path.join(inst, 'gone.md'), SRC_BODY);
        const rows = reinstallRows('project', inst, src);
        expect(rows.find((r) => r.id === 'thin')).toMatchObject({ compared: 'none', status: 'current' });
        expect(rows.find((r) => r.id === 'gone')?.status).toBe('no source');
        expect(rows.filter((r) => r.status === 'pending reinstall')).toEqual([]);
    });

    /** The digest the stub writer would record for the law in `dir/law-rule.md`. */
    function reinstallLawDigest(dir: string): string {
        const text = fs.readFileSync(path.join(dir, 'law-rule.md'), 'utf-8');
        const law = lawText(ruleBody(text));
        if (law === null) throw new Error('fixture has no law section');
        return lawDigest(law);
    }
});
