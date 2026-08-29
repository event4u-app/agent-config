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
    verdictFor,
} from '../../src/scripts/hooks/block_speaking_inbox_dir.js';

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
