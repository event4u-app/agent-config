import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildSettingsClassIndex,
    classOfPath,
    parseSettingsClassRows,
} from '../../src/shared/settingsClasses.js';
import {
    DOGFOOD_LEDGER_POSIX,
    enabled,
    LEARN_KEY,
    LEARN_KEY_CLASS,
    learnConsent,
    readDogfoodLines,
    readLearnValue,
    runLearn,
} from '../../src/scripts/memory_learn_hook.js';

let tmp: string;

function writeSettings(root: string, body: string): void {
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), body, 'utf8');
}

function seedIntake(root: string): void {
    const intake = path.join(root, 'agents', 'memory', 'intake');
    fs.mkdirSync(intake, { recursive: true });
    const lines: string[] = [];
    for (let i = 0; i < 4; i++) {
        lines.push(
            JSON.stringify({
                id: `s${i}`,
                ts: `2026-07-${20 + i}T10:00:00Z`,
                entry_type: 'historical-patterns',
                path: 'src/x.ts',
                body: 'Use helper',
                origin: i % 2 === 0 ? 'claude' : 'cursor',
                polarity: 'preferred',
            }),
        );
    }
    fs.writeFileSync(path.join(intake, 'signals-2026-07.jsonl'), `${lines.join('\n')}\n`, 'utf8');
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-learn-hook-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('enabled() — settings mini-parser', () => {
    it('defaults to false with no settings file', () => {
        expect(enabled(tmp)).toBe(false);
    });
    it('reads memory.learn_on_session_end: true', () => {
        writeSettings(tmp, 'memory:\n  learn_on_session_end: true\n');
        expect(enabled(tmp)).toBe(true);
    });
    it('stays false when the key is false or in another block', () => {
        writeSettings(tmp, 'memory:\n  learn_on_session_end: false\n');
        expect(enabled(tmp)).toBe(false);
        writeSettings(tmp, 'other:\n  learn_on_session_end: true\nmemory:\n  visibility: on\n');
        expect(enabled(tmp)).toBe(false);
    });
});

describe('the consent gate — a value read is not a decision read', () => {
    // Phase 5 step 4 of road-to-zero-ceremony-settings: the consent-gated
    // action verifies the RECORDED DECISION. Before this wiring `consentVerdict`
    // had zero production callers — a library with a test and no consumer,
    // which is the "defined but not wired" shape senior-engineering-discipline
    // counts as not done.

    it('pins the key class against the contract, so a reclassification reds CI', () => {
        // The hook hardcodes the class to keep the 2 s teardown budget. That is
        // only safe while this assertion holds: if the contract ever moves the
        // key out of B, the hardcode silently unbinds the gate — consentVerdict
        // would return 'not-a-consent-key' and the hook would refuse forever,
        // or worse, a future edit would "fix" it by dropping the check.
        // Anchored on this file, never on the process CWD — same reason as the
        // sibling suite: a CWD-relative read is a collection-time landmine.
        const contract = fs.readFileSync(
            path.join(path.resolve(__dirname, '..', '..'), 'docs/contracts/settings-classes.md'),
            'utf8',
        );
        const index = buildSettingsClassIndex(parseSettingsClassRows(contract));
        expect(classOfPath(index, LEARN_KEY)).toBe(LEARN_KEY_CLASS);
    });

    it('grants only on a permissive value in the human-written project file', () => {
        writeSettings(tmp, 'memory:\n  learn_on_session_end: true\n');
        expect(learnConsent(tmp)).toBe('granted');
    });

    it('withholds on the conservative default — absent and no are one answer', () => {
        expect(learnConsent(tmp)).toBe('withheld-default');
        writeSettings(tmp, 'memory:\n  learn_on_session_end: false\n');
        expect(learnConsent(tmp)).toBe('withheld-default');
    });

    it('refuses a truthy-looking scalar that is not the literal true', () => {
        // The mini-parser is crude by design, and isConservativeDefault treats
        // every non-empty string as permissive. Normalising before the consent
        // check is what stops `yes` from reading as a permission.
        for (const scalar of ['yes', '1', 'on', 'maybe']) {
            writeSettings(tmp, `memory:\n  learn_on_session_end: ${scalar}\n`);
            expect(readLearnValue(tmp), scalar).toBe(false);
            expect(learnConsent(tmp), scalar).toBe('withheld-default');
        }
    });

    it('distinguishes an absent key from a key set to false', () => {
        expect(readLearnValue(tmp)).toBeUndefined();
        writeSettings(tmp, 'memory:\n  learn_on_session_end: false\n');
        expect(readLearnValue(tmp)).toBe(false);
    });

    it('does NOT distinguish a deliberate false from a malformed value', () => {
        // Pinned as a known limitation rather than left to be discovered: both
        // collapse to `false`, so `learn_on_session_end: yes` is a silent
        // permanent no-op. The fail-safe direction is deliberate; the ambiguity
        // is the cost, and diagnosing it belongs to `settings:check`.
        //
        // Asserted against the CONCRETE value, not against each other: a bare
        // equality between the two reads would also pass if the parser
        // regressed to `undefined` for both, i.e. it could not fail for the
        // reason this case is named after.
        writeSettings(tmp, 'memory:\n  learn_on_session_end: false\n');
        expect(readLearnValue(tmp)).toBe(false);
        writeSettings(tmp, 'memory:\n  learn_on_session_end: yes\n');
        expect(readLearnValue(tmp)).toBe(false);
    });

    it('collapses an UNREADABLE settings file to the same undefined as an absent one', () => {
        // The second collapse the docstring names. A directory where the file
        // should be is the cheapest reproducible I/O failure.
        fs.mkdirSync(path.join(tmp, '.agent-settings.yml'));
        expect(readLearnValue(tmp)).toBeUndefined();
        expect(learnConsent(tmp)).toBe('withheld-default');
    });
});

describe('runLearn() — budget-capped, fail-open aggregation', () => {
    it('returns null (no write) when the intake dir is absent', () => {
        expect(runLearn(tmp, '2026-07-27T00:00:00Z')).toBeNull();
    });
    it('writes sidecar + lessons and returns the visibility marker', () => {
        seedIntake(tmp);
        const marker = runLearn(tmp, '2026-07-27T00:00:00Z');
        expect(marker).toMatch(/^🧠 Memory: sidecar refreshed — 1 lesson/u);
        expect(marker).toContain('/memory:propose');
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', '.agent-learning.json'))).toBe(true);
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', 'LESSONS.md'))).toBe(true);
    });
    it('never writes curated YAML (promotion stays human)', () => {
        seedIntake(tmp);
        runLearn(tmp, '2026-07-27T00:00:00Z');
        const files = fs.readdirSync(path.join(tmp, 'agents', 'memory'));
        expect(files.filter((f) => f.endsWith('.yml'))).toEqual([]);
    });
});

// road-to-learning-you-can-see step 1.3 — the dogfood ledger. The flip
// condition at `src/config/agent-settings.template.yml:1376-1378` names two
// numbers (non-trivial signal AND session-end p95 < 2 s) and NOTHING recorded
// either, because `runLearn` returned before any measurement point whenever
// the intake was empty — which is every session in this checkout today. A
// silence and a zero read identically to anyone opening the window, so the
// measurement is taken and appended BEFORE the early returns.
describe('the dogfood ledger — a zero-signal session is a line, not a silence', () => {
    it('appends exactly one line with signals_in: 0 when the intake is empty', () => {
        fs.mkdirSync(path.join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
        expect(runLearn(tmp, '2026-07-27T00:00:00Z')).toBeNull();
        const lines = readDogfoodLines(tmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]?.signals_in).toBe(0);
        expect(lines[0]?.lessons_out).toBe(0);
        expect(lines[0]?.preferred).toBe(0);
        expect(lines[0]?.at).toBe('2026-07-27T00:00:00Z');
        expect(typeof lines[0]?.wall_ms).toBe('number');
    });

    it('records a line even when the intake directory does not exist at all', () => {
        // The absent-directory branch is the oldest early return in the
        // function and the one a zero-signal checkout actually takes.
        expect(runLearn(tmp, '2026-07-27T00:00:00Z')).toBeNull();
        expect(readDogfoodLines(tmp)).toHaveLength(1);
        expect(readDogfoodLines(tmp)[0]?.signals_in).toBe(0);
    });

    it('records the real counts when signals are present', () => {
        seedIntake(tmp);
        runLearn(tmp, '2026-07-27T00:00:00Z');
        const lines = readDogfoodLines(tmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]?.signals_in).toBe(4);
        expect(lines[0]?.lessons_out).toBe(1);
        expect(lines[0]?.preferred).toBe(1);
    });

    it('appends rather than overwrites — one line per run', () => {
        runLearn(tmp, '2026-07-27T00:00:00Z');
        seedIntake(tmp);
        runLearn(tmp, '2026-07-28T00:00:00Z');
        const lines = readDogfoodLines(tmp);
        expect(lines).toHaveLength(2);
        expect(lines.map((l) => l.signals_in)).toEqual([0, 4]);
    });

    it('lands under the gitignored runtime state root', () => {
        runLearn(tmp, '2026-07-27T00:00:00Z');
        expect(DOGFOOD_LEDGER_POSIX).toBe('agents/runtime/state/learning-dogfood.jsonl');
        expect(fs.existsSync(path.join(tmp, ...DOGFOOD_LEDGER_POSIX.split('/')))).toBe(true);
    });

    it('stays fail-open when the ledger path cannot be written', () => {
        // A directory where the file belongs is the cheapest reproducible I/O
        // failure. The aggregation must still run: the ledger is a measurement,
        // never a precondition.
        fs.mkdirSync(path.join(tmp, 'agents', 'runtime', 'state', 'learning-dogfood.jsonl'), {
            recursive: true,
        });
        seedIntake(tmp);
        expect(() => runLearn(tmp, '2026-07-27T00:00:00Z')).not.toThrow();
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', 'LESSONS.md'))).toBe(true);
        expect(readDogfoodLines(tmp)).toEqual([]);
    });
});

// 30 s rather than the 10 s global default, at describe level because every
// case in this block spawns. `vitest.config.ts` names this exact escape — "If
// CI still times out at 50%, the next move is a per-test timeout on the
// spawn-bound files — named here so it is not re-derived as a global raise" —
// and CI did still time out at 50%: `exits 0 and prints nothing when the
// setting is off` timed out at 10000 ms on macOS shard 1/4 (2026-10-01, head
// c65fb337f), while the same case passes locally in well under a second. Each
// case here runs a full `npx tsx` subprocess, which is seconds of cold start on
// a contended macOS runner before any assertion is reached.
// A per-CASE timeout was rejected: in a block where every case pays the same
// spawn cost, pinning one of them only moves the lottery to the next.
describe('hook entry — default-off no-op, fail-open', { timeout: 30_000 }, () => {
    it('exits 0 and prints nothing when the setting is off', () => {
        seedIntake(tmp);
        const out = execFileSync(
            'npx',
            ['tsx', path.resolve('src/scripts/memory_learn_hook.ts')],
            { cwd: tmp, encoding: 'utf8' },
        );
        expect(out).toBe('');
        expect(fs.existsSync(path.join(tmp, 'agents', 'memory', 'LESSONS.md'))).toBe(false);
    });
    it('exits 0 with the marker when enabled', () => {
        seedIntake(tmp);
        writeSettings(tmp, 'memory:\n  learn_on_session_end: true\n');
        const out = execFileSync(
            'npx',
            ['tsx', path.resolve('src/scripts/memory_learn_hook.ts')],
            { cwd: tmp, encoding: 'utf8' },
        );
        expect(out).toMatch(/🧠 Memory: sidecar refreshed/u);
    });
});
