/**
 * Design-fidelity routing matrix — the deterministic baseline for
 * `road-to-provided-artifact-honesty` Phase 0/1.
 *
 * The roadmap's routing half asks one question: when a user hands over a
 * finished design artifact, does `design-fidelity` actually fire? That is
 * answerable without a model — the rule's `triggers:` frontmatter and the
 * shipped matcher (`router_telemetry.trigger_matches`) fully determine it.
 *
 * `ROUTING_MATRIX` below IS the measurement. Its diff across commits is the
 * before/after evidence: a phase that claims to fix routing without changing
 * this table did not fix it. Same contract as `LANE_MATRIX` in
 * `ui_lane_matrix.test.ts`.
 *
 * The matcher is imported, never reimplemented — a hand-rolled `includes()`
 * here would measure the test's idea of routing rather than the router's.
 *
 * Fixture id: `daf-port-trigger-de` (tests/design-artifacts/eval-fixtures.md).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { trigger_matches } from '../../src/scripts/router_telemetry.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const RULE = path.join(REPO_ROOT, 'src', 'rules', 'design-fidelity.md');

/** The artifact filename the port fixtures hand over. */
const HANDOVER = 'tests/design-artifacts/fixtures/design.html';

interface Trigger {
    keyword?: string;
    phrase?: string;
    file_pattern?: string;
    path_prefix?: string;
    command?: string;
    intent?: string;
}

/** Read the rule's `triggers:` frontmatter — the shipped activation set. */
function ruleTriggers(): Trigger[] {
    const text = fs.readFileSync(RULE, { encoding: 'utf-8' });
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (!m) throw new Error(`design-fidelity.md carries no frontmatter block`);
    const fm = yaml.load(m[1] as string) as Record<string, unknown>;
    const triggers = fm['triggers'];
    if (!Array.isArray(triggers)) {
        throw new Error(`design-fidelity.md declares no triggers: array`);
    }
    return triggers as Trigger[];
}

/** True when any of the rule's triggers matches this prompt + open-file set. */
function routes(prompt: string, open_files: readonly string[] = []): boolean {
    return ruleTriggers().some((t) =>
        trigger_matches(t as never, prompt, open_files, null),
    );
}

interface Row {
    /** Prompt class this row measures. */
    readonly id: string;
    /** `en` · `de` · `none` — the language / keyword class. */
    readonly klass: 'en' | 'de' | 'none';
    readonly prompt: string;
    readonly open_files: readonly string[];
    /** Expected routing outcome after Phase 1. */
    readonly routes: boolean;
    /**
     * Measured on `origin/main` before Phase 1 (2026-08-01). A row whose
     * `routes` and `baseline` differ is a behaviour change this roadmap made.
     */
    readonly baseline: boolean;
    /**
     * Which MANDATE the routed handover carries — the second axis, added by
     * `road-to-frontend-fidelity-calibration` step 0.3.
     *
     * `pixel` is the 1:1 floor and the default: absent means `pixel`, so every
     * pre-existing row keeps its exact meaning without being touched. `structure`
     * is a handover whose own artefact declares itself low-fidelity, where the
     * layout is the spec and the greys are not.
     *
     * A boolean `routes` cannot express this. Maturity is a property of the
     * ARTEFACT and mandate a property of the INSTRUCTION, and the defect this
     * roadmap names is exactly that the rule had one axis for two questions.
     */
    readonly mandate?: 'pixel' | 'structure';
}

/**
 * The measurement. Three prompt classes the roadmap names, plus the
 * already-covered English phrasings that must not regress, plus the
 * near-misses that must NOT start firing (an over-broad trigger is worse
 * than the gap it closes).
 */
export const ROUTING_MATRIX: readonly Row[] = [
    // --- Class 1: English, explicit handover ------------------------------
    {
        id: 'en-build-1-1',
        klass: 'en',
        prompt: 'Here is design.html — build this 1:1, do not redesign it.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'en-handoff',
        klass: 'en',
        prompt: 'This is the handoff from our designer. Port it faithfully.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'en-artifact',
        klass: 'en',
        prompt: 'Take the attached artifact and implement it as a component.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'en-claude-design',
        klass: 'en',
        prompt: 'I exported this from Claude Design — rebuild it in our app.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    // Already covered before Phase 1 — regression witnesses.
    {
        id: 'en-match-the-design',
        klass: 'en',
        prompt: 'Match the design in the screenshot.',
        open_files: [],
        routes: true,
        baseline: true,
    },
    {
        id: 'en-figma',
        klass: 'en',
        prompt: 'Here is the Figma export.',
        open_files: [],
        routes: true,
        baseline: true,
    },

    // --- Class 2: German ---------------------------------------------------
    {
        id: 'de-1-zu-1',
        klass: 'de',
        prompt: 'Setz das 1:1 um, bitte nichts umbauen.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'de-uebernimm',
        klass: 'de',
        prompt: 'Übernimm das Design aus dem Anhang.',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'de-nachbauen',
        klass: 'de',
        prompt: 'Baue das nach, so wie es da steht.',
        open_files: [],
        routes: true,
        baseline: false,
    },

    // --- Class 3: no keyword at all, artifact attached ---------------------
    {
        id: 'none-attached-designhtml',
        klass: 'none',
        prompt: 'Can you do this?',
        open_files: [HANDOVER],
        routes: true,
        baseline: false,
    },
    {
        id: 'none-attached-arbitrary-html',
        klass: 'none',
        // The honest limit: an arbitrary attached HTML file is NOT a handover
        // signal. `*.html` as a trigger would fire on every HTML edit in every
        // project — strictly worse than the gap. Documented, not papered over.
        prompt: 'Can you do this?',
        open_files: ['resources/views/welcome.blade.html'],
        routes: false,
        baseline: false,
    },

    // --- Class 4: the artifact arrives as a link or a directory ------------
    {
        id: 'none-capability-url',
        klass: 'en',
        // A published artifact is handed over as a capability URL, not a file.
        prompt: 'Here you go: https://claude.site/artifacts/8f2c1e40-aaaa-bbbb-cccc-1234567890ab',
        open_files: [],
        routes: true,
        baseline: false,
    },
    {
        id: 'none-design-system-dir',
        klass: 'none',
        prompt: 'Can you do this?',
        open_files: ['.claude/design-system/tokens.json'],
        routes: true,
        baseline: false,
    },

    // --- Near-misses: must stay silent ------------------------------------
    //
    // The builder-URL class (`lovable.dev` / `v0.dev` / `bolt.new`) was
    // attempted here and WITHDRAWN. `https://v0.dev/` is a substring of
    // `https://v0.dev/docs`, so the trigger fired on the vendor's own
    // documentation, pricing and changelog pages — every mention of the tool's
    // site became a spec handover. The two rows below pin BOTH directions
    // silent so a future attempt has to clear them before shipping the class.
    {
        id: 'near-bare-host-mention',
        klass: 'en',
        // The host without a protocol is a tool mention, not a handover — the
        // `claude.ai` precedent applied to the three builders.
        prompt: 'We looked at v0.dev and bolt.new before picking a stack.',
        open_files: [],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-builder-host-non-handover-url',
        klass: 'en',
        // The row that would have caught the withdrawn trigger, and the reason
        // it is here rather than the protocol-less one: a near-miss that tests
        // a direction which was ALREADY silent cannot detect over-broadness a
        // new trigger introduces. This URL is on the builder's host, carries
        // the protocol, and is not a handover.
        prompt: 'Per https://v0.dev/docs the free tier caps at three projects.',
        open_files: [],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-claude-ai-chat-link',
        klass: 'en',
        // The host alone is a conversation reference, not a spec. A keyword on
        // the bare domain would fire on every pasted chat link.
        prompt: 'I pasted this from https://claude.ai/chat/abcd — what do you think?',
        open_files: [],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-generic-design-system-dir',
        klass: 'none',
        // `design-system/` is a normal source folder in a large fraction of
        // frontend repos; only the vendor-scoped `.claude/` prefix is a handover.
        prompt: 'Can you do this?',
        open_files: ['packages/design-system/src/Button.tsx'],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-artifacts-plural-unrelated',
        klass: 'en',
        // "artifact" appears, but as CI vocabulary. A keyword trigger cannot
        // tell these apart; the phrase forms are chosen so this stays quiet.
        prompt: 'The CI build artifact is 40 MB — can we shrink it?',
        open_files: [],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-greenfield',
        klass: 'en',
        prompt: 'Design a pricing page for us from scratch.',
        open_files: [],
        routes: false,
        baseline: false,
    },
    {
        id: 'near-de-generic',
        klass: 'de',
        prompt: 'Kannst Du die Tests grün machen?',
        open_files: [],
        routes: false,
        baseline: false,
    },
    // --- Class 5: artefact MATURITY, not instruction mandate (step 0.3) ------
    // The pair is committed together on purpose. The rule's § Routing requires a
    // near-miss row per new trigger class, AND requires it to test the direction
    // the new trigger opens — a row testing something already closed cannot catch
    // the over-broadness being introduced.
    {
        id: 'daf-wireframe-not-pixel',
        klass: 'en',
        prompt: "Here's the wireframe for the settings screen — build it.",
        open_files: ['wireframe.html'],
        routes: true,
        baseline: true,
        // Routed before AND after: what changes is the mandate, not whether the
        // rule fires. A row whose `baseline` and `routes` agree while its
        // `mandate` is new is precisely the shape of this phase's change.
        mandate: 'structure',
    },
    {
        id: 'daf-wireframe-near-miss',
        klass: 'en',
        prompt: 'This replaces the wireframe we reviewed last week — build it 1:1.',
        open_files: ['design.html'],
        routes: true,
        baseline: true,
        // STRICT, and this row is the one that fails if the discriminator reads
        // the prose instead of the artefact. The word is a reference to a
        // previous artefact, not a declaration about this one.
        mandate: 'pixel',
    },
];

describe('design-fidelity routing matrix', () => {
    it('the rule declares a parseable trigger set', () => {
        const triggers = ruleTriggers();
        expect(triggers.length).toBeGreaterThan(0);
        for (const t of triggers) {
            const keys = Object.keys(t);
            expect(keys.length).toBe(1);
            expect([
                'keyword',
                'phrase',
                'file_pattern',
                'path_prefix',
                'command',
                'intent',
            ]).toContain(keys[0]);
        }
    });

    for (const row of ROUTING_MATRIX) {
        it(`${row.id} (${row.klass}) routes=${row.routes}`, () => {
            expect(routes(row.prompt, row.open_files)).toBe(row.routes);
        });
    }

    it('every prompt class the roadmap names has at least one row', () => {
        const classes = new Set(ROUTING_MATRIX.map((r) => r.klass));
        expect(classes).toEqual(new Set(['en', 'de', 'none']));
    });

    describe('maturity is a second axis, not a second trigger (step 0.3)', () => {
        const RULE = path.join(REPO_ROOT, 'src', 'rules', 'design-fidelity.md');
        const ruleText = (): string => fs.readFileSync(RULE, 'utf-8');

        it('both rows of the new class are present, and they disagree on mandate', () => {
            const structure = ROUTING_MATRIX.find((r) => r.id === 'daf-wireframe-not-pixel');
            const nearMiss = ROUTING_MATRIX.find((r) => r.id === 'daf-wireframe-near-miss');
            expect(structure, 'the wireframe class row').toBeDefined();
            expect(nearMiss, 'the near-miss row').toBeDefined();
            // Disagreeing on mandate while agreeing on `routes` IS the phase's change.
            // Two rows that agreed on both would measure nothing new.
            expect(structure!.routes).toBe(nearMiss!.routes);
            expect(structure!.mandate).toBe('structure');
            expect(nearMiss!.mandate).toBe('pixel');
        });

        it('absent mandate means pixel — every pre-existing row keeps its meaning', () => {
            // The default is the STRICTER obligation, so adding the axis cannot have
            // silently downgraded a row nobody touched.
            for (const r of ROUTING_MATRIX) {
                if (r.id.startsWith('daf-wireframe-')) continue;
                expect(r.mandate, `${r.id} must not declare a mandate`).toBeUndefined();
            }
        });

        it('the rule carries the discriminator, and reads the ARTEFACT not the prose', () => {
            // The assertion that makes the near-miss row mean something. A
            // discriminator that matched the prose would downgrade every finished
            // handover mentioning its own history — and the near-miss prompt is
            // exactly such a handover.
            const t = ruleText();
            expect(t).toContain('MATURITY IS A PROPERTY OF THE ARTEFACT');
            expect(t).toContain('reads the ARTEFACT, never the prose');
            // And the safe default is stated, not left to inference.
            expect(t).toContain('it is treated as finished');
        });

        it('the near-miss prompt would be misclassified by a prose match', () => {
            // Proves the near-miss row is guarding a REAL failure mode rather than a
            // hypothetical one: the naive implementation does misfire on it.
            const naive = (prompt: string): boolean => prompt.toLowerCase().includes('wireframe');
            const nearMiss = ROUTING_MATRIX.find((r) => r.id === 'daf-wireframe-near-miss')!;
            expect(naive(nearMiss.prompt)).toBe(true);
            expect(nearMiss.mandate).toBe('pixel');
        });
    });

    it('the matrix records at least one closed baseline gap per class', () => {
        // A class whose every row already routed on main proves nothing about
        // this roadmap; a class with no closed gap means Phase 1 skipped it.
        for (const klass of ['en', 'de', 'none'] as const) {
            const closed = ROUTING_MATRIX.filter(
                (r) => r.klass === klass && r.routes && !r.baseline,
            );
            expect(closed.length, `class ${klass} closed no baseline gap`).toBeGreaterThan(0);
        }
    });
});
