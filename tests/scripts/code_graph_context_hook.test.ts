/**
 * PreToolUse code-graph CONTEXT hook (road-to-a-graph-that-is-shipped 1.2) —
 * unit tests over the exported pure surface (classifyTool / graphState /
 * contextLine) plus the envelope the dispatcher actually hands the host.
 *
 * Replaces `code_graph_nudge_hook.test.ts`. Its `enabled` block is gone with
 * the flag it tested; the two assertions that ARE new are the ones the old
 * hook could not make — that an absent graph is silent, and that the line
 * reaches a verified host as structured `additionalContext` rather than as a
 * bare exit-2 echo.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    bashSearchToken,
    classifyTool,
    contextLine,
    graphState,
    latchKey,
    latchTarget,
    MAX_CONTEXT_LINES_PER_SESSION,
    MAX_SESSIONS_LATCHED,
    speaksFor,
    wouldSpeak,
} from '../../src/scripts/hooks/code_graph_context_hook.js';
import { emitFor } from '../../src/scripts/hooks/host_semantics.js';

function tmpRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-context-'));
}

function runGit(root: string, args: readonly string[]): void {
    execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
}

const MINIMAL_GRAPH = JSON.stringify({
    schema_version: 2,
    source_checksum: 'x',
    languages: ['php'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 1, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [{ id: 'a.php', label: 'a.php', kind: 'file', source_file: 'a.php', source_location: [] }],
    edges: [],
});

function writeNativeCache(root: string): void {
    const p = path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, MINIMAL_GRAPH);
}

/**
 * A real repository with one committed indexed file and a native cache.
 *
 * A real one, not a tmpdir: step 2.3's state is read out of `git status`, so a
 * fixture without git metadata could only assert the fallback. The cache is
 * written AFTER the commit so its mtime is newer and the source reads
 * un-stale — `edited` is then the whole difference the probe contributes.
 */
function gitRepoWithGraph(): string {
    const root = tmpRoot();
    runGit(root, ['init', '-q', '-b', 'main']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'fixture']);
    fs.writeFileSync(path.join(root, 'a.php'), '<?php function a() {}\n');
    fs.writeFileSync(path.join(root, 'README.md'), 'readme\n');
    runGit(root, ['add', '-A']);
    runGit(root, ['commit', '-q', '-m', 'fixture']);
    writeNativeCache(root);
    return root;
}

describe('classifyTool — eligibility', () => {
    it('treats Grep and Glob as searches', () => {
        expect(classifyTool({ tool_name: 'Grep' }).isSearch).toBe(true);
        expect(classifyTool({ tool_name: 'Glob' }).isSearch).toBe(true);
    });

    it('treats Read of a code file as a code read, and Read of prose as neither', () => {
        const code = classifyTool({ tool_name: 'Read', tool_input: { file_path: 'src/a.ts' } });
        expect(code.isCodeRead).toBe(true);
        const prose = classifyTool({ tool_name: 'Read', tool_input: { file_path: 'README.md' } });
        expect(prose.isCodeRead).toBe(false);
        expect(prose.isSearch).toBe(false);
    });

    it('ignores tools the manifest does not route here', () => {
        const t = classifyTool({ tool_name: 'Bash', tool_input: { command: 'ls' } });
        expect(t.isSearch).toBe(false);
        expect(t.isCodeRead).toBe(false);
    });
});

describe('graphState — absent and fresh', () => {
    it('is absent with no graph anywhere', () => {
        expect(graphState(tmpRoot())).toBe('absent');
    });

    it('is fresh once a native cache exists outside a git repo', () => {
        // No git metadata in a tmpdir, so freshness is UNKNOWN — which reads as
        // `fresh`, mirroring computeVerdict's `picked.stale ? STALE : FRESH`.
        // Pinned because the alternative (inventing a commit count) is the
        // failure mode: `behind:0` would be a fabricated measurement.
        const root = tmpRoot();
        writeNativeCache(root);
        expect(graphState(root)).toBe('fresh');
    });
});

describe('contextLine — what the model is told', () => {
    it('names the state and the verbs on the fresh branch', () => {
        const line = contextLine('fresh');
        expect(line).toContain('code-graph: fresh');
        expect(line).toContain('code-graph query|affected');
    });

    it('carries the commit count on the stale branch, because N is the decision input', () => {
        const line = contextLine('behind:7');
        expect(line).toContain('7 commit(s) behind');
        expect(line).toContain('code-graph refresh');
    });

    it('makes no ordering claim — Kill register K5 forbids graph-first wording', () => {
        for (const state of ['fresh', 'behind:3'] as const) {
            const line = contextLine(state).toLowerCase();
            expect(line).not.toContain('graph-first');
            expect(line).not.toContain('instead of grep');
            expect(line).not.toContain('before grep');
            // The fresh branch must still name grep as a real alternative
            // rather than a fallback, so the absence above is not achieved by
            // simply deleting the comparison.
        }
        expect(contextLine('fresh')).toContain('grep is the other path');
    });

    it('stays inside the one-line budget', () => {
        for (const state of ['fresh', 'behind:12'] as const) {
            expect(contextLine(state)).not.toContain('\n');
            expect(contextLine(state).length).toBeLessThanOrEqual(260);
        }
    });
});

describe('the envelope a verified host receives', () => {
    it('is structured additionalContext at exit 0, never a plain echo at exit 2', () => {
        const line = contextLine('behind:4');
        const emission = emitFor('claude', 'pre_tool_use', 'warn', [line], 2);

        // The whole point of 1.2: advisory context must not ride an exit code
        // that a block-capable event reads as a refusal.
        expect(emission.exit).toBe(0);
        expect(emission.stderr).toBe('');

        const parsed = JSON.parse(emission.stdout) as {
            hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
        };
        expect(parsed.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
        expect(parsed.hookSpecificOutput?.additionalContext).toBe(line);
    });

    it('emits nothing at all when the concern stayed silent', () => {
        const emission = emitFor('claude', 'pre_tool_use', 'allow', [], 0);
        expect(emission.exit).toBe(0);
        expect(emission.stdout).toBe('');
    });

    it('hands an unverified host its legacy exit verbatim, so nothing is echoed at it', () => {
        // `windsurf` carries no verified pre_tool_use contract. The dispatcher
        // swallows concern stdout there, which is precisely why the same line
        // is carried as a rule on instruction-file hosts instead.
        const emission = emitFor('windsurf', 'pre_tool_use', 'warn', [contextLine('fresh')], 2);
        expect(emission.stdout).toBe('');
        expect(emission.exit).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// road-to-a-graph-that-feeds-the-gate — Phase 2
// ---------------------------------------------------------------------------

describe('bashSearchToken — step 2.1, the search inside a shell command', () => {
    it('reads the term out of each recognised head', () => {
        expect(bashSearchToken('grep -rn "classifyTool" src/')).toBe('classifyTool');
        expect(bashSearchToken('rg classifyTool')).toBe('classifyTool');
        expect(bashSearchToken('ag --nocolor needle')).toBe('needle');
        // `.` until a completion review pointed out that every `find .` shares
        // it; the subject of a find is its `-name`, asserted in its own case below.
        expect(bashSearchToken('find . -name "*.ts"')).toBe('*.ts');
        expect(bashSearchToken('git grep latchTarget')).toBe('latchTarget');
        expect(bashSearchToken('/usr/bin/grep foo')).toBe('foo');
    });

    it('is null for every other command, so the hook stays silent and latches nothing', () => {
        // Risk-Register rank 2: "every shell call is a candidate line" is what
        // makes a consumer turn the hook off.
        for (const cmd of ['ls -la', 'npm test', 'git log --oneline', 'node x.js', '']) {
            expect(bashSearchToken(cmd)).toBeNull();
        }
    });

    it('reads a search in ANY pipeline segment, not only the first word of the line', () => {
        // A completion review measured `cat x | grep needle` returning null.
        // Piping into a search is the common shape, so reading only the head
        // missed most of what this step exists to reach.
        expect(bashSearchToken('cat x.ts | grep needle')).toBe('needle');
        expect(bashSearchToken('git log --oneline | rg symbol')).toBe('symbol');
        expect(bashSearchToken('ls -la | sort')).toBeNull();
    });

    it('never keys the latch on an option VALUE', () => {
        // Measured defects: `-A 5` keyed on "5", and two different `rg -g` searches
        // both keyed on the glob — which silenced the second one entirely.
        expect(bashSearchToken('grep -A 5 classifyTool')).toBe('classifyTool');
        expect(bashSearchToken('grep -C 3 -m 2 needle')).toBe('needle');
        expect(bashSearchToken('rg -g *.ts alpha')).toBe('alpha');
        expect(bashSearchToken('rg -g *.ts beta')).toBe('beta');
        expect(bashSearchToken('rg -g *.ts alpha')).not.toBe(bashSearchToken('rg -g *.ts beta'));
    });

    it('reads git grep past git own options — the form this tree mandates', () => {
        // `git -C <path> grep` is what token-efficiency asks agents to write, and
        // a `words[1] === "grep"` test missed every one of them.
        expect(bashSearchToken('git -C /repo grep latchTarget')).toBe('latchTarget');
        expect(bashSearchToken('git --no-pager grep needle')).toBe('needle');
        expect(bashSearchToken('git -C /repo log --oneline')).toBeNull();
    });

    it('keys find on its -name subject, not on the search root', () => {
        // Every `find . -name X` shares the root `.`, so keying on the root
        // collapses distinct searches onto one latch slot.
        expect(bashSearchToken('find . -name "*.ts"')).toBe('*.ts');
        expect(bashSearchToken('find src -name detect.ts')).toBe('detect.ts');
        expect(bashSearchToken('find . -name "*.ts"')).not.toBe(bashSearchToken('find . -name "*.php"'));
    });

    it('treats a usage request as not a search, so it spends no session slot', () => {
        for (const cmd of ['grep --help', 'rg -h', 'find --version']) {
            expect(bashSearchToken(cmd)).toBeNull();
        }
    });

    it('stops at a shell metacharacter rather than reading the next command', () => {
        expect(bashSearchToken('grep -l | xargs sed')).toBe('grep');
    });
});

describe('classifyTool — step 2.1 routes the shell tool, and every call names its target', () => {
    it('treats a shell search as a search and keys it on the term', () => {
        const t = classifyTool({ tool_name: 'Bash', tool_input: { command: 'rg contextLine src' } });
        expect(t.isSearch).toBe(true);
        expect(t.target).toBe('contextLine');
    });

    it('leaves a non-search shell call silent', () => {
        const t = classifyTool({ tool_name: 'Bash', tool_input: { command: 'npm run build' } });
        expect(t.isSearch).toBe(false);
        expect(t.isCodeRead).toBe(false);
        expect(t.target).toBe('');
    });

    it('keys Grep/Glob on the pattern and Read on the path', () => {
        expect(classifyTool({ tool_name: 'Grep', tool_input: { pattern: 'abc' } }).target).toBe('abc');
        expect(classifyTool({ tool_name: 'Glob', tool_input: { pattern: '**/*.ts' } }).target).toBe('**/*.ts');
        expect(classifyTool({ tool_name: 'Read', tool_input: { file_path: 'src/a.ts' } }).target).toBe('src/a.ts');
    });
});

describe('the latch — step 2.2, once per target and five per session', () => {
    it('speaksFor: a repeat is silent at any count, a new target is silent at the cap', () => {
        // The stored form is the DIGEST, so the spoken list is built with
        // `latchKey` — a test that passed plaintext here would pass against a
        // latch that stores plaintext and is exactly what must not regress.
        expect(speaksFor([], 'a')).toBe(true);
        expect(speaksFor([latchKey('a')], 'a')).toBe(false);
        expect(speaksFor([latchKey('a'), latchKey('b')], 'c')).toBe(true);
        const targets = ['a', 'b', 'c', 'd', 'e'];
        const full = targets.map(latchKey);
        expect(full.length).toBe(MAX_CONTEXT_LINES_PER_SESSION);
        expect(targets.every((t) => !speaksFor(full, t))).toBe(true);
        expect(speaksFor(full, 'f')).toBe(false);
    });

    it('persists a digest of the search term, never the term — the council condition on 2.1', () => {
        // Routing the shell tool here makes the latch key a search TERM an
        // operator typed, which can carry a customer name, a token fragment or
        // an internal hostname. Nothing reads it back, so nothing needs it.
        const root = tmpRoot();
        expect(latchTarget(root, 's', 'ACME-Corp-secret-token')).toBe(true);
        const raw = fs.readFileSync(
            path.join(root, 'agents', 'runtime', 'state', 'code-graph-context.json'),
            'utf-8',
        );
        expect(raw).not.toContain('ACME-Corp-secret-token');
        expect(raw).toContain(latchKey('ACME-Corp-secret-token'));
        // And the digest still answers the only question the latch asks.
        expect(latchTarget(root, 's', 'ACME-Corp-secret-token')).toBe(false);
    });

    it('three distinct patterns yield three lines, the same pattern twice yields one, a sixth yields none', () => {
        const root = tmpRoot();
        const s = 'session-1';
        expect(['p1', 'p2', 'p3'].map((p) => latchTarget(root, s, p))).toEqual([true, true, true]);
        // The same pattern again is not a second line.
        expect(latchTarget(root, s, 'p1')).toBe(false);
        // Two more distinct patterns reach the cap; the sixth does not speak.
        expect(latchTarget(root, s, 'p4')).toBe(true);
        expect(latchTarget(root, s, 'p5')).toBe(true);
        expect(latchTarget(root, s, 'p6')).toBe(false);
    });

    it('keeps sessions apart', () => {
        const root = tmpRoot();
        expect(latchTarget(root, 'a', 'p')).toBe(true);
        expect(latchTarget(root, 'a', 'p')).toBe(false);
        expect(latchTarget(root, 'b', 'p')).toBe(true);
    });

    it('evicts the oldest sessions rather than growing the file forever', () => {
        // A review found the file accumulating up to five digests per session id
        // for the life of the repository, while the sibling instrument added in
        // the same change caps itself and says why local-and-gitignored is not
        // free. Drives past the cap rather than asserting the constant.
        const root = tmpRoot();
        for (let i = 0; i < MAX_SESSIONS_LATCHED + 25; i += 1) {
            latchTarget(root, `s${String(i)}`, 'p');
        }
        const state = JSON.parse(
            fs.readFileSync(path.join(root, 'agents', 'runtime', 'state', 'code-graph-context.json'), 'utf-8'),
        ) as Record<string, string[]>;
        expect(Object.keys(state).length).toBeLessThanOrEqual(MAX_SESSIONS_LATCHED);
        // The session that just spoke is never the one evicted.
        expect(state[`s${String(MAX_SESSIONS_LATCHED + 24)}`]).toBeDefined();
    });

    it('reads a pre-2.2 boolean latch as a spent session, never as a fresh budget', () => {
        const root = tmpRoot();
        const p = path.join(root, 'agents', 'runtime', 'state', 'code-graph-context.json');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ old: true }));
        expect(latchTarget(root, 'old', 'anything')).toBe(false);
        expect(wouldSpeak(root, 'old', 'anything')).toBe(false);
    });
});

describe('graphState — step 2.3, the fourth state sees the uncommitted edit', () => {
    it('reads edited for a modified indexed file and fresh once it is restored', () => {
        const root = gitRepoWithGraph();
        const file = path.join(root, 'a.php');
        expect(graphState(root)).toBe('fresh');

        fs.writeFileSync(file, '<?php function b() {}\n');
        expect(graphState(root)).toBe('edited');

        // The REVERT is the half an mtime probe cannot do: restoring the file
        // rewrites its mtime, so a staleness read off mtime would never return.
        runGit(root, ['checkout', '--', 'a.php']);
        expect(graphState(root)).toBe('fresh');
    });

    it('ignores a change to a file no extractor indexes', () => {
        const root = gitRepoWithGraph();
        fs.writeFileSync(path.join(root, 'README.md'), 'changed\n');
        expect(graphState(root)).toBe('fresh');
    });

    it('counts an untracked source file, which is exactly what the index cannot know', () => {
        const root = gitRepoWithGraph();
        fs.writeFileSync(path.join(root, 'new.ts'), 'export const x = 1;\n');
        expect(graphState(root)).toBe('edited');
    });

    it('counts a source file inside an untracked DIRECTORY, which plain porcelain collapses', () => {
        // The measured under-report: `git status --porcelain` reports a whole
        // untracked directory as one entry, `?? feature/`, which carries no
        // extension — so an entire new source tree read as `fresh`. The repo-root
        // case above does not catch it, because git does not collapse there.
        const root = gitRepoWithGraph();
        fs.mkdirSync(path.join(root, 'feature', 'deep'), { recursive: true });
        fs.writeFileSync(path.join(root, 'feature', 'deep', 'new.ts'), 'export const x = 1;\n');
        expect(graphState(root)).toBe('edited');
    });

    it('still ignores an untracked directory carrying nothing indexable', () => {
        // The other direction of the same fix: enumerating untracked files must
        // not turn every scratch directory into `edited`.
        const root = gitRepoWithGraph();
        fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
        fs.writeFileSync(path.join(root, 'notes', 'scratch.md'), 'text\n');
        expect(graphState(root)).toBe('fresh');
    });
});

describe('contextLine — the edited branch', () => {
    it('names the state and the repair without claiming an ordering', () => {
        const line = contextLine('edited');
        expect(line).toContain('code-graph:');
        expect(line).toContain('code-graph refresh');
        const lower = line.toLowerCase();
        expect(lower).not.toContain('graph-first');
        expect(lower).not.toContain('instead of grep');
        expect(lower).not.toContain('before grep');
        expect(line).not.toContain('\n');
        expect(line.length).toBeLessThanOrEqual(260);
    });
});
