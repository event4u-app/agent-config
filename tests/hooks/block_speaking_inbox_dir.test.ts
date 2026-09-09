/**
 * Tests for `hooks/block_speaking_inbox_dir.ts` — the write-time guard against
 * a speaking inbox directory name (`road-to-source-silence` Phase 4.2).
 *
 * The step's verify is exactly the polarity pair asserted here: *"creating
 * `agents/tmp/<real-looking-slug>/` in the hook's test harness is rejected; an
 * opaque identifier passes."* Both halves get cases, and so does every
 * allow-branch the guard declares — a blocking concern whose allow-paths are
 * untested is one bad envelope away from wedging a session.
 *
 * Sensitivity was probed, not assumed: neutralising the `isAcceptableInboxDir`
 * check (returning `false`) reds the opaque and working-set cases; neutralising
 * the already-exists branch reds its case. A green suite over an inert predicate
 * would say nothing.
 *
 * Every directory name below is invented. Nothing here names a real source.
 */
import { describe, expect, it } from 'vitest';

import {
    creatableTokens,
    denyMessage,
    inboxDirName,
    isAcceptableInboxDir,
    main,
    verdictFor,
} from '../../src/scripts/hooks/block_speaking_inbox_dir.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

const never = (): boolean => false;
const always = (): boolean => true;

describe('inboxDirName', () => {
    it('reads the first-level directory under agents/tmp and agents/tmp.old', () => {
        expect(inboxDirName('agents/tmp/some-round/notes.md')).toBe('some-round');
        expect(inboxDirName('agents/tmp.old/some-round/notes.md')).toBe('some-round');
        expect(inboxDirName('./agents/tmp/some-round/a/b.md')).toBe('some-round');
        expect(inboxDirName('/abs/repo/agents/tmp/some-round/a.md')).toBe('some-round');
    });

    it('is null for a scratch file directly under agents/tmp', () => {
        expect(inboxDirName('agents/tmp/probe.ts')).toBeNull();
        expect(inboxDirName('agents/tmp/')).toBeNull();
    });

    it('is null outside the inbox entirely', () => {
        expect(inboxDirName('src/scripts/thing.ts')).toBeNull();
        expect(inboxDirName('agents/roadmaps/road-to-x.md')).toBeNull();
        expect(inboxDirName('agents/tmpfiles/other/a.md')).toBeNull();
        expect(inboxDirName('')).toBeNull();
    });
});

describe('isAcceptableInboxDir — delegates to the shared shape module', () => {
    it('accepts every opaque form the gate accepts', () => {
        expect(isAcceptableInboxDir('inbox-2026-08-h')).toBe(true);
        expect(isAcceptableInboxDir('inbox-2026-08')).toBe(true);
        expect(isAcceptableInboxDir('round-a91f3c')).toBe(true);
        expect(isAcceptableInboxDir('set-a91f3c')).toBe(true);
        expect(isAcceptableInboxDir('S17')).toBe(true);
    });

    it('accepts a named working set', () => {
        expect(isAcceptableInboxDir('bench-local')).toBe(true);
        expect(isAcceptableInboxDir('BENCH-LOCAL')).toBe(true);
    });

    it('rejects anything that reads', () => {
        expect(isAcceptableInboxDir('some-project-swarm')).toBe(false);
        expect(isAcceptableInboxDir('acme-pipeline-review')).toBe(false);
        expect(isAcceptableInboxDir('notes')).toBe(false);
    });
});

describe('the step verify — rejected vs passes', () => {
    it('REJECTS a new directory with a real-looking slug name', () => {
        const v = verdictFor('agents/tmp/some-project-swarm/chat.txt', never);
        expect(v.block).toBe(true);
        expect(v.dir).toBe('some-project-swarm');
        expect(v.reason).toContain('speaking name');
    });

    it('PASSES an opaque round identifier', () => {
        expect(verdictFor('agents/tmp/inbox-2026-08-h/chat.txt', never).block).toBe(false);
        expect(verdictFor('agents/tmp/round-a91f3c/chat.txt', never).block).toBe(false);
        expect(verdictFor('agents/tmp/S17/chat.txt', never).block).toBe(false);
    });
});

describe('the allow branches the guard declares', () => {
    it('a scratch file directly under agents/tmp is never blocked', () => {
        const v = verdictFor('agents/tmp/probe-thing.ts', never);
        expect(v.block).toBe(false);
        expect(v.reason).toContain('not inside an inbox subdirectory');
    });

    it('an ALREADY-EXISTING speaking directory is not re-refused', () => {
        const v = verdictFor('agents/tmp/some-project-swarm/more.md', always);
        expect(v.block).toBe(false);
        expect(v.reason).toContain('already exists');
    });

    it('a named working set passes even though it reads', () => {
        expect(verdictFor('agents/tmp/bench-local/input.json', never).block).toBe(false);
    });

    it('a path outside the inbox is out of scope', () => {
        expect(verdictFor('src/rules/source-confidentiality.md', never).block).toBe(false);
    });
});

/**
 * `creatableTokens` — the polarity pair for the false positive measured while
 * running the inbox flow over a real round. The read half of these cases was
 * REFUSED by the shipped guard, twice in one session, and the command that
 * tripped it is the command the naming rule tells an operator to run.
 *
 * Sensitivity was probed, not assumed: emptying `_READ_ONLY_VERBS` reds every
 * `does not judge` case below and leaves the `judges` cases green, so the
 * allowlist is what these assertions measure.
 */
describe('creatableTokens — reading is not creating', () => {
    const inboxTokens = (cmd: string): string[] =>
        creatableTokens(cmd).filter((t) => t.includes('agents/tmp'));

    it('does not judge a read over a glob — the case that blocked a real session', () => {
        expect(inboxTokens("ls -d agents/tmp.old/a-speaking-name-* 2>/dev/null | sed 's|.*/||'")).toEqual([]);
        expect(inboxTokens('ls -la agents/tmp/a-speaking-name/ && wc -l -c agents/tmp/a-speaking-name/*')).toEqual([]);
    });

    it('does not judge cat, grep, find, head or wc over an inbox path', () => {
        for (const cmd of [
            'cat agents/tmp/a-speaking-name/chat.txt',
            'grep -rn "x" agents/tmp/a-speaking-name/',
            'find agents/tmp/a-speaking-name -name "*.md"',
            'head -60 agents/tmp/a-speaking-name/notes.md',
            'wc -l agents/tmp/a-speaking-name/notes.md',
        ]) {
            expect(inboxTokens(cmd), cmd).toEqual([]);
        }
    });

    it('judges a creating verb, and every segment of a compound command', () => {
        expect(inboxTokens('mkdir -p agents/tmp/a-speaking-name')).toContain('agents/tmp/a-speaking-name');
        expect(inboxTokens('cp x agents/tmp/a-speaking-name/y.md')).toContain('agents/tmp/a-speaking-name/y.md');
        expect(inboxTokens('git mv old agents/tmp/a-speaking-name/note.md')).toContain(
            'agents/tmp/a-speaking-name/note.md',
        );
        // One read segment must not launder the creating one beside it.
        expect(inboxTokens('ls -la . && mkdir -p agents/tmp/a-speaking-name')).toContain(
            'agents/tmp/a-speaking-name',
        );
    });

    it('judges a redirect target even when the verb is read-only', () => {
        expect(inboxTokens('echo hi > agents/tmp/a-speaking-name/note.md')).toContain(
            'agents/tmp/a-speaking-name/note.md',
        );
        expect(inboxTokens('printf x >> agents/tmp/a-speaking-name/note.md')).toContain(
            'agents/tmp/a-speaking-name/note.md',
        );
    });

    it('classifies a stderr redirect target like any other redirect target', () => {
        // The name of this case used to say the opposite of the behaviour: it
        // asserted only that `2>/dev/null` produces no inbox token, which is
        // true because `ls` is allowlisted and would stay true if the redirect
        // classification were deleted. `2>` targets ARE captured, so both
        // directions are asserted here and the case can now go red for its own
        // reason. Found by a neutral review of this change.
        expect(inboxTokens('ls -d agents/tmp/a-speaking-name-* 2>/dev/null')).toEqual([]);
        expect(inboxTokens('ls -d agents/tmp/inbox-2026-08-h 2> agents/tmp/a-speaking-name/err.log')).toContain(
            'agents/tmp/a-speaking-name/err.log',
        );
    });

    /**
     * The eight bypasses a neutral review of this change probed against the
     * token scan it replaced. Every one of them was blocked before and allowed
     * after — coverage regressions, not false positives, which for a
     * `severity: blocking` concern is the direction that matters.
     *
     * Sensitivity: emptying `_WRITING_MARKERS` reds the first five; removing
     * the heredoc branch reds the two heredoc cases; dropping the quote strip
     * in `_redirectTargets` reds the quoted one.
     */
    it('judges an allowlisted verb carrying a writing flag', () => {
        for (const cmd of [
            "sed -i '' 's/a/b/' agents/tmp/a-speaking-name/x.md",
            "sed -n 'w agents/tmp/a-speaking-name/out.txt' in.txt",
            'find . -name x -exec mkdir -p agents/tmp/a-speaking-name {} +',
            'find . -fprint agents/tmp/a-speaking-name/list.txt',
            'awk \'BEGIN{system("mkdir -p agents/tmp/a-speaking-name")}\'',
        ]) {
            expect(inboxTokens(cmd), cmd).not.toEqual([]);
        }
    });

    it('judges a read segment when the pipeline it feeds can create', () => {
        // The path is in the read-only segment and the creating segment carries
        // none, so a per-segment skip passed both halves.
        expect(inboxTokens('echo agents/tmp/a-speaking-name | xargs mkdir -p')).toContain(
            'agents/tmp/a-speaking-name',
        );
    });

    it('judges a heredoc, whose body the shared segmenter discards as data', () => {
        expect(inboxTokens("cat <<'EOF' > agents/tmp/a-speaking-name/x.md\nbody\nEOF")).toContain(
            'agents/tmp/a-speaking-name/x.md',
        );
        expect(
            inboxTokens("python3 - <<'PY'\nimport os; os.makedirs('agents/tmp/a-speaking-name')\nPY"),
        ).not.toEqual([]);
    });

    it('judges a quoted redirect target', () => {
        expect(inboxTokens('echo hi > "agents/tmp/a-speaking-name/x.md"')).toContain(
            'agents/tmp/a-speaking-name/x.md',
        );
        expect(inboxTokens("echo hi > 'agents/tmp/a-speaking-name/x.md'")).toContain(
            'agents/tmp/a-speaking-name/x.md',
        );
    });

    it('still allows the plain reads after all of that widening', () => {
        for (const cmd of [
            "ls -d agents/tmp.old/a-speaking-name-* 2>/dev/null | sed 's|.*/||'",
            'sed -n 60,118p agents/tmp/a-speaking-name/chat.txt',
            'find agents/tmp/a-speaking-name -name "*.md"',
            'awk \'{print $1}\' agents/tmp/a-speaking-name/x.txt',
        ]) {
            expect(inboxTokens(cmd), cmd).toEqual([]);
        }
    });
});

describe('verdictFor — the probe carries the path prefix', () => {
    /** Exists only at the NESTED location, which is the whole point. */
    const nestedOnly = (p: string): boolean => p.endsWith('app/Modules/Reporting/agents/tmp/a-speaking-name');

    it('finds a module-nested round that already exists', () => {
        const v = verdictFor(
            'app/Modules/Reporting/agents/tmp/a-speaking-name/notes.md',
            nestedOnly,
            '',
        );
        expect(v.block).toBe(false);
        expect(v.reason).toContain('already exists');
    });

    it('still blocks a module-nested round that does not exist', () => {
        expect(verdictFor('app/Modules/Reporting/agents/tmp/a-speaking-name/notes.md', never, '').block).toBe(true);
    });

    it('does not match a decoy segment that merely starts with agents/tmp', () => {
        expect(inboxDirName('xagents/tmp/a-speaking-name/notes.md')).toBeNull();
        expect(verdictFor('agents/tmpfiles/a-speaking-name/notes.md', never, '').block).toBe(false);
    });

    it('probes the SAME directory it judged when a path carries two inbox segments', () => {
        // A greedy prefix resolved to the LAST inbox segment while
        // `inboxDirName` reads the FIRST, so this path judged the speaking name
        // and probed the opaque one — reporting "already exists" for a name that
        // does not. Found by a neutral review of this change.
        const p = 'agents/tmp/a-speaking-name/agents/tmp/round-a91f3c/x.md';
        expect(inboxDirName(p)).toBe('a-speaking-name');
        const seen: string[] = [];
        const v = verdictFor(p, (probe) => {
            seen.push(probe);
            return false;
        }, '');
        expect(seen).toEqual(['agents/tmp/a-speaking-name']);
        expect(v.block).toBe(true);
    });

    it('leaves an absolute path absolute instead of re-rooting it', () => {
        const seen: string[] = [];
        verdictFor('/elsewhere/repo/agents/tmp/a-speaking-name/x.md', (p) => {
            seen.push(p);
            return false;
        }, '/some/other/root');
        expect(seen).toEqual(['/elsewhere/repo/agents/tmp/a-speaking-name']);
    });
});

describe('the deny message', () => {
    const msg = denyMessage('some-project-swarm');

    it('names the offending directory, the accepted forms and the fix', () => {
        expect(msg).toContain('some-project-swarm');
        expect(msg).toContain('inbox-2026-08-h');
        expect(msg).toContain('round-a91f3c');
        expect(msg).toContain('S17');
        expect(msg).toContain('link_crypto encrypt');
    });

    it('names the rule and the maintainer kill switch', () => {
        expect(msg).toContain('src/rules/source-confidentiality.md');
        expect(msg).toContain('AGENT_CONFIG_ALLOW_SPEAKING_INBOX');
    });
});

/**
 * `main()` — the envelope surface, added after the R2 review of this branch
 * observed that the 14 cases above exercise only the pure helpers. For a concern
 * registered `severity: blocking`, the envelope shape, the path-key loop, the
 * command path and the kill switch are exactly where a bypass hides, and none of
 * them was covered.
 *
 * `repoRoot` is left empty (no `project_dir`) so the exists-probe resolves
 * relative to the test's cwd and finds nothing — which is the "new directory"
 * branch these cases are about.
 */
describe('main() — the envelope surface', () => {
    const run = (envelope: unknown): number => {
        setHookStdinOverride(JSON.stringify(envelope));
        try {
            return main();
        } finally {
            clearHookStdinOverride();
        }
    };

    it('BLOCKS a Write whose file_path creates a speaking directory', () => {
        expect(run({ tool_name: 'Write', tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } })).toBe(1);
    });

    it('reads a PAYLOAD-WRAPPED envelope, not only a top-level one', () => {
        expect(run({ payload: { tool_name: 'Write', tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } } })).toBe(1);
    });

    it('ALLOWS an opaque round id through the same path', () => {
        expect(run({ tool_name: 'Write', tool_input: { file_path: 'agents/tmp/inbox-2026-08-h/x.md' } })).toBe(0);
    });

    it('covers every _PATH_KEYS alias, not just file_path', () => {
        for (const key of ['path', 'target_file', 'filename', 'filePath', 'notebook_path']) {
            expect(run({ tool_input: { [key]: 'agents/tmp/a-speaking-round/x.md' } }), key).toBe(1);
        }
    });

    it('BLOCKS a shell command that creates the directory — the bypass the review found', () => {
        expect(run({ tool_name: 'Bash', tool_input: { command: 'mkdir -p agents/tmp/a-speaking-round' } })).toBe(1);
        expect(run({ tool_name: 'Bash', tool_input: { command: 'git mv old agents/tmp/a-speaking-round/note.md' } })).toBe(1);
        expect(run({ tool_name: 'Bash', tool_input: { command: 'echo hi > agents/tmp/a-speaking-round/note.md' } })).toBe(1);
    });

    it('does not block a command naming an opaque round id', () => {
        expect(run({ tool_name: 'Bash', tool_input: { command: 'mkdir -p agents/tmp/inbox-2026-08-h' } })).toBe(0);
    });

    it('ALLOWS a read tool whose file_path names a speaking round', () => {
        for (const tool of ['Read', 'Grep', 'Glob', 'NotebookRead', 'codebase-retrieval']) {
            expect(
                run({ tool_name: tool, tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } }),
                tool,
            ).toBe(0);
        }
    });

    it('still BLOCKS a write tool on the same path — the filter is a deny-list, not a bypass', () => {
        expect(run({ tool_name: 'Write', tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } })).toBe(1);
        // An unrecognised tool name is judged, so a host spelling its write
        // tool differently is not silently exempted.
        expect(run({ tool_name: 'str_replace_editor', tool_input: { path: 'agents/tmp/a-speaking-round/x.md' } })).toBe(1);
        expect(run({ tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } })).toBe(1);
    });

    it('ALLOWS the read commands that a real session had refused', () => {
        for (const command of [
            "ls -d agents/tmp.old/a-speaking-round-* 2>/dev/null | sed 's|.*/||'",
            'cat agents/tmp/a-speaking-round/chat.txt',
            'grep -rn "x" agents/tmp/a-speaking-round/',
        ]) {
            expect(run({ tool_name: 'Bash', tool_input: { command } }), command).toBe(0);
        }
    });

    it('a malformed or empty envelope ALLOWS — fail_closed is false', () => {
        expect(run({})).toBe(0);
        setHookStdinOverride('not json at all');
        try {
            expect(main()).toBe(0);
        } finally {
            clearHookStdinOverride();
        }
        setHookStdinOverride('');
        try {
            expect(main()).toBe(0);
        } finally {
            clearHookStdinOverride();
        }
    });

    it('the kill switch silences it', () => {
        process.env['AGENT_CONFIG_ALLOW_SPEAKING_INBOX'] = '1';
        try {
            expect(run({ tool_input: { file_path: 'agents/tmp/a-speaking-round/x.md' } })).toBe(0);
        } finally {
            delete process.env['AGENT_CONFIG_ALLOW_SPEAKING_INBOX'];
        }
    });

    it('a path outside the inbox is untouched', () => {
        expect(run({ tool_input: { file_path: 'src/rules/source-confidentiality.md' } })).toBe(0);
        expect(run({ tool_input: { file_path: 'agents/tmp/scratch.ts' } })).toBe(0);
    });
});
