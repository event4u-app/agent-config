// Fixture tests for `src/scripts/lint_consumer_internal_refs.ts`.
//
// The skill-script half of this gate is checked here: the form a consumer is
// told to type, and the scope boundary that keeps a reference file naming a
// MAINTAINER script out of it. That boundary is the reason the gate reads
// `references/` for one pattern rather than all of them, and a boundary that
// is assumed rather than measured is how a widening reds a tree nobody meant
// to touch.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scanSkillScriptForm, scanText } from '../../src/scripts/lint_consumer_internal_refs.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROJECTION = path.join(REPO, 'dist', 'agent-src', 'skills');

/**
 * Reference files that name the maintainer dispatcher. They are a different
 * class — a script you run while working on this package, not one an install
 * deploys — and this gate does not decide them. Listed so the exclusion is a
 * recorded set rather than a silence.
 */
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

    it('leaves a maintainer-script reference alone — and those references still exist', () => {
        const stillThere: string[] = [];
        for (const rel of MAINTAINER_SCRIPT_REFERENCES) {
            const abs = path.join(PROJECTION, rel);
            expect(fs.existsSync(abs), `${rel} must exist, or this exclusion is stale`).toBe(true);
            const text = fs.readFileSync(abs, 'utf-8');
            if (text.includes('./scripts-run')) stillThere.push(rel);
            expect(scanSkillScriptForm(rel, text), `${rel} is not the skill-script form`).toEqual([]);
        }
        // Not a repair this gate owes — a recorded residue, so that a later
        // widening has to argue with a number instead of discovering one.
        expect(stillThere).toEqual([...MAINTAINER_SCRIPT_REFERENCES]);
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
