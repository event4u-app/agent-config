// The local run and the CI run classify the same gated set.
//
// Found on PR #2371: CI runs the BASE revision's copy of the gate with
// `--root <head>`, so `closureArrivals` compares the head's dispatcher closure
// with the base's and gates every module the change brings into it. The local
// pre-push run executes the head's own copy, whose "base" was its own checkout,
// so it saw no arrivals: the two runs digested different file sets and no one
// `subject` satisfied both. A correct record was refused before push.
//
// The fixture is a real repository carrying a copy of the gate, so the local
// run is the gate judging its own tree and the CI run is a detached worktree of
// the base commit judging the head — the two shapes the workflow and the
// pre-push hook actually produce. A record whose subject the CI-shaped writer
// printed must clear both.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import { commitAll } from './ratification_git_fixture.js';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');

/** The gate's own module graph plus the policy it reads from its tree. */
const GATE_FILES = [
    'src/scripts/check_kernel_edit_ratified.ts',
    'src/scripts/ratification_subject.ts',
    'src/scripts/_lib/gate_ledger.ts',
    'src/scripts/_lib/dispatch_import_closure.ts',
    'src/scripts/_lib/kernel_rules.ts',
    'src/scripts/_lib/scan_scope.ts',
    'src/scripts/_lib/adr_frontmatter.ts',
    'src/scripts/_lib/ratification_artifact.ts',
    'src/scripts/_lib/ratification_subject.ts',
    'src/config/ratification-policy.json',
];

const DISPATCHER = 'src/scripts/hooks/dispatch_hook.ts';
const ARRIVAL = 'src/scripts/hooks/egress_stage.ts';

let root: string;
let baseDir: string;

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function run(script: string, args: readonly string[]): { code: number; out: string } {
    const env = { ...process.env };
    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
    const res = spawnSync(TSX, [script, ...args], { cwd: root, encoding: 'utf8', env });
    return { code: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
}

function gated(out: string): string[] {
    return out
        .split('\n')
        .filter((l) => l.trimStart().startsWith('· '))
        .map((l) => l.trim())
        .sort();
}

beforeEach(() => {
    // Real path: the scripts' entry guard compares against the resolved URL.
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ker-local-base-')));
    baseDir = `${root}-base`;
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(baseDir, { recursive: true, force: true });
});

describe('a module joining the dispatcher closure', () => {
    it('is gated by the local run exactly as by the base-revision run', () => {
        for (const rel of GATE_FILES) {
            write(rel, fs.readFileSync(path.join(REPO, rel), 'utf8'));
        }
        write(DISPATCHER, "import { save } from './state_io.js';\nsave();\n");
        write('src/scripts/hooks/state_io.ts', 'export function save(): void {}\n');
        const base = commitAll(root, 'base');

        write(
            DISPATCHER,
            "import { save } from './state_io.js';\nimport { stage } from './egress_stage.js';\nsave();\nstage();\n",
        );
        write(ARRIVAL, 'export function stage(): void {}\n');
        commitAll(root, 'head');

        const git = spawnSync('git', ['-C', root, 'worktree', 'add', '--detach', baseDir, base], {
            encoding: 'utf8',
        });
        expect(git.status).toBe(0);

        const changed = [DISPATCHER, ARRIVAL];
        const writer = run(path.join(baseDir, 'src/scripts/ratification_subject.ts'), [
            '--root',
            root,
            '--quiet',
            '--files',
            ...changed,
        ]);
        expect(writer.code).toBe(0);
        const subject = writer.out.trim().split('\n').pop() as string;
        expect(subject).toMatch(/^[0-9a-f]{64}$/u);

        // The writer run locally, as an author would before pushing, prints
        // the digest CI checks.
        const localWriter = run(path.join(root, 'src/scripts/ratification_subject.ts'), [
            '--base-ref',
            base,
            '--quiet',
            '--files',
            ...changed,
        ]);
        expect(localWriter.code).toBe(0);
        expect(localWriter.out.trim().split('\n').pop()).toBe(subject);

        write(
            path.join(RATIFICATION_DIR, 'closure-arrival.md'),
            [
                '---',
                'proposed_by: claude/session-a',
                'implemented_by: claude/session-a',
                'reviewed_by: council/anthropic+openai',
                `subject: ${subject}`,
                'verdict: ratified',
                'effective_after: merge',
                'providers:',
                '  - anthropic',
                '  - openai',
                'seats:',
                '  anthropic: ratified',
                '  openai: ratified',
                '---',
                '',
                '<!-- evidence-type: ratification -->',
                '',
                'Review body.',
                '',
            ].join('\n'),
        );
        commitAll(root, 'record');

        const ci = run(path.join(baseDir, 'src/scripts/check_kernel_edit_ratified.ts'), [
            '--root',
            root,
            '--base-ref',
            base,
        ]);
        const local = run(path.join(root, 'src/scripts/check_kernel_edit_ratified.ts'), [
            '--base-ref',
            base,
        ]);

        expect(ci.out).toContain(`hook-plumbing source ${ARRIVAL}`);
        expect(ci.code).toBe(0);
        expect(gated(local.out)).toEqual(gated(ci.out));
        expect(local.code).toBe(0);
    }, 60_000);
});
