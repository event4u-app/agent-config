/**
 * chain-nudge — the detector's polarity, pinned in BOTH directions.
 *
 * The negative rows are the load-bearing half. A nudge that fires on
 * `grep "a && b" f`, on a heredoc, or on a pipe of filters is noise, and a
 * noisy advisory gets ignored — which is the same as not shipping it. Every
 * negative row below is a shape the hook's own header promises not to flag.
 */
import { describe, expect, it } from 'vitest';

import { bashCommand, detectChaining, enabled, nudgeReason, stripLiterals } from '../../../src/scripts/hooks/chain_nudge_hook.js';

describe('detectChaining — fires', () => {
    const chained: ReadonlyArray<readonly [string, string]> = [
        ['D=/repo; cd $D && git status', 'leading assignment plus chain'],
        ['V=$(git rev-parse HEAD); echo $V', 'assignment carrying state forward'],
        ['npm test && npm run lint', 'two work steps with &&'],
        ['echo hi; echo there', 'two work steps with ;'],
        ['make build || make fallback', 'two work steps with ||'],
    ];
    for (const [cmd, why] of chained) {
        it(`flags ${why}`, () => {
            expect(detectChaining(cmd)).not.toBeNull();
        });
    }
});

describe('detectChaining — stays silent', () => {
    const clean: ReadonlyArray<readonly [string, string]> = [
        ['git -C /repo status', 'the substitution the rule asks for'],
        ['grep foo file | head', 'a pipe of ordinary filters'],
        ['grep "a && b" file', 'an operator inside a double-quoted string'],
        ["grep 'x; y' file", 'an operator inside a single-quoted string'],
        ['cat > out.txt', 'a redirect, whose target has its own file rules'],
        ['cat > f <<EOF\nx && y\nEOF', 'a heredoc body containing an operator'],
        ['python3 - <<PY\nprint(1); print(2)\nPY', 'a heredoc script with its own statements'],
        ['ls -la', 'a plain command'],
        ['VAR=value command args', 'an env prefix with no later segment'],
    ];
    for (const [cmd, why] of clean) {
        it(`ignores ${why}`, () => {
            expect(detectChaining(cmd)).toBeNull();
        });
    }
});

describe('stripLiterals', () => {
    it('removes quoted spans so operators inside them cannot be seen', () => {
        expect(stripLiterals('grep "a && b" f')).not.toContain('&&');
    });
    it('removes heredoc bodies', () => {
        expect(stripLiterals('cat <<EOF\na && b\nEOF')).not.toContain('&&');
    });
    it('leaves a real operator in place', () => {
        expect(stripLiterals('a && b')).toContain('&&');
    });
});

describe('bashCommand — host-agnostic tool detection', () => {
    it('reads the command for every known shell tool name', () => {
        for (const tool of ['Bash', 'BashTool', 'launch-process', 'launch_process', 'shell']) {
            expect(bashCommand({ payload: { tool_name: tool, tool_input: { command: 'a; b' } } })).toBe('a; b');
        }
    });
    it('declines a named tool outside the set', () => {
        expect(bashCommand({ payload: { tool_name: 'Read', tool_input: { command: 'a; b' } } })).toBe('');
    });
    it('still reads a payload that names no tool', () => {
        expect(bashCommand({ payload: { tool_input: { command: 'a; b' } } })).toBe('a; b');
    });
});

describe('enabled — absent means ON', () => {
    it('is on when the settings file does not exist', () => {
        expect(enabled('/nonexistent-path-for-this-test')).toBe(true);
    });
});

describe('nudgeReason', () => {
    it('stays inside the 1024-byte default concern cap', () => {
        const payload = JSON.stringify({ decision: 'warn', reason: nudgeReason('work steps chained with `&&`') });
        expect(Buffer.byteLength(payload)).toBeLessThan(1024);
    });
    it('names what was seen', () => {
        expect(nudgeReason('a leading `VAR=…` assignment')).toContain('a leading `VAR=…` assignment');
    });
});
