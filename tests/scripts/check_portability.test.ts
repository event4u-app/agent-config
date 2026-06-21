// Tests for src/scripts/check_portability.ts (py2ts Phase 4 / Wave 4a).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (auto-detection layers, allowlist, the
// task / CLI-bypass / identity-framing detectors, code-fence skipping,
// format_text, JSON output) plus a golden-parity layer that runs python3 vs
// tsx on the REAL REPO (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cp from '../../src/scripts/check_portability.js';



function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_portability — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
        // A package.json with a known scoped name yields a deterministic
        // identifier set ({acme, widget}) without touching git or the
        // directory-name layer (which only fires when dist/agent-src exists).
        write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'acme/widget' }));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // --- Auto-detection from package.json (scope + pkg). ---
    it('detects scope and package name from a scoped package.json', () => {
        const ids = cp._detect_project_identifiers(tmp);
        expect([...ids].sort()).toEqual(['acme', 'widget']);
    });

    it('filters out generic identifiers', () => {
        write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'core/api' }));
        // both "core" and "api" are in the generic stoplist → empty set
        expect([...cp._detect_project_identifiers(tmp)]).toEqual([]);
    });

    it('splits composer package name on hyphens (>=3 chars)', () => {
        fs.rmSync(path.join(tmp, 'package.json'));
        write(path.join(tmp, 'composer.json'), JSON.stringify({ name: 'vendor/some-pkg' }));
        // "pkg" is dropped by the generic stoplist; "some" (>=3) survives.
        const ids = [...cp._detect_project_identifiers(tmp)].sort();
        expect(ids).toEqual(['some', 'some-pkg', 'vendor']);
    });

    // --- Layer 1: project-name + project-domain violations in scanned dirs. ---
    it('flags a project-name word-boundary match in .agent-src.uncondensed', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/skills/x/SKILL.md'),
            'This belongs to the widget project.\n',
        );
        const { violations, detected } = cp.scan_all(tmp);
        expect(detected).toEqual(['acme', 'widget']);
        expect(violations).toHaveLength(1);
        expect(violations[0]!.match).toBe('widget');
        expect(violations[0]!.pattern_name).toBe('project-name');
        expect(violations[0]!.severity).toBe('error');
        expect(violations[0]!.line).toBe(1);
    });

    it('flags a project-domain pattern (name.tld)', () => {
        write(path.join(tmp, '.agent-src.uncondensed/rules/r.md'), 'visit widget.com today\n');
        const { violations } = cp.scan_all(tmp);
        const domain = violations.filter((v) => v.pattern_name === 'project-domain');
        expect(domain).toHaveLength(1);
        expect(domain[0]!.match).toBe('widget.com');
    });

    it('flags a project-derivative as a warning', () => {
        write(path.join(tmp, '.agent-src.uncondensed/rules/r.md'), 'db is acme_main here\n');
        const { violations } = cp.scan_all(tmp);
        const deriv = violations.filter((v) => v.pattern_name === 'project-derivative');
        expect(deriv).toHaveLength(1);
        expect(deriv[0]!.match).toBe('acme_main');
        expect(deriv[0]!.severity).toBe('warning');
    });

    // --- Allowlist + code-fence + frontmatter skipping. ---
    it('skips lines matched by the allowlist', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/r.md'),
            'agent-config is the package; widget agent-config\n',
        );
        // The allowlist `agent-config` matches the line → whole line skipped,
        // so the `widget` hit is suppressed.
        expect(cp.scan_all(tmp).violations).toHaveLength(0);
    });

    it('skips matches inside fenced code blocks', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/r.md'),
            '```\nwidget inside fence\n```\nwidget outside\n',
        );
        const v = cp.scan_all(tmp).violations;
        expect(v).toHaveLength(1);
        expect(v[0]!.line).toBe(4);
    });

    it('skips a top-of-file YAML frontmatter delimiter line', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/r.md'),
            '---\ntitle: widget\n---\nbody widget\n',
        );
        // Line 1 `---` is skipped as frontmatter; the `widget` on lines 2 and 4
        // are still scanned (the detector does not parse frontmatter values).
        const v = cp.scan_all(tmp).violations;
        expect(v.map((x) => x.line)).toEqual([2, 4]);
    });

    // --- Layer 3: task-invocation detector (artefact subdirs only). ---
    it('flags an inline `task <cmd>` invocation in a skill', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/skills/s/SKILL.md'),
            'Run `task ci-fast` to lint.\n',
        );
        const v = cp.scan_all(tmp).violations.filter((x) => x.pattern_name === 'task-invocation');
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('`task ci-fast`');
    });

    it('flags a `task <cmd>` line inside a fenced code block', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/commands/c.md'),
            '```bash\ntask sync\n```\n',
        );
        const v = cp.scan_all(tmp).violations.filter((x) => x.pattern_name === 'task-invocation');
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('task sync');
    });

    it('exempts the self-documenting augment-portability rule from the task detector', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/augment-portability.md'),
            'Never write `task ci` in an artefact.\n',
        );
        const v = cp.scan_all(tmp).violations.filter((x) => x.pattern_name === 'task-invocation');
        expect(v).toHaveLength(0);
    });

    // --- Layer 4: CLI-bypass detector. ---
    it('flags a direct python3 script invocation and names the CLI replacement', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/skills/s/SKILL.md'),
            'Run `python3 scripts/memory_lookup.py` to query.\n',
        );
        const v = cp.scan_all(tmp).violations.filter((x) => x.pattern_name.startsWith('cli-bypass'));
        expect(v).toHaveLength(1);
        expect(v[0]!.pattern_name).toBe('cli-bypass → use `./agent-config memory:lookup`');
    });

    // --- Layer 5: identity-framing detector on the public surface. ---
    it('flags a Laravel-first identity-framing phrase in README.md', () => {
        write(path.join(tmp, 'README.md'), 'A Laravel-first governance suite.\n');
        const v = cp.scan_all(tmp).violations.filter((x) => x.pattern_name.startsWith('identity-'));
        expect(v).toHaveLength(1);
        expect(v[0]!.pattern_name).toBe('identity-laravel-first');
    });

    // --- FORBIDDEN_IDENTIFIERS via env (loaded at module level in the CLI). ---
    it('_load_forbidden_identifiers parses the comma-separated env var', () => {
        const prev = process.env.AGENT_CONFIG_BLOCKLIST;
        process.env.AGENT_CONFIG_BLOCKLIST = ' legacycorp , , oldname ';
        try {
            expect(cp._load_forbidden_identifiers()).toEqual(['legacycorp', 'oldname']);
        } finally {
            if (prev === undefined) delete process.env.AGENT_CONFIG_BLOCKLIST;
            else process.env.AGENT_CONFIG_BLOCKLIST = prev;
        }
    });

    // --- format_text rendering. ---
    it('format_text reports the clean message with the detected header', () => {
        expect(cp.format_text([], ['acme', 'widget'])).toBe(
            'Auto-detected identifiers: acme, widget\n✅  No portability violations found.',
        );
    });

    it('format_text renders error and warning icons + context', () => {
        const out = cp.format_text(
            [
                {
                    file: 'a.md',
                    line: 2,
                    match: 'widget',
                    pattern_name: 'project-name',
                    severity: 'error',
                    context: 'the widget line',
                },
                {
                    file: 'b.md',
                    line: 5,
                    match: 'acme_x',
                    pattern_name: 'project-derivative',
                    severity: 'warning',
                    context: 'acme_x here',
                },
            ],
            ['acme'],
        );
        expect(out).toContain('Auto-detected identifiers: acme\n');
        expect(out).toContain('❌  Found 2 portability violation(s):');
        expect(out).toContain('🔴 a.md:2 — [project-name] `widget`');
        expect(out).toContain('      the widget line');
        expect(out).toContain('🟡 b.md:5 — [project-derivative] `acme_x`');
    });

    it('format_text omits the header when no identifiers were detected', () => {
        expect(cp.format_text([], [])).toBe('✅  No portability violations found.');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

