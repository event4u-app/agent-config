/**
 * Shipped text must not grow the consumer-fragile invocation
 * `npx tsx node_modules/@event4u/agent-config/src/<script>.ts`.
 *
 * It fails on a global or ephemeral install (there is no `node_modules/` path
 * to name) and `tsx` is a dev dependency, so `npx` fetches it from the registry.
 * PR #2367 proved the working form with a packed install
 * (tests/test_release_install_e2e.sh § consumer-ci-settle):
 * `npm exec --no -- agent-config <verb>`.
 *
 * No verb covers the remaining sites yet, and adding verbs moves the CLI
 * command budget, so they are pinned here as a ratchet rather than banned:
 * a new site, or a file gaining one, reds; a converted site must shrink the
 * baseline in the same change.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FRAGILE = 'npx tsx node_modules/@event4u/agent-config/src/';

// Markdown is what an agent reads and runs; other src/ files name the string
// only in prose (e.g. a budget note recording why ci:settle became a verb).
const BASELINE: Record<string, number> = {
    'src/domains/engineering-base/design-system/generate/command.md': 1,
    'src/domains/engineering-base/design-system/import/command.md': 1,
    'src/domains/git/pr/create/command.md': 1,
    'src/domains/meta/sync/gitignore/fix/command.md': 2,
    'src/skills/agent-security-review/SKILL.md': 1,
    'src/skills/design-review/SKILL.md': 1,
    'src/skills/design-system-capture/references/design-system-json.md': 1,
    'src/skills/forensics-report/SKILL.md': 2,
    'src/skills/git-workflow/SKILL.md': 1,
    'src/skills/humanizer/SKILL.md': 1,
    'src/skills/launch-readiness/SKILL.md': 2,
    'src/skills/license-compliance-borrow-check/SKILL.md': 2,
    'src/skills/license-compliance-credits/SKILL.md': 3,
    'src/skills/prediction-pool-optimizer/SKILL.md': 4,
    'src/skills/project-analysis-core/SKILL.md': 2,
    'src/skills/schema-review/SKILL.md': 1,
    'src/skills/source-discovery/SKILL.md': 5,
    'src/skills/svg-authoring/SKILL.md': 2,
    'src/skills/systematic-debugging/SKILL.md': 2,
    'src/skills/worktree-lifecycle/SKILL.md': 2,
    'src/subagents/production-validator.md': 1,
};

function markdownUnder(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...markdownUnder(full));
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

function fragileSites(): Record<string, number> {
    const found: Record<string, number> = {};
    for (const file of markdownUnder(path.join(ROOT, 'src'))) {
        const n = fs.readFileSync(file, 'utf8').split(FRAGILE).length - 1;
        if (n > 0) found[path.relative(ROOT, file).split(path.sep).join('/')] = n;
    }
    return found;
}

describe('consumer-fragile invocations in shipped text', () => {
    it('no file names more `npx tsx node_modules/...` invocations than its baseline', () => {
        const grown = Object.entries(fragileSites())
            .filter(([rel, n]) => n > (BASELINE[rel] ?? 0))
            .map(([rel, n]) => `${rel}: ${n} (baseline ${BASELINE[rel] ?? 0})`);
        expect(grown, 'use `npm exec --no -- agent-config <verb>`').toEqual([]);
    });

    it('a converted site shrinks the baseline in the same change', () => {
        const found = fragileSites();
        const stale = Object.entries(BASELINE)
            .filter(([rel, n]) => (found[rel] ?? 0) < n)
            .map(([rel, n]) => `${rel}: ${found[rel] ?? 0} (baseline ${n})`);
        expect(stale).toEqual([]);
    });
});
