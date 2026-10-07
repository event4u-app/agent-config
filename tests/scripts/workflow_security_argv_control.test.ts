// Control reading for the workflow-security audit: does the argv CI actually
// runs fail a pull request that plants a HIGH?
//
// The argv is read from .github/workflows/consistency.yml rather than written
// here, so the test follows the step: today it pins "reported, exit 0", and the
// day the step gains `--strict` the same assertions pin "exit 1" instead. The
// step's own name is held to the same outcome, so the prose next to the gate
// cannot claim a verdict the gate does not deliver.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_workflow_security.ts');
const CONSISTENCY = path.join(REPO_ROOT, '.github', 'workflows', 'consistency.yml');
const STEP_COMMAND = './scripts-run src/scripts/lint_workflow_security';

const HIGH_WF = [
    'on:',
    '  pull_request_target:',
    'jobs:',
    '  build:',
    '    steps:',
    '      - uses: actions/checkout@0000000000000000000000000000000000000000',
    '        with:',
    '          persist-credentials: false',
    '          ref: ${{ github.event.pull_request.head.sha }}',
    '',
].join('\n');

interface CiStep {
    readonly name: string;
    readonly argv: readonly string[];
}

/** The step in consistency.yml that runs the audit: its name and its argv. */
function readCiStep(): CiStep {
    const lines = fs.readFileSync(CONSISTENCY, 'utf-8').split('\n');
    const runIdx = lines.findIndex((l) => l.trim().startsWith(`run: ${STEP_COMMAND}`));
    if (runIdx < 0) {
        throw new Error(`no step in consistency.yml runs \`${STEP_COMMAND}\``);
    }
    const runLine = (lines[runIdx] as string).trim();
    const rest = runLine.slice(`run: ${STEP_COMMAND}`.length).trim();
    const nameLine = (lines[runIdx - 1] as string).trim();
    if (!nameLine.startsWith('- name:')) {
        throw new Error('the audit step has no `name:` on the line above its `run:`');
    }
    return {
        name: nameLine.slice('- name:'.length).trim(),
        argv: rest === '' ? [] : rest.split(/\s+/),
    };
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function plantHigh(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsac-'));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'bad.yml'), HIGH_WF, 'utf-8');
    return dir;
}

function runGate(wfDir: string, argv: readonly string[]): { code: number | null; out: string } {
    const r = spawnSync(TSX, [SCRIPT, ...argv], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: { ...process.env, LINT_WORKFLOW_SECURITY_DIR: wfDir },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('workflow-security audit — control reading under the argv CI runs', () => {
    it('finds the audit step in consistency.yml', () => {
        const step = readCiStep();
        expect(step.name.length).toBeGreaterThan(0);
    });

    it('under --strict, an injected HIGH exits 1', () => {
        const r = runGate(plantHigh(), ['--strict']);
        expect(r.out).toMatch(/HIGH/);
        expect(r.code).toBe(1);
    });

    it('under the argv CI runs, the HIGH is reported and the exit code matches the step', () => {
        const step = readCiStep();
        const r = runGate(plantHigh(), step.argv);
        expect(r.out).toMatch(/pull_request_target/);
        if (step.argv.includes('--strict')) {
            expect(r.code).toBe(1);
        } else {
            expect(r.code).toBe(0);
        }
    });

    it("the step's own name states the outcome the argv delivers", () => {
        const step = readCiStep();
        const saysWarnOnly = /warn-only/i.test(step.name);
        expect(saysWarnOnly).toBe(!step.argv.includes('--strict'));
    });
});
