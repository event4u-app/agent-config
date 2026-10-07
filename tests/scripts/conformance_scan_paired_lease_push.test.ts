/**
 * What the conformance scan counts for the documented rebase sequence.
 *
 * Two readings, fixed here so they are measured rather than remembered: an
 * asked-for rebase with the lease push the sequence requires counts ONE
 * `git-authorization` violation — the push is a `force-push`, which the prompt
 * that asked for the rebase did not name — and an unasked rebase on its own
 * counts none, because `rebase` is a warn-level op. The classifier is not
 * changed by this file; what should replace the removed gate is owner-reserved
 * (ADR-254). A rising count is that ADR's reopen trigger, which is why the
 * number is pinned.
 */

import { describe, expect, it } from 'vitest';

import { scanSession } from '../../src/scripts/conformance_scan.js';
import { sequenceBlock } from '../_lib/rebase_sequence.js';

function user(text: string): string {
    return JSON.stringify({ type: 'user', message: { content: text }, timestamp: 'T0' });
}

function bash(command: string): string {
    return JSON.stringify({
        type: 'assistant',
        timestamp: 'T1',
        message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
    });
}

const documentedLine = (block: string, needle: string): string => {
    const line = sequenceBlock(block).split('\n').find((l) => l.includes(needle));
    if (line === undefined) throw new Error(`no line with ${needle} in the ${block} block`);
    return line.replace(/\s*\\$/, '').trim();
};

const REBASE = 'git rebase origin/main';
const LEASE_PUSH = documentedLine('publish', '--force-with-lease=')
    .replace('$RB', 'feat')
    .replace('$EXPECTED', '0123456789abcdef0123456789abcdef01234567')
    .replace('"$REMOTE"', 'origin')
    .replace('$RB', 'feat');

const gitAuth = (lines: string[]): number =>
    scanSession('s', lines).violations.filter((v) => v.check === 'git-authorization').length;

describe('the scan over the documented rebase sequence', () => {
    it('reads the push the reference documents, fully qualified', () => {
        expect(LEASE_PUSH).toBe(
            'git push --force-with-lease="refs/heads/feat:0123456789abcdef0123456789abcdef01234567" origin "HEAD:refs/heads/feat"',
        );
    });

    it('counts one violation for an asked-for rebase with its lease push', () => {
        expect(gitAuth([user('rebase this branch onto main'), bash(REBASE), bash(LEASE_PUSH)])).toBe(1);
    });

    it('counts none for an unasked rebase on its own', () => {
        expect(gitAuth([user('fix the failing test'), bash(REBASE)])).toBe(0);
    });
});
