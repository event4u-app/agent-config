import { describe, expect, it } from 'vitest';

import { _build_envelope } from '../../src/scripts/hooks/dispatch_hook.js';
import {
    commandFromStdin,
    correctedVolume,
    isExcluded,
    isShipCommand,
    DEFAULT_THRESHOLD,
} from '../../src/scripts/hooks/ship_diff_volume_hook.js';

/** The dispatcher's own argument shape, so the envelope under test is the real one. */
const DISPATCH_ARGS = {
    platform: 'claude',
    event: 'pre_tool_use',
    native_event: 'PreToolUse',
    manifest: '',
    dry_run: false,
    project_dir: '',
    min_version: 1,
};

/** Exactly the text the dispatcher writes to a concern's stdin. */
function dispatcherStdin(hostPayload: unknown): string {
    return JSON.stringify(_build_envelope(DISPATCH_ARGS, JSON.stringify(hostPayload)));
}

describe('ship-diff-volume', () => {
    it('fires only on ship verbs', () => {
        for (const cmd of ['git push', 'git push --force-with-lease origin x', 'gh pr create --fill']) {
            expect(isShipCommand(cmd)).toBe(true);
        }
        for (const cmd of ['git status', 'git commit -m x', 'gh pr view 12', 'npm run push-docs']) {
            expect(isShipCommand(cmd)).toBe(false);
        }
    });

    it('excludes the repository bookkeeping the s04 replay identified', () => {
        // The measured defect: a committed copy of the diff being measured.
        expect(isExcluded('agents/evidence/reviews/x.review-input/diff.patch')).toBe(true);
        expect(isExcluded('agents/roadmaps/archive/index.json')).toBe(true);
        expect(isExcluded('dist/agent-src/rules/x.md')).toBe(true);
        expect(isExcluded('.claude/rules/x.md')).toBe(true);
    });

    it('counts ordinary source as volume', () => {
        expect(isExcluded('src/scripts/foo.ts')).toBe(false);
        expect(isExcluded('agents/roadmaps/road-to-x.md')).toBe(false);
        // A sibling archive file that is NOT the generated index still counts.
        expect(isExcluded('agents/roadmaps/archive/road-to-y.md')).toBe(false);
    });

    it('subtracts excluded paths from the volume rather than the file count', () => {
        const numstat = [
            '10\t5\tsrc/scripts/a.ts',
            '2000\t800\tagents/evidence/reviews/x.review-input/diff.patch',
            '3\t0\tsrc/scripts/b.ts',
        ].join('\n');
        const r = correctedVolume(numstat);
        expect(r.volume).toBe(18);
        expect(r.excluded).toBe(2800);
        expect(r.files).toBe(2);
    });

    it('treats a binary numstat row as zero rather than NaN', () => {
        const r = correctedVolume('-\t-\tassets/logo.png\n4\t1\tsrc/x.ts');
        expect(r.volume).toBe(5);
        expect(Number.isNaN(r.volume)).toBe(false);
    });

    it('pins the threshold to the derived p90, so a silent retune is a visible diff', () => {
        expect(DEFAULT_THRESHOLD).toBe(1695);
    });

    // The defect this concern shipped with: it read `tool_input` off the
    // ENVELOPE ROOT, one level above where the dispatcher puts it. Under the
    // real dispatcher it therefore found nothing and returned '' on every
    // invocation — a concern that ran, cost a dispatch, and could never fire.
    // These build their input with the dispatcher's OWN `_build_envelope`, so a
    // fixture cannot drift into agreeing with the bug.
    describe('the dispatcher stdin boundary', () => {
        it('finds the ship verb in a dispatcher envelope, where the tool fields are under payload', () => {
            const stdin = dispatcherStdin({
                session_id: 'boundary-test',
                hook_event_name: 'PreToolUse',
                tool_name: 'Bash',
                tool_input: { command: 'git push --force-with-lease origin x' },
            });
            // Pre-fix this read the envelope root and returned ''.
            expect(commandFromStdin(stdin)).toBe('git push --force-with-lease origin x');
            expect(isShipCommand(commandFromStdin(stdin))).toBe(true);
        });

        it('keeps reading a bare host payload, the direct-invocation shape', () => {
            const raw = JSON.stringify({
                hook_event_name: 'PreToolUse',
                tool_name: 'Bash',
                tool_input: { command: 'gh pr create --fill' },
            });
            expect(commandFromStdin(raw)).toBe('gh pr create --fill');
        });

        it('reads a payload that carries the command without a tool_input wrapper', () => {
            const stdin = dispatcherStdin({ command: 'git push' });
            expect(commandFromStdin(stdin)).toBe('git push');
        });

        it('stays silent on a non-ship tool call rather than guessing', () => {
            const stdin = dispatcherStdin({
                tool_name: 'Bash',
                tool_input: { command: 'git status --short' },
            });
            expect(isShipCommand(commandFromStdin(stdin))).toBe(false);
        });

        it('returns empty on empty, non-JSON, and payload-less stdin instead of throwing', () => {
            expect(commandFromStdin('')).toBe('');
            expect(commandFromStdin('not json {')).toBe('');
            expect(commandFromStdin(dispatcherStdin({}))).toBe('');
        });
    });
});
