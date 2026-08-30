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

import {
    PRESERVED_KEYS,
    renderClaudeRule,
    rewriteAndReport,
    rewriteClaudeRules,
} from '../../src/install/claudeRuleRewrite.js';
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
        expect(res).toEqual({ rewritten: 0, scoped: [], dropped: [], failed: [] });
    });
});

describe('the package ownership tag survives the rewrite', () => {
    /**
     * Regression for the high finding of 2026-08-30.
     *
     * `_inject_package_tag` writes `package:` during the copy that runs
     * immediately before this rewrite, and `reap_tagged_orphans` matches on
     * that literal line — its own docblock calls itself the only path with
     * ownership proof independent of inventory history. A rewrite that rebuilt
     * each file from the activation plan alone deleted the reaper's only
     * evidence for the whole subtree, and doctor's stale-orphan check read `ok`
     * there permanently.
     */
    const TAGGED_SCOPED =
        '---\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/x.md\n' +
        'type: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n';
    const TAGGED_UNSCOPED =
        '---\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/y.md\n' +
        'type: auto\ntriggers:\n  - keyword: "design"\n---\n\nBody.\n';

    it('keeps package: and source_path: on a SCOPED rule, beside paths:', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-tag-a-'));
        try {
            fs.writeFileSync(path.join(dir, 'scoped.md'), TAGGED_SCOPED);
            rewriteClaudeRules(dir);
            const out = fs.readFileSync(path.join(dir, 'scoped.md'), 'utf-8');
            expect(out).toContain('package: event4u/agent-config');
            expect(out).toContain('source_path: dist/agent-src/rules/x.md');
            expect(out).toContain('paths:');
            expect(out).toContain('- "*.vue"');
            // The activation vocabulary the host cannot read is still gone.
            expect(out).not.toContain('triggers:');
            expect(out).not.toContain('type: auto');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('keeps them on an UNSCOPED rule too, which has no paths: block to hang them on', () => {
        // The case that carries the defect for 101 of the 104 delivered rules:
        // a mixed-trigger rule renders with no frontmatter at all, so without
        // this it loses the tag entirely.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-tag-b-'));
        try {
            fs.writeFileSync(path.join(dir, 'mixed.md'), TAGGED_UNSCOPED);
            rewriteClaudeRules(dir);
            const out = fs.readFileSync(path.join(dir, 'mixed.md'), 'utf-8');
            expect(out).toContain('package: event4u/agent-config');
            expect(out).not.toContain('paths:');
            expect(out).not.toContain('triggers:');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('carries every declared PRESERVED_KEY, so adding one cannot be forgotten here', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-tag-c-'));
        try {
            const fm = PRESERVED_KEYS.map((k) => `${k}: value-of-${k}`).join('\n');
            fs.writeFileSync(
                path.join(dir, 'r.md'),
                `---\n${fm}\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n`,
            );
            rewriteClaudeRules(dir);
            const out = fs.readFileSync(path.join(dir, 'r.md'), 'utf-8');
            for (const k of PRESERVED_KEYS) expect(out).toContain(`${k}: value-of-${k}`);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('is still idempotent once the tag is in the output', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-tag-d-'));
        try {
            const f = path.join(dir, 'scoped.md');
            fs.writeFileSync(f, TAGGED_SCOPED);
            rewriteClaudeRules(dir);
            const first = fs.readFileSync(f, 'utf-8');
            const second = rewriteClaudeRules(dir);
            expect(fs.readFileSync(f, 'utf-8')).toBe(first);
            expect(second.rewritten).toBe(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('an unwritable rule does not abort the install', () => {
    it('records the failure and keeps going', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ro-'));
        try {
            const bad = path.join(dir, 'a-locked.md');
            const good = path.join(dir, 'b-fine.md');
            const src = '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n---\n\nBody.\n';
            fs.writeFileSync(bad, src);
            fs.writeFileSync(good, src);
            fs.chmodSync(bad, 0o444);

            const res = rewriteClaudeRules(dir);

            // The unwritable one is reported, not thrown...
            expect(res.failed.map((f) => f.rule)).toEqual(['a-locked']);
            // ...and the one after it in sort order was still rewritten, which
            // is the property that matters: an EACCES on one rule used to skip
            // every remaining tool, the inventory record and the lockfile.
            expect(res.rewritten).toBe(1);
            expect(fs.readFileSync(good, 'utf-8')).toContain('paths:');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('install reporting is one counted line, not one per pattern', () => {
    it('collapses the by-design dropped patterns and respects quiet', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rep-'));
        try {
            for (const n of ['m1', 'm2']) {
                fs.writeFileSync(
                    path.join(dir, `${n}.md`),
                    '---\ntype: auto\ntriggers:\n  - file_pattern: "*.vue"\n' +
                        '  - file_pattern: "*.jsx"\n  - keyword: "design"\n---\n\nBody.\n',
                );
            }
            const loud: string[] = [];
            const res = rewriteAndReport(dir, false, (m) => loud.push(m), (m) => loud.push(m));
            // Four dropped patterns across two rules...
            expect(res.dropped.length).toBe(4);
            // ...and no line is emitted per pattern.
            expect(loud.filter((l) => l.includes('unconditional activation')).length).toBe(1);

            const quiet: string[] = [];
            rewriteAndReport(dir, true, (m) => quiet.push(m), (m) => quiet.push(m));
            expect(quiet).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
