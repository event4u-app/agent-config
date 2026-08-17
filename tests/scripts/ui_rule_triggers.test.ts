/**
 * `ui_rule_triggers` — the two UI rules must reach a non-Laravel consumer.
 *
 * Both rules shipped with `resources/views/` and `resources/js/` as their only
 * path triggers. A React, Vue, Next or Svelte project writing to
 * `src/components/` matched no path trigger at all, leaving two prompt
 * keywords as the entire routing surface for the whole ecosystem the design
 * skills were written for.
 *
 * The negative half matters as much: a trigger that fires on the Laravel
 * backend directory would be worse than the gap. `app/` is therefore absent
 * by design and this test pins that, so a later "let's also add app/" edit
 * has to argue with a failing test rather than with a comment.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isUiPath } from '../../src/scripts/_lib/ui_surface.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const RULES = ['ui-audit-gate', 'design-review-after-ui-write'] as const;

function frontmatterOf(rule: string): string {
    const body = fs.readFileSync(path.join(REPO_ROOT, 'src', 'rules', `${rule}.md`), 'utf-8');
    const end = body.indexOf('\n---', 3);
    return body.slice(3, end);
}

function triggerValues(rule: string, kind: 'path_prefix' | 'file_pattern' | 'keyword'): string[] {
    const out: string[] = [];
    for (const line of frontmatterOf(rule).split('\n')) {
        const match = new RegExp(`^\\s*-\\s*${kind}:\\s*"(.+)"\\s*$`).exec(line);
        if (match) out.push(match[1]!);
    }
    return out;
}

describe.each(RULES)('%s', (rule) => {
    it('keeps the Laravel prefixes it already had', () => {
        const prefixes = triggerValues(rule, 'path_prefix');
        expect(prefixes).toContain('resources/views/');
        expect(prefixes).toContain('resources/js/');
    });

    it('reaches component trees outside Laravel', () => {
        const prefixes = triggerValues(rule, 'path_prefix');
        expect(prefixes).toContain('components/');
        expect(prefixes).toContain('src/components/');
        expect(prefixes).toContain('pages/');
    });

    it('carries file patterns for the component file types', () => {
        const patterns = triggerValues(rule, 'file_pattern');
        for (const pattern of ['*.vue', '*.svelte', '*.tsx', '*.jsx', '*.blade.php']) {
            expect(patterns).toContain(pattern);
        }
    });

    it('does not take `app/` as a path prefix', () => {
        // In a Laravel consumer that is the entire backend.
        expect(triggerValues(rule, 'path_prefix')).not.toContain('app/');
    });

    /**
     * Replaces `keeps the prompt keywords as the host-independent fallback`
     * (retired 2026-08-17, road-to-mixed-trigger-activation-cost Phase 2).
     *
     * That assertion pinned `component` / `design token` as keyword triggers, and
     * its reason is this file's own docblock: the rules once shipped with
     * `resources/views/` and `resources/js/` as their ONLY path triggers, so a
     * React/Vue/Next/Svelte project matched nothing and the two keywords were the
     * entire routing surface. That gap is closed — the rules now carry
     * `components/`, `src/components/` and `pages/` plus five file patterns, and
     * the assertions here pin them.
     *
     * Retired as a `decision-revisit-gate` mechanism-match miss rather than as an
     * override: the lock asked "is there any non-Laravel routing surface", and the
     * answer is now yes by a different mechanism. Measured before removing it,
     * because "host-independent" was the load-bearing word and it does not hold —
     * no host's activation surface reads a keyword:
     *   - Cursor `.mdc` → `description` + `globs` + `alwaysApply`
     *   - Windsurf      → `trigger: glob` + `globs`
     *   - Claude        → `paths:` only, and with ONE keyword present the emitter
     *                     writes no `paths:` at all, which is what kept both rules
     *                     loading in every session since 12.1.0
     * The keywords fed the compile-time router, which has no runtime consumer for
     * rules. Cross-host reach lives in `globs` and the description.
     */
    it('carries the framework-agnostic path prefixes a non-Laravel consumer needs', () => {
        const prefixes = triggerValues(rule, 'path_prefix');
        for (const prefix of ['components/', 'src/components/', 'pages/']) {
            expect(prefixes).toContain(prefix);
        }
    });

    it('declares no keyword trigger, so the host can scope it by path', () => {
        // The inverse of the retired assertion, pinned deliberately: a single
        // keyword trigger is enough to make the Claude emitter drop `paths:`
        // entirely and send the rule back to loading in every session. A future
        // "let's add a keyword for discoverability" edit now has to argue with a
        // failing test instead of with a comment.
        expect(triggerValues(rule, 'keyword')).toEqual([]);
    });

    it('declares every file pattern over a path the shared UI predicate accepts', () => {
        // The rule triggers and `ui_surface` must not drift apart: a pattern
        // the rules fire on but the measurement does not count would put the
        // nudge and the consultation rate on different populations.
        for (const pattern of triggerValues(rule, 'file_pattern')) {
            const sample = `some/dir/example${pattern.replace('*', '')}`;
            expect(isUiPath(sample), `${pattern} → ${sample}`).toBe(true);
        }
    });
});
