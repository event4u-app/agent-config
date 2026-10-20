import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Commit a fixture tree, so that the ratification subject — which is read from
 * Git objects at a revision, never from the working tree — has a revision to
 * read.
 *
 * Isolated from the developer's configuration and from a calling hook: no
 * global hooks run, no signing is attempted, and a `GIT_DIR` inherited from a
 * pre-push hook cannot point the fixture at the real repository.
 */
const LOCATING_ENV = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
];

function fixtureEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    for (const k of LOCATING_ENV) delete env[k];
    return env;
}

function git(root: string, args: readonly string[]): string {
    const res = spawnSync(
        'git',
        [
            '-C',
            root,
            '-c',
            'user.name=fixture',
            '-c',
            'user.email=fixture@example.invalid',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'core.hooksPath=/dev/null',
            ...args,
        ],
        { encoding: 'utf8', env: fixtureEnv() },
    );
    if (res.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
    }
    return res.stdout.trim();
}

/**
 * The high-consequence rule list the gate reads at every commit it judges and
 * refuses without. A fixture that does not write its own gets an EMPTY class
 * at its first commit, so the gate it exercises judges the fixture's diff
 * rather than refusing the fixture for lacking a list.
 */
const CONSEQUENCE_LIST_REL = 'src/config/rule-consequence-class.json';

/** Stage everything under `root` and commit it; returns the new commit id. */
export function commitAll(root: string, message = 'fixture'): string {
    if (!fs.existsSync(path.join(root, '.git'))) {
        git(root, ['init', '-q']);
        const list = path.join(root, CONSEQUENCE_LIST_REL);
        if (!fs.existsSync(list)) {
            fs.mkdirSync(path.dirname(list), { recursive: true });
            fs.writeFileSync(list, '{"members": {}}\n');
        }
    }
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '--allow-empty', '-m', message]);
    return git(root, ['rev-parse', 'HEAD']);
}
