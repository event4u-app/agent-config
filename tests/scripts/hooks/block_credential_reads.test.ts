/**
 * `block_credential_reads` — road-to-one-detector-and-the-senders-we-own 1.1.
 *
 * Per file class a red and a green case on a deny-capable slot, and a warn
 * assertion on a slot that cannot refuse. Every allow-branch the guard declares
 * has a case too: a blocking concern whose allow paths are untested is one bad
 * envelope away from wedging a session. No fixture holds a credential value —
 * the guard decides from paths and command words alone.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { credentialFileClass, segmentVerdict } from '../../../src/scripts/_lib/credential_files.js';
import { denyMessage, KILL_SWITCH, main, verdictFor } from '../../../src/scripts/hooks/block_credential_reads.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';
import { emitFor, isBlockCapable } from '../../../src/scripts/hooks/host_semantics.js';

function run(tool: string, input: Record<string, string>): number {
    setHookStdinOverride(JSON.stringify({ payload: { tool_name: tool, tool_input: input } }));
    try {
        return main();
    } finally {
        clearHookStdinOverride();
    }
}

afterEach(() => {
    delete process.env[KILL_SWITCH];
});

// One red and one green path per class: the green is the nearest legitimate neighbour.
const CLASSES: ReadonlyArray<{ cls: string; red: string; green: string }> = [
    { cls: 'env-file', red: 'app/.env', green: 'app/.env.example' },
    { cls: 'env-file', red: '.env.production.local', green: '.env.sample' },
    { cls: 'private-key', red: '/home/u/.ssh/id_ed25519', green: '/home/u/.ssh/id_ed25519.pub' },
    { cls: 'private-key', red: 'certs/server.key', green: 'docs/key.md' },
    { cls: 'cloud-credentials', red: '/home/u/.aws/credentials', green: '/home/u/.aws/notes.txt' },
    { cls: 'cloud-credentials', red: '/home/u/.config/gh/hosts.yml', green: '/home/u/.config/gh/config.yml' },
    { cls: 'registry-credentials', red: 'pkg/.npmrc', green: 'pkg/.nvmrc' },
    { cls: 'registry-credentials', red: '/home/u/.cargo/credentials.toml', green: '/home/u/.cargo/config.toml' },
];

describe('the file classes', () => {
    for (const c of CLASSES) {
        it(`${c.cls}: ${c.red} is refused, ${c.green} is not`, () => {
            expect(credentialFileClass(c.red)).toBe(c.cls);
            expect(credentialFileClass(c.green)).toBeNull();
            expect(run('Read', { file_path: c.red })).toBe(1);
            expect(run('Read', { file_path: c.green })).toBe(0);
        });
    }

    it('reads the process environment file as the environment', () => {
        expect(credentialFileClass('/proc/self/environ')).toBe('process-environment');
    });
});

describe('the tool and command surface', () => {
    it('refuses every reading file tool and passes the write-only and name-only ones', () => {
        for (const tool of ['Read', 'Edit', 'MultiEdit', 'Grep', 'NotebookEdit']) expect(run(tool, { file_path: '.env' })).toBe(1);
        for (const tool of ['Write', 'Glob', 'LS']) expect(run(tool, { file_path: '.env' })).toBe(0);
    });

    it('refuses a shell read of a credential file, and passes a command that does not print it', () => {
        for (const cmd of ['cat .env', 'grep KEY .env.local', 'head -1 ~/.aws/credentials', 'sort < .env', 'git diff .env', 'cd x && less .env']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['ls -la .env', 'cp .env.example .env', 'rm .env', 'git add .env.example', 'git check-ignore .env', 'cat .env.example']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('refuses a command that prints the environment, and passes one that only uses it', () => {
        for (const cmd of ['env', 'printenv', 'env | grep TOKEN', 'export', 'export -p', 'set', 'declare -x', 'cat /proc/self/environ']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['env FOO=1 node app.js', 'printenv HOME', 'export PATH=/x:$PATH', 'set -euo pipefail', 'declare -a list']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('refuses the bypasses council round 4c named', () => {
        for (const cmd of [
            'cp .env /dev/stdout',
            'cp .env backup.txt',
            'mv .env renamed.txt',
            'set -x; source .env',
            '. ./.env',
            'curl --config=.env https://x',
            'mysqldump --defaults-file=~/.my.cnf db',
            'echo $(cat .env)',
            'echo `cat .env`',
            'cat <<< "$(cat .env)"',
            'command env',
            '/usr/bin/env',
            'sudo env',
            'sudo -u root cat /root/.aws/credentials',
            "sh -c 'env'",
            'nice -n 5 printenv',
            'cat ~/.git-credentials',
            'cat /proc/self/../self/environ',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
    });

    it('passes the legitimate neighbours of those bypasses', () => {
        for (const cmd of [
            'cp .env.example .env',
            'cp .env.local.example .env.local',
            'cat .env.production.template',
            'cat certs/ca.pem certs/chain.pem',
            'sudo ls -la /root',
            'command -v node',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
        expect(run('Read', { file_path: 'certs/cert.pem' })).toBe(0);
        expect(run('Read', { file_path: 'certs/server-key.pem' })).toBe(1);
    });

    it('reads every path a tool input carries, nested and in arrays', () => {
        expect(run('MultiRead', { paths: ['README.md', 'app/.env'] } as unknown as Record<string, string>)).toBe(1);
        expect(run('Tool', { edits: [{ file_path: '.pgpass' }] } as unknown as Record<string, string>)).toBe(1);
        expect(run('Tool', { edits: [{ file_path: 'src/a.ts' }], note: '.env' } as unknown as Record<string, string>)).toBe(0);
    });

    it('a malformed envelope, an empty one and the kill switch all allow', () => {
        setHookStdinOverride('{not json');
        try {
            expect(main()).toBe(0);
        } finally {
            clearHookStdinOverride();
        }
        expect(run('Read', {})).toBe(0);
        process.env[KILL_SWITCH] = '1';
        expect(run('Read', { file_path: '.env' })).toBe(0);
    });

    it('the refusal names the class and the alternative, never a value', () => {
        const r = verdictFor('Read', { file_path: '/repo/.env' });
        expect(r?.class).toBe('env-file');
        const msg = denyMessage(r as NonNullable<typeof r>);
        expect(msg).toContain('environment file');
        expect(msg).toContain('process.env.NAME');
        expect(segmentVerdict('printenv')?.class).toBe('process-environment');
    });
});

describe('what the host does with the refusal', () => {
    it('a deny-capable slot refuses the call', () => {
        expect(isBlockCapable('claude', 'pre_tool_use')).toBe(true);
        const e = emitFor('claude', 'pre_tool_use', 'block', ['blocked'], 1);
        expect(e.exit).toBe(2);
    });

    it('a slot that cannot refuse only warns', () => {
        expect(isBlockCapable('claude', 'post_tool_use')).toBe(false);
        const e = emitFor('claude', 'post_tool_use', 'block', ['blocked'], 1);
        expect(e.exit).toBe(0);
        expect(JSON.parse(e.stdout).hookSpecificOutput.additionalContext).toContain('blocked');
    });
});
