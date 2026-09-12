// Enforcement drift — the published host-level claim against the per-slot
// lowering values.
//
// Three properties are pinned here and none of them is today's count. First,
// the comparison rule must actually change the verdict: a strict reading of a
// binary host cell rejects a partially-blocking host and a lenient one accepts
// it, and a test that only exercised one would let the other rot into a rule
// nobody can re-derive. Second, an empty mismatch list and a failure to find
// the table must stay distinguishable — a parse miss that rendered as "no
// drift" would be a clean bill of health issued by a check that looked at
// nothing. Third, the reporter is read-only: it is asserted here that its
// source carries no file-creating call, because the whole argument for pointing
// it at the committed tree is that doing so cannot change the tree.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';
import {
    agrees,
    compareEnforcement,
    deriveDeny,
    loweringKeyFor,
    main,
    parseClaim,
    parsePublishedMatrix,
    render,
    type SlotReading,
} from '../../src/scripts/report_enforcement_drift.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SOURCE = path.join(REPO_ROOT, 'src', 'scripts', 'report_enforcement_drift.ts');

/** A host with one blocking slot and one that is not — the partial case. */
const PARTIAL_YAML = `schema_version: 1
hosts:
  alpha:
    surfaces:
      any:
        entry_shape: x
        json_shape: none
        fail_policy: propagate
        timeout_unit: seconds
        timeout_default: null
        verified:
          docs_at: null
          docs_url: null
          probe_at: null
          host_version: null
          expires: 2099-01-01
        slots:
          pre_tool_use:  { native: PreToolUse,  block_exit: 2 }
          post_tool_use: { native: PostToolUse, block_exit: null }
  beta:
    surfaces:
      any:
        entry_shape: x
        json_shape: none
        fail_policy: discard
        timeout_unit: unknown
        timeout_default: null
        verified: null
        slots:
          stop: { native: Stop, block_exit: null }
`;

function doc(rows: string): string {
    return [
        '# heading',
        '',
        '| Host | Compile-time rules | Lifecycle slots bound | Deny honoured |',
        '|---|---|---|---|',
        rows,
        '',
        'trailing prose',
        '',
    ].join('\n');
}

function slots(...effective: Array<number | null>): SlotReading[] {
    return effective.map((e, i) => ({ slot: `s${String(i)}`, literal: e, effective: e }));
}

describe('parsePublishedMatrix', () => {
    it('reads label, slot count and claim from each row', () => {
        const rows = parsePublishedMatrix(doc('| Alpha | ✅ | 2 | ✅ it refuses |'));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.label).toBe('Alpha');
        expect(rows[0]?.host).toBe('alpha');
        expect(rows[0]?.publishedSlots).toBe(2);
        expect(rows[0]?.claimed).toBe('honoured');
    });

    it('returns nothing when the matrix header is absent', () => {
        expect(parsePublishedMatrix('| a | b |\n|---|---|\n| 1 | 2 |\n')).toEqual([]);
    });

    it('ignores a different table that precedes the matrix', () => {
        // The published document carries more than one table, so anchoring on
        // position rather than on the header would silently retarget.
        const other = ['| Host | Loop primitive | Verified |', '|---|---|---|', '| Alpha | none | x |', ''].join('\n');
        const rows = parsePublishedMatrix(other + doc('| Beta | ✅ | 1 | ❌ no |'));
        expect(rows.map((r) => r.label)).toEqual(['Beta']);
    });
});

describe('parseClaim', () => {
    it.each([
        ['✅ the only host that refuses on a deny', 'honoured'],
        ['❌ bound, verdict not honoured', 'not-honoured'],
        ['— `fallback_only`, nothing bound', 'not-applicable'],
        ['probably', 'unparsed'],
    ])('reads %s', (cell, expected) => {
        expect(parseClaim(cell)).toBe(expected);
    });
});

describe('loweringKeyFor', () => {
    it('takes the first word, lower-cased', () => {
        expect(loweringKeyFor('Claude Code (plugin)')).toBe('claude');
        expect(loweringKeyFor('Windsurf')).toBe('windsurf');
    });
});

describe('deriveDeny', () => {
    it('separates all, partial and none', () => {
        expect(deriveDeny(slots(2, 2), true)).toBe('all');
        expect(deriveDeny(slots(2, null), true)).toBe('partial');
        expect(deriveDeny(slots(null, null), true)).toBe('none');
        expect(deriveDeny([], true)).toBe('no-slots');
        expect(deriveDeny([], false)).toBe('unmodelled');
    });
});

describe('agrees — the rule is load-bearing', () => {
    it('rejects a partial host under strict and accepts it under lenient', () => {
        expect(agrees('honoured', 'partial', 'strict')).toBe(false);
        expect(agrees('honoured', 'partial', 'lenient')).toBe(true);
    });

    it('treats a unanimous host the same under both rules', () => {
        for (const rule of ['strict', 'lenient'] as const) {
            expect(agrees('honoured', 'all', rule)).toBe(true);
            expect(agrees('not-honoured', 'none', rule)).toBe(true);
            expect(agrees('not-honoured', 'all', rule)).toBe(false);
        }
    });

    it('accepts a dash only where nothing is bound', () => {
        expect(agrees('not-applicable', 'no-slots', 'strict')).toBe(true);
        expect(agrees('not-applicable', 'none', 'strict')).toBe(false);
    });

    it('never calls an unmodelled host a disagreement', () => {
        expect(agrees('honoured', 'unmodelled', 'strict')).toBe(true);
        expect(agrees('not-honoured', 'unmodelled', 'strict')).toBe(true);
    });
});

describe('compareEnforcement over a fixture', () => {
    const markdown = doc(
        ['| Alpha | ✅ | 2 | ✅ refuses on a deny |', '| Beta | ✅ | 1 | ❌ not honoured |', '| Gamma | ✅ | 0 | — absent |'].join(
            '\n',
        ),
    );
    const table = parseHostLowering(PARTIAL_YAML);

    it('flags the partial host under strict and nothing under lenient', () => {
        const strict = compareEnforcement(table, markdown, 'strict', 'l', 'd');
        expect(strict.mismatches.map((r) => r.label)).toEqual(['Alpha']);
        const lenient = compareEnforcement(table, markdown, 'lenient', 'l', 'd');
        expect(lenient.mismatches).toEqual([]);
        // Both counts travel with the report, so the reader can see that the
        // headline is a consequence of the rule.
        expect(strict.mismatchesLenient).toEqual([]);
        expect(lenient.mismatchesStrict.map((r) => r.label)).toEqual(['Alpha']);
    });

    it('names the blocking and non-blocking slots of a flagged host', () => {
        const r = compareEnforcement(table, markdown, 'strict', 'l', 'd').mismatches[0];
        expect(r?.blockingSlots).toEqual(['pre_tool_use']);
        expect(r?.nonBlockingSlots).toEqual(['post_tool_use']);
    });

    it('reports an unmodelled host as not-compared rather than as a mismatch', () => {
        const d = compareEnforcement(table, markdown, 'strict', 'l', 'd');
        expect(d.unverifiable.map((r) => r.label)).toEqual(['Gamma']);
        expect(d.mismatches.map((r) => r.label)).not.toContain('Gamma');
    });

    it('applies verification currency, so an expired row cannot block', () => {
        const expired = PARTIAL_YAML.replace('expires: 2099-01-01', 'expires: 2000-01-01');
        const d = compareEnforcement(parseHostLowering(expired), markdown, 'strict', 'l', 'd');
        const alpha = d.rows.find((r) => r.host === 'alpha');
        expect(alpha?.derived).toBe('none');
        // The literal survives, so the disarming is visible rather than silent.
        expect(alpha?.slots.map((s) => s.literal)).toEqual([2, null]);
        expect(alpha?.slots.map((s) => s.effective)).toEqual([null, null]);
    });
});

describe('render', () => {
    it('distinguishes an empty mismatch list from a table it could not find', () => {
        const table = parseHostLowering(PARTIAL_YAML);
        const clean = render(compareEnforcement(table, doc('| Beta | ✅ | 1 | ❌ no |'), 'strict', 'l', 'd'));
        expect(clean).toContain('MISMATCHES under the strict rule: 0');
        expect(clean).toContain('That is a finding, not a skipped check');

        const missing = render(compareEnforcement(table, 'no table here\n', 'strict', 'l', 'd'));
        expect(missing).toContain('was not found');
        expect(missing).not.toContain('MISMATCHES under');
    });

    it('emits a scanned line counting the published rows', () => {
        const out = render(
            compareEnforcement(
                parseHostLowering(PARTIAL_YAML),
                doc(['| Alpha | ✅ | 2 | ✅ yes |', '| Beta | ✅ | 1 | ❌ no |'].join('\n')),
                'strict',
                'l',
                'd',
            ),
        );
        expect(out.trimEnd().endsWith('scanned: 2')).toBe(true);
    });
});

describe('CLI contract', () => {
    it('exits 0 on the committed tree — it gates on nothing', () => {
        expect(main([])).toBe(0);
    });

    it('rejects an unknown flag and a flag-shaped value', () => {
        expect(main(['--nope'])).toBe(1);
        expect(main(['--rule', '--doc'])).toBe(1);
        expect(main(['--rule', 'sometimes'])).toBe(1);
    });

    it('prints usage on --help', () => {
        expect(main(['--help'])).toBe(0);
    });
});

describe('read-only', () => {
    it('carries no file-creating call in its source', () => {
        const src = fs.readFileSync(SOURCE, 'utf-8');
        for (const call of ['writeFile', 'writeFileSync', 'mkdir', 'mkdirSync', 'appendFile', 'rmSync']) {
            expect(src).not.toContain(call);
        }
    });
});
