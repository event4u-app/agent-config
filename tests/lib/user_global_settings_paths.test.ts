/**
 * The user-global settings cascade — `road-to-capability-answerability` 4.1.
 *
 * Before this, three writers (the GUI settings route, the wizard route, the
 * installer) produced `<event4u_root>/settings/.agent-settings.yml` while
 * `load_agent_settings` read `<event4u_root>/agent-settings.yml`. Everything set
 * through the only surfaces that write settings was silently inert.
 *
 * The fix is deliberately ADDITIVE — the flat file stays in the cascade because
 * `link_crypto.ts` reads it directly — so these tests pin both halves: the
 * canonical file is read and wins, AND the flat file still resolves.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as ags from '../../src/scripts/_lib/agent_settings.js';

const ENV_KEY = 'EVENT4U_CONFIG_HOME';
const originalHome = process.env[ENV_KEY];

function globalRootWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'ug-settings-'));
    for (const [rel, body] of Object.entries(files)) {
        const target = join(root, rel);
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, body, 'utf-8');
    }
    return root;
}

afterEach(() => {
    if (originalHome === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalHome;
});

describe('user-global settings cascade', () => {
    it('reads the canonical settings/.agent-settings.yml the writers produce', () => {
        process.env[ENV_KEY] = globalRootWith({
            'settings/.agent-settings.yml': "personal:\n  autonomy: 'on'\n",
        });

        expect(ags.user_global_settings_paths().some((p) => p.includes('settings/'))).toBe(true);
        const merged = ags.load_agent_settings({ cwd: mkdtempSync(join(tmpdir(), 'proj-')) });
        expect((merged['personal'] as Record<string, unknown>)['autonomy']).toBe('on');
    });

    it('still reads the flat agent-settings.yml, which link_crypto depends on', () => {
        process.env[ENV_KEY] = globalRootWith({
            'agent-settings.yml': "personal:\n  autonomy: 'off'\n",
        });

        const merged = ags.load_agent_settings({ cwd: mkdtempSync(join(tmpdir(), 'proj-')) });
        // Additive means nothing that resolved before stops resolving.
        expect((merged['personal'] as Record<string, unknown>)['autonomy']).toBe('off');
    });

    it('lets the canonical file win per key when both exist', () => {
        process.env[ENV_KEY] = globalRootWith({
            'agent-settings.yml': "personal:\n  autonomy: 'off'\n",
            'settings/.agent-settings.yml': "personal:\n  autonomy: 'on'\n",
        });

        const merged = ags.load_agent_settings({ cwd: mkdtempSync(join(tmpdir(), 'proj-')) });
        expect((merged['personal'] as Record<string, unknown>)['autonomy']).toBe('on');
        // Precedence is expressed by ORDER, so the canonical path is last.
        const paths = ags.user_global_settings_paths();
        expect(paths).toHaveLength(2);
        expect(paths[paths.length - 1]).toContain('settings/');
    });

    it('attributes each value to the file that actually contains it', () => {
        process.env[ENV_KEY] = globalRootWith({
            'agent-settings.yml': "personal:\n  autonomy: 'off'\n",
            'settings/.agent-settings.yml': "personal:\n  autonomy: 'on'\n",
        });

        const tuples = [...ags.iter_setting_overrides({ cwd: mkdtempSync(join(tmpdir(), 'proj-')) })]
            .filter(([key]) => key === 'personal.autonomy');

        // Two files set it, so two tuples — collapsing them would attribute a
        // value to a file that does not contain it, which is the one thing this
        // generator exists to get right.
        expect(tuples).toHaveLength(2);
        expect(tuples[0]?.[1]).toBe('off');
        expect(tuples[1]?.[1]).toBe('on');
        expect(tuples[1]?.[2]).toContain('settings/');
    });

    it('honours an explicit user_global_path override without merging', () => {
        const root = globalRootWith({
            'agent-settings.yml': "personal:\n  autonomy: 'off'\n",
            'settings/.agent-settings.yml': "personal:\n  autonomy: 'on'\n",
        });
        process.env[ENV_KEY] = root;

        const merged = ags.load_agent_settings({
            cwd: mkdtempSync(join(tmpdir(), 'proj-')),
            user_global_path: join(root, 'agent-settings.yml'),
        });
        // A caller naming one file means that file, not "that file plus others".
        expect((merged['personal'] as Record<string, unknown>)['autonomy']).toBe('off');
    });
});
