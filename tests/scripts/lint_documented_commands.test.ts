import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const LINTER = path.resolve('src/scripts/lint_documented_commands.ts');

let tmp: string;

/** Write a skill doc into the fixture tree's scanned location. */
function writeSkill(root: string, body: string): void {
    const dir = path.join(root, 'src', 'skills', 'fixture-skill');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
}

interface RunResult {
    status: number;
    stdout: string;
}

function runLinter(root: string, format: 'text' | 'json' = 'text'): RunResult {
    try {
        const stdout = execFileSync('npx', ['tsx', LINTER, '--root', root, '--format', format], {
            encoding: 'utf8',
        });
        return { status: 0, stdout };
    } catch (e) {
        const err = e as { status?: number; stdout?: string };
        return { status: err.status ?? -1, stdout: err.stdout ?? '' };
    }
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-doc-cmds-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_documented_commands — red/green fixtures', () => {
    it('GREEN: registered agent-config verbs resolve', () => {
        writeSkill(
            tmp,
            '# fixture\n\nRun `agent-config doctor` then `./agent-config memory:lookup foo`.\n',
        );
        const r = runLinter(tmp);
        expect(r.status).toBe(0);
    });

    it('RED: unknown agent-config verb is a violation with file+line+token', () => {
        writeSkill(tmp, '# fixture\n\nRun `agent-config nonexistent-verb-xyz` now.\n');
        const r = runLinter(tmp, 'json');
        expect(r.status).toBe(1);
        const violations = JSON.parse(r.stdout) as { token: string; line: number; file: string }[];
        expect(violations).toHaveLength(1);
        expect(violations[0]!.token).toBe('nonexistent-verb-xyz');
        expect(violations[0]!.file).toContain('fixture-skill/SKILL.md');
        expect(violations[0]!.line).toBe(3);
    });

    it('RED: bare unregistered package form (`code_graph detect`) is a violation', () => {
        writeSkill(tmp, '# fixture\n\nRun `code_graph detect` to check freshness.\n');
        const r = runLinter(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('code_graph');
    });

    it('GREEN: the registered replacement form resolves', () => {
        writeSkill(tmp, '# fixture\n\nRun `agent-config code-graph detect`.\n');
        expect(runLinter(tmp).status).toBe(0);
    });

    it('GREEN: ignore marker suppresses a deliberate example', () => {
        writeSkill(
            tmp,
            '# fixture\n\n<!-- lint-documented-commands: ignore -->\nRun `agent-config nonexistent-verb-xyz` (negative example).\n',
        );
        expect(runLinter(tmp).status).toBe(0);
    });

    it('GREEN: consumer-project npm/task guidance is out of scope by design', () => {
        writeSkill(
            tmp,
            '# fixture\n\nIn your app run `npm run ios` or `task deploy-prod-xyz` (consumer project).\n',
        );
        expect(runLinter(tmp).status).toBe(0);
    });

    it('scans fenced bash blocks, not just inline spans', () => {
        writeSkill(tmp, '# fixture\n\n```bash\nagent-config not-a-real-verb-abc\n```\n');
        const r = runLinter(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('not-a-real-verb-abc');
    });
});

describe('lint_documented_commands — current tree', () => {
    it('the real shipped tree is green (the S0a bug class is pinned at zero)', () => {
        const r = runLinter(path.resolve('.'));
        expect(r.stdout).not.toContain('🔴');
        expect(r.status).toBe(0);
    });
});
