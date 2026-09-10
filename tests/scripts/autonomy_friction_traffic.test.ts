/**
 * autonomy_friction_traffic — the pure half, pinned.
 *
 * The probe's value rests on two properties a reader has to be able to trust
 * without a transcript store: that it counts a Bash call once and only from a
 * real tool-use block, and that an empty or unreadable store REFUSES rather
 * than reporting a coverage figure computed over nothing. The second is the
 * one that would be silently wrong — a probe answering "0 calls, 0 % covered"
 * from a missing directory reads exactly like a measurement.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    classify,
    currentSessionTranscript,
    dedupeCalls,
    defaultStore,
    extractCommands,
    firstDisqualifier,
    headToken,
    main,
    SHELL_METACHARACTERS,
    transcriptPaths,
} from '../../src/scripts/autonomy_friction_traffic.js';
import {
    isCategoryABashCommand,
    SHELL_METACHARACTERS as CATEGORY_A_METACHARACTERS,
} from '../../src/scripts/hooks/category_a.js';

function transcriptLine(command: string, id = 'toolu_x'): string {
    return JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Bash', id, input: { command } }] },
    });
}

function commandsOf(text: string): string[] {
    return extractCommands(text).map((c) => c.command);
}

describe('extractCommands', () => {
    it('reads the command out of a Bash tool-use block', () => {
        expect(commandsOf(transcriptLine('ls -la'))).toEqual(['ls -la']);
    });

    it('carries the tool-use id, which is what identifies a call across files', () => {
        expect(extractCommands(transcriptLine('ls -la', 'toolu_1'))[0]?.id).toBe('toolu_1');
    });

    it('skips a malformed line instead of losing the file', () => {
        const text = ['{"Bash": not json', transcriptLine('git status')].join('\n');
        expect(commandsOf(text)).toEqual(['git status']);
    });

    it('ignores a tool-use block for another tool', () => {
        const line = JSON.stringify({
            message: { content: [{ type: 'tool_use', name: 'Read', input: { command: 'ls' } }] },
        });
        expect(extractCommands(line)).toEqual([]);
    });

    it('ignores a mention of Bash that is not a tool-use block', () => {
        const line = JSON.stringify({ message: { content: [{ type: 'text', text: 'the "Bash" tool' }] } });
        expect(extractCommands(line)).toEqual([]);
    });
});

describe('dedupeCalls — a resumed session repeats its history', () => {
    // Round-2 finding 9: a window of files double-counts the turns a resume
    // copied forward, so the denominator was not the number of distinct calls.
    it('keeps one copy of a call that appears in two transcripts', () => {
        expect(dedupeCalls([
            { id: 'toolu_1', command: 'ls' },
            { id: 'toolu_1', command: 'ls' },
        ])).toEqual(['ls']);
    });

    it('keeps two genuinely distinct calls that happen to be identical', () => {
        expect(dedupeCalls([
            { id: 'toolu_1', command: 'ls' },
            { id: 'toolu_2', command: 'ls' },
        ])).toEqual(['ls', 'ls']);
    });

    it('keeps an id-less call rather than shrinking the denominator', () => {
        expect(dedupeCalls([
            { id: '', command: 'ls' },
            { id: '', command: 'ls' },
        ])).toEqual(['ls', 'ls']);
    });
});

describe('currentSessionTranscript — the probe excludes its own session', () => {
    it('names the running session transcript when the host exports an id', () => {
        const prior = process.env['CLAUDE_CODE_SESSION_ID'];
        process.env['CLAUDE_CODE_SESSION_ID'] = 'sess-1';
        expect(currentSessionTranscript('/store')).toBe(path.join('/store', 'sess-1.jsonl'));
        if (prior === undefined) delete process.env['CLAUDE_CODE_SESSION_ID'];
        else process.env['CLAUDE_CODE_SESSION_ID'] = prior;
    });

    it('names nothing when the host exports no id, so nothing is excluded', () => {
        const prior = process.env['CLAUDE_CODE_SESSION_ID'];
        delete process.env['CLAUDE_CODE_SESSION_ID'];
        expect(currentSessionTranscript('/store')).toBeNull();
        if (prior !== undefined) process.env['CLAUDE_CODE_SESSION_ID'] = prior;
    });
});

describe('firstDisqualifier — only the first, because that is the one a fix removes', () => {
    it('names the metacharacter for a chained call whose head is also unlisted', () => {
        expect(firstDisqualifier('cd /x && frobnicate')).toBe('shell-metacharacter');
    });

    it('names an empty command as such', () => {
        expect(firstDisqualifier('   ')).toBe('empty-command');
    });

    // Round-2 finding 3. These three used to land in the head bucket, so a
    // report saying "N fail on the head token" counted operations that
    // category_a refuses on the operation whatever the head list says.
    it('separates a consequence operation from a head-list miss', () => {
        expect(firstDisqualifier('git push origin main')).toBe('names-a-consequence-operation');
        expect(firstDisqualifier('gh pr merge 12')).toBe('names-a-consequence-operation');
        expect(firstDisqualifier('rm -rf build')).toBe('names-a-consequence-operation');
    });

    it('names the residual bucket for a simple command that cleared both', () => {
        expect(firstDisqualifier('frobnicate --all')).toBe('not-an-allowlisted-operation');
    });

    // The residual bucket is an UPPER BOUND, not an exact head count: this
    // command's head IS allowlisted and it is refused for the absolute
    // directory-flag value instead. Pinned so the doc sentence built on the
    // bucket cannot be read as "adding this head would cover it".
    it('also holds a refusal that is not about the head at all', () => {
        expect(firstDisqualifier('git -C /abs/worktree status')).toBe('not-an-allowlisted-operation');
    });
});

describe('the disqualifier order tracks the classifier, which nothing else pins', () => {
    // The mechanics doc says the report and the carrier "cannot drift". That
    // holds for the detectors by construction (they are imported) and NOT for
    // the bucket order, which restates category_a's refusal sequence by hand.
    // These rows are the only thing keeping the restatement honest, and the
    // round-2 review named the gap explicitly.
    it('reports the metacharacter before the operation, as the classifier does', () => {
        expect(firstDisqualifier('rm -rf x && ls')).toBe('shell-metacharacter');
    });

    it('reports the operation before the head list, as the classifier does', () => {
        expect(firstDisqualifier('frobnicate --push')).toBe('names-a-consequence-operation');
    });

    it('agrees with the classifier that each of these is refused at all', () => {
        for (const cmd of ['rm -rf x && ls', 'frobnicate --push', 'frobnicate --all', 'git -C /abs status']) {
            expect(isCategoryABashCommand(cmd)).toBe(false);
            expect(firstDisqualifier(cmd)).not.toBe('');
        }
    });
});

describe('the metacharacter class is shared with category_a, not copied', () => {
    // Round-2 finding 2: this was a private regex literal here while the
    // header claimed shared detectors, and it computes the load-bearing split.
    it('is the same object the classifier refuses on', () => {
        expect(SHELL_METACHARACTERS).toBe(CATEGORY_A_METACHARACTERS);
    });
});

describe('headToken', () => {
    it('lower-cases so two spellings of one head do not split the histogram', () => {
        expect(headToken('LS -la')).toBe('ls');
    });
});

describe('classify', () => {
    it('counts a category-A call as covered and emits no disqualifier for it', () => {
        const r = classify('/store', 1, ['git -C sub status']);
        expect(r.categoryA).toBe(1);
        expect(r.disqualifiers).toEqual({});
    });

    it('counts an uncovered call under its first disqualifier and its head', () => {
        const r = classify('/store', 1, ['cd /x && git status']);
        expect(r.categoryA).toBe(0);
        expect(r.disqualifiers['shell-metacharacter']).toBe(1);
        expect(r.heads['cd']).toBe(1);
    });

    it('attributes a write-shaped call to edit-by-shell, not to chain', () => {
        const r = classify('/store', 1, ["cd /x && sed -i '' -e s/a/b/ f"]);
        expect(r.shapes.editByShell).toBe(1);
        expect(r.shapes.chain).toBe(0);
    });

    it('counts the shape classes over every call, covered or not', () => {
        const r = classify('/store', 1, ['git -C sub status', 'a && b']);
        expect(r.calls).toBe(2);
        expect(r.categoryA).toBe(1);
        expect(r.shapes.chain).toBe(1);
    });
});

describe('the recommended substitution is only covered with a RELATIVE path', () => {
    it('covers `git -C sub status`', () => {
        expect(classify('/s', 1, ['git -C sub status']).categoryA).toBe(1);
    });

    // Pinned as a FINDING, not as a preference: category_a refuses a global
    // option whose value is absolute, and every cross-worktree invocation in
    // this repository writes an absolute one. The canon teaches the directory
    // flag as the answer to `cd X && …`; with an absolute path the answer is
    // uncovered too, which is why the coverage figure barely moves when the
    // chain is unwound. Change this row only alongside a decision to confine
    // an absolute path against a known root.
    it('does NOT cover the absolute form the multi-worktree workflow writes', () => {
        expect(classify('/s', 1, ['git -C /abs/worktree status']).categoryA).toBe(0);
    });
});

describe('transcriptPaths', () => {
    it('returns nothing for a directory that does not exist', () => {
        expect(transcriptPaths(path.join(os.tmpdir(), 'aft-absent-store-xyz'), 5)).toEqual([]);
    });

    it('reads only .jsonl and honours the limit', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aft-store-'));
        fs.writeFileSync(path.join(dir, 'a.jsonl'), transcriptLine('ls'));
        fs.writeFileSync(path.join(dir, 'b.jsonl'), transcriptLine('pwd'));
        fs.writeFileSync(path.join(dir, 'c.txt'), 'not a transcript');
        expect(transcriptPaths(dir, 5)).toHaveLength(2);
        expect(transcriptPaths(dir, 1)).toHaveLength(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('defaultStore', () => {
    it('derives the host store slug from the repo root', () => {
        expect(defaultStore('/Users/x/projects/repo')).toBe(
            path.join(os.homedir(), '.claude', 'projects', '-Users-x-projects-repo'),
        );
    });
});

describe('--limit and --store are validated, not coerced', () => {
    // Round-2 finding 11 / round-3 finding 5: a negative limit silently dropped
    // the OLDEST transcripts through Array.slice, zero reported an empty store
    // as the reason, and a typo fell back to 40 without saying so.
    //
    // The store is REAL and non-empty here, which is the whole point of this
    // block. The first version pointed at /nonexistent, where a VALID limit
    // returns 1 as well — so the rows could not fail for the property they
    // name, and a test that cannot fail for its own reason is the anti-pattern
    // this suite already carries a finding about.
    function storeWithOneCall(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aft-limit-'));
        fs.writeFileSync(path.join(dir, 'a.jsonl'), transcriptLine('git -C sub status'));
        return dir;
    }

    it('accepts a valid limit against this store, so the rows below isolate the limit', () => {
        const dir = storeWithOneCall();
        expect(main(['--store', dir, '--limit', '1', '--json'])).toBe(0);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('refuses a negative, a zero and a non-numeric limit', () => {
        const dir = storeWithOneCall();
        for (const bad of ['-5', '0', 'forty']) {
            expect(main(['--store', dir, '--limit', bad])).toBe(1);
        }
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('refuses a valueless --limit instead of falling back to 40', () => {
        const dir = storeWithOneCall();
        expect(main(['--store', dir, '--limit'])).toBe(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    // Round-3 finding 6: the --store half of the same defect was left unfixed —
    // a valueless --store fell back to the DEFAULT store silently, which is a
    // different measurement wearing the requested one's shape.
    it('refuses a valueless --store instead of falling back to the default store', () => {
        expect(main(['--store'])).toBe(1);
        expect(main(['--store', '--json'])).toBe(1);
    });
});

describe('main — an empty store refuses instead of reporting zeros', () => {
    it('exits 1 when the store holds no Bash call', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aft-empty-'));
        expect(main(['--store', dir])).toBe(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('exits 0 and measures when the store holds one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aft-one-'));
        fs.writeFileSync(path.join(dir, 'a.jsonl'), transcriptLine('git -C sub status'));
        expect(main(['--store', dir, '--json'])).toBe(0);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('--help exits 0 without touching a store', () => {
        expect(main(['--help'])).toBe(0);
    });
});
