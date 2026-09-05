/**
 * The `observability only` swallow, swept across its population.
 *
 * `git_auth_observability_and_bounds.test.ts` pins the same property for the two
 * sites inside `git_authorization_hook.ts`. This file is the rest of the
 * population: a grep for the exact phrase that commit rebutted returned SIX
 * occurrences across `src/**\/*.ts`, of which two were live defects in the hook
 * directory. Both are repaired here and both are held red-sensitive, because a
 * fault-injection test never seen red has unknown sensitivity.
 *
 * FOUR sites, not the two the roadmap enumerated. Its census was scoped to
 * `src/scripts/hooks/`; the phrase sweep was not, and found two more in
 * `src/scripts/language_mirror_hook.ts`. Council 2026-09-04 (anthropic +
 * openai, 2/2) held that the roadmap's "only the two named sites" bound was
 * aimed at the 47 generic silent catches, not at further instances of the exact
 * rebutted phrase — repairing two of four would be the very pathology the
 * roadmap exists to end.
 *
 * The site named here fails OPEN, which is why the assertion says so:
 *
 *   evidence_independence   — fail-OPEN. The turn's evaluation count does not
 *                             advance, so the SECOND self-scoped evaluation in
 *                             that turn is not warned about. The pre-loaded
 *                             verdict BLOCK reads the prompt, not this state,
 *                             and is unaffected.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { pendingFileFor } from '../../src/scripts/git_authorization_hook.js';
import {
    run as runEvidence,
    STATE_FILE,
} from '../../src/scripts/hooks/evidence_independence.js';
import { _setPinLost, pinLostMarker } from '../../src/scripts/language_mirror_hook.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const cleanups: Array<() => void> = [];
afterEach(() => {
    while (cleanups.length > 0) {
        (cleanups.pop() as () => void)();
    }
});

function tmpRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swallow-'));
    cleanups.push(() => {
        try {
            for (const d of walkDirs(root)) fs.chmodSync(d, 0o700);
        } catch {
            /* best effort — the rm below is the real cleanup */
        }
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

function walkDirs(root: string): string[] {
    const out: string[] = [root];
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (e.isDirectory()) out.push(...walkDirs(path.join(root, e.name)));
    }
    return out;
}

/**
 * Make `dir` unwritable and report whether the mode actually took.
 *
 * A ROOT runner ignores the bits entirely, so the write would succeed and the
 * diagnostic would never fire. That is an environment fact, not a defect — the
 * caller skips rather than fails, exactly as the sibling test does.
 */
function makeUnwritable(dir: string): boolean {
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o500);
    try {
        const probe = path.join(dir, '.writable-probe');
        fs.writeFileSync(probe, 'x');
        fs.unlinkSync(probe);
        return false;
    } catch {
        return true;
    }
}

function captureStderr(fn: () => void): string {
    const seen: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    (process.stderr as unknown as { write: unknown }).write = ((chunk: unknown) => {
        seen.push(String(chunk));
        return true;
    }) as unknown as typeof process.stderr.write;
    try {
        fn();
    } finally {
        (process.stderr as unknown as { write: unknown }).write = original;
    }
    return seen.join('');
}

function captureStdout(fn: () => void): string {
    const seen: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: unknown }).write = ((chunk: unknown) => {
        seen.push(String(chunk));
        return true;
    }) as unknown as typeof process.stdout.write;
    try {
        fn();
    } finally {
        (process.stdout as unknown as { write: unknown }).write = original;
    }
    return seen.join('');
}

function refuseEnvelope(session: string): string {
    return JSON.stringify({
        event: 'pre_tool_use',
        session_id: session,
        payload: { tool_name: 'Bash', tool_input: { command: 'npm publish' } },
    });
}

describe('evidence_independence — a failed evaluation-count write is observable', () => {
    function evalEnvelope(session: string, prompt: string): string {
        return JSON.stringify({
            event: 'pre_tool_use',
            session_id: session,
            payload: { tool_name: 'Agent', tool_input: { prompt } },
        });
    }

    it('the happy path advances the count, so the unwritable case is measured against a working one', () => {
        const root = tmpRoot();
        captureStdout(() =>
            runEvidence(evalEnvelope('e-ok', 'Review my change and report findings.'), {
                consumer_root: root,
            }),
        );
        const s = JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8')) as {
            evaluations?: unknown[];
        };
        expect(s.evaluations?.length, 'a self-scoped evaluation must be counted').toBe(1);
    });

    it('an unwritable state directory writes a diagnostic and does not block the dispatch', () => {
        const root = tmpRoot();
        const dir = path.dirname(path.join(root, STATE_FILE));
        if (!makeUnwritable(dir)) {
            expect(
                process.getuid?.() === 0 || process.platform === 'win32',
                'an unwritable directory stayed writable — expected only as root or on win32',
            ).toBe(true);
            return;
        }
        let exit = -1;
        const text = captureStderr(() => {
            captureStdout(() => {
                expect(() => {
                    exit = runEvidence(evalEnvelope('e-ro', 'Review my change and report findings.'), {
                        consumer_root: root,
                    });
                }).not.toThrow();
            });
        });
        expect(exit, 'an advisory guard must not turn a persistence failure into a deny').toBe(0);
        expect(text, 'a failed evaluation-count write must not be silent').toMatch(
            /evaluation-count write failed/,
        );
        expect(
            text,
            'the diagnostic must state the fail-OPEN direction — the next evaluation goes unwarned',
        ).toMatch(/will not be warned/);
    });
});

describe('the population, not the two instances — no write in these files swallows silently', () => {
    // Structural, and deliberately so: the shape `} catch {` with NO binding is
    // the one that CANNOT report. A `} catch (err) {` may still discard, but the
    // per-site assertions above are what stop it.
    it.each([
        'src/scripts/hooks/evidence_independence.ts',
    ])('%s binds the error on every atomic_write_json catch', (rel) => {
        const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        expect(
            src.match(/atomic_write_json\([\s\S]{0,400}?\);\s*\n\s*\} catch \{/g) ?? [],
            'an unbound catch around a persistence write cannot report the failure',
        ).toEqual([]);
    });

    it('no file under src/scripts/hooks/ still carries the rebutted phrase', () => {
        const dir = path.join(REPO_ROOT, 'src/scripts/hooks');
        const offenders: string[] = [];
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.ts')) continue;
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            for (const [i, line] of src.split('\n').entries()) {
                // The phrase is legitimate in prose that REASONS about the hazard;
                // it is the bare comment-only catch body that is the defect.
                if (/^\s*\/[/*]+\s*observability only\b/i.test(line)) {
                    offenders.push(`${f}:${i + 1}`);
                }
            }
        }
        expect(offenders, 'a bare "observability only" catch body is the swallowed write').toEqual([]);
    });
});


describe('language_mirror_hook — the two sites outside the hooks directory', () => {
    it('a failed pin-lost marker write is observable, and the turn still proceeds', () => {
        const root = tmpRoot();
        const dir = path.dirname(path.join(root, pinLostMarker('lm-ro')));
        if (!makeUnwritable(dir)) {
            expect(
                process.getuid?.() === 0 || process.platform === 'win32',
                'an unwritable directory stayed writable — expected only as root or on win32',
            ).toBe(true);
            return;
        }
        const text = captureStderr(() => {
            expect(() => _setPinLost(root, 'lm-ro')).not.toThrow();
        });
        expect(text, 'a failed pin-lost marker write must not be silent').toMatch(
            /pin-lost marker write failed/,
        );
        expect(text, 'the diagnostic must state what is lost').toMatch(/NOT be re-emitted/);
    });

    it('the happy path still writes the marker, so the unwritable case is measured against a working one', () => {
        const root = tmpRoot();
        _setPinLost(root, 'lm-ok');
        expect(fs.existsSync(path.join(root, pinLostMarker('lm-ok')))).toBe(true);
    });

    it('neither language_mirror site swallows a write without binding the error', () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/language_mirror_hook.ts'), 'utf8');
        const offenders: string[] = [];
        for (const [i, line] of src.split('\n').entries()) {
            if (/^\s*\/[/*]+\s*observability only\b/i.test(line)) offenders.push(`:${i + 1}`);
        }
        expect(
            offenders,
            'a bare "observability only" catch body is the swallowed write this sweep counts',
        ).toEqual([]);
        // The DOCBLOCK occurrence is legitimate and must survive: it reasons
        // about this exact hazard for the legacy-marker migration. A sweep that
        // deleted it would be counting the word rather than the defect.
        expect(src, 'the docblock reasoning about the hazard must not be swept away').toMatch(
            /swallows as\s*\n?\s*\*?\s*"observability only"/,
        );
    });
});
