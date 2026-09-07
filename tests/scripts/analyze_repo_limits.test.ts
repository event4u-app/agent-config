/**
 * Pins the `limits:` block of `analyze/repo/command.md` against its flow text,
 * and the eval fixtures against both.
 *
 * Sibling of `tests/scripts/optimize_deep_limits.test.ts`, written because that
 * one is hard-wired to a single command path: the restatement enforcement in
 * this repository is per-command, not generic, so a second `limits:` consumer
 * gets JSON-Schema shape validation and nothing else unless a test like this
 * exists. Without it the frontmatter pin and the body could drift silently,
 * which is the exact failure the schema's own description warns about
 * ("frontmatter is the pin the deterministic test reads, the body is what the
 * executing agent obeys").
 *
 * What this file does NOT claim: that the command has been run. The fixtures
 * below are scenario specifications, and the one real end-to-end observation is
 * carried to `road-to-first-reference-analysis-observation`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const COMMAND = path.join(REPO, 'src/domains/analysis-workbench/analyze/repo/command.md');
const HARVESTER = path.join(REPO, 'src/domains/analysis-workbench/analyze/roadmap-repos/command.md');
const FIXTURES = path.join(REPO, 'tests/analyze-repo/eval-fixtures.md');

const commandText = fs.readFileSync(COMMAND, 'utf-8');
const harvesterText = fs.readFileSync(HARVESTER, 'utf-8');
const fixtureText = fs.readFileSync(FIXTURES, 'utf-8');

/** Everything below the closing frontmatter fence — what the agent obeys. */
const body = commandText.split(/^---$/mu).slice(2).join('---');

function frontmatterValue(key: string): string | null {
    const fm = commandText.split(/^---$/mu)[1] ?? '';
    const m = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mu').exec(fm);
    return m ? (m[1] as string).trim() : null;
}

describe('machine-readable limits block', () => {
    it('pins the exact limit values', () => {
        expect(frontmatterValue('mode_default')).toBe('plan');
        expect(frontmatterValue('max_iterations')).toBe('3');
        expect(frontmatterValue('hard_ceiling')).toBe('5');
        expect(frontmatterValue('no_gain_stop')).toBe('2');
        expect(frontmatterValue('target_metric')).toBe('required');
    });

    it('offers the mode and loop flags in the argument hint', () => {
        const hint = String(frontmatterValue('argument-hint'));
        expect(hint).toContain('--mode=plan|execute');
        expect(hint).toContain('--loops=N');
        expect(hint).toContain('--refresh');
    });
});

describe('the body restates every line the frontmatter pins', () => {
    it('names each limit key in the body, not only in the frontmatter', () => {
        for (const key of ['mode_default', 'max_iterations', 'hard_ceiling', 'no_gain_stop', 'target_metric']) {
            expect(body, `body does not restate ${key}`).toContain(key);
        }
    });

    it('states plan as the default and execute as explicit', () => {
        expect(body).toContain('`--mode=plan` is the **default**');
        expect(body).toMatch(/`--mode=execute` must be \*\*explicitly present in the invocation\*\*/u);
    });

    it('states the loop budget and the hard ceiling', () => {
        expect(body).toMatch(/\*\*Default: 3\*\*/u);
        expect(body).toMatch(/Hard ceiling: 5 — a larger `--loops` value is clamped/u);
    });

    it('states the no-gain halt and refuses to let one zero-delta loop cancel the rest', () => {
        expect(body).toMatch(/\*\*Two consecutive zero-delta loops → STOP\*\*/u);
        expect(body).toMatch(/never\*\* cancels the remaining lenses/u);
    });

    it('requires the target metric before loop 1 and names the refusal string', () => {
        expect(body).toContain('target metric not pre-registered — record the seed-pass baseline first');
    });
});

describe('2.3 three loops, three different lenses', () => {
    it('names all three lenses and gives each its own question', () => {
        for (const lens of ['Coverage', 'Adversary', 'Convergence']) {
            expect(body).toContain(lens);
        }
    });

    it('requires a delta block per loop and forbids omitting a zero-delta one', () => {
        expect(body).toMatch(/recorded as a zero-delta loop, never omitted/u);
        expect(body).toContain('added / removed / flipped / folded');
    });

    it('feeds each loop both the previous analysis and the previous roadmap', () => {
        expect(body).toMatch(/\*\*both\*\* the previous analysis \*\*and\*\* the previous\nroadmap draft/u);
    });
});

describe('2.4 the target metric is a decision-quality measure', () => {
    it('is the count of both-sided file:line rows, not an output-volume count', () => {
        expect(body).toMatch(/count of ADOPT\/ADAPT rows carrying a concrete `file:line` on \*\*both\*\*/u);
        expect(body).toContain('Not the number of rows');
    });
});

describe('2.5 the scope menu is gone', () => {
    it('asks nothing before the first fetch', () => {
        expect(body).not.toContain("Wait for the user's choice");
        expect(body).toMatch(/\*\*Ask nothing before the\nfirst fetch\.\*\*/u);
    });

    it('keeps the one question the invocation did not answer', () => {
        expect(body).toMatch(/unresolvable repository identity/u);
    });

    it('keeps the write-act confirmations', () => {
        expect(body).toContain('Never create the roadmap without explicit confirmation.');
    });
});

describe('2.2 the upstream revision is pinned once', () => {
    it('resolves once in the seed pass and only --refresh re-resolves', () => {
        expect(body).toMatch(/resolves the reference's head revision exactly once/u);
        expect(body).toMatch(/Only `--refresh` re-resolves it/u);
    });

    it('makes --deep the default whenever the loop runs, with a read-ceiling line', () => {
        expect(body).toMatch(/`--deep` \(§ 2b\) is the default whenever the loop runs/u);
        expect(body).toMatch(/logs \*\*one\*\* read-ceiling line/u);
    });
});

describe('Phase 3 — the output stops naming its source', () => {
    it('writes under an opaque id in the gitignored local area', () => {
        expect(body).toContain('agents/.harvest-local/repo/<opaque-id>/analysis.md');
        expect(body).not.toContain('agents/evidence/analysis/compare-<slug>.md`.');
    });

    it('names the landed roadmap after the defect, never the source', () => {
        expect(body).toMatch(/road-to-<the-thing-we-lack>\.md/u);
        expect(body).toMatch(/It contains neither the\n {2}owner nor the repository name/u);
    });

    it('never passes a plaintext URL to a subagent', () => {
        expect(body).toMatch(/\*\*the opaque id and nothing else\*\*/u);
        expect(harvesterText).toMatch(/never a resolved URL/u);
    });

    it('takes the indirection on precaution rather than on a proven threat', () => {
        expect(body).toContain('host-dependent and was not verifiable from this tree');
    });
});

describe('the harvester carries no analysis instruction', () => {
    it('says so, and routes every analysis reference at analyze-repo', () => {
        expect(harvesterText).toContain('contains no analysis instruction and never will');
        expect(harvesterText).not.toContain('analyze-reference-repo');
    });

    it('dispatches one subagent per repository, sequentially', () => {
        expect(harvesterText).toMatch(/\*\*Sequential, never a fan-out\.\*\*/u);
    });

    it('lands its consolidated result local-only, per the recorded decision', () => {
        expect(harvesterText).toMatch(/No per-run consolidate roadmap takes an active top-level estate\nslot/u);
    });
});

describe('the cluster head permits exactly one chain exception', () => {
    const head = fs.readFileSync(path.join(REPO, 'src/domains/analysis-workbench/analyze/command.md'), 'utf-8');

    it('still forbids chaining in general', () => {
        expect(head).toContain('**Do NOT chain sub-commands.**');
    });

    it('names roadmap-repos as the only exception, invoking only repo', () => {
        expect(head).toMatch(/\*\*Exactly one\n {2}exception:\*\* `roadmap-repos` invokes `repo`/u);
        expect(head).toMatch(/it may\n {2}invoke only `repo`/u);
    });

    it('routes to both commands', () => {
        expect(head).toMatch(/routes_to:.*analyze-repo,\s*analyze-roadmap-repos/u);
    });
});

describe('eval fixtures cover the decidable contract', () => {
    it('carries every fixture id', () => {
        for (let i = 1; i <= 10; i++) {
            expect(fixtureText, `missing arl-${i}`).toContain(`### arl-${i} `);
        }
    });

    it('carries the four decidable patterns', () => {
        for (const p of ['**P1 (lens line):**', '**P2 (zero-delta line):**', '**P3 (halt line):**', '**P4 (metric line):**']) {
            expect(fixtureText).toContain(p);
        }
    });

    it('pins the two fixtures whose steps close on them', () => {
        // 2.4 — a zero-delta loop 1 must not cancel loop 2.
        expect(fixtureText).toMatch(/arl-4 — zero-delta loop 1 does NOT cancel loop 2/u);
        expect(fixtureText).toMatch(/loop 2 \(Adversary\) then runs/u);
        // 2.5 — an explicit repository argument asks nothing before the fetch.
        expect(fixtureText).toMatch(/arl-2 — no scope prompt before the first fetch/u);
        expect(fixtureText).toMatch(/first external action is a fetch/u);
    });

    it('does not claim a run happened', () => {
        expect(fixtureText).toContain('They are not a run');
    });
});
