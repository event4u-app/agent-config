#!/usr/bin/env tsx
/**
 * lint_consumer_internal_refs — no maintainer-internal path/task references
 * in consumer-projected skills.
 *
 * road-to-credible-install Phase 4 step 2: an external review claimed
 * "84/281 skills reference package internals". Re-verification found the
 * real count 17 after excluding two large classes of false positive the
 * review's crude grep did not distinguish:
 *
 *   - Skills whose `workspaces:` frontmatter is EXCLUSIVELY
 *     `agent-config-maintainer` (per ADR-013, "skills/rules/commands that
 *     maintain THIS package") — referencing this repo's own Taskfile verbs,
 *     dev scripts, or test suite is correct there, not a leak.
 *   - Generic conventions this package ships to EVERY consumer project
 *     (`agents/roadmaps/`, `agents/runtime/council/`, "check your project's
 *     `Taskfile.yml`") — these are real, shipped, documented features, not
 *     internal-only paths. (The `no-roadmap-references` /
 *     `check_no_roadmap_refs.ts` lint already guards the narrower
 *     specific-file-citation case for stable artifacts.)
 *
 * What DOES leak: a literal Taskfile verb invocation (`task ci`, `task
 * sync`, …), the retired `.agent-src.uncondensed/` source tree, maintainer-
 * only docs (`docs/maintainers/`), a bare `src/scripts/<tool>.ts` reference
 * with no `node_modules/@event4u/agent-config/` prefix (broken once the
 * skill is installed — the relative distance from the installed file to
 * this repo's `src/scripts/` no longer exists), a citation of this
 * package's own test suite (`tests/scripts/*.test.ts`, never shipped), or
 * the maintainer-only `./scripts-run` dispatch wrapper (not shipped —
 * `package.json` `files` never lists the repo-root `scripts-run` file).
 *
 * Scope: every `dist/agent-src/skills/<name>/SKILL.md` — the consumer projection
 * actually shipped in the npm package (mirrors the reviewer's own vantage
 * point: `npm i` + read the installed skills).
 *
 * Carve-outs:
 *   - Skill frontmatter `workspaces: [agent-config-maintainer]` (exclusive)
 *     — entirely exempt, per the mechanism above.
 *   - `SCRIPTS_RUN_ALLOWLIST` below — the `corpus-grounding` engine's own
 *     documented consumer-runtime CLI convention (`./scripts-run
 *     <skills-root>/<name>/scripts/<tool> …`, skill-bundled assets per
 *     `docs/contracts/skill-bundled-assets.md`) — the invoked PATH is real
 *     and reachable in every install; only the wrapper name is inherited
 *     from the maintainer dispatcher. Tracked as a separate, larger-scope
 *     naming-consistency item; out of scope for this lint's 17-skill sweep.
 *
 * Exit codes: 0 clean · 1 findings · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');

/**
 * Skills using `corpus-grounding`'s documented `./scripts-run
 * <skills-root>/<name>/scripts/<tool>` consumer-runtime CLI convention
 * (skill-bundled assets, `docs/contracts/skill-bundled-assets.md`) — the
 * path is real and reachable once installed; only the wrapper name drifted
 * from the contract's prescribed `node_modules/.bin/tsx` form. A single,
 * uniform, cross-skill convention — renaming it is a separate, larger-scope
 * follow-up, not one of this sweep's 17 leaky skills.
 */
const SCRIPTS_RUN_ALLOWLIST = new Set([
    'accessibility-auditor',
    'api-design',
    'api-endpoint',
    'authz-review',
    'blade-ui',
    'brand',
    'brand-identity',
    'brand-strategy',
    'brand-to-tokens',
    'corpus-grounding',
    'dashboard-design',
    'database',
    'design-intelligence',
    'design-tokens',
    'flux',
    'livewire',
    'react-shadcn-ui',
    'sql-writing',
    'threat-modeling',
    'typography-system',
]);

interface PatternDef {
    readonly re: RegExp;
    readonly label: string;
    /** Skill names (by directory) exempt from this specific pattern. */
    readonly allowlist?: ReadonlySet<string>;
}

const PATTERNS: readonly PatternDef[] = [
    {
        re: /`task [a-z][a-z0-9-]*`/,
        label: 'literal Taskfile verb invocation (this repo’s own `task <verb>`, not shipped to consumers)',
    },
    {
        re: /\.agent-src\.uncondensed\//,
        label: 'reference to the retired `.agent-src.uncondensed/` source tree',
    },
    {
        re: /docs\/maintainers\//,
        label: 'reference to maintainer-only docs (`docs/maintainers/`)',
    },
    {
        re: /(?<!node_modules\/@event4u\/agent-config\/)src\/scripts\//,
        label: 'bare `src/scripts/` reference (broken once installed — prefix with `node_modules/@event4u/agent-config/` or drop)',
    },
    {
        re: /tests\/scripts\//,
        label: 'citation of this package’s own test suite (`tests/scripts/`, never shipped to consumers)',
    },
    {
        re: /\.\/scripts-run\b/,
        label: 'invocation of the maintainer-only `./scripts-run` dispatcher (not in `package.json` `files`, never reaches a consumer install)',
        allowlist: SCRIPTS_RUN_ALLOWLIST,
    },
];

/** `workspaces:` frontmatter list of a skill file ([] when untagged). */
function skillWorkspaces(skillPath: string): string[] {
    const src = fs.readFileSync(skillPath, 'utf-8');
    const m = src.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return [];
    let meta: Record<string, unknown>;
    try {
        meta = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
    } catch {
        return [];
    }
    const ws = meta['workspaces'];
    return Array.isArray(ws) ? ws.map((w) => String(w)) : [];
}

function isExclusivelyMaintainer(ws: readonly string[]): boolean {
    return ws.length === 1 && ws[0] === 'agent-config-maintainer';
}

export function scanText(skillName: string, relPath: string, text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        for (const { re, label, allowlist } of PATTERNS) {
            if (allowlist?.has(skillName)) continue;
            // Fresh RegExp per line: lookbehind + no /g is safe to reuse via .test().
            if (re.test(lines[i] as string)) {
                findings.push(`${relPath}:${i + 1}: ${label}`);
            }
        }
    }
    return findings;
}

export function main(): number {
    if (!fs.existsSync(SKILLS_DIR)) {
        process.stderr.write(`lint_consumer_internal_refs: skills dir not found: ${SKILLS_DIR}\n`);
        return 2;
    }
    let skillDirs: string[];
    try {
        skillDirs = fs
            .readdirSync(SKILLS_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort();
    } catch (err) {
        process.stderr.write(`lint_consumer_internal_refs: failed to list ${SKILLS_DIR}: ${String(err)}\n`);
        return 2;
    }

    const findings: string[] = [];
    for (const name of skillDirs) {
        const abs = path.join(SKILLS_DIR, name, 'SKILL.md');
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        const ws = skillWorkspaces(abs);
        if (isExclusivelyMaintainer(ws)) continue;
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        const relPath = path.relative(REPO_ROOT, abs);
        findings.push(...scanText(name, relPath, text));
    }

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  consumer-internal reference: ${f}\n`);
        }
        process.stderr.write(
            `\n${findings.length} consumer-internal reference(s) in the shipped skill projection. ` +
                'Replace with the existing consumer-safe indirection (an `agent-config <verb>` CLI command, ' +
                'the `node_modules/@event4u/agent-config/src/scripts/...` path, or a docs-site link) ' +
                'or drop the reference (road-to-credible-install Phase 4 step 2).\n',
        );
        return 1;
    }
    process.stdout.write('✅  no consumer-internal references in the shipped skill projection\n');
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
