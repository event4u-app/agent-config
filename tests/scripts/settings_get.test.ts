/**
 * `settings:get` — the read verb from `road-to-capability-answerability` 2.2.
 *
 * Three properties carry the value of this verb and each is asserted here:
 * the resolved SOURCE (not just the value), the absent-is-not-default warning
 * for carved-out keys, and credential redaction. The third is not in the
 * roadmap: a general settings reader is a general secret reader unless it is
 * told otherwise, and the settings tree really does carry credentials.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
    carveOutFor,
    displayValue,
    isSecretKey,
    parseArgv,
    runSettingsGet,
    templateDefault,
} from '../../src/scripts/_cli/cmd_settings_get.js';

const PACKAGE_ROOT = resolve(process.cwd());

function scratchProject(body: string): string {
    const root = mkdtempSync(join(tmpdir(), 'settings-get-'));
    writeFileSync(join(root, '.agent-settings.yml'), body, 'utf-8');
    return root;
}

describe('settings:get argv', () => {
    it('requires exactly one key', () => {
        expect(parseArgv(['personal.autonomy'])).toMatchObject({ ok: true, key: 'personal.autonomy' });
        expect(parseArgv([]).ok).toBe(false);
        expect(parseArgv(['a', 'b']).ok).toBe(false);
        expect(parseArgv(['--bogus']).ok).toBe(false);
    });
});

describe('settings:get resolution', () => {
    it('names the file a value came from, not just the value', () => {
        const root = scratchProject('personal:\n  play_by_play: true\n');
        const payload = JSON.parse(
            runSettingsGet({ key: 'personal.play_by_play', cwd: root, packageRoot: PACKAGE_ROOT, json: true })
                .out.join('\n'),
        ) as { value: unknown; set: boolean; source: string | null };

        expect(payload.set).toBe(true);
        expect(payload.value).toBe(true);
        // The whole point of the verb: the answer is checkable because it says
        // WHERE it came from. A value with a null source is an unverifiable claim.
        expect(payload.source).toContain('.agent-settings.yml');
    });

    it('reports an unset key as unset rather than inventing the default as the value', () => {
        const root = scratchProject('personal:\n  play_by_play: true\n');
        const payload = JSON.parse(
            runSettingsGet({ key: 'personal.minimal_output', cwd: root, packageRoot: PACKAGE_ROOT, json: true })
                .out.join('\n'),
        ) as { set: boolean; source: string | null; template_default: unknown };

        expect(payload.set).toBe(false);
        expect(payload.source).toBeNull();
        // The default is reported as the DEFAULT, in its own field — conflating
        // it with `value` is what makes "is this set?" unanswerable.
        expect(payload.template_default).not.toBeNull();
    });

    it('warns that absent is not the default for every carved-out key', () => {
        const root = scratchProject('personal:\n  play_by_play: true\n');
        // Derived from the carve-out module rather than hardcoded to one key,
        // so a new carved-out key is covered the day it is added.
        for (const entry of ['quality.local_auto_run', 'onboarding.onboarded']) {
            expect(carveOutFor(entry)).toBeDefined();
            const text = runSettingsGet({ key: entry, cwd: root, packageRoot: PACKAGE_ROOT, json: false })
                .out.join('\n');
            expect(text).toContain('Absent is NOT the template default');
            expect(text).toContain((carveOutFor(entry) as { reader: string }).reader);
        }
    });

    it('does not warn about absent-vs-default for an ordinary key', () => {
        const root = scratchProject('personal:\n  play_by_play: true\n');
        const text = runSettingsGet({ key: 'personal.minimal_output', cwd: root, packageRoot: PACKAGE_ROOT, json: false })
            .out.join('\n');
        expect(text).not.toContain('Absent is NOT the template default');
    });

    it('reads the shipped template for defaults', () => {
        // Guards the packaging assumption: src/config/ must stay in files[],
        // or every default reads as "(none in the template)" in a real install.
        expect(templateDefault(PACKAGE_ROOT, 'personal.autonomy')).toBe('auto');
        expect(templateDefault(PACKAGE_ROOT, 'no.such.key')).toBeUndefined();
    });
});

describe('settings:get redaction', () => {
    it('classifies credential-shaped keys wherever they sit', () => {
        expect(isSecretKey('secrets.link_encryption_key')).toBe(true);
        expect(isSecretKey('secrets')).toBe(true);
        expect(isSecretKey('github.api_key')).toBe(true);
        expect(isSecretKey('some.nested.password')).toBe(true);
        expect(isSecretKey('personal.autonomy')).toBe(false);
        expect(isSecretKey('quality.local_auto_run')).toBe(false);
    });

    it('never returns the raw value for a credential-shaped key', () => {
        const shown = displayValue('secrets.link_encryption_key', 'AAAABBBBCCCCDDDD');
        expect(shown).not.toContain('AAAABBBBCCCCDDDD');
        // Absent stays absent — masking must not fabricate presence.
        expect(displayValue('secrets.link_encryption_key', undefined)).toBeUndefined();
    });

    it('masks the value in real output while still answering the question', () => {
        const root = scratchProject('secrets:\n  link_encryption_key: SUPERSECRETVALUE123\n');
        const text = runSettingsGet({
            key: 'secrets.link_encryption_key',
            cwd: root,
            packageRoot: PACKAGE_ROOT,
            json: false,
        }).out.join('\n');

        expect(text).not.toContain('SUPERSECRETVALUE123');
        expect(text).toContain('redacted');
    });
});
