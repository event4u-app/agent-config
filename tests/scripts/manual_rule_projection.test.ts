/**
 * ADR-004 manual-rule projection contract (road-to-rule-coherence P0.3).
 *
 * `rule.schema.json` defines the type enum without ambiguity:
 *   `manual` = "no auto-injection (zero workspace-budget cost); file remains as
 *   a reference document linkable from skills/contexts."
 *
 * `compile_router` already honoured the first half — manual rules are omitted
 * from `dist/router.json`. The per-tool projection did not: it symlinked them
 * into `.claude/rules/` and emitted `.mdc` / windsurf copies, so under the
 * shipped `eager-all` projection mode their full bodies were injected every
 * session. `brand-consistency` is the sharpest case — its own body reads
 * "reference-only, no router emission" while it shipped in context regardless.
 *
 * Both halves are asserted here, because fixing one by breaking the other is the
 * obvious wrong repair: dropping the file from `dist/` would satisfy "no
 * injection" while silently breaking every inbound cross-reference.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SRC_RULES = path.join(REPO_ROOT, 'src', 'rules');
const DIST_RULES = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');

/** Per-tool trees whose contents are auto-injected by the host. */
const PROJECTION_TREES: Array<{ dir: string; ext: string }> = [
    { dir: path.join(REPO_ROOT, '.claude', 'rules'), ext: '.md' },
    { dir: path.join(REPO_ROOT, '.cursor', 'rules'), ext: '.mdc' },
    { dir: path.join(REPO_ROOT, '.windsurf', 'rules'), ext: '.md' },
];

function manualRuleStems(): string[] {
    return fs
        .readdirSync(SRC_RULES)
        .filter((f) => f.endsWith('.md'))
        .filter((f) => {
            const text = fs.readFileSync(path.join(SRC_RULES, f), 'utf-8');
            if (!text.startsWith('---\n')) return false;
            const end = text.indexOf('\n---\n', 4);
            if (end === -1) return false;
            return /^type:\s*["']?manual["']?\s*$/m.test(text.slice(4, end));
        })
        .map((f) => path.basename(f, '.md'))
        .sort();
}

describe('ADR-004 — manual rules are reference-only', () => {
    const manual = manualRuleStems();

    it('the corpus actually contains manual rules (dead-scope guard)', () => {
        // A test that iterates an empty list passes while checking nothing —
        // the repo's documented "gates that scan nothing exit green" failure.
        expect(manual.length).toBeGreaterThan(0);
    });

    for (const { dir, ext } of PROJECTION_TREES) {
        const rel = path.relative(REPO_ROOT, dir);
        it(`${rel} injects no manual rule`, () => {
            if (!fs.existsSync(dir)) {
                // Tool tree not generated in this checkout — nothing to assert,
                // and the other trees still carry the contract.
                return;
            }
            const present = manual.filter((stem) => fs.existsSync(path.join(dir, `${stem}${ext}`)));
            expect(
                present,
                `manual rules must cost zero workspace budget, but ${rel} injects: ${present.join(', ')}`,
            ).toEqual([]);
        });
    }

    it('every manual rule stays linkable in dist/agent-src/rules', () => {
        // The other half of the schema sentence. Excluding a manual rule from
        // dist would break inbound cross-references from rules and skills.
        const missing = manual.filter((stem) => !fs.existsSync(path.join(DIST_RULES, `${stem}.md`)));
        expect(missing, `manual rules must remain linkable: ${missing.join(', ')}`).toEqual([]);
    });

    it('brand-consistency is one of them — the rule that named its own violation', () => {
        expect(manual).toContain('brand-consistency');
    });
});
