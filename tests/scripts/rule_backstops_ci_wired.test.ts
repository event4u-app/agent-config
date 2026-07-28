/**
 * A declared backstop must be reachable from CI (road-to-wiring-truth P2.3).
 *
 * The piece the previous two PRs did not add. Five gates shipped with a taskfile
 * entry and nothing else; the coverage number counted them as blocking while no
 * workflow invoked `task ci`. Both halves were fixed — the resolver now says
 * WHICH build, and `rule-backstops.yml` runs the gates — but neither fix stops
 * the next one from falling out again. This does.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { GATES } from '../../src/scripts/check_backstop_debt.js';

const REPO = path.resolve(__dirname, '..', '..');
const WF_DIR = path.join(REPO, '.github', 'workflows');

const workflowText = (): string =>
    fs
        .readdirSync(WF_DIR)
        .filter((f) => /\.ya?ml$/.test(f))
        .map((f) => fs.readFileSync(path.join(WF_DIR, f), 'utf-8'))
        .join('\n');

/** Every `validator:<path>` a rule declares, with the rule that declared it. */
function declaredValidators(): { rule: string; script: string }[] {
    const dir = path.join(REPO, 'src', 'rules');
    const out: { rule: string; script: string }[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.md')) continue;
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        const block = /enforced_by:\n((?:\s+- ".*"\n)+)/.exec(text);
        if (!block) continue;
        for (const line of (block[1] ?? '').split('\n')) {
            const m = /- "validator:(.+?)"/.exec(line);
            if (m?.[1]) out.push({ rule: name.replace(/\.md$/, ''), script: m[1] });
        }
    }
    return out;
}

/**
 * Reachable from a workflow, following one level of umbrella indirection.
 *
 * `lint_skill_frontmatter_safety` is named by no workflow and runs on every CI
 * pass as a sub-check of `lint_agent_security`, which is. Requiring a direct
 * mention would fail on a gate that genuinely runs.
 */
function ciReachable(script: string, wf: string): boolean {
    const stem = path.basename(script).replace(/\.ts$/, '');
    if (wf.includes(script) || wf.includes(stem)) return true;
    // Follow scripts the workflows DO name, and look inside them.
    const scriptsDir = path.join(REPO, 'src', 'scripts');
    for (const f of fs.readdirSync(scriptsDir)) {
        if (!f.endsWith('.ts')) continue;
        const umbrellaStem = f.replace(/\.ts$/, '');
        if (!(wf.includes(`src/scripts/${f}`) || wf.includes(umbrellaStem))) continue;
        const body = fs.readFileSync(path.join(scriptsDir, f), 'utf-8');
        if (body.includes(path.basename(script)) || body.includes(stem)) return true;
    }
    return false;
}

describe('every declared validator is reachable from a workflow', () => {
    const wf = workflowText();
    const declared = declaredValidators();

    it('finds validator declarations to check', () => {
        // Guards against the test passing because it looked at nothing.
        expect(declared.length).toBeGreaterThan(5);
    });

    for (const { rule, script } of declared) {
        it(`${rule} → ${path.basename(script)}`, () => {
            expect(
                ciReachable(script, wf),
                `${rule} declares enforced_by validator:${script}, but no workflow reaches it. ` +
                    `A backstop only a human can start is not what "can fail a build" means — ` +
                    `add it to .github/workflows/rule-backstops.yml.`,
            ).toBe(true);
        });
    }
});

describe('the debt-ratchet gates stay wired', () => {
    it('every red-on-arrival gate is covered by the ratchet step', () => {
        const wf = workflowText();
        expect(wf).toContain('check_backstop_debt');
        // The ratchet is what keeps these five reachable; if it is dropped from
        // the workflow they become invisible again in one edit.
        expect(GATES.length).toBeGreaterThan(0);
    });

    it('names the rule each red gate belongs to, so the report is legible', () => {
        for (const g of GATES) {
            expect(g.rule).toBeTruthy();
            expect(g.count.source).toBeTruthy();
        }
    });
});
