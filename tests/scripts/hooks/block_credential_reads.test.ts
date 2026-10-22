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

import { credentialFileClass, segmentVerdict, type PathHost } from '../../../src/scripts/_lib/credential_files.js';
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
        expect(credentialFileClass('/proc/self/task/123/environ')).toBe('process-environment');
    });

    it('matches names case-folded, as a case-insensitive filesystem opens them', () => {
        expect(credentialFileClass('.ENV')).toBe('env-file');
        expect(credentialFileClass('.Env.Local')).toBe('env-file');
        expect(credentialFileClass('.ENV.EXAMPLE')).toBeNull();
        expect(credentialFileClass('~/.ssh/ID_RSA')).toBe('private-key');
        expect(credentialFileClass('~/.AWS/credentials')).toBe('cloud-credentials');
        expect(credentialFileClass('.NPMRC')).toBe('registry-credentials');
        expect(credentialFileClass('~/.azure/accesstokens.json')).toBe('cloud-credentials');
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

    it("refuses another process's environment, not only self's", () => {
        // The host process's environment is the same secret leak as this
        // shell's: the parent by variable, and any process by numeric pid.
        for (const cmd of ['cat /proc/$PPID/environ', 'cat /proc/1234/environ', 'tr "\\0" "\\n" < /proc/1/environ']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
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

    it('reads command grammar the way the command does (council round 4c, second pass)', () => {
        for (const cmd of [
            'sudo -u root env',
            'sudo --user root env',
            'sudo --user=root printenv',
            'env -u PATH',
            'env FOO=1',
            "env -S 'cat .env'",
            'env -C /tmp cat .env',
            'cp -t backup .env',
            'cp --target-directory=backup .env',
            'mv --target-directory backup .env',
            'timeout --signal TERM 5 env',
            'timeout -k 2 10s cat .env',
            'exec -a name env',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['sudo -u root ls /root', 'timeout 5 npm test', 'env FOO=1 node app.js', 'cp -t backup .env.example']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('judges a wrapped segment conservatively, and splices env -S into env (council round 4c, third pass)', () => {
        for (const cmd of [
            "env -S 'cat' .env",
            "env -S '-u PATH cat .env'",
            "env -S'cat .env'",
            'env -iu PATH',
            'cp -vt backup .env',
            'mv -ft backup .env',
            'cp -tbackup .env',
            'sudo -nu root cat .env',
            'timeout .5s cat .env',
            'xargs -a list.txt cat .env',
            'sudo -E env',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['sudo -nu root ls /root', 'timeout .5s npm test', 'cp -vt backup .env.example', 'env -i PATH=/bin node app.js']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('reads credential paths from the raw text, not only from parsed words (council round 4c, fourth pass)', () => {
        for (const cmd of [
            'cat<.env',
            'cat<".env"',
            'head<certs/tls.key',
            'node app.js<config/.env.local',
            'xargs -a.env echo',
            'diff --from-file=.env a b',
            'paste - <(cat .env)',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['cat<notes.txt', 'xargs -a list.txt echo']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('reads escapes and quote joins the way the shell does (council round 4c, fifth pass)', () => {
        for (const cmd of [
            'cat .e\\nv',
            'cat /tmp/private\\.key',
            "cat .e''nv",
            'cat .e"n"v',
            'cat<.e\\nv',
            'cat ".e\\\nnv"',
            'cat .e\\\nnv',
        ]) {
            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
        }
        // A backslash the shell keeps (inside single quotes, or before an ordinary
        // character inside double quotes) and a literal apostrophe name another file.
        for (const cmd of ["cat .e''nv.example", 'cat notes\\.txt', 'cat ".e\\nv"', "cat '.e\\nv'", 'cat ".e\'nv"']) {
            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(0);
        }
    });

    it('reads a backslash as a separator on a Windows host only (council round 4c, seventh and eighth passes)', () => {
        const bash = (command: string, host: PathHost) => verdictFor('Bash', { command }, host);
        const read = (file_path: string, host: PathHost) => verdictFor('Read', { file_path }, host);
        // Each of these names `.env` or a key in a directory on Windows, and one
        // file whose name holds a backslash on a POSIX host.
        const separatorDecides = [
            "cat 'dir\\.env'",
            'cat "dir\\.env"',
            "cat '.ssh\\id_rsa'",
            'cat "C:\\Users\\someone\\project\\.env"',
            "cat '\\\\server\\share\\.env'",
            "cat 'C:dir\\.env'",
            "cat '\\Users\\x\\.env'",
        ];
        for (const cmd of separatorDecides) {
            expect(bash(cmd, 'windows'), `windows ${JSON.stringify(cmd)}`).not.toBeNull();
            expect(bash(cmd, 'posix'), `posix ${JSON.stringify(cmd)}`).toBeNull();
        }
        for (const p of ['dir\\.env', 'C:\\Users\\someone\\project\\.env']) {
            expect(read(p, 'windows'), `windows ${p}`).not.toBeNull();
            expect(read(p, 'posix'), `posix ${p}`).toBeNull();
        }
        expect(bash('cat "C:\\Users\\someone\\project\\.env.example"', 'windows')).toBeNull();
        // An unquoted backslash is the shell's before it is the filesystem's: it
        // escapes the next character, so `cat dir\.env` opens `dir.env` on both hosts
        // (council round 4c, ninth pass).
        for (const host of ['posix', 'windows'] as const) {
            for (const cmd of ['cat dir\\.env', 'cat C:\\x\\.env', 'cat < dir\\.env']) {
                expect(bash(cmd, host), `${host} ${JSON.stringify(cmd)}`).toBeNull();
            }
        }
        // A redirection attached to the command word arrives with its quotes already
        // stripped, so on a Windows host it is judged uncooked: the unquoted form is a
        // false positive the guard accepts so the quoted one is never missed.
        expect(bash('cat<dir\\.env', 'windows')).not.toBeNull();
        expect(bash('cat<dir\\.env', 'posix')).toBeNull();
        // Quoted, the backslash survives and the Windows host separates on it, attached or not.
        for (const cmd of ['cat<"C:\\x\\.env"', 'cat --config="dir\\.env"']) {
            expect(bash(cmd, 'windows'), `windows ${JSON.stringify(cmd)}`).not.toBeNull();
            expect(bash(cmd, 'posix'), `posix ${JSON.stringify(cmd)}`).toBeNull();
        }
        // A backslash the shell consumes as an escape names the same file on both hosts.
        for (const host of ['posix', 'windows'] as const) {
            for (const cmd of ['cat .e\\nv', 'cat dir\\/.env', "cat 'certs\\tls.key'"]) {
                expect(bash(cmd, host), `${host} ${JSON.stringify(cmd)}`).not.toBeNull();
            }
        }
    });

    it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
        expect(credentialFileClass('certs/monkey.pem')).toBeNull();
        expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
        expect(credentialFileClass('certs/tls.key.pem')).toBe('private-key');
        expect(credentialFileClass('certs/private.pem')).toBe('private-key');
        expect(credentialFileClass('docs/proc/self/environ')).toBeNull();
        expect(credentialFileClass('proc/self/environ')).toBeNull();
    });

    it('names a Windows path by its basename only', () => {
        const r = verdictFor('Read', { file_path: 'C:\\Users\\someone\\project\\.env' }, 'windows');
        expect(r).not.toBeNull();
        expect(r?.class).toBe('env-file');
        expect(r?.what).toBe('`.env`');
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
