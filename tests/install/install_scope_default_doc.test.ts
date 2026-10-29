// The install-scope contract and the README name a default scope; the
// installer has its own. They drifted once (both docs said project-local while
// `detectScope` falls through to `global`, ADR-020), so the default the docs
// name is read from the docs and compared with what the installer returns.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detectScope } from '../../src/install/detect.js';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCOPE_OF: Record<string, string> = { 'user-global': 'global', 'project-local': 'project' };

/** The scope a doc names in its `**Installer default:** <scope>` marker, or null. */
function namedDefault(file: string): string | null {
    const text = fs.readFileSync(path.join(REPO, file), 'utf-8');
    const m = /\*\*Installer default:\*\*\s*\**(user-global|project-local)/.exec(text);
    return m === null ? null : (SCOPE_OF[m[1] as string] ?? null);
}

let tmp: string | null = null;
afterEach(() => {
    if (tmp !== null) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
});

describe('the documented installer default is the installer default', () => {
    it.each(['docs/contracts/install-scopes.md', 'README.md'])('%s names the scope detectScope returns', (file) => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-default-'));
        expect(namedDefault(file)).toBe(detectScope(tmp).scope);
    });

    it('neither doc calls project-local the default', () => {
        for (const file of ['docs/contracts/install-scopes.md', 'README.md']) {
            const text = fs.readFileSync(path.join(REPO, file), 'utf-8');
            expect(text, file).not.toMatch(/project-local \(default/);
        }
    });
});
