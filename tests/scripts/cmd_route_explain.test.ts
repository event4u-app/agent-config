// Golden tests for `agent-config route:explain` — 10 pinned prompts with
// pinned explanations. The explanations are structural pins (which rules
// match, on which triggers, at which tier), not full-text snapshots: rule
// bodies change size routinely, so byte-pinning the budget numbers would make
// every rule edit red here. What must NOT drift silently: the matched-rule
// sets, the matched trigger labels, the measurement-level first line, and the
// exit-code contract.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    build_report,
    build_skills_report,
    main,
    render_skills_text,
    render_text,
    MEASUREMENT_HEADER,
} from '../../src/scripts/_cli/cmd_route_explain.js';
import { DEFAULT_SUGGEST_LIMIT } from '../../src/shared/skillRanking.js';
import { REGISTRY } from '../../src/cli/registry.js';
import { ALLOWLIST } from '../../src/scripts/mcp_server/tools.js';
import type { Router } from '../../src/scripts/_lib/router_match.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ROUTER: Router = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
) as Router;

function matchedIds(prompt: string, files: string[] = []): string[] {
    return build_report(ROUTER, prompt, files, 'full').matches.map((m) => m.id);
}

describe('route:explain — pinned prompt → explanation goldens', () => {
    it('G1: "refactor the controller" fires the analyze/diff/architecture cluster', () => {
        const ids = matchedIds('refactor the controller');
        for (const expected of [
            'architecture',
            'broken-access-control',
            'think-before-action',
            'active-remediation',
            'senior-engineering-discipline',
            'improve-before-implement',
            'code-comment-discipline',
        ]) {
            expect(ids, `expected ${expected} in [${ids.join(', ')}]`).toContain(expected);
        }
    });

    it('G2: "fix the login endpoint" fires think-before-action + minimal-safe-diff + access control', () => {
        const ids = matchedIds('fix the login endpoint');
        expect(ids).toContain('think-before-action');
        expect(ids).toContain('minimal-safe-diff');
        expect(ids).toContain('broken-access-control');
    });

    it('G3: "review this contract" fires the advisory + legal floors', () => {
        const ids = matchedIds('please review this contract for me');
        expect(ids).toContain('domain-safety-disclaimer');
        expect(ids).toContain('legal-safety-floor');
    });

    it('G4: brand prompts route to the MERGED brand-source-of-truth (not the retired brand-consistency)', () => {
        const ids = matchedIds('Is this landing page copy on-brand for us?');
        expect(ids).toContain('brand-source-of-truth');
        expect(ids).not.toContain('brand-consistency');
    });

    it('G5: "what is our DCF valuation" fires ONLY the finance floor (disclaimer disjoined 2026-08-04)', () => {
        const ids = matchedIds('what is our DCF valuation');
        expect(ids).toContain('finance-safety-floor');
        expect(ids).not.toContain('domain-safety-disclaimer');
    });

    it('G6: "commit the secret password" fires the VCS guard, NOT security-sensitive-stop (disjoined)', () => {
        const ids = matchedIds('commit the secret password');
        expect(ids).toContain('secret-vcs-guard');
        expect(ids).not.toContain('security-sensitive-stop');
    });

    it('G7: "harden the oauth flow" fires security-sensitive-stop via its conversational surface', () => {
        const ids = matchedIds('harden the oauth flow');
        expect(ids).toContain('security-sensitive-stop');
    });

    it('G8: an editing prompt with a skills file fires the path_prefix rules via --files', () => {
        const report = build_report(ROUTER, 'polish this skill', ['src/skills/foo/SKILL.md'], 'full');
        const ids = report.matches.map((m) => m.id);
        expect(ids).toContain('framework-neutrality-in-generic-skills');
        const fn = report.matches.find((m) => m.id === 'framework-neutrality-in-generic-skills');
        expect(fn?.matched.some((l) => l.startsWith('path_prefix:'))).toBe(true);
    });

    it('G8b: skill-quality is NOT routed here — it loads unconditionally instead', () => {
        // This golden used to assert the opposite, and the change is the point
        // rather than an accommodation. road-to-single-delivery Phase 5.1 removed
        // the `src/skills/` path trigger from `skill-quality` (and from three
        // sibling package-only rules) so they survive `/compact` once ADR-236's
        // delivery partition removes their unscoped global twin — a path-scoped
        // rule is not re-injected after compaction (ADR-227), which would let an
        // Iron Law vanish mid-session.
        //
        // So the rule is no longer ROUTED at all: it is delivered unconditionally,
        // which is strictly more available than a path match. Asserting its absence
        // from the router's match set is what distinguishes that from a regression
        // where a rule silently stopped arriving.
        const report = build_report(ROUTER, 'polish this skill', ['src/skills/foo/SKILL.md'], 'full');
        expect(report.matches.map((m) => m.id)).not.toContain('skill-quality');
        const entry = [...(ROUTER.tier_1 as Array<{ id: string; triggers: unknown[] }>),
                       ...(ROUTER.tier_2 as Array<{ id: string; triggers: unknown[] }>)]
            .find((r) => r.id === 'skill-quality');
        expect(entry, 'skill-quality must still be a router entry').toBeDefined();
        expect(entry?.triggers, 'with an empty trigger list, i.e. unconditional').toEqual([]);
    });

    it('G9: a no-match prompt leaves only the kernel and reports every candidate as rejected', () => {
        const report = build_report(ROUTER, 'xyzzy blorp quux', [], 'full');
        expect(report.matches).toEqual([]);
        expect(report.kernel_always.length).toBe(9);
        const rejected = report.rejected.find((r) => r.reason === 'no trigger matched');
        expect(rejected?.ids.length).toBe(
            (ROUTER.tier_1 as unknown[]).length + (ROUTER.tier_2 as unknown[]).length,
        );
    });

    it('G10: profile=balanced excludes tier-2 and says why', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'balanced');
        expect(report.matches.every((m) => m.tier === 'tier-1')).toBe(true);
        const excl = report.rejected.find((r) => r.reason.includes("excluded by profile 'balanced'"));
        expect(excl).toBeDefined();
        expect(excl?.ids.length).toBe((ROUTER.tier_2 as unknown[]).length);
    });
});

describe('route:explain — output contract', () => {
    it('the measurement-level header is the mandatory first line of the text output', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        const text = render_text(report);
        expect(text.split('\n')[0]).toBe(MEASUREMENT_HEADER);
        expect(MEASUREMENT_HEADER).toContain('NOT measured here');
    });

    it('the JSON report carries the header as its first field and budget totals add up', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        expect(Object.keys(report)[0]).toBe('measurement_level');
        const sum = report.matches.reduce((s, m) => s + m.body_chars, 0);
        expect(report.budget.matched_chars).toBe(sum);
        expect(sum).toBeGreaterThan(0);
    });

    it('every matched rule carries tier, disposition, and at least one trigger label', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        for (const m of report.matches) {
            expect(['tier-1', 'tier-2']).toContain(m.tier);
            expect(m.disposition).toContain('projection time');
            expect(m.matched.length).toBeGreaterThan(0);
        }
    });
});

// `--skills` — the search answer on a host with a shell and no MCP server.
//
// Three things are worth pinning and none of them is the ranking: that the row
// carries the same four fields the two MCP servers return, that a workspace
// with NO catalogue root still gets an answer out of the installed package's
// own projection, and that the output says which of those two happened. The
// third is the load-bearing one — a row ranked out of the package tree is a
// different claim from a row ranked out of the consumer's catalogue, and a
// reader who cannot tell them apart has been handed the wrong confidence.
describe('route:explain --skills — the shell path', () => {
    const tmpDirs: string[] = [];
    afterEach(() => {
        while (tmpDirs.length > 0) {
            fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
        }
    });
    function tmp(prefix: string): string {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        tmpDirs.push(d);
        return d;
    }

    /** A workspace carrying only ANOTHER host's directory — the reproduced case. */
    function foreignWorkspace(): string {
        const ws = tmp('rx-ws-');
        fs.mkdirSync(path.join(ws, '.cursor', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(ws, '.cursor', 'rules', 'x.mdc'), 'x\n');
        return ws;
    }

    function skillWorkspace(): string {
        const ws = tmp('rx-own-');
        const dir = path.join(ws, '.claude', 'skills', 'merge-conflicts');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            '---\nname: merge-conflicts\ndescription: Resolve merge conflicts in a rebase.\n---\n\n# body\n',
        );
        return ws;
    }

    it('answers out of the package projection when NO other root resolves', () => {
        const report = build_skills_report('resolve merge conflicts', {
            workspaceRoot: foreignWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: 3,
        });
        // The reproduced defect: this used to be zero roots and no answer, on a
        // machine where the installed package ships its own catalogue.
        expect(report.skills_roots).toEqual([
            path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
        ]);
        expect(report.package_fallback_used).toBe(true);
        expect(report.suggestions.length).toBeGreaterThan(0);
        expect(render_skills_text(report)).toContain("installed package's own projection");
    });

    it('never ranks the package projection AHEAD of, or beside, a real root', () => {
        const report = build_skills_report('resolve merge conflicts', {
            workspaceRoot: skillWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: 3,
        });
        expect(report.package_fallback_used).toBe(false);
        // Not merely "not first" — ABSENT. Appending it to a non-empty list
        // would rank 300 package skills beside the consumer's own catalogue.
        expect(report.skills_roots).not.toContain(
            path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
        );
        expect(report.suggestions.map((r) => r.skill)).toContain('merge-conflicts');
    });

    it('reaches a package skill the host root lacks, labelled not-installed', () => {
        // The installed root carries one skill. A package skill outside it used
        // to be invisible here: the projection is only ever a fallback root.
        const report = build_skills_report('write a conventional commit message', {
            workspaceRoot: skillWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: 3,
        });
        expect(report.package_fallback_used).toBe(false);
        const names = report.not_installed.map((r) => r.skill);
        expect(names).toContain('conventional-commits-writing');
        // An installed name is never repeated as not-installed.
        expect(names).not.toContain('merge-conflicts');
        expect(names.length).toBeLessThanOrEqual(3);
        expect(render_skills_text(report)).toMatch(/· conventional-commits-writing {2}\[[\d.]+\] {2}not-installed/);
    });

    it('labels every row not-installed when only the package projection answered', () => {
        const report = build_skills_report('resolve merge conflicts', {
            workspaceRoot: foreignWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: 3,
        });
        expect(report.not_installed).toEqual([]);
        const rows = render_skills_text(report).split('\n').filter((l) => l.startsWith('  · '));
        expect(rows.length).toBeGreaterThan(0);
        for (const l of rows) expect(l).toMatch(/ {2}not-installed$/);
    });

    it('carries the same four fields the MCP servers return, description included', () => {
        const report = build_skills_report('resolve merge conflicts in a rebase', {
            workspaceRoot: skillWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: 3,
        });
        const row = report.suggestions.find((r) => r.skill === 'merge-conflicts')!;
        expect(Object.keys(row).sort()).toEqual(['description', 'personas', 'score', 'skill']);
        expect(row.description).toBe('Resolve merge conflicts in a rebase.');
        expect(render_skills_text(report)).toContain('Resolve merge conflicts in a rebase.');
    });

    it('defaults to the same depth the MCP servers publish', () => {
        expect(main(['--skills', 'resolve merge conflicts', '--limit', '0'])).toBe(2);
        expect(main(['--skills', '   '])).toBe(2);
        // The default is read from the shared constant, not spelled again here.
        const report = build_skills_report('resolve merge conflicts', {
            workspaceRoot: skillWorkspace(),
            packageRoot: REPO_ROOT,
            home: tmp('rx-home-'),
            limit: DEFAULT_SUGGEST_LIMIT,
        });
        expect(report.limit).toBe(DEFAULT_SUGGEST_LIMIT);
    });

    it('an unreadable catalogue is UNKNOWN in the output, never "no skill covers this"', () => {
        // Both the no-catalogue and the no-match case exit 1; the difference is
        // in the text, which is where a reader can act on it.
        const none = build_skills_report('resolve merge conflicts', {
            workspaceRoot: foreignWorkspace(),
            packageRoot: tmp('rx-nopkg-'),
            home: tmp('rx-home-'),
            limit: 3,
        });
        expect(none.skills_roots).toEqual([]);
        const text = render_skills_text(none);
        expect(text).toContain('NONE readable');
        expect(text).toContain('"unknown", never "no skill covers this"');
        expect(text).not.toMatch(/ranked skills/);
    });

    it('leaves the rule arm alone — a prompt with no --skills still traces rules', () => {
        // The flag is a second ARM, not a second meaning for the same input.
        // A2 chose a flag over a new verb; this is the line that keeps the flag
        // from quietly becoming one.
        const ids = build_report(ROUTER, 'refactor the controller', [], 'full').matches.map(
            (m) => m.id,
        );
        expect(ids.length).toBeGreaterThan(0);
        expect(main([])).toBe(2);
    });
});

// The recovery rule's ladder, checked against the things it names.
//
// It lives beside the `--skills` tests because this command is the rung the
// ladder gained, and because the failure it guards is specific: a rule that
// instructs a call which does not exist sends an agent into a retry loop on a
// verb no shell can run. The rule's own text says it "may never instruct a
// call it cannot verify is possible" — this is that verification, and without
// it the sentence is a promise nothing keeps.
describe('missing-skill-recovery — the ladder names only rungs that exist', () => {
    const RULE = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'rules', 'missing-skill-recovery.md'),
        'utf-8',
    );

    it('every `agent-config <verb>` it names is a registered CLI verb', () => {
        const named = [...RULE.matchAll(/`agent-config ([a-z][a-z-]*:[a-z][a-z-]*)/g)].map(
            (m) => m[1] as string,
        );
        expect(named.length).toBeGreaterThan(0);
        const registered = new Set(REGISTRY.map((c) => c.name));
        expect(named.filter((v) => !registered.has(v))).toEqual([]);
    });

    it('the MCP rung it names is an allowlisted tool', () => {
        expect(RULE).toContain('suggest_skill_for_task');
        expect(Object.keys(ALLOWLIST)).toContain('suggest_skill_for_task');
    });

    it('the shell rung it names is the flag this command actually parses', () => {
        expect(RULE).toContain('route:explain --skills "<task>"');
        // Parsed, not merely spelled: a flag the rule names and the command
        // ignores would be the same dead end in a different place.
        expect(main(['--skills'])).toBe(2);
        expect(main(['--skills', 'resolve merge conflicts', '--limit', 'nope'])).toBe(2);
    });

    it('stays `instruction-only`, with its reason', () => {
        // 2.2 may add a rung; it may not quietly upgrade the rule's honesty
        // field, because nothing new here observes the conclusion it forbids.
        expect(RULE).toMatch(/enforced_by:\n\s+- "instruction-only:/);
    });
});
