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
