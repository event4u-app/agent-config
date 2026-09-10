/**
 * chain-nudge — the detector's polarity, pinned in BOTH directions.
 *
 * The negative rows are the load-bearing half. A nudge that fires on
 * `grep "a && b" f`, on a heredoc, or on a pipe of filters is noise, and a
 * noisy advisory gets ignored — which is the same as not shipping it. Every
 * negative row below is a shape the hook's own header promises not to flag.
 */
import { describe, expect, it } from 'vitest';

import {
    bashCommand,
    classAlreadyNudged,
    detectChaining,
    detectEditByShell,
    detectShape,
    editByShellReason,
    enabled,
    nudgeReason,
    reasonFor,
    stripLiterals,
    withClassLatched,
} from '../../../src/scripts/hooks/chain_nudge_hook.js';

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

describe('detectEditByShell — fires on the four write shapes', () => {
    const writes: ReadonlyArray<readonly [string, string]> = [
        ["sed -i '' -e 's/a/b/' docs/x.md", 'sed in-place, BSD two-arg form'],
        ['sed -i.bak -e s/a/b/ f', 'sed in-place with a suffix'],
        ['cat > out.txt', 'a file filled from the shell'],
        ['cat >> out.txt', 'a file appended from the shell'],
        ['tee report.txt', 'tee writing its input to a path'],
        ["perl -i -pe 's/a/b/' f", 'perl in-place'],
        ['python3 -c "open(\'f\',\'w\').write(x)"', 'an interpreter opening a path for writing'],
    ];
    for (const [cmd, why] of writes) {
        it(`flags ${why}`, () => {
            expect(detectEditByShell(cmd)).not.toBeNull();
        });
    }
});

describe('detectEditByShell — stays silent', () => {
    const clean: ReadonlyArray<readonly [string, string]> = [
        ['sed -n 2,8p f', 'sed in read mode'],
        ['sed -e s/a/b/ f', 'sed printing to stdout, not editing in place'],
        ['cat f', 'cat reading a file'],
        ['cat f | grep x', 'cat feeding a filter'],
        ['grep x f > /dev/null', 'a redirect to the null device'],
        ['npm test 2>&1', 'an fd duplication, which names no file'],
        ['tee -a', 'tee with no path argument'],
        ['python3 -c "print(open(\'f\').read())"', 'an interpreter opening a path to READ'],
        ["grep 'sed -i' f", 'the shape mentioned inside a quoted argument'],
        ['ls -la', 'a plain command'],
    ];
    for (const [cmd, why] of clean) {
        it(`ignores ${why}`, () => {
            expect(detectEditByShell(cmd)).toBeNull();
        });
    }
});

describe('detectShape — the write class wins a call that is both', () => {
    it('reports edit-by-shell for a cd-chain that ends in an in-place edit', () => {
        const finding = detectShape("cd /other/tree && sed -i '' -e 's/a/b/' f");
        expect(finding?.klass).toBe('edit-by-shell');
    });
    it('reports chain when nothing is written', () => {
        expect(detectShape('cd /other/tree && git status')?.klass).toBe('chain');
    });
    it('reports nothing for a plain read', () => {
        expect(detectShape('git -C /repo status')).toBeNull();
    });
});

describe('the latch is per class, and a pre-two-class file still counts', () => {
    it('a legacy `true` means the chain class fired, and only that one', () => {
        expect(classAlreadyNudged(true, 'chain')).toBe(true);
        expect(classAlreadyNudged(true, 'edit-by-shell')).toBe(false);
    });
    it('an unseen session has fired nothing', () => {
        expect(classAlreadyNudged(undefined, 'chain')).toBe(false);
        expect(classAlreadyNudged(undefined, 'edit-by-shell')).toBe(false);
    });
    it('one class firing does not silence the other', () => {
        const after = withClassLatched(undefined, 'chain');
        expect(classAlreadyNudged(after, 'chain')).toBe(true);
        expect(classAlreadyNudged(after, 'edit-by-shell')).toBe(false);
    });
    it('upgrading a legacy entry keeps the chain latch it already held', () => {
        const after = withClassLatched(true, 'edit-by-shell');
        expect(classAlreadyNudged(after, 'chain')).toBe(true);
        expect(classAlreadyNudged(after, 'edit-by-shell')).toBe(true);
    });
    it('a class never fires twice', () => {
        const once = withClassLatched(undefined, 'edit-by-shell');
        const twice = withClassLatched(once, 'edit-by-shell');
        expect(classAlreadyNudged(twice, 'edit-by-shell')).toBe(true);
        expect(Object.keys(twice)).toEqual(['edit-by-shell']);
    });
});

describe('editByShellReason', () => {
    it('stays inside the 1024-byte default concern cap', () => {
        expect(Buffer.byteLength(editByShellReason('`sed -i` edits a file in place'), 'utf8')).toBeLessThan(1024);
    });
    it('names the primitive that carries no expiring grant', () => {
        const line = editByShellReason('`cat >` fills a file from the shell');
        expect(line).toContain('Edit');
        expect(line).toContain('Write');
    });
    it('reasonFor dispatches on the class', () => {
        expect(reasonFor({ klass: 'edit-by-shell', seen: 'x' })).toContain('writes a file through the shell');
        expect(reasonFor({ klass: 'chain', seen: 'y' })).toContain('chains work');
    });
});
