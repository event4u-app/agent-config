/**
 * The capture-only artifact-read instrument on `ui-route-nudge`.
 *
 * Two things are asserted here and they are different in kind:
 *
 * 1. **The instrument records what it claims to.** `artifactRead` latches on a
 *    handover file, `artifactReadBeforeFirstUiWrite` latches once at the first
 *    UI write, and `undefined` (no write yet) stays distinct from `false`
 *    (a write happened unread).
 * 2. **It changes NO behaviour.** The phase that added it declares `nothing
 *    behavioural` in its own rollback line, so every warn outcome must be
 *    identical with and without an artifact read in the session. That is the
 *    assertion a future "just fold it into `consulted`" edit has to break
 *    loudly rather than quietly.
 *
 * Plus the drift guard: the hook COPIES two of `design-fidelity`'s triggers
 * rather than reading the rule, exactly as it copies the UI-surface predicate.
 * A copy nothing pins is a copy that rots, so the rule's own frontmatter is
 * parsed here and compared.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
    MAX_NUDGES,
    decide,
    isArtifactRead,
    isConsultation,
    stateChanged,
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

    it('is disjoint from consultation — the two signals are not the same event', () => {
        expect(isConsultation(read('tests/design-artifacts/fixtures/design.html'))).toBe(false);
        expect(isArtifactRead(read('src/skills/fe-design/SKILL.md'))).toBe(false);
    });
});

describe('the instrument', () => {
    it('records the read without latching consultation', () => {
        const { state, warn } = decide(read('a/design.html'), fresh);
        expect(state.artifactRead).toBe(true);
        expect(state.consulted).toBe(false);
        expect(warn).toBe(false);
    });

    it('leaves the before-first-write field undefined until a UI write happens', () => {
        const afterRead = decide(read('a/design.html'), fresh).state;
        expect(afterRead.artifactReadBeforeFirstUiWrite).toBeUndefined();
    });

    it('latches true at the first UI write when the artifact was read', () => {
        const afterRead = decide(read('a/design.html'), fresh).state;
        const afterWrite = decide(write(UI_FILE), afterRead).state;
        expect(afterWrite.artifactReadBeforeFirstUiWrite).toBe(true);
    });

    it('latches false at the first UI write when it was not', () => {
        const afterWrite = decide(write(UI_FILE), fresh).state;
        expect(afterWrite.artifactReadBeforeFirstUiWrite).toBe(false);
    });

    it('does not re-latch on later writes — first write only', () => {
        const first = decide(write(UI_FILE), fresh).state;
        expect(first.artifactReadBeforeFirstUiWrite).toBe(false);
        const afterRead = decide(read('a/design.html'), first).state;
        const second = decide(write(UI_FILE), afterRead).state;
        // The read happened AFTER the first write; the instrument must keep
        // recording the outcome it measured, not the later, better one.
        expect(second.artifactReadBeforeFirstUiWrite).toBe(false);
    });

    it('latches even when the session already consulted, so the rate is not measured over nudged sessions alone', () => {
        const consulted = decide(read('src/skills/fe-design/SKILL.md'), fresh).state;
        expect(consulted.consulted).toBe(true);
        const { state, warn } = decide(write(UI_FILE), consulted);
        expect(state.artifactReadBeforeFirstUiWrite).toBe(false);
        expect(warn).toBe(false);
    });

    it('latches even past the nudge valve', () => {
        const exhausted: SessionState = { consulted: false, nudges: MAX_NUDGES };
        const { state, warn } = decide(write(UI_FILE), exhausted);
        expect(state.artifactReadBeforeFirstUiWrite).toBe(false);
        expect(warn).toBe(false);
    });
});

describe('capture-only — no behaviour change', () => {
    it('warns identically whether or not an artifact was read', () => {
        const withRead = decide(read('a/design.html'), fresh).state;
        expect(decide(write(UI_FILE), withRead).warn).toBe(
            decide(write(UI_FILE), fresh).warn,
        );
    });

    it('an artifact read does not consume a nudge', () => {
        const afterRead = decide(read('a/design.html'), fresh).state;
        expect(afterRead.nudges).toBe(fresh.nudges);
    });

    it('an artifact read still leaves the session nudgeable', () => {
        // The failure this guards: folding the read into `consulted` would
        // silence the nudge for any session that opened a design.html.
        const afterRead = decide(read('a/design.html'), fresh).state;
        expect(decide(write(UI_FILE), afterRead).warn).toBe(true);
    });
});

describe('persistence', () => {
    it('reports a change when only a capture-only field moved', () => {
        // The trap: the predicate this replaced compared `consulted` and
        // `nudges` only, so these fields would have been computed on every
        // event and persisted on none.
        expect(stateChanged(fresh, { ...fresh, artifactRead: true })).toBe(true);
        expect(stateChanged(fresh, { ...fresh, artifactReadBeforeFirstUiWrite: false })).toBe(
            true,
        );
    });

    it('reports no change when nothing moved', () => {
        expect(stateChanged(fresh, { ...fresh })).toBe(false);
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

    it('the rule still declares the file_pattern the hook copied', () => {
        const patterns = ruleTriggers()
            .filter((t) => 'file_pattern' in t)
            .map((t) => t['file_pattern']);
        expect(patterns).toContain('*design.html');
    });

    it('the rule still declares the path_prefix the hook copied', () => {
        const prefixes = ruleTriggers()
            .filter((t) => 'path_prefix' in t)
            .map((t) => t['path_prefix']);
        expect(prefixes).toContain('.claude/design-system/');
    });
});
