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
 * sync`, …), the retired uncondensed legacy source tree (pre-ADR-051), maintainer-
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
 * point: `npm i` + read the installed skills) — plus, for the skill-script
 * form alone, `references/*.md` beside it.
 *
 * The twenty-skill `SCRIPTS_RUN_ALLOWLIST` this gate used to carry is GONE.
 * It exempted the one form that most needed the finding: a line telling a
 * consumer to type a wrapper the package does not ship. The skills now teach
 * `node <skills-root>/<name>/scripts/<tool>.mjs`, which an install can start,
 * so the exemption has nothing left to exempt.
 *
 * Carve-out:
 *   - Skill frontmatter `workspaces: [agent-config-maintainer]` (exclusive)
 *     — entirely exempt, per the mechanism above.
 *
 * Exit codes: 0 clean · 1 findings · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');

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
        label: 'reference to the retired uncondensed legacy source tree (pre-ADR-051)',
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
    },
    {
        re: /node_modules\/\.bin\/tsx\b/,
        label: 'invocation through `node_modules/.bin/tsx` (a devDependency binary; an install carries `node`, not a TypeScript loader)',
    },
];

/**
 * The skill-script form: `<runner> <skills-root>/<skill>/scripts/<tool>`.
 *
 * Checked apart from PATTERNS because the runner is not always on the line
 * that carries the path — a wrapped command leaves it at the end of the line
 * above, and a per-line regex reading only its own line reports every wrapped
 * invocation in the tree.
 *
 * It is also the one form checked inside `references/`. A blanket widening
 * would red on the reference files that name `./scripts-run src/scripts/…`,
 * which is a different class — a maintainer script, invoked while working on
 * this package — and this gate is not the place that decides those.
 */
const SKILL_SCRIPT_RE = /<skills-root>\/([A-Za-z0-9._-]+)\/scripts\/([A-Za-z0-9._-]+)/;
const SKILL_SCRIPT_RUNNER = 'node';

/** The last shell-ish token of a markdown fragment, decoration stripped. */
function lastToken(fragment: string): string {
    const cleaned = fragment.replace(/\\\s*$/, '').replace(/[`\s]+$/, '').trim();
    if (cleaned === '') return '';
    return (cleaned.split(/\s+/).pop() ?? '').replace(/^[`>*_(]+/, '').replace(/[`*_)]+$/, '');
}

/** The runner a taught line names: its own, or the one the line above ends with. */
function runnerFor(lines: readonly string[], idx: number, col: number): string {
    const before = (lines[idx] as string).slice(0, col);
    const own = lastToken(before.replace(/^[\s>]*(?:[-*+]\s+|\d+\.\s+)?/, ''));
    if (own !== '') return own;
    if (idx === 0) return '';
    const above = lines[idx - 1] as string;
    if (/^\s*(?:```|~~~)/.test(above)) return '';
    return lastToken(above);
}

/** Findings for taught skill-script lines that a node-only install cannot start. */
export function scanSkillScriptForm(relPath: string, text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const m = SKILL_SCRIPT_RE.exec(lines[i] as string);
        if (!m) continue;
        const tool = m[2] as string;
        const runner = runnerFor(lines, i, m.index);
        if (runner !== SKILL_SCRIPT_RUNNER) {
            findings.push(
                `${relPath}:${i + 1}: skill-script line whose runner is ` +
                    `${runner === '' ? 'absent' : `\`${runner}\``}, not \`node\` — ` +
                    'an install carries the runtime and the bundle, nothing else',
            );
        }
        if (!tool.endsWith('.mjs')) {
            findings.push(
                `${relPath}:${i + 1}: skill-script line naming \`${tool}\` — ` +
                    'the shipped entry point is the `.mjs` beside the source',
            );
        }
    }
    return findings;
}

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
    let projected = 0;
    for (const name of skillDirs) {
        const abs = path.join(SKILLS_DIR, name, 'SKILL.md');
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        projected += 1;
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
        findings.push(...scanSkillScriptForm(relPath, text));

        // `references/` is read for the skill-script form only — see the note
        // above `SKILL_SCRIPT_RE` for why the other patterns stop at SKILL.md.
        const refsDir = path.join(SKILLS_DIR, name, 'references');
        if (!fs.existsSync(refsDir) || !fs.statSync(refsDir).isDirectory()) continue;
        for (const ref of fs.readdirSync(refsDir).sort()) {
            if (!ref.endsWith('.md')) continue;
            const refAbs = path.join(refsDir, ref);
            let refText: string;
            try {
                refText = fs.readFileSync(refAbs, 'utf-8');
            } catch {
                continue;
            }
            findings.push(...scanSkillScriptForm(path.relative(REPO_ROOT, refAbs), refText));
        }
    }

    // Counted BEFORE the maintainer-exclusive skip, so an all-maintainer
    // projection is not mistaken for a dead root. The dir-exists guard above
    // only catches a deleted tree; a regenerated-but-empty projection reaches
    // here and would print the ✅ line over nothing. Exit 2 follows that same
    // guard: the projection is unusable, which is not a "finding" (1).
    try {
        assertScanned({
            gate: 'lint_consumer_internal_refs',
            scanned: projected,
            units: 'projected SKILL.md file(s)',
            roots: ['dist/agent-src/skills'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
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
