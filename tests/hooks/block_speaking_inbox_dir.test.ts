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
