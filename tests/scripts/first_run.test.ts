// Tests for the non-interactive skip — Phase 4 step 3 of
// `road-to-zero-ceremony-settings`: *"Skip cleanly in non-TTY, CI, and headless
// contexts: no file, defaults, no questions, ever."*
//
// This file is the `verify:` target the roadmap names. It covers two halves that
// have to hold together:
//
//   1. `nonInteractiveReason` recognises every context where nobody can answer.
//   2. `planSettingsAsks` in such a context produces `ask: null` — so "no
//      questions, ever" is a computed property of the plan and not a rule the
//      caller has to remember.
//
// The suite is weighted towards the FALSE-INTERACTIVE direction, because the
// failure modes are asymmetric: a wrongly-interactive verdict hangs an automated
// run or fabricates a consent, while a wrongly-non-interactive one merely
// declines to ask and takes the documented conservative default.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { load as parseYaml } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PACKAGE_ROOT,
    provenanceFilePath,
    runSettingsSet,
    settingsFilePath,
} from '../../src/scripts/_cli/cmd_settings_set.js';
import {
    isInteractiveSession,
    nonInteractiveReason,
    type SessionProbe,
} from '../../src/shared/interactiveContext.js';
import { planSettingsAsks, silentDefaultsSummary } from '../../src/shared/settingsAsks.js';
import {
    buildSettingsClassIndex,
    parseSettingsClassRows,
} from '../../src/shared/settingsClasses.js';

const REPO = path.resolve(__dirname, '..', '..');
const CONTRACT = path.join(REPO, 'docs', 'contracts', 'settings-classes.md');

const classes = () =>
    buildSettingsClassIndex(parseSettingsClassRows(fs.readFileSync(CONTRACT, 'utf8')));

/** A session a human is demonstrably sitting in front of. */
const human = (over: Partial<SessionProbe> = {}): SessionProbe => ({
    env: {},
    stdinTty: true,
    stdoutTty: true,
    headless: false,
    ...over,
});

const B_DEFAULTS: Record<string, unknown> = {
    'personal.canary_name': '',
    'personal.open_edited_files': false,
    'memory.learn_on_session_end': false,
};
const defaultOf = (k: string): unknown => B_DEFAULTS[k];
const THREE_B = [
    'personal.canary_name',
    'personal.open_edited_files',
    'memory.learn_on_session_end',
];

describe('nonInteractiveReason — every context where nobody can answer', () => {
    it('recognises an interactive session as interactive', () => {
        expect(nonInteractiveReason(human())).toBeNull();
        expect(isInteractiveSession(human())).toBe(true);
    });

    it('recognises CI under all three variables, not just CI', () => {
        // The narrow shapes elsewhere in the tree miss two of these. A GitHub
        // Actions run that only sets GITHUB_ACTIONS must still count as CI.
        for (const key of ['CI', 'GITHUB_ACTIONS', 'AGENT_CONFIG_CI']) {
            expect(nonInteractiveReason(human({ env: { [key]: '1' } })), key).toBe('ci');
        }
    });

    it('believes an explicit CI=0', () => {
        // A consumer who exports CI=0 to mean "not CI" is taken at their word —
        // the `set && !== '0'` convention the first-run notice already uses.
        expect(nonInteractiveReason(human({ env: { CI: '0' } }))).toBeNull();
    });

    it('treats an empty or whitespace CI as unset', () => {
        expect(nonInteractiveReason(human({ env: { CI: '' } }))).toBeNull();
        expect(nonInteractiveReason(human({ env: { CI: '   ' } }))).toBeNull();
    });

    it('honours an explicit request not to be asked', () => {
        expect(nonInteractiveReason(human({ env: { AGENT_CONFIG_NO_UI: '1' } }))).toBe(
            'no-ui-requested',
        );
    });

    it('fires when either stream is not a TTY — pipes, hooks, MCP serving', () => {
        expect(nonInteractiveReason(human({ stdinTty: false }))).toBe('not-a-tty');
        expect(nonInteractiveReason(human({ stdoutTty: false }))).toBe('not-a-tty');
    });

    it('fires on a headless display', () => {
        expect(nonInteractiveReason(human({ headless: true }))).toBe('headless');
    });

    it('treats an absent headless flag as not headless rather than as unknown', () => {
        const probe: SessionProbe = { env: {}, stdinTty: true, stdoutTty: true };
        expect(nonInteractiveReason(probe)).toBeNull();
    });

    it('ranks CI above an explicit no-UI request and above the TTY probe', () => {
        // Order matters only for the REASON reported, never for the verdict —
        // but the reason is what a user reads, so it is pinned.
        expect(
            nonInteractiveReason(
                human({ env: { CI: '1', AGENT_CONFIG_NO_UI: '1' }, stdinTty: false }),
            ),
        ).toBe('ci');
        expect(
            nonInteractiveReason(human({ env: { AGENT_CONFIG_NO_UI: '1' }, stdinTty: false })),
        ).toBe('no-ui-requested');
    });
});

describe('no questions, ever — the plan in a non-interactive context', () => {
    it('asks nothing even when three B keys are undecided', () => {
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: false,
        });
        expect(plan.ask).toBeNull();
    });

    it('takes the conservative default for every one of them instead', () => {
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: false,
        });
        expect(plan.silent.map((s) => s.key)).toEqual(THREE_B);
        expect(plan.skipped).toEqual([]);
    });

    it('still names every defaulted key in the summary — silent is not invisible', () => {
        // "No questions" must not become "no record". A default taken without a
        // question is exactly the one a user needs told about.
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: false,
        });
        const summary = silentDefaultsSummary(plan);
        for (const key of THREE_B) {
            expect(summary).toContain(key);
        }
    });

    it('asks once in the same scenario when a human IS present — the contrast case', () => {
        // Without this row the suite would pass on a resolver that never asks
        // at all, which is the vacuity trap this repo has recorded before.
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: true,
        });
        expect(plan.ask).toBe('personal.canary_name');
        expect(plan.silent).toHaveLength(2);
    });

    it('defaults to interactive when the caller says nothing', () => {
        // The option is a narrowing, never a silent widening: a caller that
        // forgets it gets the asking behaviour, not the mute one.
        expect(planSettingsAsks(THREE_B, classes(), defaultOf).ask).toBe('personal.canary_name');
    });

    it('a non-conservative default is still surfaced rather than swallowed', () => {
        // Non-interactive must not become a licence to inherit a permission.
        const plan = planSettingsAsks(
            ['personal.open_edited_files'],
            classes(),
            () => true,
            new Set(),
            { interactive: false },
        );
        expect(plan.ask).toBeNull();
        expect(plan.silent).toEqual([]);
        expect(plan.skipped).toEqual([
            { key: 'personal.open_edited_files', reason: 'non-conservative-default' },
        ]);
    });

    it('writes nothing — the planner has no file surface at all', () => {
        // "No file" holds by construction: this module is pure. The assertion
        // that matters is that no ask means no `jit-answer` write downstream,
        // which is exactly `ask === null`.
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: false,
        });
        expect(plan.ask).toBeNull();
        expect(Object.keys(plan)).toEqual(['ask', 'silent', 'skipped']);
    });
});

describe('entry count — the file a first run leaves behind', () => {
    // Phase 4's exit criterion claims the resulting file has at most ONE entry.
    // The 2026-08-07 council ruled the nickname step done ON CONDITION that this
    // claim is pinned by a test — a first-run file with exactly one entry, and
    // one with zero — rather than amended into another unverified statement.
    // These are those two cases, composed end-to-end: the plan decides whether
    // an ask exists, and `settings:set --source jit-answer` is the only writer
    // the protocol sanctions for an answered ask.
    const NOW = '2026-08-09T00:00:00Z';
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-run-entries-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    /** Dotted leaf paths of a parsed YAML mapping — one per entry. */
    function leafEntries(node: unknown, prefix = ''): string[] {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) {
            return [prefix];
        }
        return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
            leafEntries(v, prefix ? `${prefix}.${k}` : k),
        );
    }

    it('zero entries: a first run that answers nothing never creates the file', () => {
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: false,
        });
        // No ask → no answered ask → the sanctioned writer is never invoked,
        // and the user's global settings file simply does not come to exist.
        expect(plan.ask).toBeNull();
        expect(fs.existsSync(settingsFilePath(root))).toBe(false);
        expect(fs.existsSync(provenanceFilePath(root))).toBe(false);
    });

    it('exactly one entry: answering the nickname writes that leaf and nothing else', () => {
        const plan = planSettingsAsks(THREE_B, classes(), defaultOf, new Set(), {
            interactive: true,
        });
        expect(plan.ask).toBe('personal.canary_name');
        const res = runSettingsSet({
            key: 'personal.canary_name',
            rawValue: 'Matze',
            source: 'jit-answer',
            root,
            packageRoot: PACKAGE_ROOT,
            now: NOW,
            dryRun: false,
        });
        expect(res.code).toBe(0);
        const file = parseYaml(fs.readFileSync(settingsFilePath(root), 'utf-8'));
        // Exactly ONE leaf entry, and it is the decision that was made — no
        // template opinion rides along into the user's file.
        expect(leafEntries(file)).toEqual(['personal.canary_name']);
        const sidecar = JSON.parse(fs.readFileSync(provenanceFilePath(root), 'utf-8')) as Record<
            string,
            { source: string; at: string }
        >;
        expect(sidecar['personal.canary_name']).toEqual({ source: 'jit-answer', at: NOW });
    });
});
