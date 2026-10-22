// Fixture tests for `src/scripts/lint_consumer_internal_refs.ts`.
//
// The skill-script half of this gate is checked here: the form a consumer is
// told to type. The gate reads `references/` and the context projection with
// every pattern — the five reference files that used to tell a consumer to run
// the maintainer-only dispatcher are repaired, and pinned below as repaired.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { main, scanContext, scanSkillScriptForm, scanText } from '../../src/scripts/lint_consumer_internal_refs.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROJECTION = path.join(REPO, 'dist', 'agent-src', 'skills');

/** Reference files that named the maintainer dispatcher until they were repaired; they must stay clean. */
const MAINTAINER_SCRIPT_REFERENCES: readonly string[] = [
    'ai-council/references/cost-and-redaction.md',
    'git-workflow/references/commit-subject.md',
    'git-workflow/references/push-closes-its-loop.md',
    'skill-writing/references/procedure.md',
    'skill-writing/references/section-patterns.md',
];

describe('references-and-allowlist: the skill-script form, and what it deliberately does not reach', () => {
    it('flags the old wrapper form in a reference file', () => {
        const text = [
            'Ground the decision first:',
            '',
            '```bash',
            './scripts-run <skills-root>/corpus-grounding/scripts/ground search \\',
            '  --manifest <skills-root>/brand/data/manifest.json "luxury"',
            '```',
        ].join('\n');
        const findings = scanSkillScriptForm('fixture/references/ground.md', text);
        expect(findings.length, findings.join('\n')).toBe(2);
        expect(findings[0]).toContain('`./scripts-run`, not `node`');
        expect(findings[1]).toContain('the shipped entry point is the `.mjs`');
    });

    it('flags a wrapped command whose runner sits on the line above', () => {
        const text = ['> decisions come grounded — `./scripts-run', '> <skills-root>/database/scripts/ground.mjs search`'].join('\n');
        const findings = scanSkillScriptForm('fixture/SKILL.md', text);
        expect(findings.length, findings.join('\n')).toBe(1);
        expect(findings[0]).toContain('`./scripts-run`, not `node`');
    });

    it('flags a path with no runner in front of it at all', () => {
        const text = ['```bash', '<skills-root>/design-tokens/scripts/tokens.mjs generate', '```'].join('\n');
        const findings = scanSkillScriptForm('fixture/SKILL.md', text);
        expect(findings.length, findings.join('\n')).toBe(1);
        expect(findings[0]).toContain('runner is absent');
    });

    it('passes the repaired form, wrapped or not', () => {
        const text = [
            '```bash',
            'node <skills-root>/corpus-grounding/scripts/ground.mjs search \\',
            '  --manifest <skills-root>/brand/data/manifest.json "luxury"',
            '```',
            '',
            '> and also — `node',
            '> <skills-root>/design-tokens/scripts/tokens.mjs validate --dir src/`',
        ].join('\n');
        expect(scanSkillScriptForm('fixture/SKILL.md', text)).toEqual([]);
    });

    it('the reference files that told a consumer to run ./scripts-run no longer do, under every pattern', () => {
        const stillThere: string[] = [];
        for (const rel of MAINTAINER_SCRIPT_REFERENCES) {
            const abs = path.join(PROJECTION, rel);
            expect(fs.existsSync(abs), `${rel} must exist`).toBe(true);
            const text = fs.readFileSync(abs, 'utf-8');
            if (text.includes('./scripts-run')) stillThere.push(rel);
            expect(scanText(rel.split('/')[0] as string, rel, text), rel).toEqual([]);
            expect(scanSkillScriptForm(rel, text), `${rel} is not the skill-script form`).toEqual([]);
        }
        expect(stillThere).toEqual([]);
    });

    it('a context is read with every pattern plus the docs link, and not the Taskfile verb', () => {
        expect(scanContext('c.md', 'see [ADR-1](../../../docs/decisions/ADR-1.md)')).toHaveLength(1);
        expect(scanContext('c.md', 'run `./scripts-run src/scripts/x`')).toHaveLength(2);
        expect(scanContext('c.md', 'pinned in `tests/scripts/x.test.ts`')).toHaveLength(1);
        // A consumer's `task ci` is the subject of the CI-step policy, not an instruction.
        expect(scanContext('c.md', 'a step reading `task ci` is CI-shaped')).toEqual([]);
        // `agent-src/scripts/` is not this package's `src/scripts/`.
        expect(scanContext('c.md', 'the curated `dist/agent-src/scripts/` list')).toEqual([]);
        expect(scanContext('c.md', 'see `node_modules/@event4u/agent-config/src/scripts/x.ts`')).toEqual([]);
    });

    it('the shipped skill and context projection carries no consumer-internal reference', () => {
        expect(main()).toBe(0);
    });

    it('carries no allowlist: the wrapper pattern fires on every skill alike', () => {
        const line = 'run `./scripts-run <skills-root>/corpus-grounding/scripts/ground search`';
        for (const skill of ['corpus-grounding', 'brand', 'threat-modeling', 'some-skill-that-never-existed']) {
            const findings = scanText(skill, `${skill}/SKILL.md`, line);
            expect(findings.length, `${skill} must not be exempt`).toBe(1);
            expect(findings[0]).toContain('maintainer-only `./scripts-run` dispatcher');
        }
    });

    it('flags an invocation through the TypeScript loader binary', () => {
        const findings = scanText('brand', 'brand/SKILL.md', 'node_modules/.bin/tsx <skills-root>/x/scripts/y.ts');
        expect(findings.some((f) => f.includes('node_modules/.bin/tsx'))).toBe(true);
    });
});
