/**
 * No test run appends to a ledger outside a temporary directory (AC-5).
 *
 * Step 4.1 of `road-to-a-spend-bound-only-where-one-was-set`.
 *
 * The council spend ledger resolves its path from the user-global
 * configuration home, once, at import time. Nothing in the suite pinned that
 * home, so a test exercising a billable seat appended to the developer's real
 * `~/.event4u/agent-config/council-spend.jsonl`, on their real machine,
 * recording test traffic as spend.
 *
 * That stayed survivable only because the orchestrator appended a line solely
 * while a daily limit was set and no default set one. Step 4.2 removes that
 * condition, so this file lands FIRST: afterwards every billable response
 * writes, and an unpinned home would turn a green suite into real-looking
 * spend records on whoever ran it.
 *
 * The assertion that matters is the LOCATION, not the absence. "No ledger was
 * written" and "a ledger was written somewhere else" look identical from
 * inside a passing test, and only the second is the bug.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONFIG_HOME_VAR, HERMETIC_CONFIG_HOME } from '../../_lib/hermetic-env.js';
import {
    LEDGER_PATH,
    LEDGER_FILENAME,
    record_spend,
} from '../../../src/scripts/ai_council/budget_guard.js';

/** Resolved once, at import — which is exactly what makes the pin load-bearing. */
const REAL_HOME_LEDGER = path.join(
    os.homedir(),
    '.event4u',
    'agent-config',
    LEDGER_FILENAME,
);

describe('the suite is isolated from the real spend ledger', () => {
    it('pins the configuration home to a temporary directory', () => {
        expect(process.env[CONFIG_HOME_VAR]).toBe(HERMETIC_CONFIG_HOME);
        expect(HERMETIC_CONFIG_HOME.startsWith(fs.realpathSync(os.tmpdir()))).toBe(true);
    });

    it('resolves the ledger path inside that directory', () => {
        // `LEDGER_PATH` is a module constant computed at import time. If the
        // pin ever moves out of `setupFiles` into a `beforeEach`, this is the
        // assertion that notices.
        expect(LEDGER_PATH.startsWith(HERMETIC_CONFIG_HOME)).toBe(true);
    });

    it('does not resolve the ledger to the real user-global home', () => {
        // Stated as its own case because the previous one would still pass if
        // the temporary directory were somehow nested under the real home.
        expect(LEDGER_PATH).not.toBe(REAL_HOME_LEDGER);
        expect(LEDGER_PATH.includes(path.join('.event4u', 'agent-config'))).toBe(false);
    });

    it('a real append lands inside the temporary directory and nowhere else', () => {
        // The sensitivity case: it exercises the writer rather than the
        // constant, so it fails if a future caller resolves its own path.
        const realBefore = fs.existsSync(REAL_HOME_LEDGER)
            ? fs.statSync(REAL_HOME_LEDGER).size
            : null;

        // Refuse to write before it is proven safe to. Without this the case
        // becomes the defect: run with the pin removed, `record_spend` resolves
        // to the real home and appends a fabricated line there BEFORE any
        // later assertion can fail. Measured on 2026-10-06 while proving this
        // file's sensitivity — the probe put `0.4242` into a real developer
        // ledger and it had to be removed by hand.
        if (!LEDGER_PATH.startsWith(HERMETIC_CONFIG_HOME)) {
            throw new Error(
                `refusing to append: ledger resolves outside the hermetic home (${LEDGER_PATH})`,
            );
        }
        // No `path` override — the whole point is to exercise the DEFAULT
        // resolution, which is what a run under test would use.
        expect(record_spend(0.4242, 'test-provider', 'test-model')).toBe(true);

        expect(fs.existsSync(LEDGER_PATH)).toBe(true);
        expect(fs.readFileSync(LEDGER_PATH, 'utf-8')).toContain('0.4242');

        // The real ledger is byte-unchanged — absent stays absent, and a
        // pre-existing one keeps its size.
        const realAfter = fs.existsSync(REAL_HOME_LEDGER)
            ? fs.statSync(REAL_HOME_LEDGER).size
            : null;
        expect(realAfter).toBe(realBefore);
    });
});
