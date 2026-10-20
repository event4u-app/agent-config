/**
 * The stdin seam crosses a module-graph boundary.
 *
 * A concern loaded from a conditional chunk (`hooks/lazy_concern.ts`) is a
 * second module graph in the same process and carries its own copy of
 * `hook_stdin.ts`. While the override was a module-local binding, the
 * dispatcher set it on ITS copy and the concern read a different one — fell
 * through to fd 0, already consumed, and ran against an empty envelope with
 * exit code 0. Measured 2026-10-20 on the lazily loaded `chat-history`
 * concern, which wrote no history line at all.
 *
 * This asserts the fix in the shape of the defect: set through one instance,
 * read through another.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { clearHookStdinOverride, readHookStdin, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const HOOK_STDIN = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'hook_stdin.ts');

interface HookStdin {
    readHookStdin: () => string;
    setHookStdinOverride: (raw: string) => void;
    clearHookStdinOverride: () => void;
}

/** A SECOND instance of the module, through tsx's CJS require — a distinct graph. */
function secondInstance(): HookStdin {
    const req = createRequire(import.meta.url);
    const api = req('tsx/cjs/api') as { require: (id: string, from: string) => unknown };
    return api.require(HOOK_STDIN, fileURLToPath(import.meta.url)) as HookStdin;
}

describe('hook stdin override across module graphs', () => {
    afterEach(() => {
        clearHookStdinOverride();
    });

    it('is visible to a second instance of the module', () => {
        const other = secondInstance();
        // Genuinely a different instance, not a re-export of the same binding.
        expect(other.readHookStdin).not.toBe(readHookStdin);
        setHookStdinOverride('{"event":"session_start"}');
        expect(other.readHookStdin()).toBe('{"event":"session_start"}');
    });

    it('is cleared for the second instance too', () => {
        const other = secondInstance();
        setHookStdinOverride('{"event":"stop"}');
        clearHookStdinOverride();
        // Nothing on fd 0 under vitest, so the fall-through answer is empty.
        expect(other.readHookStdin()).toBe('');
    });

    it('a second instance setting it is visible here', () => {
        const other = secondInstance();
        other.setHookStdinOverride('{"from":"the chunk"}');
        try {
            expect(readHookStdin()).toBe('{"from":"the chunk"}');
        } finally {
            other.clearHookStdinOverride();
        }
    });
});
