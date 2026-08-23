#!/usr/bin/env tsx
/**
 * Lint cross-wing handoffs declared in senior-tier skills' `## Related Skills`.
 *
 * Ported from the retired Python `src/scripts/lint_handoffs.py` (ADR-200, Phase 4 /
 * Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet` flag is a
 * bare `sys.argv` membership check (NOT argparse, so there is no real
 * `-h`/`--help`; `main(argv)` treats `argv[0]` as a skills-dir override,
 * e.g. `--help` → `Path("--help")`), the `file:line:code: message` render
 * shape on stdout, the trailing `❌` summary on stderr, exit codes
 * (0 clean, 1 violations), and the same WHEN/WHEN-NOT split + DAG cycle
 * detection. No behaviour changes.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SRC_SKILLS } from './_lib/agent_src.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import {
    compute_active_pack_ids,
    is_pruned_under_scoped,
    load_packs_registry,
} from './_lib/scoped_projection.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
/**
 * ADR-051 moved skill authoring to `src/skills`. Until 2026-08-02 this default
 * still named the retired pre-ADR-051 source container, so the CLI walked a
 * missing directory and printed "no violations under <that root>" while
 * reading zero files. Resolved through the shared resolver so the next root
 * move updates every consumer at once.
 */
const SKILLS_DIR = SRC_SKILLS();

/** Mirror `QUIET = "--quiet" in sys.argv` (computed at import). */
const QUIET = process.argv.slice(2).includes('--quiet');

// re.compile(r"\[`?([a-z0-9][a-z0-9-]*)`?\]\(([^)]+SKILL\.md)\)")
const LINK_RE = /\[`?([a-z0-9][a-z0-9-]*)`?\]\(([^)]+SKILL\.md)\)/g;
// re.compile(r"^##\s+Related\s+Skills\s*$", re.IGNORECASE)
const RELATED_HEADING_RE = /^##\s+Related\s+Skills\s*$/i;
// re.compile(r"^##\s+\S")
const NEXT_HEADING_RE = /^##\s+\S/;
// re.compile(r"^\*\*WHEN\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)
const WHEN_USE_RE = /^\*\*WHEN\s+to\s+use\s+this\*\*\s*$/i;
// re.compile(r"^\*\*WHEN\s+NOT\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)
const WHEN_NOT_RE = /^\*\*WHEN\s+NOT\s+to\s+use\s+this\*\*\s*$/i;

export interface Violation {
    file: string; // resolved absolute path
    line: number;
    code: string;
    message: string;
}

function _render(v: Violation, repo: string): string {
    // file is always absolute here, so relative_to applies.
    const rel = _isUnder(v.file, repo) || v.file === repo ? _relTo(v.file, repo) : v.file;
    return `${rel}:${v.line}:${v.code}: ${v.message}`;
}

function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function parse_frontmatter_tier(text: string): string | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    for (const raw of text.slice(4, end).split('\n')) {
        if (!raw.includes(':')) {
            continue;
        }
        const sep = raw.indexOf(':');
        const key = raw.slice(0, sep);
        const val = raw.slice(sep + 1);
        if (key.trim() === 'tier') {
            return _strip(_strip(_strip(val.trim(), '"'), "'"), undefined);
        }
    }
    return null;
}

/** Python str.strip(chars) — strip leading/trailing chars (whitespace if undefined). */
function _strip(s: string, chars?: string): string {
    if (chars === undefined) {
        return s.trim();
    }
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start++;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end--;
    }
    return s.slice(start, end);
}

/** Return [block_start_line, [[line, raw], ...]] for `## Related Skills`. */
function extract_related_block(text: string): [number, Array<[number, string]>] | null {
    const lines = text.split('\n');
    let start: number | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
        if (RELATED_HEADING_RE.test(lines[idx] as string)) {
            start = idx;
            break;
        }
    }
    if (start === null) {
        return null;
    }
    const body: Array<[number, string]> = [];
    for (let idx = start + 1; idx < lines.length; idx++) {
        if (NEXT_HEADING_RE.test(lines[idx] as string)) {
            break;
        }
        body.push([idx + 1, lines[idx] as string]);
    }
    return [start + 1, body];
}

function split_when_subblocks(
    body: Array<[number, string]>,
): [Array<[number, string]>, Array<[number, string]>] {
    const when_use: Array<[number, string]> = [];
    const when_not: Array<[number, string]> = [];
    let current = when_use;
    for (const [lineno, raw] of body) {
        if (WHEN_USE_RE.test(raw)) {
            current = when_use;
            continue;
        }
        if (WHEN_NOT_RE.test(raw)) {
            current = when_not;
            continue;
        }
        current.push([lineno, raw]);
    }
    return [when_use, when_not];
}

function extract_links(body: Array<[number, string]>): Array<[number, string, string]> {
    const out: Array<[number, string, string]> = [];
    for (const [lineno, raw] of body) {
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(raw)) !== null) {
            out.push([lineno, m[1] as string, m[2] as string]);
        }
    }
    return out;
}

/** (skill_file.parent / link).resolve() — absolute, symlink-resolved. */
function resolve_target(skill_file: string, link: string): string {
    const joined = path.resolve(path.dirname(skill_file), link);
    try {
        return fs.realpathSync(joined);
    } catch {
        return joined;
    }
}

function detect_cycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const on_stack = new Set<string>();

    const dfs = (node: string): void => {
        if (on_stack.has(node)) {
            const i = stack.indexOf(node);
            cycles.push([...stack.slice(i), node]);
            return;
        }
        if (visited.has(node)) {
            return;
        }
        visited.add(node);
        on_stack.add(node);
        stack.push(node);
        for (const nxt of graph.get(node) ?? []) {
            dfs(nxt);
        }
        stack.pop();
        on_stack.delete(node);
    };

    for (const node of [...graph.keys()]) {
        dfs(node);
    }
    return cycles;
}

/** sorted(skills_dir.rglob("SKILL.md")) — absolute, sorted POSIX. */
function _rglobSkillMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(current, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.name === 'SKILL.md') {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

/** Path.resolve() with symlink resolution; falls back to absolute on missing. */
function _resolve(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

export function lint(skills_dir: string): Violation[] {
    const senior_skills: Map<string, string> = new Map();
    /** `file|line|href` of every dangling link the senior pass already reported. */
    const reported_dangling = new Set<string>();
    const all_skills: Map<string, string> = new Map();
    for (const skill_md of _rglobSkillMd(skills_dir)) {
        const text = fs.readFileSync(skill_md, 'utf-8');
        const tier = parse_frontmatter_tier(text);
        const resolved = _resolve(skill_md);
        all_skills.set(resolved, tier ?? '');
        if (tier === 'senior') {
            senior_skills.set(resolved, text);
        }
    }

    const violations: Violation[] = [];
    const graph: Map<string, Set<string>> = new Map();

    for (const [skill_path, text] of senior_skills) {
        const block = extract_related_block(text);
        if (block === null) {
            continue;
        }
        const [, body] = block;
        const [when_use, when_not] = split_when_subblocks(body);

        // WHEN-to-use links: composition edges (graph) + dangling/tier checks.
        for (const [lineno, slug, link] of extract_links(when_use)) {
            const target = resolve_target(skill_path, link);
            if (!graph.has(skill_path)) {
                graph.set(skill_path, new Set());
            }
            graph.get(skill_path)!.add(target);
            if (!all_skills.has(target)) {
                reported_dangling.add(`${skill_path}|${String(lineno)}|${link}`);
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_dangling',
                    message: `link to \`${slug}\` resolves to missing file ${link}`,
                });
                continue;
            }
            if (all_skills.get(target) !== 'senior') {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_tier_mismatch',
                    message:
                        `senior skill links to non-senior \`${slug}\` ` +
                        `(tier=${_pyRepr(all_skills.get(target) || 'unset')})`,
                });
            }
        }

        // WHEN-NOT-to-use links: alternative pointers, NOT composition edges.
        for (const [lineno, slug, link] of extract_links(when_not)) {
            const target = resolve_target(skill_path, link);
            if (!all_skills.has(target)) {
                reported_dangling.add(`${skill_path}|${String(lineno)}|${link}`);
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_dangling',
                    message: `link to \`${slug}\` resolves to missing file ${link}`,
                });
                continue;
            }
            if (all_skills.get(target) !== 'senior') {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_tier_mismatch',
                    message:
                        `senior skill links to non-senior \`${slug}\` ` +
                        `(tier=${_pyRepr(all_skills.get(target) || 'unset')})`,
                });
            }
        }
    }

    for (const cycle of detect_cycles(graph)) {
        const names = cycle.map((p) => path.basename(path.dirname(p))).join(' → ');
        violations.push({
            file: cycle[0] as string,
            line: 1,
            code: 'handoff_cycle',
            message: `composition cycle: ${names}`,
        });
    }

    // Whole-body dangling pass — see the BodyLink block below for why the
    // scope widens here and NOT for tier mismatch or cycle detection.
    for (const bl of collect_body_links(skills_dir)) {
        if (all_skills.has(bl.target)) {
            continue;
        }
        if (reported_dangling.has(`${bl.file}|${String(bl.line)}|${bl.link}`)) {
            continue;
        }
        violations.push({
            file: bl.file,
            line: bl.line,
            code: 'handoff_dangling',
            message: `link to \`${bl.slug}\` resolves to missing file ${bl.link}`,
        });
    }
    violations.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
    return violations;
}

// ── Whole-body cross-skill links + the link census (skill-link-integrity) ──
// The senior / `## Related Skills` pass above is a COMPOSITION contract: it
// judges tier and builds the DAG, and both of those only mean anything inside
// a declared handoff block. A dead link is a different fact — a body sentence
// telling the agent to read a file that is not on disk is wrong wherever it
// sits — and every file carrying today's dead links declares neither a `tier:`
// nor that heading, which is exactly why a gate that has owned
// `handoff_dangling` since 2026-08-02 had never seen one of them.
//
// So the scope widens for the dangling check ONLY. Tier mismatch and cycle
// detection keep the narrow scope on purpose: widening them would read every
// prose cross-reference as a composition edge, which it is not.

/** One `[slug](…SKILL.md)` link found anywhere in a SKILL.md body. */
export interface BodyLink {
    /** Absolute, symlink-resolved path of the SKILL.md carrying the link. */
    file: string;
    line: number;
    /** Link text. `LINK_RE` only matches slug-shaped text, so this is a slug. */
    slug: string;
    /** The href exactly as written. */
    link: string;
    /** `resolve_target(file, link)` — absolute, symlink-resolved. */
    target: string;
}

/** Every `[slug](…SKILL.md)` link in every SKILL.md body under `skills_dir`. */
export function collect_body_links(skills_dir: string): BodyLink[] {
    const out: BodyLink[] = [];
    for (const skill_md of _rglobSkillMd(skills_dir)) {
        const file = _resolve(skill_md);
        const lines = fs.readFileSync(skill_md, 'utf-8').split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
            const raw = lines[idx] as string;
            LINK_RE.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = LINK_RE.exec(raw)) !== null) {
                const link = m[2] as string;
                out.push({
                    file,
                    line: idx + 1,
                    slug: m[1] as string,
                    link,
                    target: resolve_target(file, link),
                });
            }
        }
    }
    return out;
}

/** Values of a block-list frontmatter key (`key:` then `  - item` lines). */
export function parse_frontmatter_list(text: string, key: string): string[] {
    if (!text.startsWith('---\n')) {
        return [];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return [];
    }
    const out: string[] = [];
    let inKey = false;
    for (const raw of text.slice(4, end).split('\n')) {
        if (/^\S/.test(raw)) {
            inKey = raw.replace(/:.*$/, '').trim() === key;
            continue;
        }
        if (inKey) {
            const m = /^\s+-\s*(.+?)\s*$/.exec(raw);
            if (m) out.push(_strip(_strip(m[1] as string, '"'), "'"));
        }
    }
    return out;
}

/** A dead link, as the census records it. */
export interface DeadLinkRecord {
    /** Repo-relative path of the referring SKILL.md. */
    file: string;
    line: number;
    /** The href exactly as written. */
    target: string;
}

/** A surviving skill linking a slug that `scoped` prunes. */
export interface ScopedDangleRecord {
    survivor: string;
    target: string;
}

/**
 * The link census Phase 0 of `road-to-skill-link-integrity-and-manifest-sync`
 * publishes. Produced by the SAME collector the gate above scans with, so the
 * published figure and the gate verdict cannot disagree — which is the whole
 * reason it lives here rather than in a script of its own.
 */
export interface SkillLinkCensus {
    schema_version: 1;
    _comment: string;
    commit: string | null;
    /** `](../<slug>/SKILL.md` occurrences — the Reproduction B.1 grep. */
    total_links_skill_md: number;
    /** `](../<slug>/` occurrences — B.1 widened to bare directory targets. */
    total_links_any_dir: number;
    /**
     * Links the GATE sees (`LINK_RE`). Lower than `total_links_skill_md`
     * because LINK_RE additionally requires slug-shaped link TEXT — and, in
     * the other direction, its href is unconstrained, so it catches targets
     * the B.1 character class cannot. Both are recorded because the gap is
     * where a dead link hid: `../create-pr:description-only/SKILL.md` carries
     * a colon, so `[a-z0-9-]*` never matched it and the drafted census
     * reported 14 dead links where the gate finds 16.
     */
    links_matched_by_gate: number;
    files_with_skill_md_link: number;
    files_with_any_relative_link: number;
    skills_total: number;
    dead_links: DeadLinkRecord[];
    /** Links whose target slug is absent from the linker's `requires_skills:`. */
    undeclared_in_requires: number;
    skills_declaring_requires: number;
    scoped_survivors: number;
    scoped_pruned: number;
    scoped_dangles: ScopedDangleRecord[];
    survivors_with_dangle: number;
}

/** Provenance carried inside the row, so a reader never has to find this file. */
const CENSUS_COMMENT =
    'Written by `./scripts-run src/scripts/lint_handoffs --census-json`. Do not ' +
    'hand-edit — regenerate it. The collector is `collect_body_links`, the same ' +
    'one the gate scans with, so the published figure and the gate verdict ' +
    'cannot drift apart. `dead_links` uses the gate predicate (a target absent ' +
    'from the live SKILL.md set), NOT the Reproduction B.1 grep — see ' +
    '`links_matched_by_gate` for why the two differ and which dead link the ' +
    'grep was blind to.';

/** `](../<slug>/SKILL.md` — the Reproduction B.1 pattern, verbatim. */
const B1_SKILL_MD_RE = /\]\(\.\.\/[a-z0-9-]*\/SKILL\.md/g;
/** `](../<slug>/` — B.1 widened to bare directory targets. */
const B1_ANY_DIR_RE = /\]\(\.\.\/[a-z0-9-]*\//g;
/** `](../` — the "carries any relative link" file counter from B.1. */
const B1_ANY_REL_RE = /\]\(\.\.\//;

/** Build the census over a skills root. `commit` is passed in, never guessed. */
export function skill_link_census(
    skills_dir: string,
    package_root: string,
    commit: string | null = null,
): SkillLinkCensus {
    const files = _rglobSkillMd(skills_dir);
    const live = new Set(files.map(_resolve));

    let total_links_skill_md = 0;
    let total_links_any_dir = 0;
    let files_with_skill_md_link = 0;
    let files_with_any_relative_link = 0;
    let skills_declaring_requires = 0;
    const requires_by_file = new Map<string, Set<string>>();

    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        const a = text.match(B1_SKILL_MD_RE) ?? [];
        const b = text.match(B1_ANY_DIR_RE) ?? [];
        total_links_skill_md += a.length;
        total_links_any_dir += b.length;
        if (a.length > 0) files_with_skill_md_link += 1;
        if (B1_ANY_REL_RE.test(text)) files_with_any_relative_link += 1;
        const req = parse_frontmatter_list(text, 'requires_skills');
        if (text.includes('requires_skills')) skills_declaring_requires += 1;
        requires_by_file.set(_resolve(f), new Set(req));
    }

    const links = collect_body_links(skills_dir);
    const dead_links: DeadLinkRecord[] = [];
    let undeclared_in_requires = 0;
    for (const bl of links) {
        if (!live.has(bl.target)) {
            dead_links.push({
                file: _relTo(bl.file, package_root),
                line: bl.line,
                target: bl.link,
            });
        }
        if (!(requires_by_file.get(bl.file) ?? new Set()).has(bl.slug)) {
            undeclared_in_requires += 1;
        }
    }

    // Scoped projection, with the installer's own predicate — never a second
    // definition of "pruned" free to disagree with the one install.ts applies.
    const active = compute_active_pack_ids(load_packs_registry(package_root), []);
    let scoped_survivors = 0;
    let scoped_pruned = 0;
    const pruned_paths = new Set<string>();
    for (const f of files) {
        if (is_pruned_under_scoped(f, active)) {
            scoped_pruned += 1;
            pruned_paths.add(_resolve(f));
        } else {
            scoped_survivors += 1;
        }
    }
    const scoped_dangles: ScopedDangleRecord[] = [];
    const survivors = new Set<string>();
    for (const bl of links) {
        if (pruned_paths.has(bl.file) || !pruned_paths.has(bl.target)) {
            continue;
        }
        scoped_dangles.push({
            survivor: path.basename(path.dirname(bl.file)),
            target: path.basename(path.dirname(bl.target)),
        });
        survivors.add(bl.file);
    }
    scoped_dangles.sort((x, y) =>
        x.survivor === y.survivor
            ? x.target.localeCompare(y.target)
            : x.survivor.localeCompare(y.survivor),
    );

    return {
        schema_version: 1,
        _comment: CENSUS_COMMENT,
        commit,
        total_links_skill_md,
        total_links_any_dir,
        links_matched_by_gate: links.length,
        files_with_skill_md_link,
        files_with_any_relative_link,
        skills_total: files.length,
        dead_links,
        undeclared_in_requires,
        skills_declaring_requires,
        scoped_survivors,
        scoped_pruned,
        scoped_dangles,
        survivors_with_dangle: survivors.size,
    };
}

/** Python repr() of a string (single-quote preference). */
function _pyRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// ── HANDOFF.md artifact validation (workflow-contracts Phase 2) ─────────
// SEPARATE concern from the cross-wing skill-handoff lint above: this
// validates the OPTIONAL standing workflow-resume artifact
// (agents/runtime/state/HANDOFF.md, written by /agent-handoff --file).
// Same file on purpose — one linter owns everything named "handoff";
// the naming reconciliation is this comment.

export const HANDOFF_ARTIFACT_REQUIRED = [
    'Mode',
    'Contract received',
    'Contract owed',
    'Decisions',
    'Open questions',
    'Next command',
] as const;

/** Returns missing required section headings ([] = valid). */
export function validate_handoff_artifact(text: string): string[] {
    const missing: string[] = [];
    for (const heading of HANDOFF_ARTIFACT_REQUIRED) {
        const re = new RegExp(`^##\\s+${heading}\\s*$`, 'mi');
        if (!re.test(text)) {
            missing.push(heading);
        }
    }
    return missing;
}

/**
 * The body of a `## <heading>` section, up to the next heading of the same or a
 * higher level. Fenced blocks are stripped first so a `##` inside a code fence
 * cannot end the section early — a resume artefact routinely quotes commands.
 */
export function handoff_section_body(text: string, heading: string): string | null {
    const withoutFences = text.replace(/^```[\s\S]*?^```\s*$/gm, '');
    const start = new RegExp(`^##\\s+${heading}\\s*$`, 'mi').exec(withoutFences);
    if (start === null) {
        return null;
    }
    const rest = withoutFences.slice(start.index + start[0].length);
    const next = /^#{1,2}\s+\S/m.exec(rest);
    return next === null ? rest : rest.slice(0, next.index);
}

// An explicit "there are none" answer. Kept as a closed list rather than a
// heuristic so the escape cannot be widened by accident: a section saying
// nothing and a section saying "none" are different facts, and only the first is
// a defect.
const _NO_OPEN_QUESTIONS = new Set(['none', 'keine', 'n/a', 'na', 'no open questions', 'nothing']);

/**
 * Strip list markers, checkbox glyphs, emphasis and trailing sentence
 * punctuation. The trailing strip is skipped when it would empty the line: a
 * line that is ONLY punctuation (`...`) is a placeholder to name, not an empty
 * section to report as blank, and the two findings say different things.
 */
function _bareLine(line: string): string {
    const stripped = line
        .trim()
        .replace(/^[-*+]\s*/, '')
        .replace(/^\[[ x~-]\]\s*/i, '')
        .replace(/[*_`]/g, '')
        .trim()
        .toLowerCase();
    const trimmed = stripped.replace(/[.!]+$/, '').trim();
    return trimmed.length > 0 ? trimmed : stripped;
}

/**
 * Shape check on the one required section whose emptiness is the defect rather
 * than a style nit. `validate_handoff_artifact` only tests that the heading
 * exists, so `## Open questions` followed by nothing passed while carrying
 * nothing — and a resume artefact whose open questions are blank hands the next
 * session a false all-clear.
 *
 * **The step this implements claimed the false-positive class was empty because
 * one `?`-terminated line is required. It is not, and the counterexample ships
 * in this repo:** `tests/scripts/lint_handoffs_artifact.test.ts` carries
 * `## Open questions` / `- none`, which is an honest answer and would be forced
 * to grow a fake question. So the check accepts EITHER a real question OR an
 * explicit none-marker, and fires only on a section that answers neither —
 * blank, or a bare placeholder. That keeps the defect the step names without
 * turning a truthful "none" into a lint error.
 *
 * Returns a finding string, or null when the shape holds. A MISSING section is
 * not this check's business — `validate_handoff_artifact` already reports it.
 */
export function validate_handoff_open_questions(text: string): string | null {
    const body = handoff_section_body(text, 'Open questions');
    if (body === null) {
        return null;
    }
    const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.some((l) => l.length > 1 && l.endsWith('?'))) {
        return null;
    }
    const bare = lines.map(_bareLine).filter((l) => l.length > 0);
    if (bare.some((l) => _NO_OPEN_QUESTIONS.has(l))) {
        return null;
    }
    if (bare.length === 0) {
        return 'section `## Open questions` is empty — carry a `?`-terminated question, or state `none`';
    }
    const placeholder = new Set(['tbd', 'todo', 'wip', '...', '…', '?']);
    if (bare.every((l) => placeholder.has(l))) {
        return 'section `## Open questions` carries only a placeholder — carry a `?`-terminated question, or state `none`';
    }
    return null;
}

export function main(argv?: readonly string[]): number {
    let skills_dir = SKILLS_DIR;
    // Positional-only: flags are NOT paths. Before this filter the CI invocation
    // (`lint_handoffs --quiet`, injected by Taskfile's QUIET_FLAG) resolved
    // `--quiet` as the skills root, scanned 0 files and exited 2 — the gate was
    // red under the exact argv CI runs while green when probed bare. That is the
    // inverse of this suite's dead-scope defect and the reason gate-coverage
    // rule 2 pins CI-identical argv.
    const rawArgs = argv ?? process.argv.slice(2);
    const args = rawArgs.filter((a) => !String(a).startsWith('-'));
    // Census mode. An added mode on the gate's own entry point rather than a
    // new script: the census MUST be produced by the collector the gate scans
    // with, or the published figure and the verdict are free to drift, which
    // is the class of defect this whole roadmap is about.
    if (rawArgs.includes('--census-json')) {
        if (args.length > 0) {
            skills_dir = _resolve(args[0] as string);
        }
        let commit: string | null = null;
        try {
            commit = execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: REPO,
                encoding: 'utf-8',
            }).trim();
        } catch {
            commit = null;
        }
        const census = skill_link_census(skills_dir, REPO, commit);
        process.stdout.write(JSON.stringify(census, null, 2) + '\n');
        return 0;
    }
    if (args.length > 0 && String(args[0]).endsWith('HANDOFF.md')) {
        // artifact mode — validate the workflow-resume file's required fields
        const text = fs.readFileSync(_resolve(args[0] as string), 'utf-8');
        const missing = validate_handoff_artifact(text);
        const shape = validate_handoff_open_questions(text);
        if (missing.length === 0 && shape === null) {
            if (!QUIET) process.stdout.write('✅  HANDOFF artifact: all required fields present\n');
            return 0;
        }
        for (const m of missing) {
            process.stdout.write(`${args[0]}:1:handoff-artifact-missing-field: missing required section \`## ${m}\`\n`);
        }
        if (shape !== null) {
            process.stdout.write(`${args[0]}:1:handoff-artifact-empty-section: ${shape}\n`);
        }
        const problems = missing.length + (shape === null ? 0 : 1);
        process.stderr.write(`❌  ${problems} HANDOFF artifact problem(s)\n`);
        return 1;
    }
    if (args.length > 0) {
        skills_dir = _resolve(args[0] as string);
    }
    const isDefaultRoot = skills_dir === SKILLS_DIR;

    // Scope assertion: zero skill files means the root moved, not that the
    // corpus is clean. This is the state the gate shipped in until 2026-08-02.
    const scanned = _rglobSkillMd(skills_dir).length;
    try {
        assertScanned({
            gate: 'lint_handoffs',
            scanned,
            units: 'skill file(s)',
            roots: [_relTo(skills_dir, REPO)],
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }
    // Gate-coverage contract (src/config/gate-coverage.yml rule 1): publish the
    // count the assertion above just validated. Emitted before the verdict
    // branches so a run WITH violations still reports its corpus — coverage and
    // verdict are different questions — and outside the QUIET guard, because CI
    // passes --quiet and a count only visible without it is not a count.
    process.stdout.write(`scanned: ${String(scanned)}\n`);

    const violations = lint(skills_dir);
    if (violations.length === 0) {
        if (!QUIET) {
            process.stdout.write(
                `✅  lint_handoffs: no violations under ${_relTo(skills_dir, REPO)} ` +
                    `(${scanned} skill file(s) scanned)\n`,
            );
        }
        return 0;
    }
    for (const v of violations) {
        process.stdout.write(_render(v, REPO) + '\n');
    }
    // Ratchet applies to the repo corpus only — an explicit fixture root is
    // judged on its own findings, never against the repo's recorded debt.
    if (isDefaultRoot) {
        const verdict = checkRatchet({
            gate: 'lint_handoffs',
            actual: violations.length,
            repoRoot: REPO,
        });
        if (verdict.ok) {
            process.stdout.write(`\n⚠️   ${verdict.message}\n`);
            return 0;
        }
        process.stderr.write(`\n❌  ${verdict.message}\n`);
        return 1;
    }
    process.stderr.write(`\n❌  lint_handoffs: ${violations.length} violation(s)\n`);
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO,
    SKILLS_DIR,
    LINK_RE,
    extract_related_block,
    split_when_subblocks,
    extract_links,
    resolve_target,
    detect_cycles,
};
