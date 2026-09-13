import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    REMOVED_KEYS,
    RENAMED_KEYS,
    load_agent_settings,
} from '../../src/scripts/_lib/agent_settings.js';

function tmpProject(yaml: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renamed-keys-'));
    fs.writeFileSync(path.join(dir, '.agent-settings.yml'), yaml, 'utf8');
    return dir;
}

function read(dir: string): Record<string, unknown> {
    return load_agent_settings({
        project_path: path.join(dir, '.agent-settings.yml'),
        user_global_path: path.join(dir, 'no-such-user-global.yml'),
        cwd: dir,
    }) as Record<string, unknown>;
}

function planning(dir: string): Record<string, unknown> {
    return (read(dir)['planning'] ?? {}) as Record<string, unknown>;
}

describe('RENAMED_KEYS — a renamed key CARRIES its value', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('the old key alone resolves onto the new one', () => {
        // The property that separates a rename from a removal: an installed
        // `false` must not quietly become the shipped `true`.
        const dir = tmpProject('planning:\n  challenge_on_create: false\n');
        expect(planning(dir)['closure_pass']).toBe(false);
    });

    it('the new key wins when a file carries both', () => {
        // A reader who has already migrated is not overridden by a stale line
        // they forgot to delete.
        const dir = tmpProject('planning:\n  challenge_on_create: false\n  closure_pass: true\n');
        expect(planning(dir)['closure_pass']).toBe(true);
    });

    it('a file carrying neither is untouched by the migration', () => {
        const dir = tmpProject('planning:\n  risk_review: false\n');
        expect(planning(dir)['closure_pass']).not.toBe(false);
    });

    it('the rename is NOT in the removed map — the two do different things', () => {
        // A removed key's value is discarded; putting a rename there would
        // silently return an installed `false` to the shipped default.
        for (const oldKey of RENAMED_KEYS.keys()) {
            expect(REMOVED_KEYS.has(oldKey)).toBe(false);
        }
    });

    it('every rename target differs from its source', () => {
        for (const [from, to] of RENAMED_KEYS) expect(from).not.toBe(to);
    });
});
