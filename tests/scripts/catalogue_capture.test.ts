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
    buildCodexObservationRecord,
    buildObservationRecord,
    countCommandBodies,
    formatReport,
    parseCodexTruncation,
    projectedVolume,
    readProjectedCatalogue,
    type CatalogueEntry,
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
        // Default equal to the character length — these fixtures are ASCII, so
        // the two coincide. A fixture that needs them to diverge overrides it.
        descriptionBytes: 40,
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
            'observation_kind',
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

    it('the codex record obeys the same no-free-form-field floor', () => {
        const record = buildCodexObservationRecord({ dropped: 401 }, 498, '2026-08-15');
        expect(Object.keys(record).sort()).toEqual([
            'bare_count',
            'bare_names',
            'described_count',
            'dropped_count',
            'entries_total',
            'host',
            'observation_kind',
            'observed_at',
            'projection_undercovers',
            'schema',
            'separating_candidates',
            'truncation_mode',
            'verdict',
        ]);
        for (const value of Object.values(record)) {
            const values = Array.isArray(value) ? value : [value];
            for (const v of values) expect(typeof v).not.toBe('object');
        }
    });
});

describe('projectedVolume', () => {
    it('reports bytes, not characters — they diverge on any non-ASCII description', () => {
        const root = path.join(TMP, 'volume');
        fs.mkdirSync(root, { recursive: true });
        // `—` is one character and three UTF-8 bytes. A tool that reported the
        // character count under a byte label would be wrong by exactly the size
        // of this repo's own punctuation habit.
        writeSkill(root, 'a', 'name: a\ndescription: "a—b"');
        writeSkill(root, 'b', 'name: b');

        const v = projectedVolume(root);
        expect(v.entries).toBe(2);
        expect(v.declares_description).toBe(1);
        expect(v.description_bytes).toBe(5);
        expect(readProjectedCatalogue(root)[0]!.descriptionLength).toBe(3);
    });
});

describe('countCommandBodies', () => {
    it('descends into a directory whose name ends in .md instead of counting it', () => {
        const root = path.join(TMP, 'commands-weird');
        fs.mkdirSync(path.join(root, 'weird.md'), { recursive: true });
        fs.writeFileSync(path.join(root, 'weird.md', 'inner.md'), '# a');
        fs.writeFileSync(path.join(root, 'weird.md', 'inner2.md'), '# b');
        fs.writeFileSync(path.join(root, 'plain.md'), '# c');

        // Testing the suffix before the directory branch counted `weird.md` as
        // one command and never descended: 2 instead of 3.
        expect(countCommandBodies(root)).toBe(3);
    });

    it('is zero for an absent root rather than throwing', () => {
        expect(countCommandBodies(path.join(TMP, 'does-not-exist'))).toBe(0);
    });
});

describe('codex truncation parsing', () => {
    // The exact stream shape, captured from `codex exec --json` on 2026-08-15.
    const REAL_EVENT =
        '{"type":"thread.started","thread_id":"01a0"}\n' +
        '{"type":"turn.started"}\n' +
        '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Exceeded skills context budget. All skill descriptions were removed and 401 additional skills were not included in the model-visible skills list."}}\n' +
        '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"OK"}}\n';

    it('reads the dropped count off the structured event', () => {
        expect(parseCodexTruncation(REAL_EVENT)).toEqual({ dropped: 401 });
    });

    it('returns null — never zero — when no budget event is present', () => {
        // The load-bearing distinction of the whole parser: a host that stopped
        // emitting the message and a host that truncated nothing must NOT
        // produce the same record. `null` is "not measured".
        const clean =
            '{"type":"turn.started"}\n{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}\n';
        expect(parseCodexTruncation(clean)).toBeNull();
    });

    it('ignores non-JSON noise interleaved in the stream', () => {
        expect(parseCodexTruncation(`warning: something\n${REAL_EVENT}`)).toEqual({ dropped: 401 });
    });

    it('does not match the same words outside the structured error event', () => {
        // Matching free text would let an agent_message that QUOTES the banner
        // — a transcript, a bug report pasted into a prompt — register as a
        // measurement.
        const quoted =
            '{"type":"item.completed","item":{"type":"agent_message","text":"Exceeded skills context budget. All skill descriptions were removed and 999 additional skills were not included in the model-visible skills list."}}\n';
        expect(parseCodexTruncation(quoted)).toBeNull();
    });

    it('derives survivors from the projection, and never a negative count', () => {
        expect(buildCodexObservationRecord({ dropped: 401 }, 498, '2026-08-15')).toMatchObject({
            host: 'codex',
            entries_total: 498,
            dropped_count: 401,
            bare_count: 97,
            described_count: 0,
            truncation_mode: 'budget-strip-all',
            observation_kind: 'host-reported',
            verdict: 'host-declared-budget',
        });
        // A host reporting more dropped than this tree projects is a real
        // possibility (its estate is not ours), and a negative survivor count
        // would be nonsense rather than a finding.
        expect(buildCodexObservationRecord({ dropped: 900 }, 498, '2026-08-15').bare_count).toBe(0);
    });

    it('marks a clamped survivor count ON THE RECORD, not only in the human report', () => {
        // The whole point: `--json` and `--record` are the channels that
        // persist, and the first version computed under-coverage inside the
        // stdout branch only. A corpus reader could not tell a measured 0 from
        // a clamp.
        const clamped = buildCodexObservationRecord({ dropped: 900 }, 498, '2026-08-15');
        expect(clamped.bare_count).toBe(0);
        expect(clamped.projection_undercovers).toBe(true);

        const measured = buildCodexObservationRecord({ dropped: 393 }, 497, '2026-08-15');
        expect(measured.bare_count).toBe(104);
        expect(measured.projection_undercovers).toBe(false);
    });

    it('never runs the per-entry inference over a budget-shaped observation', () => {
        // Risk 1 of the plan: pooling the two mechanisms. `analyzeSelector`
        // would return `insufficient-observation` here (zero described
        // entries), which reads as a failed measurement rather than the
        // decisive one it is.
        const record = buildCodexObservationRecord({ dropped: 401 }, 498, '2026-08-15');
        expect(record.verdict).not.toBe('insufficient-observation');
        expect(record.verdict).not.toBe('no-selector');
    });
});
