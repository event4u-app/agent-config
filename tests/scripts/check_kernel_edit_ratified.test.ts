import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    classifyPaths,
    configuredProviderCount,
    evaluate,
    POLICY_PATH,
    ratificationArtifactsIn,
    READER_PATH,
    requiresRatification,
    SELF_PATH,
    WORKFLOW_PATH,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';

/**
 * Fixture G15 and its polarity partner.
 *
 * The gate replaces a tool-call deny, so the property that matters is not "it
 * can red" but "it reds exactly the diffs the deny used to refuse, plus the
 * decomposed ones the deny missed, and nothing else". Every test below pins
 * one of the two directions; a test file that only proved the red would
 * certify a gate that reds on everything.
 */

let root: string;

function writeArtifact(name: string, fields: Record<string, string>, providers: string[]): string {
    const rel = path.join(RATIFICATION_DIR, name);
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const lines = ['---'];
    for (const [k, v] of Object.entries(fields)) {
        lines.push(`${k}: ${v}`);
    }
    lines.push('providers:');
    for (const p of providers) {
        lines.push(`  - ${p}`);
    }
    lines.push('---', '', '<!-- evidence-type: ratification -->', '', 'Review body.', '');
    fs.writeFileSync(abs, lines.join('\n'));
    return rel;
}

const GOOD = {
    proposed_by: 'claude/session-a',
    implemented_by: 'claude/session-a',
    reviewed_by: 'openai/gpt-5',
    verdict: 'ratified',
    effective_after: 'merge',
};

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('classifyPaths', () => {
    it('matches a kernel rule in the source tree', () => {
        expect(classifyPaths(['src/rules/commit-policy.md']).kernelRules).toEqual([
            'src/rules/commit-policy.md',
        ]);
    });

    it('matches a kernel rule in every projection, not only the source', () => {
        for (const p of [
            '.claude/rules/scope-control.md',
            '.augment/rules/direct-answers.md',
            'dist/agent-src/rules/no-cheap-questions.md',
        ]) {
            expect(classifyPaths([p]).kernelRules, p).toEqual([p]);
        }
    });

    it('does NOT match a non-kernel rule', () => {
        expect(classifyPaths(['src/rules/git-history-discipline.md']).kernelRules).toEqual([]);
    });

    it('does NOT match a kernel-named file outside a rules/ directory', () => {
        for (const p of ['docs/staging/commit-policy.md', 'tests/fixtures/scope-control.md']) {
            expect(classifyPaths([p]).kernelRules, p).toEqual([]);
        }
    });

    it('matches a governance hook and not an ordinary one', () => {
        expect(classifyPaths(['src/scripts/hooks/block_no_verify.ts']).governanceHooks).toEqual([
            'src/scripts/hooks/block_no_verify.ts',
        ]);
        expect(classifyPaths(['src/scripts/hooks/chain_nudge_hook.ts']).governanceHooks).toEqual(
            [],
        );
    });

    it('matches every part of the mechanism, not only the gate file', () => {
        // Round 1: self-inclusion buys nothing if the reader or the quorum
        // policy can be weakened beside it. Round 3 added the workflow that
        // invokes the gate — one more level, and named as not an anchor.
        for (const p of [SELF_PATH, READER_PATH, POLICY_PATH, WORKFLOW_PATH]) {
            expect(classifyPaths([p]).self, p).toBe(true);
            expect(requiresRatification(classifyPaths([p])), p).toBe(true);
        }
        // …and an unrelated workflow is not the mechanism.
        expect(classifyPaths(['.github/workflows/tests.yml']).self).toBe(false);
    });

    it('normalises Windows separators rather than missing the path', () => {
        expect(classifyPaths(['src\\rules\\commit-policy.md']).kernelRules).toHaveLength(1);
    });
});

describe('ratificationArtifactsIn', () => {
    it('finds artifacts in the directory and ignores lookalikes elsewhere', () => {
        const files = [
            `${RATIFICATION_DIR}/1981.md`,
            'agents/evidence/analysis/1981.md',
            `${RATIFICATION_DIR}/notes.txt`,
        ];
        expect(ratificationArtifactsIn(files)).toEqual([`${RATIFICATION_DIR}/1981.md`]);
    });
});

describe('evaluate — G15', () => {
    it('an ungated diff passes and says nothing was to ratify', () => {
        const r = evaluate(['README.md', 'docs/architecture.md'], root, 2);
        expect(r.exitCode).toBe(0);
        expect(r.lines.join('\n')).toContain('nothing to ratify');
    });

    it('a kernel edit with NO artifact is refused', () => {
        const r = evaluate(['src/rules/commit-policy.md'], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('no ratification artifact');
    });

    it('a kernel edit WITH a valid ratified artifact passes', () => {
        const rel = writeArtifact('1981.md', GOOD, ['anthropic', 'openai']);
        const r = evaluate(['src/rules/commit-policy.md', rel], root, 2);
        expect(r.exitCode).toBe(0);
        expect(r.lines.join('\n')).toContain('ratified by openai/gpt-5');
    });

    it('an authority-expanding edit is INERT before ratification and live after', () => {
        // The two halves of G15 over one and the same diff — the only thing
        // that differs between them is the artifact's verdict.
        const diff = ['src/rules/non-destructive-by-default.md'];

        const pending = writeArtifact(
            'pending.md',
            { ...GOOD, verdict: 'non-convergent' },
            ['anthropic', 'openai'],
        );
        expect(evaluate([...diff, pending], root, 2).exitCode).toBe(1);

        const ratified = writeArtifact('ratified.md', GOOD, ['anthropic', 'openai']);
        expect(evaluate([...diff, ratified], root, 2).exitCode).toBe(0);
    });

    it('refuses a self-ratified artifact even though it says `ratified`', () => {
        const rel = writeArtifact(
            'self.md',
            { ...GOOD, proposed_by: 'claude/x', implemented_by: 'claude/x', reviewed_by: 'claude/x' },
            ['anthropic', 'openai'],
        );
        const r = evaluate(['src/rules/commit-policy.md', rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('may not record the ratification');
    });

    it('refuses a single-provider artifact when two are required', () => {
        const rel = writeArtifact('single.md', GOOD, ['anthropic']);
        expect(evaluate(['src/rules/commit-policy.md', rel], root, 2).exitCode).toBe(1);
    });

    it('accepts the same artifact when only one provider is required', () => {
        const rel = writeArtifact('single.md', GOOD, ['anthropic']);
        expect(evaluate(['src/rules/commit-policy.md', rel], root, 1).exitCode).toBe(0);
    });

    // Round 1 refused the opposite behaviour. An unreadable policy used to
    // PASS with a printed disclaimer; a control that passes when it cannot
    // measure is advisory, so it now refuses.
    it('FAILS CLOSED when the required provider count cannot be read', () => {
        const rel = writeArtifact('good.md', GOOD, ['anthropic', 'openai']);
        const r = evaluate(['src/rules/commit-policy.md', rel], root, null);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('fails closed');
    });

    it('refuses an artifact listed in the diff but absent from disk', () => {
        const r = evaluate(
            ['src/rules/commit-policy.md', `${RATIFICATION_DIR}/ghost.md`],
            root,
            2,
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('not readable on disk');
    });

    it('`confirmed-non-expanding` lets a diff land without calling it a ratification', () => {
        // Round 1 (codex-default): demanding an artifact for a typo fix and
        // then labelling it `ratified` is a false record, and a vocabulary that
        // forces a false label is one people route around.
        const rel = writeArtifact(
            'typo.md',
            { ...GOOD, verdict: 'confirmed-non-expanding' },
            ['anthropic', 'openai'],
        );
        expect(evaluate(['src/rules/commit-policy.md', rel], root, 2).exitCode).toBe(0);
    });

    it('`refused` and `non-convergent` do NOT let a diff land', () => {
        for (const verdict of ['refused', 'non-convergent']) {
            const rel = writeArtifact(`${verdict}.md`, { ...GOOD, verdict }, [
                'anthropic',
                'openai',
            ]);
            expect(evaluate(['src/rules/commit-policy.md', rel], root, 2).exitCode, verdict).toBe(
                1,
            );
        }
    });

    it('the shipped policy file parses and requires at least two providers', () => {
        // The gate is only fail-closed in practice if the committed policy is
        // actually readable — an unparseable one would red every kernel PR.
        const repo = path.resolve(__dirname, '..', '..');
        expect(configuredProviderCount(repo)).toBeGreaterThanOrEqual(2);
    });

    it('an absent policy tree yields null, which the gate turns into a refusal', () => {
        expect(configuredProviderCount(root)).toBeNull();
    });

    it('the ledger accounts for every path it was given', () => {
        const rel = writeArtifact('1981.md', GOOD, ['anthropic', 'openai']);
        const files = ['README.md', 'src/rules/commit-policy.md', rel, 'docs/x.md'];
        const r = evaluate(files, root, 2);
        expect(r.scanned).toBe(files.length);
        expect(r.lines.join('\n')).toContain(`planned ${files.length}`);
    });
});
