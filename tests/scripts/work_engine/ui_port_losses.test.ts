/**
 * The port-losses fixture and the three gates it scores —
 * `road-to-a-ui-coverage-ledger-that-can-fail`.
 *
 * Fixture id `daf-port-losses` (tests/design-artifacts/eval-fixtures.md);
 * the arms live in `tests/design-artifacts/fixtures/ui-port-losses/`.
 *
 * Three gates inside `directives/ui/apply.ts` accepted the case they exist to
 * catch: a declared item was "accounted for" by substring containment against
 * any bucket entry, a port that carried nothing still returned SUCCESS, and the
 * placeholder scan read the porter's own `rendered` report instead of the files
 * it wrote. Each arm below is one of those, and each is asserted in both
 * directions — the loss is caught, and the faithful arm stays silent.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    COVERAGE_BUCKETS,
    COVERED_INVENTORIES,
    coverage_report,
    run as applyRun,
    written_file_placeholders,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';
import { placeholder_paths } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'design-artifacts', 'fixtures', 'ui-port-losses');

type Json = Record<string, unknown>;

function arm(name: string): Json {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')) as Json;
}

const ARTIFACT = arm('_artifact.json');

/** The confirmed brief every arm shares — identical to the probe's. */
function brief(): Json {
    return {
        layout: 'one panel, tab-switched',
        components: ['tablist', 'disclosure', 'subscribe form'],
        states: {
            empty: 'no notes yet',
            loading: 'skeleton lines',
            error: 'could not load the notes',
            success: 'Filed.',
            disabled: 'submit disabled while filing',
        },
        microcopy: { submit: 'Send me the summary' },
        a11y: 'tablist exposes aria-selected; disclosure exposes aria-expanded',
        design_confirmed: true,
        provided_artifact: ARTIFACT,
    };
}

function stateFor(name: string): DeliveryState {
    return new DeliveryState({
        ticket: {
            id: 'T-1',
            title: 'port the release-notes panel',
            ui_apply: arm(name)['ui_apply'],
        } as never,
        ui_design: brief() as never,
        stack: { frontend: 'plain' } as never,
    });
}

/** Everything the step said, in one string. */
function saidBy(r: { message: string; questions: string[] }): string {
    return [r.message, ...r.questions].join('\n');
}

const ARM_FILES = [
    'S-a-substring-collision.json',
    'S-b-all-flagged.json',
    'S-c-placeholder-in-file.json',
    'faithful.json',
] as const;

describe('ui-port-losses fixture — 1.1 the arms exist and name their plants', () => {
    it('all four arms exist and each carries a marker naming what is planted', () => {
        for (const file of ARM_FILES) {
            const a = arm(file);
            expect(typeof a['_planted'], `${file} has no _planted marker`).toBe('string');
            expect((a['_planted'] as string).length).toBeGreaterThan(40);
            expect(a['ui_apply'], `${file} has no ui_apply envelope`).toBeTruthy();
        }
        // The faithful arm's marker must say the opposite of the other three.
        expect(arm('faithful.json')['_planted']).toContain('NOTHING IS PLANTED');
    });

    it('the written files exist and only the S-c one carries the planted placeholder', () => {
        const planted = fs.readFileSync(path.join(FIXTURES, 'written/S-c/panel.html'), 'utf8');
        const clean = fs.readFileSync(path.join(FIXTURES, 'written/faithful/panel.html'), 'utf8');
        expect(planted).toContain('PLANTED LOSS S-c');
        expect(planted.toLowerCase()).toContain('lorem');
        expect(clean.toLowerCase()).not.toContain('lorem');
    });

    it('S-a plants a real substring collision, not an asserted one', () => {
        // The roadmap specified this arm as "`nav` covered by `canvas`", which
        // does not reproduce — see README § Corrected from reproduction. The
        // relation is checked here rather than described in prose, so an arm
        // that silently stops colliding fails instead of measuring nothing.
        const cover = (arm('S-a-substring-collision.json')['ui_apply'] as Json)['coverage'] as Json;
        const entries = (Object.values(cover) as string[][]).flat();
        const needle = 'tab';
        expect((ARTIFACT['interactions'] as string[])).toContain(needle);
        expect(entries.some((e) => e.toLowerCase().includes(needle))).toBe(true);
        expect(entries.some((e) => e.toLowerCase() === needle)).toBe(false);
        // And the roadmap's own illustration, recorded as the finding it is.
        expect('canvas'.includes('nav')).toBe(false);
    });

    it('the README pre-registers the before-count with the command that produced it', () => {
        const readme = fs.readFileSync(path.join(FIXTURES, 'README.md'), 'utf8');
        expect(readme).toContain('npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts');
        expect(readme).toMatch(/caught 0 of 3/);
    });
});

/**
 * The matching rule as it stood before 2.1: substring containment against any
 * bucket entry. Reproduced here rather than described, so the "passes before
 * the change" limb of 2.1's verify stays assertable after the change has
 * landed — otherwise that half of the contract could only ever be checked once,
 * by a reader who happened to be standing at the right commit.
 */
function legacyContainmentGaps(provided: Json, coverage: Json): string[] {
    const entries: string[] = [];
    for (const bucket of COVERAGE_BUCKETS) {
        for (const item of (coverage[bucket] as string[]) ?? []) {
            if (typeof item === 'string' && item !== '') entries.push(item.toLowerCase());
        }
    }
    const gaps: string[] = [];
    for (const inventory of COVERED_INVENTORIES) {
        for (const item of (provided[inventory] as string[]) ?? []) {
            if (typeof item !== 'string' || item === '') continue;
            const needle = item.toLowerCase();
            if (!entries.some((e) => e.includes(needle))) gaps.push(`${inventory}: ${item}`);
        }
    }
    return gaps;
}

describe('2.1 — an id, not a substring', () => {
    it('S-a halts naming the unaccounted item, and passed under the old rule', () => {
        const cover = (arm('S-a-substring-collision.json')['ui_apply'] as Json)['coverage'] as Json;

        // Red-first limb, held permanently: the old rule saw no gap at all.
        expect(legacyContainmentGaps(ARTIFACT, cover)).toEqual([]);

        // And the new rule halts, naming the one item and only that one.
        const r = applyRun(stateFor('S-a-substring-collision.json'));
        expect(r.outcome).toBe('blocked');
        const said = saidBy(r);
        expect(said).toContain('`tab` appears in no coverage bucket');
        expect(said).toContain('coverage gap');
        for (const kept of ['disclosure toggle', 'subscribe submit', 'rule-draw', 'mark.svg']) {
            expect(said, `${kept} was accounted for and must not be reported`).not.toContain(
                `\`${kept}\` appears in no coverage bucket`,
            );
        }
    });

    it('an exact entry accounts for an item; a mid-word collision does not', () => {
        const provided = { interactions: ['tab'], keyframes: [], assets: [] };
        const bucket = (entry: string): Json => ({
            honoured: [entry],
            translated: [],
            flagged: [],
        });
        expect(coverage_report(provided as never, bucket('tab')).gaps).toEqual([]);
        expect(coverage_report(provided as never, bucket('TAB')).gaps).toEqual([]);
        expect(coverage_report(provided as never, bucket('table sort order')).gaps.length).toBe(1);
        expect(coverage_report(provided as never, bucket('the stab wound')).gaps.length).toBe(1);
    });
});

describe('2.2 — containment survives one release as a warned fallback', () => {
    const provided = { interactions: ['subscribe submit'], keyframes: [], assets: [] };
    const annotated: Json = {
        honoured: ['subscribe submit — translated to a form action'],
        translated: [],
        flagged: [],
    };

    it('an annotated entry warns and does not halt', () => {
        const report = coverage_report(provided as never, annotated);
        expect(report.gaps).toEqual([]);
        expect(report.fallbacks.length).toBe(1);
        expect(report.fallbacks[0]).toContain('subscribe submit');
    });

    it('the same envelope halts once the fallback is removed', () => {
        // The sensitivity control for 2.2: with the fallback off, the entry
        // that only matched by annotation is a gap. If this ever stops
        // failing, the fallback is not what is carrying the envelope.
        const report = coverage_report(provided as never, annotated, false);
        expect(report.gaps.length).toBe(1);
        expect(report.gaps[0]).toContain('subscribe submit');
    });

    it('the warning reaches the operator on an otherwise-successful port', () => {
        const r = applyRun(stateFor('faithful.json'));
        expect(r.outcome).toBe('success');
        expect(r.message).not.toContain('matched only by containment');

        // The faithful arm names everything exactly, so it must NOT warn.
        // An arm that does warn is built by annotating one of its entries.
        const st = stateFor('faithful.json');
        const cov = (st.ticket['ui_apply'] as Json)['coverage'] as Json;
        (cov['honoured'] as string[])[0] = 'tab — kept as a tablist';
        const warned = applyRun(st);
        expect(warned.outcome).toBe('success');
        expect(warned.message).toContain('matched only by containment');
        expect(warned.message).toContain('tab');
    });
});

describe('3.1 — handing work back is reported', () => {
    const ALL = ['tab', 'disclosure toggle', 'subscribe submit', 'rule-draw', 'mark.svg'];

    it('S-b produces the shadow line naming every handed-back item', () => {
        const said = saidBy(applyRun(stateFor('S-b-all-flagged.json')));
        expect(said).toContain('carried nothing');
        for (const id of ALL) expect(said, `${id} not enumerated`).toContain(id);
    });

    it('the faithful arm does not produce it', () => {
        expect(saidBy(applyRun(stateFor('faithful.json')))).not.toContain('carried nothing');
    });

    it('a port that flagged some but not all is not the carried-nothing case', () => {
        // The narrow condition matters: flagging one dropped handler is the
        // ledger working as designed, and must not be reported as a hand-back.
        const st = stateFor('faithful.json');
        const cov = (st.ticket['ui_apply'] as Json)['coverage'] as Json;
        cov['honoured'] = ['tab', 'disclosure toggle'];
        cov['translated'] = [];
        cov['flagged'] = ['subscribe submit', 'rule-draw', 'mark.svg'];
        expect(saidBy(applyRun(st))).not.toContain('carried nothing');
    });

    it('3.1 deliberately does not change the outcome value', () => {
        // Superseded by the 3.2 assertion once the flip lands; kept until then
        // so the shadow release is a recorded state rather than an intention.
        expect(applyRun(stateFor('S-b-all-flagged.json')).outcome).toBe('success');
    });
});

describe('4.1 — the placeholder scan reads the files', () => {
    it('S-c halts naming the written file', () => {
        const r = applyRun(stateFor('S-c-placeholder-in-file.json'));
        expect(r.outcome).toBe('blocked');
        const said = saidBy(r);
        expect(said).toContain('written/S-c/panel.html');
        expect(said).toContain('placeholder');
    });

    it('the rendered-only scan does not see it — the sensitivity control', () => {
        // "Removing the file-side scan makes the same arm pass", asserted
        // permanently rather than demonstrated once: the report the porter
        // wrote is clean, and only the file it wrote is not.
        const env = arm('S-c-placeholder-in-file.json')['ui_apply'] as Json;
        expect(placeholder_paths(env['rendered'])).toEqual([]);
        expect(written_file_placeholders(env as never, REPO).length).toBe(1);
    });

    it('the faithful arm raises nothing from either side', () => {
        const env = arm('faithful.json')['ui_apply'] as Json;
        expect(placeholder_paths(env['rendered'])).toEqual([]);
        expect(written_file_placeholders(env as never, REPO)).toEqual([]);
        expect(applyRun(stateFor('faithful.json')).outcome).toBe('success');
    });

    it('an unreadable or absent path is not a finding', () => {
        // Risk 4's false-positive guard: apply runs at points where a declared
        // file may not be on disk, and halting a correct port because a path
        // did not resolve would be a worse failure than the one being fixed.
        const env = { rendered: {}, files: ['does/not/exist.tsx', 'tests'] };
        expect(written_file_placeholders(env as never, REPO)).toEqual([]);
    });

    it('only the declared changed set is read, never a tree sweep', () => {
        // The planted file is inside the repo and would be found by a sweep.
        // An envelope that does not name it must stay silent.
        const env = { rendered: {}, files: [] };
        expect(written_file_placeholders(env as never, REPO)).toEqual([]);
    });
});
