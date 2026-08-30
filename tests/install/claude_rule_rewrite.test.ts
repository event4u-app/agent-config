/**
 * The installer's Claude host-form rewrite must produce byte-identical output
 * to the maintainer projection's `_emit_claude_rule`.
 *
 * Two emitters now shape rules for the same host from opposite sides of the
 * pipeline — `condense.ts` on the projection path, `claudeRuleRewrite.ts` on
 * the install path. They deliberately do not share a call: the installer must
 * not pull the projection graph into its bundle, which is the same reason
 * `claudePathsPlan.ts` was extracted in the first place.
 *
 * So the invariant is held HERE instead. If the two ever disagree on any rule
 * in `src/rules/`, this fails rather than shipping two different activation
 * surfaces to one host.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderClaudeRule, rewriteClaudeRules } from '../../src/install/claudeRuleRewrite.js';
import { _emit_claude_rule } from '../../src/scripts/condense.js';

const REPO_ROOT = path.resolve(__dirname, '../..');
const RULES_DIR = path.join(REPO_ROOT, 'src/rules');

function ruleFiles(): string[] {
    return fs
        .readdirSync(RULES_DIR)
        .filter((n) => n.endsWith('.md'))
        .sort();
}

describe('claudeRuleRewrite ↔ condense._emit_claude_rule equivalence', () => {
    it('has rules to compare — a green run over an empty set proves nothing', () => {
        expect(ruleFiles().length).toBeGreaterThan(50);
    });

    it('renders byte-identically to the projection emitter for every rule', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rule-eq-'));
        try {
            const mismatches: string[] = [];
            for (const name of ruleFiles()) {
                const src = path.join(RULES_DIR, name);
                const viaCondense = path.join(tmp, name);
                _emit_claude_rule(src, viaCondense);
                const expected = fs.readFileSync(viaCondense, 'utf-8');
                const actual = renderClaudeRule(fs.readFileSync(src, 'utf-8')).text;
                if (actual !== expected) mismatches.push(name);
            }
            expect(mismatches).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('rewriteClaudeRules', () => {
    it('emits paths: for a path-only rule and nothing for a mixed one', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rule-rw-'));
        try {
            fs.writeFileSync(
                path.join(tmp, 'path-only.md'),
                '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n',
            );
            fs.writeFileSync(
                path.join(tmp, 'mixed.md'),
                '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n  - keyword: "design"\n---\n\nBody.\n',
            );
            const res = rewriteClaudeRules(tmp);

            expect(res.scoped).toEqual(['path-only']);
            expect(fs.readFileSync(path.join(tmp, 'path-only.md'), 'utf-8')).toBe(
                '---\npaths:\n  - "*.vue"\n---\n\nBody.\n',
            );
            // Mixed triggers must NOT become path-gated: `paths:` is exclusive
            // on this host, so emitting it would silence the rule on exactly
            // the keyword prompts it was written for.
            expect(fs.readFileSync(path.join(tmp, 'mixed.md'), 'utf-8')).toBe('Body.\n');
            expect(res.dropped.map((d) => d.rule)).toContain('mixed');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('is idempotent — a second pass does not strip the paths: block it wrote', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rule-idem-'));
        try {
            const f = path.join(tmp, 'path-only.md');
            fs.writeFileSync(f, '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n');
            rewriteClaudeRules(tmp);
            const afterFirst = fs.readFileSync(f, 'utf-8');
            const second = rewriteClaudeRules(tmp);
            expect(fs.readFileSync(f, 'utf-8')).toBe(afterFirst);
            expect(second.rewritten).toBe(0);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('never writes through a symlink — the legacy raw-md farm is left alone', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rule-link-'));
        try {
            const realSrc = path.join(tmp, 'source.md');
            fs.writeFileSync(realSrc, '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n');
            const linkDir = path.join(tmp, 'linked');
            fs.mkdirSync(linkDir);
            fs.symlinkSync(realSrc, path.join(linkDir, 'source.md'));

            const res = rewriteClaudeRules(linkDir);
            expect(res.rewritten).toBe(0);
            expect(fs.readFileSync(realSrc, 'utf-8')).toContain('triggers:');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('returns an empty result for a missing directory rather than throwing', () => {
        const res = rewriteClaudeRules(path.join(os.tmpdir(), 'definitely-not-here-9f3a2'));
        expect(res).toEqual({ rewritten: 0, scoped: [], dropped: [] });
    });
});
