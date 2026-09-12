// The generated per-slot enforcement region, and the four properties that make
// generating a human-facing document safer than hand-maintaining it.
//
// First, the vocabulary must not outrun the data: `outcomeFor` can never return
// `halt-by-state`, and a committed cell carrying it is rejected with its own
// message. A value defined in prose and emitted by nothing is a category a
// generator bug could print into a table that looks authoritative, and the
// rejection is the answer to that.
//
// Second, the projection must have exactly one implementation. The generator
// imports `readSlots` from the reporter that measured the drift, and the one
// literal the two files cannot share — the region marker, because the import
// runs the other way — is pinned equal here.
//
// Third, a regeneration must touch only the region. The prose above and below
// the markers carries the reasons, which is the half a generated table cannot
// hold, and `spliceDoc` is asserted to preserve it byte for byte.
//
// Fourth, the committed document must agree with the configuration on the real
// tree, including the row the whole roadmap was about: the slot carrying the
// content scanner, which reads non-`refusal` and is derived here from the
// manifest rather than repeated from memory.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    BEGIN_MARKER,
    CONFIGURED_OUTCOMES,
    DOC_REL,
    END_MARKER,
    LOWERING_REL,
    backedOutcomes,
    backingFor,
    buildRows,
    committedCells,
    extractRegion,
    outcomeFor,
    renderRegion,
    spliceDoc,
    summaryLine,
    unbackedOutcomes,
} from '../../src/scripts/check_enforcement_matrix.js';
import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const REPORTER_SOURCE = path.join(REPO_ROOT, 'src', 'scripts', 'report_enforcement_drift.ts');

function realLowering(): ReturnType<typeof parseHostLowering> {
    return parseHostLowering(fs.readFileSync(path.join(REPO_ROOT, LOWERING_REL), 'utf-8'));
}

function realDoc(): string {
    return fs.readFileSync(path.join(REPO_ROOT, DOC_REL), 'utf-8');
}

/** Two hosts, one propagating and partially blocking, one discarding. */
const FIXTURE_YAML = `schema_version: 1
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
  gamma:
    surfaces:
      any:
        entry_shape: none
        json_shape: none
        fail_policy: discard
        timeout_unit: unknown
        timeout_default: null
        verified: null
        slots: {}
`;

describe('the closed vocabulary, and the value nothing emits', () => {
    it('names exactly four values', () => {
        expect([...CONFIGURED_OUTCOMES]).toEqual([
            'refusal',
            'halt-by-state',
            'warning',
            'unenforced',
        ]);
    });

    it('never derives `halt-by-state` from any shape of configuration', () => {
        const policies = ['propagate', 'discard', 'unknown'];
        const readings = [
            { slot: 's', literal: 2, effective: 2 },
            { slot: 's', literal: 2, effective: null },
            { slot: 's', literal: null, effective: null },
        ];
        const seen = new Set<string | null>();
        for (const p of policies) for (const r of readings) seen.add(outcomeFor(r, p));
        expect(seen.has('halt-by-state')).toBe(false);
    });

    it('reads refusal off the effective value, so an expiry downgrades the cell', () => {
        // The literal still says 2; the row's `verified` block has expired, so
        // the effective value is null and the cell must not claim a refusal.
        const disarmed = { slot: 'pre_tool_use', literal: 2, effective: null };
        expect(outcomeFor(disarmed, 'propagate')).toBe('warning');
        expect(backingFor(disarmed, 'propagate')).toContain('disarmed by an expired');
    });

    it('returns null rather than guessing on a `fail_policy` it does not know', () => {
        expect(outcomeFor({ slot: 's', literal: null, effective: null }, 'shrug')).toBeNull();
    });

    it('splits the non-refusal case on `fail_policy`', () => {
        const none = { slot: 's', literal: null, effective: null };
        expect(outcomeFor(none, 'propagate')).toBe('warning');
        expect(outcomeFor(none, 'discard')).toBe('unenforced');
    });
});

describe('the backing set', () => {
    it('never admits `halt-by-state`, on the real tree or the fixture', () => {
        expect(backedOutcomes(realLowering()).has('halt-by-state')).toBe(false);
        expect(backedOutcomes(parseHostLowering(FIXTURE_YAML)).has('halt-by-state')).toBe(false);
    });

    it('is computed from the configuration fields, not from the generated rows', () => {
        // This is the non-circularity property, and it was a real defect before
        // it was a test: the first version collected the outcomes it found in
        // its own output, which made a broken mapping self-backing. A fixture
        // with no propagating host must therefore NOT back `warning`, even
        // though a broken mapping could have emitted it everywhere.
        const discardOnly = `schema_version: 1
hosts:
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
        const backed = backedOutcomes(parseHostLowering(discardOnly));
        expect([...backed].sort()).toEqual(['unenforced']);
    });

    it('backs `refusal` only when an unexpired blocking exit exists', () => {
        const expired = FIXTURE_YAML.replace('expires: 2099-01-01', 'expires: 2000-01-01');
        expect(backedOutcomes(parseHostLowering(expired)).has('refusal')).toBe(false);
        expect(backedOutcomes(parseHostLowering(FIXTURE_YAML)).has('refusal')).toBe(true);
    });
});

describe('unbacked cells', () => {
    const backed = backedOutcomes(parseHostLowering(FIXTURE_YAML));

    it('rejects a cell claiming a value the configuration does not produce', () => {
        const region = renderRegion(parseHostLowering(FIXTURE_YAML)).replace(
            '| `warning` |',
            '| `halt-by-state` |',
        );
        const findings = unbackedOutcomes(region, backed);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('halt-by-state');
        expect(findings[0]).toContain('NO line in');
    });

    it('rejects a cell outside the closed vocabulary, with a different message', () => {
        const region = renderRegion(parseHostLowering(FIXTURE_YAML)).replace(
            '| `refusal` |',
            '| `blocked` |',
        );
        const findings = unbackedOutcomes(region, backed);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('not in the closed vocabulary');
    });

    it('accepts the region the generator produced', () => {
        expect(unbackedOutcomes(renderRegion(parseHostLowering(FIXTURE_YAML)), backed)).toEqual([]);
    });

    it('is blind to a reachable value that is wrong for its row, which the drift check owns', () => {
        // Stated as a test so the guard's reach cannot be overread later: a
        // `warning` flipped to `unenforced` is backed and passes HERE.
        const region = renderRegion(parseHostLowering(FIXTURE_YAML)).replace(
            '| `refusal` |',
            '| `unenforced` |',
        );
        expect(unbackedOutcomes(region, backed)).toEqual([]);
        expect(region).not.toBe(renderRegion(parseHostLowering(FIXTURE_YAML)));
    });
});

describe('one row per host and bound slot', () => {
    const lowering = parseHostLowering(FIXTURE_YAML);

    it('emits a row for every lowerable slot and none for a slotless host', () => {
        const { rows, slotlessHosts } = buildRows(lowering);
        expect(rows.map((r) => `${r.host}/${r.slot}`)).toEqual([
            'alpha/pre_tool_use',
            'alpha/post_tool_use',
            'beta/stop',
        ]);
        expect(slotlessHosts).toEqual(['gamma']);
    });

    it('keeps the configuration file’s own slot order rather than sorting', () => {
        // `host_lowering.yaml` states that its slot order is part of the
        // generated bridge output; sorting here would make a diff of this table
        // stop corresponding to a diff of the YAML.
        const rows = buildRows(realLowering()).rows.filter((r) => r.host === 'claude');
        expect(rows.map((r) => r.slot)).toEqual([
            'session_start',
            'session_end',
            'stop',
            'user_prompt_submit',
            'pre_tool_use',
            'post_tool_use',
            'pre_compact',
            'subagent_start',
            'subagent_stop',
        ]);
    });

    it('reports a blocking exit under a discarding policy instead of picking a side', () => {
        const contradictory = FIXTURE_YAML.replace(
            'stop: { native: Stop, block_exit: null }',
            'stop: { native: Stop, block_exit: 2 }',
        ).replace('verified: null\n        slots:\n          stop', 'verified:\n          docs_at: null\n          docs_url: null\n          probe_at: null\n          host_version: null\n          expires: 2099-01-01\n        slots:\n          stop');
        const { contradictions } = buildRows(parseHostLowering(contradictory));
        expect(contradictions).toHaveLength(1);
        expect(contradictions[0]).toContain('fail_policy: discard');
        expect(contradictions[0]).toContain('will not pick one');
    });
});

describe('the derived summary', () => {
    it('lives inside the region and is recomputed from the same rows as the table', () => {
        const lowering = realLowering();
        const region = renderRegion(lowering);
        const line = summaryLine(lowering, buildRows(lowering).rows);
        expect(region).toContain(line);
        expect(line).toContain('host-slot pairs configure a refusal');
    });

    it('moves when the configuration moves', () => {
        const before = summaryLine(
            parseHostLowering(FIXTURE_YAML),
            buildRows(parseHostLowering(FIXTURE_YAML)).rows,
        );
        const flipped = FIXTURE_YAML.replace(
            'post_tool_use: { native: PostToolUse, block_exit: null }',
            'post_tool_use: { native: PostToolUse, block_exit: 2 }',
        );
        const after = summaryLine(
            parseHostLowering(flipped),
            buildRows(parseHostLowering(flipped)).rows,
        );
        expect(after).not.toBe(before);
        expect(before).toContain('1 of 3 host-slot pairs');
        expect(after).toContain('2 of 3 host-slot pairs');
    });

    it('counts `halt-by-state` and reports zero, rather than omitting the value', () => {
        expect(summaryLine(realLowering(), buildRows(realLowering()).rows)).toContain(
            '0 are `halt-by-state`',
        );
    });
});

describe('the region boundary', () => {
    const doc = [
        '# heading',
        '',
        'hand-written prose that must survive',
        '',
        BEGIN_MARKER,
        'stale body',
        END_MARKER,
        '',
        '## Loop primitive',
        '',
        'more hand-written prose',
        '',
    ].join('\n');

    it('replaces only what lies between the markers', () => {
        const next = spliceDoc(doc, 'NEW BODY');
        expect(next.slice(0, next.indexOf(BEGIN_MARKER))).toBe(
            doc.slice(0, doc.indexOf(BEGIN_MARKER)),
        );
        expect(next.slice(next.indexOf(END_MARKER))).toBe(doc.slice(doc.indexOf(END_MARKER)));
        expect(next).toContain('## Loop primitive');
        expect(next).not.toContain('stale body');
    });

    it('is idempotent', () => {
        const once = spliceDoc(doc, 'NEW BODY');
        expect(spliceDoc(once, 'NEW BODY')).toBe(once);
    });

    it('refuses a document that has lost its markers', () => {
        expect(() => spliceDoc('# no markers here\n', 'x')).toThrow(/missing the generated-region/);
    });

    it('round-trips: what is spliced in is what comes back out', () => {
        const region = renderRegion(realLowering());
        expect(extractRegion(spliceDoc(doc, region))).toBe(region);
    });
});

describe('the one projection, and the one literal the two files cannot share', () => {
    it('pins the marker the reporter holds as a copy', () => {
        // `check_enforcement_matrix` imports `report_enforcement_drift`, so the
        // reporter cannot import the marker back without a cycle. It holds a
        // literal instead, and this is what keeps the two spellings equal.
        const src = fs.readFileSync(REPORTER_SOURCE, 'utf-8');
        expect(src).toContain(`const GENERATED_REGION_MARKER = '${BEGIN_MARKER}'`);
    });

    it('reads the slot column through the reporter rather than re-walking the table', () => {
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'check_enforcement_matrix.ts'),
            'utf-8',
        );
        expect(src).toContain("from './report_enforcement_drift.js'");
        expect(src).toContain('readSlots(lowering, host)');
    });
});

describe('the committed document', () => {
    it('carries a region that matches what the configuration produces', () => {
        expect(extractRegion(realDoc())).toBe(renderRegion(realLowering()));
    });

    it('carries one row per lowerable host-slot pair', () => {
        const cells = committedCells(extractRegion(realDoc()) ?? '');
        const rows = buildRows(realLowering()).rows;
        expect(cells.map((c) => c.label)).toEqual(rows.map((r) => `${r.host}/${r.slot}`));
        expect(cells.length).toBeGreaterThan(20);
    });

    it('reads non-blocking on the slot that carries the content scanner', () => {
        // The slot is derived from the manifest, not remembered: `injection-scan`
        // is the content scanner, and the roadmap's finding is that the slot it
        // binds to on the one refusing host does NOT carry a refusal.
        const manifest = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf-8',
        );
        const slots = new Set<string>();
        for (const line of manifest.split('\n')) {
            const m = /^\s{4}([a-z_]+):\s+\[(.*)\]\s*$/.exec(line);
            if (m === null) continue;
            if ((m[2] ?? '').split(',').some((c) => c.trim() === 'injection-scan')) {
                slots.add(m[1] ?? '');
            }
        }
        expect([...slots]).toEqual(['post_tool_use']);

        const cells = committedCells(extractRegion(realDoc()) ?? '');
        const cell = cells.find((c) => c.label === 'claude/post_tool_use');
        expect(cell).toBeDefined();
        expect(cell?.value).not.toBe('refusal');
    });

    it('keeps the hand-written taxonomy and the loop-primitive table outside the region', () => {
        const doc = realDoc();
        const region = extractRegion(doc) ?? '';
        expect(doc).toContain('## Loop primitive');
        expect(region).not.toContain('## Loop primitive');
        expect(region).not.toContain('Currently unused');
        expect(doc).toContain('Currently unused');
    });

    it('titles the region as configured behavior, never as enforced behavior', () => {
        const region = extractRegion(realDoc()) ?? '';
        expect(region).toContain('configured behavior, not observed behavior');
        expect(region).not.toMatch(/enforced behavior/i);
    });

    it('names its source file and its regeneration command beside the region', () => {
        const doc = realDoc();
        const head = doc.slice(0, doc.indexOf(BEGIN_MARKER));
        expect(head).toContain('DO NOT EDIT BY HAND');
        expect(head).toContain('check_enforcement_matrix --write');
        expect(head).toContain(LOWERING_REL);
    });

    it('no longer publishes a binary host-level deny column', () => {
        // The measured mismatch was a binary cell summarising a column that
        // disagreed with itself. No binary value would have been faithful, so
        // the column was removed rather than corrected.
        expect(realDoc()).not.toContain('| Deny honoured |');
    });
});
