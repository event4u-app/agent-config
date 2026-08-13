/**
 * `isArtifactRead` — the shared predicate the analyzer measures over.
 *
 * It deliberately has NO decision role: `decide` does not branch on it, and the
 * assertions below pin that, because the phase that introduced it declares
 * `nothing behavioural` in its own rollback line. An earlier revision of this
 * branch also latched two session fields on it inside the hook; a review caught
 * that nothing read them, so the measurement now lives in
 * `report_consultation_rate` alone — one implementation instead of two.
 *
 * The drift guard at the bottom is the load-bearing part: the predicate COPIES
 * two of `design-fidelity`'s triggers rather than reading the rule, exactly as
 * the hook copies the UI-surface predicate. A copy nothing pins is a copy that
 * rots, so the rule's own frontmatter is parsed here and compared **as a set** —
 * an earlier revision asserted only that the two copied triggers were still
 * present, which stays green while the rule grows a third the predicate never
 * learns about.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
    decide,
    isArtifactRead,
    isConsultation,
    type SessionState,
    type ToolEvent,
} from '../../src/scripts/hooks/ui_route_nudge_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULE = path.resolve(HERE, '..', '..', 'src', 'rules', 'design-fidelity.md');

const fresh: SessionState = { consulted: false, nudges: 0 };

function write(file: string): ToolEvent {
    return { file, isWrite: true };
}
function read(file: string): ToolEvent {
    return { file, isWrite: false };
}

/** A UI path the nudge's own predicate accepts, used as the write target. */
const UI_FILE = 'src/components/Card.tsx';

describe('artifact-read classification', () => {
    it('latches on the two handover shapes design-fidelity routes on a file', () => {
        expect(isArtifactRead(read('tests/design-artifacts/fixtures/design.html'))).toBe(true);
        expect(isArtifactRead(read('/abs/path/to/my-design.html'))).toBe(true);
        expect(isArtifactRead(read('.claude/design-system/tokens.json'))).toBe(true);
    });

    it('does not latch on an arbitrary HTML file', () => {
        // Same limit the routing matrix pins: `*.html` as a signal would fire
        // on every HTML read in every project.
        expect(isArtifactRead(read('resources/views/welcome.html'))).toBe(false);
        expect(isArtifactRead(read('public/index.html'))).toBe(false);
    });

    it('does not latch on a generic design-system directory', () => {
        expect(isArtifactRead(read('packages/design-system/src/Button.tsx'))).toBe(false);
    });

    it('does not latch on a WRITE to a handover file', () => {
        // Producing an artifact is not reading one.
        expect(isArtifactRead(write('tests/design-artifacts/fixtures/design.html'))).toBe(false);
    });
});

describe('overlap with consultation — a property, not two examples', () => {
    it('the two predicates are NOT disjoint, and the overlap is constructible', () => {
        // This is the finding a review raised: an earlier revision returned
        // early on `isArtifactRead`, which silently removed such an event from
        // the consultation numerator. Asserting the overlap EXISTS is what
        // makes that ordering bug expressible as a test rather than a comment.
        const both = read('src/skills/design-review/references/design.html');
        expect(isArtifactRead(both)).toBe(true);
        expect(isConsultation(both)).toBe(true);
    });

    it('neither predicate implies the other', () => {
        expect(isArtifactRead(read('src/skills/fe-design/SKILL.md'))).toBe(false);
        expect(isConsultation(read('tests/design-artifacts/fixtures/design.html'))).toBe(false);
    });
});

describe('no behaviour change — the predicate never reaches a decision', () => {
    it('an artifact read leaves the state untouched', () => {
        const { state, warn } = decide(read('a/design.html'), fresh);
        expect(state).toEqual(fresh);
        expect(warn).toBe(false);
    });

    it('an artifact read still leaves the session nudgeable', () => {
        // The failure this guards: latching the read as consultation would
        // silence the nudge for any session that opened a design.html.
        const afterRead = decide(read('a/design.html'), fresh).state;
        expect(decide(write(UI_FILE), afterRead).warn).toBe(true);
    });

    it('warns identically whether or not an artifact was read', () => {
        const afterRead = decide(read('a/design.html'), fresh).state;
        expect(decide(write(UI_FILE), afterRead).warn).toBe(decide(write(UI_FILE), fresh).warn);
    });
});

describe('drift guard — the copied triggers still exist in the rule', () => {
    function ruleTriggers(): Array<Record<string, string>> {
        const text = fs.readFileSync(RULE, { encoding: 'utf-8' });
        const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
        if (!m) throw new Error('design-fidelity.md carries no frontmatter block');
        const fm = yaml.load(m[1] as string) as Record<string, unknown>;
        return fm['triggers'] as Array<Record<string, string>>;
    }

    // Asserting the SET, not membership. A `toContain` pair passes forever
    // while the rule grows a third file-shaped trigger the predicate never
    // learns about — the same shape as a near-miss row that tests an
    // already-closed direction, which is why this branch withdrew a trigger
    // rather than ship it. Adding a file_pattern/path_prefix must red this
    // test and force a decision about `isArtifactRead`.
    it('the rule declares EXACTLY the file-shaped triggers the predicate copied', () => {
        const fileShaped = ruleTriggers().filter(
            (t) => 'file_pattern' in t || 'path_prefix' in t,
        );
        expect(fileShaped).toEqual([
            { file_pattern: '*design.html' },
            { path_prefix: '.claude/design-system/' },
        ]);
    });

    it('every file-shaped trigger is one `isArtifactRead` actually accepts', () => {
        // The membership half, derived rather than restated: each declared
        // trigger is turned into a path the predicate should latch on. A new
        // trigger the predicate ignores fails here even if someone updates the
        // set above without touching the predicate.
        const samples: Record<string, string> = {
            '*design.html': 'some/dir/design.html',
            '.claude/design-system/': '.claude/design-system/tokens.json',
        };
        for (const trigger of ruleTriggers()) {
            const value = trigger['file_pattern'] ?? trigger['path_prefix'];
            if (value === undefined) continue;
            const sample = samples[value];
            expect(sample, `no sample path for trigger ${value}`).toBeDefined();
            expect(isArtifactRead(read(sample as string))).toBe(true);
        }
    });
});
