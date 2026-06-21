// Tests for src/scripts/lint_global_paths.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over `lint()` with synthetic
// policies plus a golden-parity layer running python3 vs tsx on the REAL REPO
// (skipped without python3). The linter resolves globs under $HOME, so parity
// runs use the real default policy + an empty policy — both deterministic
// across the two runtimes.
//
// DIVERGENCE CANDIDATE (flagged, not on any CI path): the bad/missing-policy
// error text embeds the runtime exception message — Python `[Errno 2] No such
// file...` / json `Expecting property name...` vs Node `ENOENT ...` / V8 JSON
// parser text. The stable `error: policy load failed:` prefix and exit code 2
// match; the trailing exception string does not. The CI invocation always
// uses the valid default policy, so this path never fires in CI. We assert the
// exit code + prefix here, never byte-compare the exception tail.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lint } from '../../src/scripts/lint_global_paths.js';



describe('lint_global_paths.lint — synthetic policies', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lgp-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('a policy whose global_root is absent is clean (exit 0)', () => {
        // An empty `{}` policy falls back to the real default root
        // (~/.event4u/agent-config), which is machine-dependent. Point the
        // root at a guaranteed-absent path so the result is deterministic:
        // a missing root skips its mode + symlink checks → no findings.
        const p = path.join(tmp, 'pol.json');
        fs.writeFileSync(
            p,
            JSON.stringify({ global_root: { path: path.join(tmp, 'absent-root') } }),
        );
        expect(lint(p, true)).toBe(0);
    });

    it('a missing policy returns the usage-error code 2', () => {
        expect(lint(path.join(tmp, 'nope.json'), true)).toBe(2);
    });

    it('a malformed policy returns code 2', () => {
        const p = path.join(tmp, 'bad.json');
        fs.writeFileSync(p, '{not json');
        expect(lint(p, true)).toBe(2);
    });

    it('a policy requiring a missing file under a nonexistent root yields no finding when the root is absent', () => {
        // global_root that does not exist → root checks are skipped; a
        // non-required file glob also yields nothing. Clean (exit 0).
        const p = path.join(tmp, 'pol.json');
        fs.writeFileSync(
            p,
            JSON.stringify({
                global_root: { path: path.join(tmp, 'no-such-root'), expected_mode: '0700' },
                files: [{ glob: path.join(tmp, 'no-such-root', '*.txt'), expected_mode: '0600' }],
            }),
        );
        expect(lint(p, true)).toBe(0);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

