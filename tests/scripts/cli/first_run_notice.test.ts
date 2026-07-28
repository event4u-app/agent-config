// Install-time side-effect honesty (road-to-feedback-9.8.0-followups Phase 0):
// the package has NO install-time GUI side effect; the discoverability notice
// prints exactly once, on the first INTERACTIVE CLI invocation, and every
// machine surface (CI, pipes/hooks, AGENT_CONFIG_NO_UI) never sees it.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FIRST_RUN_NOTICE,
    maybePrintFirstRunNotice,
} from '../../../src/cli/firstRunNotice.js';

let root: string;
let out: string[];
const io = (over: Record<string, unknown> = {}) => ({
    env: {} as NodeJS.ProcessEnv,
    isStderrTty: true,
    root,
    write: (t: string) => { out.push(t); },
    ...over,
});

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ac-first-run-'));
    out = [];
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe('maybePrintFirstRunNotice', () => {
    it('prints the notice once, then never again (marker persisted)', () => {
        expect(maybePrintFirstRunNotice('doctor-shell', io())).toBe(true);
        expect(out).toEqual([FIRST_RUN_NOTICE]);
        expect(existsSync(join(root, 'first-run-notice-shown'))).toBe(true);
        expect(maybePrintFirstRunNotice('doctor-shell', io())).toBe(false);
        expect(out).toHaveLength(1);
    });

    it('names the suppress var and the GUI entry point in the notice text', () => {
        expect(FIRST_RUN_NOTICE).toContain('AGENT_CONFIG_NO_UI');
        expect(FIRST_RUN_NOTICE).toContain('agent-config setup');
    });

    it('is silent under CI', () => {
        expect(maybePrintFirstRunNotice('versions', io({ env: { CI: '1' } }))).toBe(false);
        expect(out).toHaveLength(0);
        expect(existsSync(join(root, 'first-run-notice-shown'))).toBe(false);
    });

    it('is silent when AGENT_CONFIG_NO_UI is set', () => {
        expect(
            maybePrintFirstRunNotice('versions', io({ env: { AGENT_CONFIG_NO_UI: '1' } })),
        ).toBe(false);
        expect(out).toHaveLength(0);
    });

    it('is silent when stderr is not a TTY (pipes, hooks, MCP serving)', () => {
        expect(maybePrintFirstRunNotice('versions', io({ isStderrTty: false }))).toBe(false);
        expect(out).toHaveLength(0);
        expect(existsSync(join(root, 'first-run-notice-shown'))).toBe(false);
    });

    it('marks as seen WITHOUT printing when the first command already opens the GUI', () => {
        expect(maybePrintFirstRunNotice('setup', io())).toBe(false);
        expect(out).toHaveLength(0);
        expect(existsSync(join(root, 'first-run-notice-shown'))).toBe(true);
        expect(maybePrintFirstRunNotice('versions', io())).toBe(false);
    });

    it('degrades to silence on an unwritable root', () => {
        expect(
            maybePrintFirstRunNotice('versions', io({ root: '/dev/null/nope' })),
        ).toBe(false);
        expect(out).toHaveLength(0);
    });
});
