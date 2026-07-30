// The recorded lock, made mechanical: curated project memory (`agents/memory/*.yml`)
// carries ZERO user-attribute facts. User attributes belong to the user layer
// (`profile.md` / `.agent-user.md`), never to a project-scoped curated store —
// the whole point of the global user layer is that a user fact stops being
// copied into per-project artefacts.
//
// This test asserts the lock rather than trusting a one-off manual grep: a
// future consolidation pass that starts writing `style.pace` or a person's name
// into curated memory must fail here, not be discovered by a reader.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALLOWED_OBSERVATION_FIELDS } from '../../src/scripts/_lib/user_global_observations.js';

const MEMORY_DIR = path.join(process.cwd(), 'agents', 'memory');

/**
 * The user-attribute surface, derived from the observation schema's own enum so
 * the two can never drift: whatever the buffer may propose about the user is
 * exactly what curated project memory must not contain. `notes` is excluded —
 * it is a free-text field name common enough to appear in unrelated schemas.
 */
const USER_ATTRIBUTE_KEYS = ALLOWED_OBSERVATION_FIELDS.filter((f) => f !== 'notes');

function curatedFiles(): string[] {
    if (!fs.existsSync(MEMORY_DIR)) return [];
    return fs
        .readdirSync(MEMORY_DIR)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map((f) => path.join(MEMORY_DIR, f));
}

describe('curated project memory carries zero user-attribute facts', () => {
    it('finds at least one curated file to check (a dead scan must not pass silently)', () => {
        expect(curatedFiles().length).toBeGreaterThan(0);
    });

    it('derives the forbidden key set from the observation schema, not a hand-copied list', () => {
        expect(USER_ATTRIBUTE_KEYS).toContain('identity.name');
        expect(USER_ATTRIBUTE_KEYS).toContain('style.pace');
        expect(USER_ATTRIBUTE_KEYS).toContain('voice_sample');
        expect(USER_ATTRIBUTE_KEYS).not.toContain('notes');
    });

    it.each(USER_ATTRIBUTE_KEYS)('no curated file declares %s', (key) => {
        const leaf = key.split('.').pop() as string;
        // Only ever match a DECLARATION, never prose. Two shapes:
        //   1. YAML key position — `voice_sample:`
        //   2. the dotted form an observation would use — `style.pace`
        // A single-segment key (`role`, `language`) gets shape 1 only: matching
        // it as a bare word would fire on ordinary prose ("language/project",
        // "role-modes"), which is how the first draft of this test failed on a
        // clean tree.
        const patterns = [new RegExp(`(^|\\s)${leaf}\\s*:`, 'mu')];
        if (key.includes('.')) {
            patterns.push(new RegExp(key.replace(/\./gu, '\\.'), 'u'));
        }
        for (const file of curatedFiles()) {
            const body = fs.readFileSync(file, 'utf-8');
            for (const pattern of patterns) {
                expect(pattern.test(body), `${path.basename(file)} declares ${key}`).toBe(false);
            }
        }
    });
});
