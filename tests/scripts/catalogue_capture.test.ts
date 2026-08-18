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
    OBSERVATION_HOST_BAR,
    OBSERVATION_VOLUME_BAR,
    analyzeSelector,
    buildHostEventRecord,
    buildObservationRecord,
    cadenceStatus,
    catalogueLimitWarning,
    formatCadenceStatus,
    formatPerHostVerdicts,
    formatPointableBare,
    formatReport,
    joinPointableBare,
    knownHostLimits,
    latestPointableBarePerHost,
    migrationEligibility,
    migrationPromptLines,
    observationSourceOf,
    parseHostBudgetEvent,
    readProjectedCatalogue,
    scopeFlagDecision,
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

    // The self-report path is the ONLY one that fills `bare_names`, so it is
    // the only source the pointable-but-bare join can read — and until
    // 2026-08-18 it could not record its projection scope at all, while the
    // host-event records beside it could.
    it('records the projection scope on a self-report observation', () => {
        const projected = [entry({ name: 'a', position: 1 }), entry({ name: 'b', position: 2 })];
        const report = { catalogueRoot: 'src/skills', ...analyzeSelector(projected, ['b']) };

        const record = buildObservationRecord(report, 'claude', '2026-08-18', 2, 'scoped');

        expect(record.projection_mode).toBe('scoped');
        expect(record.projected_skill_count).toBe(2);
    });

    it('omits the scope rather than defaulting it — absence is not `legacy-all`', () => {
        const projected = [entry({ name: 'a', position: 1 }), entry({ name: 'b', position: 2 })];
        const report = { catalogueRoot: 'src/skills', ...analyzeSelector(projected, ['b']) };

        const record = buildObservationRecord(report, 'claude', '2026-08-18');

        expect('projection_mode' in record).toBe(false);
        expect('projected_skill_count' in record).toBe(false);
    });
});

describe('cadence', () => {
    const claude: ObservationRecord = {
        schema: 1,
        observed_at: '2026-08-01',
        host: 'claude',
        entries_total: 300,
        bare_count: 2,
        described_count: 5,
        bare_names: ['alpha', 'beta'],
        verdict: 'no-selector',
        separating_candidates: [],
        truncation_mode: 'per-entry',
        observation_source: 'self-report',
    };
    const codex: ObservationRecord = {
        schema: 1,
        observed_at: '2026-08-17',
        host: 'codex',
        entries_total: 497,
        bare_count: 0,
        described_count: 0,
        bare_names: [],
        verdict: 'insufficient-observation',
        separating_candidates: [],
        truncation_mode: 'budget-strip-and-drop',
        observation_source: 'host-event',
        projection_mode: 'scoped',
    };

    it('reports per host and never pools them into one freshness verdict', () => {
        const rows = cadenceStatus([claude, codex], '2026-08-18');

        expect(rows.map((r) => r.host)).toEqual(['claude', 'codex']);
        // 17 days vs 1 day: one host is stale while the other is current, and a
        // pooled answer would describe neither.
        expect(rows[0]!.due).toBe(true);
        expect(rows[0]!.daysSince).toBe(17);
        expect(rows[1]!.due).toBe(false);
        expect(rows[1]!.daysSince).toBe(1);
    });

    it('counts observations carrying no projection scope instead of hiding them', () => {
        const rows = cadenceStatus([claude, codex], '2026-08-18');

        expect(rows[0]!.unscoped).toBe(1);
        expect(rows[1]!.unscoped).toBe(0);
    });

    it('reads an unparseable stamp as DUE, never as fresh', () => {
        const broken = { ...claude, observed_at: 'not-a-date' };

        const rows = cadenceStatus([broken], '2026-08-18');

        expect(Number.isNaN(rows[0]!.daysSince)).toBe(true);
        // A broken date and a current one must not look alike — the same law
        // the host-event parser follows when it refuses to record a zero.
        expect(rows[0]!.due).toBe(true);
    });

    it('states the volume bar as quoted, and never invents a different one', () => {
        expect(OBSERVATION_VOLUME_BAR).toBe(20);
        expect(OBSERVATION_HOST_BAR).toBe(2);

        const out = formatCadenceStatus(cadenceStatus([claude, codex], '2026-08-18'), '2026-08-18');

        expect(out).toContain('2/20 observation(s) across 2/2 host(s)');
    });

    it('says every host is due when the corpus is empty', () => {
        expect(cadenceStatus([], '2026-08-18')).toEqual([]);
        expect(formatCadenceStatus([], '2026-08-18')).toContain('every host is due');
    });
});

describe('pointable-but-bare join (D-4)', () => {
    const perEntry: ObservationRecord = {
        schema: 1,
        observed_at: '2026-08-12',
        host: 'claude',
        entries_total: 300,
        bare_count: 3,
        described_count: 9,
        bare_names: ['on-disk-a', 'on-disk-b', 'gone-from-disk'],
        verdict: 'no-selector',
        separating_candidates: [],
        truncation_mode: 'per-entry',
        observation_source: 'self-report',
    };
    const stripAndDrop: ObservationRecord = {
        schema: 1,
        observed_at: '2026-08-16',
        host: 'codex',
        entries_total: 497,
        bare_count: 0,
        described_count: 0,
        bare_names: [],
        verdict: 'insufficient-observation',
        separating_candidates: [],
        truncation_mode: 'budget-strip-and-drop',
        observation_source: 'host-event',
        dropped_count: 402,
    };

    it('counts the bare entries the ranker can still name', () => {
        const { rows } = joinPointableBare([perEntry], ['on-disk-a', 'on-disk-b', 'unrelated']);

        expect(rows).toHaveLength(1);
        expect(rows[0]!.pointableBare).toBe(2);
        expect(rows[0]!.pointableNames).toEqual(['on-disk-a', 'on-disk-b']);
        expect(rows[0]!.unpointableBare).toBe(1);
        expect(rows[0]!.unpointableNames).toEqual(['gone-from-disk']);
    });

    // The load-bearing test. A strip-and-drop host enumerates nothing, so its
    // empty `bare_names` means "not counted", not "none were bare". Emitting a
    // row of 0 for it would be a zero inferred from silence — the one failure
    // this module's header forbids outright.
    it('SKIPS a host that publishes no per-entry list rather than scoring it 0', () => {
        const join = joinPointableBare([perEntry, stripAndDrop], ['on-disk-a']);

        expect(join.rows).toHaveLength(1);
        expect(join.rows.map((r) => r.host)).toEqual(['claude']);
        expect(join.skippedNonPerEntry).toBe(1);
    });

    // R2 finding 5. `readObservationLog` builds records with an unchecked
    // `JSON.parse … as` over an append-only log with more than one producer, so
    // a line missing `bare_names` is a real state — and it used to take the
    // whole mode down with a TypeError.
    it('skips a malformed record instead of crashing, and counts it', () => {
        const malformed = { ...perEntry, bare_names: undefined } as unknown as ObservationRecord;

        const join = joinPointableBare([perEntry, malformed], ['on-disk-a']);

        expect(join.rows).toHaveLength(1);
        expect(join.skippedMalformed).toBe(1);
        expect(formatPointableBare(join, 'src/skills', 2)).toContain('malformed log line(s)');
    });

    it('treats zero on a per-entry observation as a legitimate answer', () => {
        const join = joinPointableBare([perEntry], ['something', 'else']);

        expect(join.rows).toHaveLength(1);
        expect(join.rows[0]!.pointableBare).toBe(0);
        expect(formatPointableBare(join, 'src/skills', 2)).toContain(
            'claude (2026-08-12): 0 — the ranker points at nothing this host degraded.',
        );
    });

    it('distinguishes "nothing to join" from "joined and found zero"', () => {
        const out = formatPointableBare(
            { rows: [], skippedNonPerEntry: 1, skippedMalformed: 0 },
            'src/skills',
            2,
        );

        expect(out).toContain('This is NOT a count of zero');
        expect(out).toContain('D-4 divergence: unmeasured.');
    });

    // R2 finding 4. A pooled `Math.max` across every host and every date let a
    // superseded observation supply the headline while the current one read 0,
    // with no host or date attached to the number — the same failure
    // `_supersedes` and `formatPerHostVerdicts` exist to prevent.
    it('states the headline per host off that host\'s latest row, never pooled', () => {
        const stale = { ...perEntry, observed_at: '2026-01-01' };
        const current = { ...perEntry, observed_at: '2026-08-12', bare_names: ['unrelated'] };

        const join = joinPointableBare([stale, current], ['on-disk-a', 'on-disk-b']);
        const out = formatPointableBare(join, 'src/skills', 2);

        // The stale row scores 2 and the current one 0. A pooled max would
        // headline 2; the per-host headline must quote the current row.
        expect(out).toContain('claude (2026-08-12): 0');
        expect(out).not.toContain('up to 2 skill(s)');
        expect(latestPointableBarePerHost(join.rows).get('claude')!.observedAt).toBe('2026-08-12');
    });
});

// R2 finding 8: this decision was module-private and untested, and it is the
// one the roadmap's part (c) treats as load-bearing — a later edit could
// regress it to a `<scoped|legacy-all>` placeholder with nothing objecting.
describe('scope-flag decision', () => {
    const row = (installedSkills: number, matches: 'scoped' | 'legacy-all' | 'indeterminate') => ({
        host: 'codex',
        root: '/root',
        installedSkills,
        matches,
    });

    it('names the mode when the installed root matches one', () => {
        const decision = scopeFlagDecision('/root', true, row(219, 'scoped'));

        expect(decision.mode).toBe('scoped');
        expect(decision.reason).toContain('219 skills');
    });

    it('claims NO mode on an indeterminate root, and says why', () => {
        const decision = scopeFlagDecision('/root', true, row(297, 'indeterminate'));

        expect(decision.mode).toBeNull();
        expect(decision.reason).toContain('matches neither projection count');
        expect(decision.reason).toContain('label a reading nobody took');
    });

    // Same output, different fact. Collapsing the two would report "this
    // install's scope is unmeasurable" for a host that is simply not installed.
    it('claims NO mode when the root is absent, with a DIFFERENT reason', () => {
        const decision = scopeFlagDecision('/root', false, null);

        expect(decision.mode).toBeNull();
        expect(decision.reason).toContain('not installed here');
        expect(decision.reason).not.toContain('matches neither');
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
    const codexRecord = buildHostEventRecord(
        'codex',
        '2026-08-15',
        497,
        { droppedCount: 401, descriptionsStripped: true },
        297,
    );

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
            projectedSkills: 297,
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
        // Skills decide, not artefacts: a tree with MORE artefacts but fewer
        // skills than the observation is not comparable evidence of truncation.
        expect(
            catalogueLimitWarning({ ...over, artefacts: 900, skillEntries: 10 }, limits.get('codex')),
        ).toBeNull();
        // An unmeasured host gets no invented number, so it gets no warning.
        expect(catalogueLimitWarning({ ...over, host: 'claude' }, limits.get('claude'))).toBeNull();
    });
});

describe('migration eligibility (AI council 2026-08-15, 2/2)', () => {
    const limits = knownHostLimits([
        buildHostEventRecord('codex', '2026-08-15', 497, { droppedCount: 393, descriptionsStripped: true }, 297),
    ]);

    it('is eligible when this host truncated and the install is legacy-all', () => {
        const e = migrationEligibility('codex', 'legacy-all', 297, limits);

        expect(e).toMatchObject({ eligible: true, reason: 'eligible', droppedEntries: 393 });
    });

    it('never fires on an install that already scoped', () => {
        expect(migrationEligibility('codex', 'scoped', 297, limits).reason).toBe('already-scoped');
    });

    it('never extrapolates from another host', () => {
        expect(migrationEligibility('claude', 'legacy-all', 900, limits).reason).toBe(
            'no-observation-for-host',
        );
    });

    // The correction the council made, and the reason it matters: a probe
    // moved the host's dropped count by 0 for +60 commands and +53 for +60
    // skills. Comparing artefact TOTALS would fire here — 600 artefacts is
    // far above the 497 recorded — while the skill population has shrunk and
    // nothing is being truncated.
    it('compares SKILLS, so command growth alone never triggers it', () => {
        expect(migrationEligibility('codex', 'legacy-all', 100, limits).reason).toBe(
            'below-observed-skill-volume',
        );
    });

    it('refuses an observation with no comparable skill count', () => {
        const old = knownHostLimits([
            buildHostEventRecord('codex', '2026-08-15', 497, {
                droppedCount: 393,
                descriptionsStripped: true,
            }),
        ]);

        expect(migrationEligibility('codex', 'legacy-all', 999, old).reason).toBe(
            'observation-not-comparable',
        );
    });

    it('never offers a CLI write for a class-C key', () => {
        const lines = migrationPromptLines(
            'codex',
            migrationEligibility('codex', 'legacy-all', 297, limits),
            '/x/.agent-settings.yml',
        ).join('\n');

        // `settings:set` refuses class-C keys by construction, so naming it
        // would send the reader to a command guaranteed to reject them.
        expect(lines).not.toContain('settings:set');
        expect(lines).toContain('/x/.agent-settings.yml');
        expect(lines).toContain('mode: scoped');
        expect(lines).toContain('agent-config config');
        expect(lines).toContain('legitimate choice');
    });
});
