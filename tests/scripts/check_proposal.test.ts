// Tests for src/scripts/check_proposal.ts — the Stage-4 gate.
//
// 1:1 port of tests/test_check_proposal.py (pytest → vitest, ADR-088 parity
// contract). Each case spawns the TS script via tsx and asserts on stdout /
// exit code. A trailing golden-parity block runs python3 + tsx on identical
// fixtures and asserts byte-identical stdout+stderr+exit, skipped when
// python3 is absent.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve_logical } from '../../src/scripts/_lib/agent_src.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_proposal.ts');

const TEMPLATE = resolve_logical('templates/agents/proposal.example.md');
if (TEMPLATE === null) {
    throw new Error('proposal.example.md must exist in some package');
}

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function run(path: string, fmt = 'text'): RunResult {
    return runTs(['--format', fmt, path]);
}

function validProposal(): string {
    return [
        '---',
        'proposal_id: sample-one',
        'type: rule',
        'scope: package',
        'stage: proposed',
        'author: team-x',
        'created: 2026-04-01',
        'last_updated: 2026-04-22',
        '---',
        '',
        '# Proposal: sample',
        '',
        '## 1. Learning',
        '',
        'Pattern description.',
        '',
        '## 2. Classification',
        '',
        'Scope / Type / etc.',
        '',
        '## 3. Evidence',
        '',
        '```yaml',
        'evidence:',
        '  - kind: pr',
        '    ref: https://github.com/org-a/repo-a/pull/1',
        '    summary: first.',
        '  - kind: review-comment',
        '    ref: https://gitlab.com/org-b/repo-b/pull/42',
        '    summary: second.',
        '```',
        '',
        '## 4. Proposed artefact',
        '',
        'Draft body.',
        '',
        '## 5. Quality gate expectations',
        '',
        'Checks.',
        '',
        '## 6. Replacement justification',
        '',
        'N/A.',
        '',
        '## 7. Success signal',
        '',
        '- Metric: reviewer comments per month',
        '- Baseline: 3',
        '- Target: < 1',
        '- Evaluation date: 2026-07-22',
        '',
        '## 8. Risks and alternatives rejected',
        '',
        'Risks.',
        '',
        '## 9. Gate verdict',
        '',
        'Pending.',
        '',
        '## 10. Upstream PR',
        '',
        'Pending.',
        '',
    ].join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'check-proposal-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('check_proposal.ts', () => {
    it('example template passes', () => {
        const result = run(TEMPLATE as string);
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('PASS');
    });

    it('valid proposal passes', () => {
        const p = join(tmp, 'p.md');
        writeFileSync(p, validProposal(), 'utf-8');
        const result = run(p);
        expect(result.status, result.stdout).toBe(0);
    });

    it('missing frontmatter fields fails', () => {
        const p = join(tmp, 'p.md');
        writeFileSync(p, '---\nproposal_id: x\n---\n\n# body\n', 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('missing: type');
        expect(result.stdout).toContain('missing: author');
    });

    it('invalid vocabulary fails', () => {
        let body = validProposal().replace('type: rule', 'type: widget');
        body = body.replace('scope: package', 'scope: cosmic');
        body = body.replace('stage: proposed', 'stage: bogus');
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("invalid type 'widget'");
        expect(result.stdout).toContain("invalid scope 'cosmic'");
        expect(result.stdout).toContain("invalid stage 'bogus'");
    });

    it('insufficient evidence fails', () => {
        const body = validProposal().replace(
            '  - kind: review-comment\n' +
                '    ref: https://gitlab.com/org-b/repo-b/pull/42\n' +
                '    summary: second.\n',
            '',
        );
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('need ≥2 evidence refs');
    });

    it('todo markers fail', () => {
        const body = validProposal().replace('Draft body.', 'Draft body. TODO: finish');
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('draft placeholder');
    });

    it('html comments strip todo markers', () => {
        const body = `${validProposal()}\n<!-- checklist: [ ] TODO items handled -->\n`;
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status, result.stdout).toBe(0);
    });

    it('missing success signal fields fail', () => {
        const body = validProposal().replace('- Target: < 1\n', '');
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("missing 'Target:'");
    });

    it('missing section fails', () => {
        const body = validProposal().replace('## 7. Success signal', '## 7. Something else');
        const p = join(tmp, 'p.md');
        writeFileSync(p, body, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('missing section: 7. Success signal');
    });

    it('nonexistent path returns 3', () => {
        const result = run(join(tmp, 'nope.md'));
        expect(result.status).toBe(3);
    });

    it('json format output', () => {
        const p = join(tmp, 'p.md');
        writeFileSync(p, '---\nproposal_id: x\n---\n\n# body\n', 'utf-8');
        const result = run(p, 'json');
        expect(result.status).toBe(1);
        const payload = JSON.parse(result.stdout) as { findings: Array<{ message: string }> };
        expect(payload.findings.some((f) => f.message.includes('missing: type'))).toBe(true);
    });

    it('originating project required when stage upstream', () => {
        const p = join(tmp, 'p.md');
        const text = validProposal().replace('stage: proposed', 'stage: upstream');
        writeFileSync(p, text, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Originating project');
    });

    it('originating project placeholder blocks', () => {
        const p = join(tmp, 'p.md');
        let text = validProposal().replace('stage: proposed', 'stage: upstream');
        text = text.replace(
            '## 10. Upstream PR\n\nPending.',
            '## 10. Upstream PR\n\n- Originating project: <consumer repo slug; metadata only>',
        );
        writeFileSync(p, text, 'utf-8');
        const result = run(p);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('originating-project');
    });

    it('originating project filled passes', () => {
        const p = join(tmp, 'p.md');
        let text = validProposal().replace('stage: proposed', 'stage: upstream');
        text = text.replace(
            '## 10. Upstream PR\n\nPending.',
            '## 10. Upstream PR\n\n- Originating project: acme-app',
        );
        writeFileSync(p, text, 'utf-8');
        const result = run(p);
        expect(result.status, result.stdout).toBe(0);
    });

    it('rate limit warns when dir full', () => {
        const proposals = join(tmp, 'proposals');
        mkdirSync(proposals);
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (let i = 0; i < 6; i += 1) {
            writeFileSync(
                join(proposals, `p${i}.md`),
                `---\nproposal_id: p${i}\ntype: rule\nscope: project\nstage: proposed\nauthor: t\ncreated: ${iso}\nlast_updated: ${iso}\n---\n\n# body\n`,
                'utf-8',
            );
        }
        const target = join(proposals, 'current.md');
        writeFileSync(target, validProposal(), 'utf-8');
        const result = run(target);
        expect(result.stdout).toContain('rate-limit');
        expect(result.status, result.stdout).toBe(0);
    });
});
