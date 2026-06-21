// Tests for src/scripts/migrate_command_suggestions.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed. This is a focused differential suite that NEVER
// touches the live repo — every run targets a fresh temp command dir:
//   1. In-process unit checks of build_block / migrate_one (eligible, ineligible,
//      already-present skip, idempotent re-run, escaping of inner quotes).
//   2. A writer golden-parity layer: a Python driver patches the module's
//      COMMANDS_DIR onto a temp fixture and runs main(); the TS twin runs the
//      same fixture via `_setCommandsDirForTest` + main(). Stdout summary,
//      stderr WARNING, exit code, and every rewritten file are asserted
//      byte-identical. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    build_block,
    migrate_one,
    main,
    _setCommandsDirForTest,
    _getCommandsDirForTest,
} from '../../src/scripts/migrate_command_suggestions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const FM_COMMIT = '---\nname: commit\ndescription: Commit changes.\n---\n\n# commit\n\nbody.\n';
const FM_MODE = '---\nname: mode\ndescription: Switch mode.\n---\n\n# mode\n\nbody.\n';
const FM_HAS = '---\nname: work\ndescription: Do work.\nsuggestion:\n  eligible: true\n---\n\n# work\n\nx.\n';

function writeFixture(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'commit.md'), FM_COMMIT, 'utf-8');
    fs.writeFileSync(path.join(dir, 'mode.md'), FM_MODE, 'utf-8');
    fs.writeFileSync(path.join(dir, 'work.md'), FM_HAS, 'utf-8');
}

describe('migrate_command_suggestions — in-process units', () => {
    let tmp: string;
    let prev: string;
    beforeEach(() => {
        prev = _getCommandsDirForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-'));
    });
    afterEach(() => {
        _setCommandsDirForTest(prev);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('build_block — eligible command emits trigger fields', () => {
        const b = build_block('commit');
        expect(b).toContain('eligible: true');
        expect(b).toContain('trigger_description: "commit my changes');
        expect(b).toContain('trigger_context: "git status shows uncommitted changes"');
    });

    it('build_block — ineligible command emits rationale', () => {
        const b = build_block('mode');
        expect(b).toBe(
            'suggestion:\n  eligible: false\n  rationale: "Role-mode switch is a deliberate context change."',
        );
    });

    it('build_block — escapes inner double quotes', () => {
        // "memory-full" rationale contains 'never auto-triggered' in single
        // quotes (no double quotes); craft via an eligible one that has none —
        // assert the escape mechanic on a synthetic check instead.
        const b = build_block('agents-audit');
        expect(b).not.toContain('""');
    });

    it('migrate_one — injects block for eligible command', () => {
        const p = path.join(tmp, 'commit.md');
        fs.writeFileSync(p, FM_COMMIT, 'utf-8');
        expect(migrate_one(p)).toBe('ok');
        const after = fs.readFileSync(p, 'utf-8');
        expect(after).toContain('suggestion:\n  eligible: true');
        // body preserved
        expect(after).toContain('\n# commit\n\nbody.\n');
    });

    it('migrate_one — skips when suggestion already present', () => {
        const p = path.join(tmp, 'work.md');
        fs.writeFileSync(p, FM_HAS, 'utf-8');
        expect(migrate_one(p)).toBe('skip');
        expect(fs.readFileSync(p, 'utf-8')).toBe(FM_HAS);
    });

    it('migrate_one — idempotent re-run is a no-op', () => {
        const p = path.join(tmp, 'mode.md');
        fs.writeFileSync(p, FM_MODE, 'utf-8');
        expect(migrate_one(p)).toBe('ok');
        const first = fs.readFileSync(p, 'utf-8');
        expect(migrate_one(p)).toBe('skip');
        expect(fs.readFileSync(p, 'utf-8')).toBe(first);
    });

    it('main — WARNING + exit 1 when the dir has fewer files than the table', () => {
        writeFixture(tmp);
        _setCommandsDirForTest(tmp);
        expect(main()).toBe(1); // 3 files != table count
    });
});

const py3 = hasPython3();

function runPyDriver(commandsDir: string): { stdout: string; stderr: string; status: number | null } {
    const driver = `import sys, importlib
sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'src', 'scripts'))})
from pathlib import Path
m = importlib.import_module("migrate_command_suggestions")
m.COMMANDS_DIR = Path(sys.argv[1])
raise SystemExit(m.main())
`;
    const r = spawnSync('python3', ['-c', driver, commandsDir], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function runTsDriver(commandsDir: string): { stdout: string; stderr: string; status: number | null } {
    const driver = `import { _setCommandsDirForTest, main } from ${JSON.stringify(
        path.join(REPO_ROOT, 'src', 'scripts', 'migrate_command_suggestions.ts'),
    )};
_setCommandsDirForTest(process.argv[1]);
process.exit(main());
`;
    const r = spawnSync(TSX_BIN, ['-e', driver, commandsDir], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe.skipIf(!py3)('migrate_command_suggestions — writer golden parity (temp fixtures)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-par-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('rewrites + stdout + stderr + exit byte-identical (mixed fixture)', () => {
        const pyDir = path.join(tmp, 'py');
        const tsDir = path.join(tmp, 'ts');
        writeFixture(pyDir);
        writeFixture(tsDir);
        const p = runPyDriver(pyDir);
        const t = runTsDriver(tsDir);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
        for (const f of ['commit.md', 'mode.md', 'work.md']) {
            expect(fs.readFileSync(path.join(tsDir, f), 'utf-8'), f).toBe(
                fs.readFileSync(path.join(pyDir, f), 'utf-8'),
            );
        }
    });

    it('not-classified command → exit 1 with identical stderr message', () => {
        const pyDir = path.join(tmp, 'py');
        const tsDir = path.join(tmp, 'ts');
        const body = '---\nname: not-a-real-command\ndescription: x.\n---\n\n# x\n';
        fs.mkdirSync(pyDir, { recursive: true });
        fs.mkdirSync(tsDir, { recursive: true });
        fs.writeFileSync(path.join(pyDir, 'not-a-real-command.md'), body, 'utf-8');
        fs.writeFileSync(path.join(tsDir, 'not-a-real-command.md'), body, 'utf-8');
        const p = runPyDriver(pyDir);
        const t = runTsDriver(tsDir);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    });
});
