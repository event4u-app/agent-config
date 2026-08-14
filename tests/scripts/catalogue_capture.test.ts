/**
 * `catalogue_capture` — the selector analyzer, including the case that
 * motivated it.
 *
 * The load-bearing test is `refutes a head-N budget`. The census proposed a
 * positional explanation for the described/bare split and a fix (priority
 * ordering) that only works if the explanation holds. A live observation
 * contradicted it — entries far down the sorted catalogue carried
 * descriptions while an earlier one did not. If the analyzer cannot report
 * that as a non-separating candidate, it would rubber-stamp the hypothesis
 * that produced the wrong fix, which is the whole failure this tool exists
 * to prevent.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    analyzeSelector,
    buildHostEventRecord,
    buildObservationRecord,
    catalogueLimitWarning,
    formatPerHostVerdicts,
    formatReport,
    knownHostLimits,
    observationSourceOf,
    parseHostBudgetEvent,
    readProjectedCatalogue,
    truncationModeOf,
    type CatalogueEntry,
    type ObservationRecord,
} from '../../src/scripts/capture_skill_catalogue.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-capture-'));

afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

function writeSkill(root: string, name: string, frontmatter: string): void {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n# ${name}\n`);
}

function entry(overrides: Partial<CatalogueEntry> & { name: string; position: number }): CatalogueEntry {
    return {
        hasDescription: true,
        descriptionLength: 40,
        description: 'x'.repeat(40),
        frontmatterKeys: ['name', 'description'],
        ...overrides,
    };
}

describe('readProjectedCatalogue', () => {
    const root = path.join(TMP, 'projection');

    it('sorts by name and reads description presence off the frontmatter', () => {
        writeSkill(root, 'zebra', 'name: zebra\ndescription: "Use when striping things."');
        writeSkill(root, 'alpha', 'name: alpha\ndescription: "Use when starting things."');
        writeSkill(root, 'bravo', 'name: bravo\nmodel_tier: medium');

        const catalogue = readProjectedCatalogue(root);

        expect(catalogue.map((e) => e.name)).toEqual(['alpha', 'bravo', 'zebra']);
        expect(catalogue.map((e) => e.position)).toEqual([1, 2, 3]);
        expect(catalogue.find((e) => e.name === 'bravo')!.hasDescription).toBe(false);
        expect(catalogue.find((e) => e.name === 'alpha')!.descriptionLength).toBe(
            'Use when starting things.'.length,
        );
    });

    it('ignores directories without a SKILL.md', () => {
        const root2 = path.join(TMP, 'partial');
        writeSkill(root2, 'real', 'name: real\ndescription: "Use when real."');
        fs.mkdirSync(path.join(root2, 'evals'), { recursive: true });

        expect(readProjectedCatalogue(root2).map((e) => e.name)).toEqual(['real']);
    });

    it('follows symlinked entries — the shape the host-facing projection uses', () => {
        // The real `.claude/skills/` is symlinks into `dist/agent-src/skills/`.
        // A `Dirent.isDirectory()` filter reports false for every one of them,
        // which read 47 of 289 entries as the whole catalogue.
        const target = path.join(TMP, 'symlink-target');
        const root3 = path.join(TMP, 'symlink-root');
        writeSkill(target, 'linked', 'name: linked\ndescription: "Use when linked."');
        fs.mkdirSync(root3, { recursive: true });
        try {
            fs.symlinkSync(path.join(target, 'linked'), path.join(root3, 'linked'), 'dir');
        } catch {
            return; // platform without symlink permission — nothing to assert
        }

        const catalogue = readProjectedCatalogue(root3);

        expect(catalogue.map((e) => e.name)).toEqual(['linked']);
        expect(catalogue[0]!.hasDescription).toBe(true);
    });
});

describe('analyzeSelector', () => {
    it('confirms a head-N budget when the positions really are disjoint', () => {
        const projected = [
            entry({ name: 'a', position: 1 }),
            entry({ name: 'b', position: 2 }),
            entry({ name: 'y', position: 3 }),
            entry({ name: 'z', position: 4 }),
        ];

        const report = analyzeSelector(projected, ['y', 'z']);
        const positional = report.candidates.find((c) => c.id === 'positional-head')!;

        expect(positional.separates).toBe(true);
        expect(report.verdict).toBe('selector-found');
    });

    it('refutes a head-N budget when a late entry is described and an early one is bare', () => {
        // The observed shape: `command-routing` early and bare,
        // `using-git-worktrees` late and described.
        const projected = [
            entry({ name: 'aaa-early-described', position: 1 }),
            entry({ name: 'command-routing', position: 45 }),
            entry({ name: 'using-git-worktrees', position: 280 }),
        ];

        const report = analyzeSelector(projected, ['command-routing']);
        const positional = report.candidates.find((c) => c.id === 'positional-head')!;

        expect(positional.separates).toBe(false);
        expect(positional.detail).toContain('overlap');
    });

    it('does not blame the projection when every entry declares a description', () => {
        const projected = [
            entry({ name: 'a', position: 1 }),
            entry({ name: 'b', position: 2 }),
        ];

        const report = analyzeSelector(projected, ['b']);
        const declares = report.candidates.find((c) => c.id === 'declares-description')!;

        expect(declares.separates).toBe(false);
    });

    it('finds a frontmatter key whose presence tracks the split exactly', () => {
        const projected = [
            entry({ name: 'a', position: 1, frontmatterKeys: ['name', 'description', 'user-invocable'] }),
            entry({ name: 'b', position: 2, frontmatterKeys: ['name', 'description', 'user-invocable'] }),
            entry({ name: 'c', position: 3, frontmatterKeys: ['name', 'description'] }),
        ];

        const report = analyzeSelector(projected, ['c']);

        expect(report.candidates.map((c) => c.id)).toContain('frontmatter:user-invocable');
        expect(report.verdict).toBe('selector-found');
    });

    it('reports no-selector rather than inventing one', () => {
        const projected = [
            entry({ name: 'a', position: 1 }),
            entry({ name: 'b', position: 2 }),
            entry({ name: 'c', position: 3 }),
        ];

        // Bare entry sits between two described ones and is identical in every
        // measured property — nothing here can separate them.
        const report = analyzeSelector(projected, ['b']);

        expect(report.verdict).toBe('no-selector');
        expect(formatReport({ catalogueRoot: 'x', ...report })).toContain('Publish the null');
    });

    it('needs both groups before it separates anything', () => {
        const projected = [entry({ name: 'a', position: 1 })];

        expect(analyzeSelector(projected, []).verdict).toBe('insufficient-observation');
        expect(analyzeSelector(projected, ['a']).verdict).toBe('insufficient-observation');
    });

    it('surfaces observed names the projection does not know', () => {
        const projected = [entry({ name: 'a', position: 1 }), entry({ name: 'b', position: 2 })];

        expect(analyzeSelector(projected, ['a', 'ghost']).unknownObserved).toEqual(['ghost']);
    });
});

describe('observation record', () => {
    it('carries only names, counts and a host label — no free-form field', () => {
        const projected = [entry({ name: 'a', position: 1 }), entry({ name: 'b', position: 2 })];
        const report = { catalogueRoot: 'src/skills', ...analyzeSelector(projected, ['b']) };

        const record = buildObservationRecord(report, 'claude', '2026-08-12');

        expect(Object.keys(record).sort()).toEqual([
            'bare_count',
            'bare_names',
            'described_count',
            'entries_total',
            'host',
            'observation_source',
            'observed_at',
            'schema',
            'separating_candidates',
            'truncation_mode',
            'verdict',
        ]);
        // Every value is a scalar or an array of scalars: nothing can hold a body.
        for (const value of Object.values(record)) {
            const values = Array.isArray(value) ? value : [value];
            for (const v of values) expect(typeof v).not.toBe('object');
        }
    });

    it('keeps the host-event record to integers and closed enums', () => {
        const record = buildHostEventRecord('codex', '2026-08-15', 497, {
            droppedCount: 401,
            descriptionsStripped: true,
        });

        expect(Object.keys(record).sort()).toEqual([
            'bare_count',
            'bare_names',
            'described_count',
            'dropped_count',
            'entries_total',
            'host',
            'observation_source',
            'observed_at',
            'schema',
            'separating_candidates',
            'truncation_mode',
            'verdict',
        ]);
        // The host's message is READ; only the integer in it is kept. If any
        // record field could hold that sentence, the parser would have become
        // an egress path for whatever the host decides to say next.
        const serialized = JSON.stringify(record);
        expect(serialized).not.toContain('Exceeded');
        expect(serialized).not.toContain('skills context budget');
        for (const value of Object.values(record)) {
            const values = Array.isArray(value) ? value : [value];
            for (const v of values) expect(typeof v).not.toBe('object');
        }
    });
});

describe('host budget event', () => {
    // Verbatim from `codex exec --json --skip-git-repo-check`, 2026-08-15.
    const REAL_STREAM = [
        '{"type":"thread.started","thread_id":"01a00286-dcc4-7ba2-8e09-e52e7320128c"}',
        '{"type":"turn.started"}',
        '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Exceeded skills context budget. All skill descriptions were removed and 401 additional skills were not included in the model-visible skills list."}}',
        '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"OK"}}',
        '{"type":"turn.completed","usage":{"input_tokens":21998}}',
    ].join('\n');

    it('reads the dropped count off the host event', () => {
        expect(parseHostBudgetEvent(REAL_STREAM)).toEqual({
            droppedCount: 401,
            descriptionsStripped: true,
        });
    });

    it('skips the CLI plain-text chatter interleaved with the JSON channel', () => {
        expect(parseHostBudgetEvent(`Reading additional input from stdin...\n${REAL_STREAM}`)).toEqual(
            { droppedCount: 401, descriptionsStripped: true },
        );
    });

    it('returns null — never zero — when no budget event is present', () => {
        expect(parseHostBudgetEvent('{"type":"turn.completed"}')).toBeNull();
    });

    // The failure this guard exists for: upstream rewords the message, the
    // count no longer parses, and a scanner that fell back to zero would
    // report a fixed defect. Null is the only honest answer.
    it('returns null when the event fires but its wording changed', () => {
        const reworded =
            '{"type":"item.completed","item":{"type":"error","message":"Exceeded skills context budget. Some skills were omitted."}}';

        expect(parseHostBudgetEvent(reworded)).toBeNull();
    });

    it('records descriptionsStripped=false when only entries were dropped', () => {
        const stripless =
            '{"type":"item.completed","item":{"type":"error","message":"Exceeded skills context budget. 12 additional skills were not included in the model-visible skills list."}}';

        expect(parseHostBudgetEvent(stripless)).toEqual({
            droppedCount: 12,
            descriptionsStripped: false,
        });
    });
});

describe('per-host verdicts and measured truncations', () => {
    const claudeRecord: ObservationRecord = {
        schema: 1,
        observed_at: '2026-08-12',
        host: 'claude',
        entries_total: 336,
        bare_count: 16,
        described_count: 19,
        bare_names: ['command-routing'],
        verdict: 'no-selector',
        separating_candidates: [],
        // No `truncation_mode` — exactly the shape written before hosts were
        // distinguished. It must keep reading as `per-entry`.
    };
    const codexRecord = buildHostEventRecord('codex', '2026-08-15', 497, {
        droppedCount: 401,
        descriptionsStripped: true,
    });

    it('reads a pre-existing record as per-entry rather than relabelling it', () => {
        expect(truncationModeOf(claudeRecord)).toBe('per-entry');
        expect(observationSourceOf(claudeRecord)).toBe('self-report');
    });

    it('yields a truncation record only for a host that published its own count', () => {
        const limits = knownHostLimits([claudeRecord, codexRecord]);

        expect(limits.has('claude')).toBe(false);
        // Only the two numbers that were actually measured: what the host said
        // it dropped, and what this tool projected. No delivered count — the
        // two figures do not share a denominator (see buildHostEventRecord).
        expect(limits.get('codex')).toEqual({
            host: 'codex',
            droppedEntries: 401,
            projectedVolume: 497,
            observedAt: '2026-08-15',
        });
    });

    it('reports that the two hosts truncate by DIFFERENT mechanisms', () => {
        const report = formatPerHostVerdicts([claudeRecord, codexRecord]);

        expect(report).toContain('truncation modes DIFFER');
        expect(report).toContain('per-entry');
        expect(report).toContain('budget-strip-and-drop');
        // The pooled verdict is the thing that must not appear: `no-selector`
        // belongs to claude's line and must not be stated over codex, which
        // has no per-entry selector to find.
        expect(report).toMatch(/claude:.*\n.*no-selector/);
        expect(report).not.toMatch(/codex:.*\n.*no-selector/);
    });

    it('warns only against a MEASURED truncation volume', () => {
        const limits = knownHostLimits([claudeRecord, codexRecord]);
        const over = {
            host: 'codex',
            root: '/x',
            skillEntries: 297,
            commandEntries: 200,
            artefacts: 497,
            descriptionBytes: 55114,
        };
        const under = { ...over, artefacts: 40, skillEntries: 40, commandEntries: 0 };

        expect(catalogueLimitWarning(over, limits.get('codex'))).toContain('dropping 401 entries');
        expect(catalogueLimitWarning(under, limits.get('codex'))).toBeNull();
        // An unmeasured host gets no invented number, so it gets no warning.
        expect(catalogueLimitWarning({ ...over, host: 'claude' }, limits.get('claude'))).toBeNull();
    });
});
