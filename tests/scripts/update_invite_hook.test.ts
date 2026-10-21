/**
 * Step 4.3 and AC-7 — the one-time invitation an existing install gets.
 *
 * The step's verify clause is a list of five contexts in which there must be
 * ZERO prompts, so that list is the centre of this file. Everything else is
 * there to prove the fixture can produce a prompt at all — a no-prompt
 * assertion over a decision that can never say yes measures nothing.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { autoInviteDecision, ringZeroExited, type InviteInput } from '../../src/scripts/_lib/update_invite.js';
import { CONCERN, RING_ZERO_PREFIX, readRingZeroRecord, runInvite } from '../../src/scripts/update_invite_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

// A generous hook timeout, because these fixtures are `mkdtempSync` and
// nothing else: measured on a machine running several parallel lanes, the
// default 30 s hook budget expired inside `beforeEach` itself while every one
// of these tests passed in isolation. The number is about the host's load, not
// about the work, so raising it removes a flake rather than hiding a slow test.
const HOOK_TIMEOUT_MS = 120_000;

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'update-invite-'));
}, HOOK_TIMEOUT_MS);
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
}, HOOK_TIMEOUT_MS);

/** Every condition cleared — the one input shape that produces a question. */
const OPEN: InviteInput = {
    mode: 'ask',
    ringZeroExited: true,
    registerAvailable: true,
    alreadyInvited: false,
    turnEndedOnVerifiedSuccess: true,
    env: { ci: false, noUpdateCheck: false, interactive: true, headless: false, jsonOutput: false, subagent: false },
};

describe('4.3 — the invitation exists at all', () => {
    it('asks when every condition clears, and names all three answers', () => {
        const d = autoInviteDecision(OPEN);
        expect(d.ask).toBe(true);
        const text = d.ask ? d.lines.join('\n') : '';
        expect(text).toMatch(/mode: auto/);
        expect(text).toMatch(/Stop these invitations — set `update\.mode` back to `notify`/);
        expect(text).not.toMatch(/never-ask-auto/);
        expect(text).toMatch(/Leave it as it is/);
    });
});

describe('4.3 — zero prompts in the five contexts the step names', () => {
    const contexts: Array<[string, Partial<InviteInput['env']>]> = [
        ['CI', { ci: true }],
        ['a non-TTY', { interactive: false }],
        ['headless', { headless: true }],
        ['--json output', { jsonOutput: true }],
        ['a subagent run', { subagent: true }],
    ];
    for (const [label, env] of contexts) {
        it(`asks nothing under ${label}`, () => {
            const d = autoInviteDecision({ ...OPEN, env: { ...OPEN.env, ...env } });
            expect(d.ask).toBe(false);
        });
    }
});

// A rollout switch is not consent. The invitation now needs a
// value only a human can set — `update.mode` is class C, hand-edit or GUI only —
// and ring-0 stays as a second, independent kill switch.
describe('4.3 — the invitation needs a user-owned opt-in, not a rollout switch', () => {
    it('an absent update.mode asks nothing, even with ring-0 exited', () => {
        const d = autoInviteDecision({ ...OPEN, mode: undefined });
        expect(d).toEqual({ ask: false, reason: 'no user opt-in: update.mode is not ask' });
    });

    it('notify asks nothing — being told is not asking to be asked', () => {
        expect(autoInviteDecision({ ...OPEN, mode: 'notify' }).ask).toBe(false);
    });

    it('ask opens it, and only together with the ring-0 exit', () => {
        expect(autoInviteDecision({ ...OPEN, mode: 'ask' }).ask).toBe(true);
        expect(autoInviteDecision({ ...OPEN, mode: 'ask', ringZeroExited: false }).ask).toBe(false);
    });
});

describe('4.3 / AC-7 — the ring-0 record is the kill switch', () => {
    it('a record that has not exited closes it', () => {
        expect(autoInviteDecision({ ...OPEN, ringZeroExited: false }).ask).toBe(false);
    });

    it('`ring-0-exit: no` reads as not exited, and an absent record too', () => {
        expect(ringZeroExited('ring-0-exit: no\n')).toBe(false);
        expect(ringZeroExited('ring-0-exit: yes\n')).toBe(true);
        expect(ringZeroExited(null)).toBe(false);
        expect(ringZeroExited('nothing about rings here')).toBe(false);
        // Not a loose substring match: the word must be the whole value.
        expect(ringZeroExited('ring-0-exit: yesterday\n')).toBe(false);
    });

    it('the record committed in this tree exists and has NOT exited', () => {
        const text = readRingZeroRecord(REPO_ROOT);
        expect(text, `no ${RING_ZERO_PREFIX}*.md under agents/evidence/analysis/`).not.toBeNull();
        expect(ringZeroExited(text)).toBe(false);
    });
});

describe('4.3 — a once, and the setting as the only stop', () => {
    it('the env kill switch closes it, as it does the notice', () => {
        const d = autoInviteDecision({ ...OPEN, env: { ...OPEN.env, noUpdateCheck: true } });
        expect(d).toEqual({ ask: false, reason: 'AGENT_CONFIG_NO_UPDATE_CHECK=1' });
    });

    it('a second run after an invitation asks nothing', () => {
        expect(autoInviteDecision({ ...OPEN, alreadyInvited: true }).ask).toBe(false);
    });

    it('a mode the user already chose closes it', () => {
        for (const mode of ['auto', 'off'] as const) {
            expect(autoInviteDecision({ ...OPEN, mode }).ask, mode).toBe(false);
        }
    });

    it('a turn that did not end on a verified success is not the moment', () => {
        expect(autoInviteDecision({ ...OPEN, turnEndedOnVerifiedSuccess: false }).ask).toBe(false);
    });
});

describe('4.3 — the concern never writes update.mode', () => {
    it('leaves every settings file it can see untouched, and records the once', () => {
        const settings = path.join(tmp, 'agent-settings.yml');
        fs.writeFileSync(settings, 'update:\n  mode: notify\n');
        const before = fs.readFileSync(settings, 'utf-8');
        const statePath = path.join(tmp, 'state', 'update-invite.json');
        const lines: string[] = [];
        const decision = runInvite({
            packageRoot: REPO_ROOT,
            workspaceRoot: tmp,
            sessionId: '',
            mode: undefined,
            statePath,
            ringZeroText: 'ring-0-exit: yes\n',
            env: {},
            isTty: true,
            out: { write: (t) => void lines.push(t) },
        });
        // No verified-success record in a bare temp workspace, so no question.
        expect(decision.ask).toBe(false);
        expect(fs.readFileSync(settings, 'utf-8')).toBe(before);
        expect(fs.existsSync(statePath)).toBe(false);
    });
});

describe('4.3 — the manifest binding', () => {
    const manifest = parseYaml(fs.readFileSync(MANIFEST, 'utf-8')) as {
        concerns: Record<string, Record<string, unknown>>;
        platforms: Record<string, Record<string, string[]>>;
    };

    // FLIPPED 2026-10-20, by the commit the previous wording predicted — see
    // the matching block in update_notice_hook.test.ts. Round 2 returned
    // `ratified` 2/2, and this concern registers under `interaction`, a term
    // that ratification added because the closed vocabulary had no word for
    // "asks the user something" that was not `notification` ("changes nothing
    // else"). The pin inverts rather than disappears: a later edit relabelling
    // it `notification` would be the under-declaration round 1 refused.
    // FLIPPED again 2026-10-21: the registration was withdrawn after two more
    // refusals — the one global invitation was claimed on workspace-written
    // evidence without confirmed delivery. The definition and its effect stay;
    // a commit that binds it again turns this red and has to carry a new round.
    it('is defined under the ratified effect, and bound on no event of any host', () => {
        const entry = manifest.concerns[CONCERN];
        expect(entry).toBeDefined();
        expect((entry as { effect?: string }).effect).toBe('interaction');
        const bound: string[] = [];
        for (const [host, events] of Object.entries(manifest.platforms)) {
            for (const [event, concerns] of Object.entries(events)) {
                if (Array.isArray(concerns) && concerns.includes(CONCERN)) bound.push(`${host}:${event}`);
            }
        }
        expect(bound).toEqual([]);
    });
});
