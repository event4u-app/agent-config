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
    defaultStore,
    extractCommands,
    firstDisqualifier,
    headToken,
    main,
    transcriptPaths,
} from '../../src/scripts/autonomy_friction_traffic.js';

function transcriptLine(command: string): string {
    return JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
    });
}

describe('extractCommands', () => {
    it('reads the command out of a Bash tool-use block', () => {
        expect(extractCommands(transcriptLine('ls -la'))).toEqual(['ls -la']);
    });

    it('skips a malformed line instead of losing the file', () => {
        const text = ['{"Bash": not json', transcriptLine('git status')].join('\n');
        expect(extractCommands(text)).toEqual(['git status']);
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

describe('firstDisqualifier — only the first, because that is the one a fix removes', () => {
    it('names the metacharacter for a chained call whose head is also unlisted', () => {
        expect(firstDisqualifier('cd /x && frobnicate')).toBe('shell-metacharacter');
    });

    it('names the head when the command is a single simple one', () => {
        expect(firstDisqualifier('frobnicate --all')).toBe('head-or-subcommand-not-allowlisted');
    });

    it('names an empty command as such', () => {
        expect(firstDisqualifier('   ')).toBe('empty-command');
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
