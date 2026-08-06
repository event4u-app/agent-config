/**
 * Phase 4 step 2 of `road-to-zero-ceremony-settings` — the nickname prefill.
 *
 * The step's payload is "accepting is one keypress", and that only holds when
 * the prefilled value is the one the user would have typed. The rule states the
 * chain and closes it with a negation ("Never `$USER` alone"), so the negation
 * is what most of these cases pin: an assertion that git wins is weaker than an
 * assertion that `$USER` does not win while a git name exists.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { nicknamePrefill } from '../../src/shared/nicknamePrefill.js';

describe('nicknamePrefill — the documented chain, in order', () => {
    it('prefers the git user name over every environment variable', () => {
        const got = nicknamePrefill({
            env: { USER: 'mberg', USERNAME: 'mberg-win' },
            gitUserName: 'Mathias Berg',
        });
        expect(got).toEqual({ name: 'Mathias Berg', source: 'git-user-name' });
    });

    it('never returns $USER while a git name exists — the rule\'s negation', () => {
        const got = nicknamePrefill({ env: { USER: 'mberg' }, gitUserName: 'Mathias Berg' });
        expect(got.name).not.toBe('mberg');
        expect(got.source).toBe('git-user-name');
    });

    it('falls back to $USER when git has no name configured', () => {
        expect(nicknamePrefill({ env: { USER: 'mberg' }, gitUserName: undefined })).toEqual({
            name: 'mberg',
            source: 'env-user',
        });
    });

    it('falls back to $USERNAME on Windows, where $USER is unset', () => {
        expect(nicknamePrefill({ env: { USERNAME: 'mberg-win' } })).toEqual({
            name: 'mberg-win',
            source: 'env-username',
        });
    });

    it('treats a whitespace-only value at any rung as absent, not as a name', () => {
        // A `git config user.name` of "   " is the shape that would otherwise
        // prefill the field with blanks and cost the user a keypress to clear.
        expect(nicknamePrefill({ env: { USER: 'mberg' }, gitUserName: '   ' })).toEqual({
            name: 'mberg',
            source: 'env-user',
        });
        expect(nicknamePrefill({ env: { USER: '  ', USERNAME: 'w' } }).source).toBe(
            'env-username',
        );
    });

    it('trims a resolved name rather than passing the newline through', () => {
        expect(nicknamePrefill({ env: {}, gitUserName: 'Mathias Berg\n' }).name).toBe(
            'Mathias Berg',
        );
    });

    it('returns an empty prefill rather than inventing one when nothing resolves', () => {
        expect(nicknamePrefill({ env: {} })).toEqual({ name: '', source: 'none' });
    });
});

describe('the chain matches the rule that documents it', () => {
    // The drift this whole module exists to close was a rule and its one
    // implementation disagreeing. A test that only exercises the code would not
    // have caught it, so this one reads the rule.
    const rule = readFileSync(
        path.resolve('src/rules/settings-ask-protocol.md'),
        'utf8',
    );

    it('the rule still documents git-then-USER-then-USERNAME', () => {
        expect(rule).toContain('git config user.name');
        expect(rule).toMatch(/then:\s*\$USER,\s*then\s*\$USERNAME/u);
    });

    it('the rule still forbids $USER alone, which is the order the code encodes', () => {
        expect(rule).toContain('Never $USER alone');
    });
});
