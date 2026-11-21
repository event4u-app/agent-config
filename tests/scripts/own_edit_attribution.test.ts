import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { MUTATION_LINE_THRESHOLD, totalNonDocMutatedLines } from '../../src/scripts/hooks/end_review_nudge_hook.js';
import {
    countOwnLines,
    ownEditCount,
    sessionWritesFromTranscript,
    shellWriteTargets,
} from '../../src/scripts/_lib/own_edit_attribution.js';

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', ...args], {
        cwd,
        env: ENV,
        encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
}

const lines = (n: number, tag: string): string => Array.from({ length: n }, (_, i) => `${tag} ${i}`).join('\n') + '\n';

const toolUse = (name: string, input: Record<string, unknown>): string =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: name, name, input }] } });

let repo = '';
afterEach(() => {
    if (repo) fs.rmSync(repo, { recursive: true, force: true });
    repo = '';
});

/** A repo with one commit; returns the head a session-start baseline would record. */
function freshRepo(): string {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'own-edit-'));
    git(repo, 'init', '-q');
    fs.writeFileSync(path.join(repo, 'seed.ts'), 'seed\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'seed');
    return git(repo, 'rev-parse', 'HEAD');
}

describe('foreign edits are not charged to the session', () => {
    it('(a) a session with no write call is silent while another writer adds 703 lines', () => {
        const start = freshRepo();
        fs.writeFileSync(path.join(repo, 'foreign.ts'), lines(703, 'foreign'));
        const writes = sessionWritesFromTranscript(toolUse('Read', { file_path: path.join(repo, 'foreign.ts') }), repo);
        expect(ownEditCount(repo, start, writes)).toEqual({ lines: 0, attribution: 'own' });
        // The live nudge charges all of it — the defect this module answers.
        expect(totalNonDocMutatedLines(repo)).toBeGreaterThan(MUTATION_LINE_THRESHOLD);
    });

    it('(b) a session that edits 40 lines and commits them is charged 40, not 40 + 663', () => {
        const start = freshRepo();
        fs.writeFileSync(path.join(repo, 'mine.ts'), lines(40, 'mine'));
        git(repo, 'add', 'mine.ts');
        git(repo, 'commit', '-q', '-m', 'mine');
        fs.writeFileSync(path.join(repo, 'foreign.ts'), lines(663, 'foreign'));
        const writes = sessionWritesFromTranscript(toolUse('Write', { file_path: path.join(repo, 'mine.ts') }), repo);
        expect(ownEditCount(repo, start, writes)).toEqual({ lines: 40, attribution: 'own' });
    });

    it('(c) a session that edits 60 lines alone is charged 60', () => {
        const start = freshRepo();
        fs.writeFileSync(path.join(repo, 'seed.ts'), lines(59, 'edit'));
        const writes = sessionWritesFromTranscript(toolUse('Edit', { file_path: path.join(repo, 'seed.ts') }), repo);
        const count = ownEditCount(repo, start, writes);
        expect(count?.attribution).toBe('own');
        expect(count?.lines).toBe(60);
    });

    it('a shell-only session is charged for the literal targets it wrote', () => {
        const start = freshRepo();
        fs.writeFileSync(path.join(repo, 'gen.ts'), lines(80, 'gen'));
        fs.writeFileSync(path.join(repo, 'foreign.ts'), lines(300, 'foreign'));
        const transcript = toolUse('Bash', { command: "cat > gen.ts <<'EOF'\n...\nEOF" });
        expect(ownEditCount(repo, start, sessionWritesFromTranscript(transcript, repo))).toEqual({ lines: 80, attribution: 'own' });
    });

    it('an opaque shell write marks the count fallback and still reports what was verified', () => {
        const start = freshRepo();
        fs.writeFileSync(path.join(repo, 'a.ts'), lines(10, 'a'));
        const transcript = [
            toolUse('Write', { file_path: path.join(repo, 'a.ts') }),
            toolUse('Bash', { command: "python3 - <<'PY'\nopen('b.ts','w').write('x')\nPY" }),
        ].join('\n');
        expect(ownEditCount(repo, start, sessionWritesFromTranscript(transcript, repo))).toEqual({ lines: 10, attribution: 'fallback' });
    });
});

describe('shell write targets', () => {
    it.each([
        ['echo x > out.ts', ['out.ts'], false],
        ['printf x >> log.ts 2>&1', ['log.ts'], false],
        ['npm test 2>&1 | tee build.log', ['build.log'], false],
        ["sed -i '' 's/a/b/' src/a.ts src/b.ts", ['src/a.ts', 'src/b.ts'], false],
        ['cp src/a.ts src/b.ts', ['src/b.ts'], false],
        ['ls > /dev/null', [], false],
        ['echo x > "$OUT"', [], true],
        ['git apply fix.patch', [], true],
        ['find . -name "*.ts" -exec sed -i s/a/b/ {} +', [], true],
        ['grep -rn foo src', [], false],
    ])('%s', (command, targets, unresolved) => {
        expect(shellWriteTargets(command)).toEqual({ targets, unresolved });
    });
});

describe('countOwnLines', () => {
    it('subtracts a written path\'s start-of-session dirt and ignores docs', () => {
        const rows = [
            { path: 'a.ts', added: 30, deleted: 5 },
            { path: 'b.md', added: 100, deleted: 0 },
            { path: 'c.ts', added: 7, deleted: 0 },
        ];
        const writes = { paths: new Set(['a.ts', 'b.md']), unresolvedShellWrite: false };
        expect(countOwnLines(rows, new Map([['new.ts', 4]]), writes, new Map([['a.ts', 10]]))).toEqual({ lines: 25, attribution: 'own' });
    });
});
