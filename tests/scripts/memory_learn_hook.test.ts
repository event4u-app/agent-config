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
    enabled,
    LEARN_KEY,
    LEARN_KEY_CLASS,
    learnConsent,
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
        const contract = fs.readFileSync(
            path.resolve('docs/contracts/settings-classes.md'),
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

describe('hook entry — default-off no-op, fail-open', () => {
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
