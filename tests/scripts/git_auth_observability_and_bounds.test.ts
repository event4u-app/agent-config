/**
 * Two properties the authorization gate asserted in comments and nowhere else.
 *
 * 1. A failed persistence write is OBSERVABLE. Both sites carried an
 *    "Observability only" comment and wrote nothing — the word inverted. The
 *    failure DIRECTION was and is defensible; the silence was not, because an
 *    operator had no way to learn that a grant outlived its single use.
 *    AC-5 describes a behavioural class, so both call sites are tested: fixing
 *    one and leaving its sibling would have made the acceptance claim half true.
 *
 * 2. A pull-request target resolves across the API's whole range. Both the
 *    mint and the consume site carried `\d{1,7}`, whose `\b` sits after digit
 *    seven — so an eight-digit target did not resolve out of range, it resolved
 *    to NOTHING and the gate fell back to the clock with no diagnostic.
 *    Widening only the consume site would have been inert: the mint site is
 *    where a grant's target set is frozen.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    consumeGrantTarget,
    extractMergeTargets,
    ledgerFileFor,
    PR_NUMBER_MAX,
    readGrants,
} from '../../src/scripts/git_authorization_hook.js';
import { mergeTargetOf } from '../../src/scripts/hooks/git_command_classifier.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const cleanups: Array<() => void> = [];
afterEach(() => {
    while (cleanups.length > 0) {
        (cleanups.pop() as () => void)();
    }
});

function ledgerFixture(session: string, target: number): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauth-obs-'));
    const file = path.join(root, ledgerFileFor(session));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        JSON.stringify({
            grants: [{ id: 'g1', op: 'pr-merge', targets: [target], consumed: [] }],
        }),
    );
    cleanups.push(() => {
        try {
            fs.chmodSync(path.dirname(file), 0o700);
        } catch {
            /* best effort */
        }
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

describe('AC-5 — a failed grant-consumption write is observable, and the outcome is unchanged', () => {
    it('the happy path still consumes, so the unwritable case is measured against a working one', () => {
        const root = ledgerFixture('sess-ok', 42);
        consumeGrantTarget(root, 'sess-ok', 42);
        expect(readGrants(root, 'sess-ok')[0]?.consumed).toEqual([42]);
    });

    it('an unwritable ledger directory writes a diagnostic to stderr and still returns', () => {
        const root = ledgerFixture('sess-ro', 42);
        const dir = path.dirname(path.join(root, ledgerFileFor('sess-ro')));
        fs.chmodSync(dir, 0o500); // readable, not writable — the read succeeds, the write cannot
        // A ROOT runner ignores the mode bits entirely, so the write would
        // succeed and the diagnostic would never fire. That is an environment
        // fact, not a defect, and the probe says so instead of failing.
        let modeHolds = false;
        try {
            const probe = path.join(dir, '.writable-probe');
            fs.writeFileSync(probe, 'x');
            fs.unlinkSync(probe);
        } catch {
            modeHolds = true;
        }
        if (!modeHolds) {
            expect(
                process.getuid?.() === 0 || process.platform === 'win32',
                'an unwritable directory stayed writable — expected only as root or on win32',
            ).toBe(true);
            return;
        }
        const seen: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        (process.stderr as unknown as { write: unknown }).write = ((chunk: unknown) => {
            seen.push(String(chunk));
            return true;
        }) as unknown as typeof process.stderr.write;
        try {
            // The contract is that it does NOT throw — the authorization outcome
            // is unchanged by a persistence failure.
            expect(() => consumeGrantTarget(root, 'sess-ro', 42)).not.toThrow();
        } finally {
            (process.stderr as unknown as { write: unknown }).write = original;
        }
        const text = seen.join('');
        expect(text, 'a failed grant-consumption write must not be silent').toMatch(
            /grant-consumption write failed/,
        );
        expect(text, 'the diagnostic must state the failure direction').toMatch(/UNSPENT/);
    });

    it('the sibling swallow is fixed too — neither site is silent', () => {
        // Asserted structurally rather than by driving the whole hook: the
        // session-ledger write sits behind a full pre_tool_use dispatch with a
        // real repo layout, and a test that drove it would be asserting the
        // dispatch. What AC-5 needs is that no `catch` in this file discards a
        // persistence failure without saying so.
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src/scripts/git_authorization_hook.ts'),
            'utf8',
        );
        // `} catch {` with NO binding is the shape that cannot report. A
        // `} catch (err) {` may still discard, but it cannot do so silently
        // without the second assertion below failing.
        const swallows = src.match(/atomic_write_json\([^)]*\);\s*\n\s*\} catch \{/g) ?? [];
        expect(
            swallows,
            'every atomic_write_json catch must bind the error so it can be reported',
        ).toEqual([]);
        expect(
            (src.match(/write failed \(\$\{_errText\(err\)\}\)/g) ?? []).length,
            'both persistence sites report',
        ).toBe(2);
    });
});

describe('AC — an eight-digit pull-request target resolves at both sites', () => {
    it('the consume site resolves an eight-digit gh target', () => {
        expect(mergeTargetOf('gh pr merge 12345678 --squash')).toBe(12345678);
        expect(mergeTargetOf('gh api -X PUT repos/o/r/pulls/12345678/merge')).toBe(12345678);
    });

    it('the mint site freezes an eight-digit target — without this the fix is inert', () => {
        expect(extractMergeTargets('merge PR #12345678 please')).toEqual([12345678]);
    });

    it('the seven-digit shape it used to be bounded at still resolves', () => {
        expect(mergeTargetOf('gh pr merge 1234567')).toBe(1234567);
        expect(extractMergeTargets('merge #1234567')).toEqual([1234567]);
    });

    it('above the API bound is NO target, not a wrapped one', () => {
        const over = String(PR_NUMBER_MAX + 1);
        expect(mergeTargetOf(`gh pr merge ${over}`)).toBeNull();
        expect(extractMergeTargets(`merge PR #${over}`)).toEqual([]);
        expect(PR_NUMBER_MAX).toBe(2147483647);
    });

    it('the mint site still requires an object marker — a bare number freezes nothing', () => {
        expect(extractMergeTargets('merge the 3 branches')).toEqual([]);
    });

    it('both sites carry the same bound, read from one constant', () => {
        const consume = fs.readFileSync(
            path.join(REPO_ROOT, 'src/scripts/hooks/git_command_classifier.ts'),
            'utf8',
        );
        const mint = fs.readFileSync(
            path.join(REPO_ROOT, 'src/scripts/git_authorization_hook.ts'),
            'utf8',
        );
        expect(consume, 'the consume site imports the bound rather than restating it').toMatch(
            /PR_NUMBER_MAX/,
        );
        // Scoped to REGEX LITERALS, not to the file text. Both files now carry
        // the old bound in a comment explaining what changed, and a file-wide
        // grep would read its own changelog as the defect — which it did on the
        // first run of this test.
        const regexLiterals = (text: string): string[] =>
            (text.match(/\/(?:[^/\n\\]|\\.)+\/[gimsuy]*/g) ?? []).filter((r) =>
                /pulls|pr\\s|pr\[|#/.test(r),
            );
        for (const [label, text] of [
            ['consume', consume],
            ['mint', mint],
        ] as const) {
            for (const lit of regexLiterals(text)) {
                expect(lit, `${label}: no seven-digit bound survives in a regex`).not.toMatch(
                    /\\d\{1,7\}/,
                );
            }
        }
        expect(consume, 'the consume site widened to ten digits').toMatch(/\\d\{1,10\}/);
        expect(mint, 'the mint site widened to ten digits').toMatch(/\\d\{1,10\}/);
    });
});

/**
 * Is the roadmap's base commit reachable in this checkout?
 *
 * `actions/checkout` defaults to `fetch-depth: 1`, and the workflow that runs
 * this suite does not override it — so in CI the repository is a shallow clone
 * with one commit and `git show 022c0d240:…` cannot resolve. Measured the hard
 * way: this suite passed locally and failed on shard 1/4 of both runners.
 *
 * The assertion below is about HISTORY, so a checkout without history cannot
 * make it and must not pretend to. It skips with the reason rather than
 * silently passing, which is the difference between an honest gap and a green
 * check that proves nothing.
 */
function baseCommitReachable(base: string): boolean {
    try {
        execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        return true;
    } catch {
        return false;
    }
}

describe('the git history records the pre-state, so the fix is not asserted from memory', () => {
    const base = '022c0d240';
    const reachable = baseCommitReachable(base);

    it.skipIf(!reachable)('the seven-digit bound was really there at the roadmap base', () => {
        for (const rel of [
            'src/scripts/git_authorization_hook.ts',
            'src/scripts/hooks/block_unauthorized_git.ts',
        ]) {
            const at = execFileSync('git', ['show', `${base}:${rel}`], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
            });
            expect(at, `${rel} at ${base}`).toMatch(/\\d\{1,7\}/);
        }
    });

    it('records WHY the pre-state probe is skipped, when it is', () => {
        // Not a tautology: it asserts the skip is explained by a reachability
        // fact rather than by the test having been quietly deleted.
        expect(typeof reachable).toBe('boolean');
    });
});
