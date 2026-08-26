#!/usr/bin/env node
/**
 * Block D · D2 — score_skill_relevance.
 *
 * Ported from the retired Python `src/scripts/skill_tools/score_skill_relevance.py`
 * (ADR-200, Phase 8 Wave 8h). The CLI contract is pinned —
 * flags (`--task`, `--skills-dir`, `--top`, `--json`, `--sample`), exit
 * codes (0 / 2), stdout/stderr split, byte-identical human table AND
 * byte-identical JSON (`json.dump(..., indent=2)`, ensure_ascii default).
 *
 * Rank skills by relevance to a free-form task description.
 *
 * Heuristic (council iter-1 D-OQ1 verdict (b) — discovery-story tool 1):
 *
 *   score = keyword_overlap * 70 + persona_match * 30
 *
 * where:
 *   - keyword_overlap = |task_terms ∩ skill_terms| / |task_terms|
 *     (skill_terms = tokens from `name` + `description`)
 *   - persona_match  = 1.0 if any persona on the skill is named or
 *     role-mentioned in the task, else 0.0
 *
 * Inputs:
 *   --task TEXT      — task description (required)
 *   --skills-dir DIR — directory holding SKILL.md files (default: package skills)
 *   --top N          — emit only top-N ranked skills (default: all non-zero)
 *   --json           — machine-readable ranked output
 *
 * Output: ranked list with integer scores 0–100, descending. Ties break on name.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The formula, the stopword list and the tokenizer live in one Node-free
// module so the pure stdio-lite dispatcher can share them instead of growing
// a second copy (road-to-skill-delivery-over-mcp risk 6). Everything below is
// the disk half — globbing, frontmatter, the CLI — which stays here.
import {
    scoreSkill,
    skillTerms as _sharedSkillTerms,
    tokenize as _sharedTokenize,
    triggerTextFromFlatLines,
    type RankOptions,
} from '../../shared/skillRanking.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_tools/score_skill_relevance.ts → parents[3] of the .py
// (skill_tools → scripts → src → repo root) is the package root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
/**
 * The skills root, resolved the way the two real consumers already resolve it.
 *
 * `road-to-inbox-harvest-2026-08-f-skill-selection-evidence` 1.1. This used to be
 * a hardcoded path to a directory that no longer exists, and the failure was
 * SILENT: `--task "review a pull request"` printed `(no relevant skills found)`
 * and exited 0, which is indistinguishable from a task that genuinely matches
 * nothing. A ranker that reports an empty catalogue as an empty result is worse
 * than one that crashes.
 *
 * `resolveSkillsRoot` is the shared resolver the `skill-route` concern and the
 * `suggest_skill_for_task` MCP handler use — deliberately shared, because two
 * resolvers over one catalogue is how a ranker and the tool that exposes it
 * start ranking different trees. `null` when no candidate root exists, and the
 * CLI turns that into a distinct exit code rather than an empty list.
 */
import { DEFAULT_CATALOGUE_ROOTS, resolveSkillsRoot } from '../_lib/skill_catalogue.js';

export const DEFAULT_SKILLS_DIR: string | null = resolveSkillsRoot(ROOT);

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

export function _tokenize(text: string): Set<string> {
    // Single-sourced in `src/shared/skillRanking.ts`. Kept as an export because
    // the CLI-parity suite and the hook path both import this name.
    return _sharedTokenize(text);
}

export interface Frontmatter {
    [key: string]: string | string[];
}

/** Minimal YAML-frontmatter reader (stdlib-only). Returns {} on parse miss. */
export function _parse_frontmatter(filePath: string): Frontmatter {
    // text.read_text(errors="replace") — Node `utf-8` decode replaces the same
    // way for the inputs these tools see (well-formed SKILL.md files).
    const text = fs.readFileSync(filePath, 'utf-8');
    if (!text.startsWith('---')) {
        return {};
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }
    const block = text.slice(3, end);
    const out: Frontmatter = {};
    let currentListKey: string | null = null;
    // block.splitlines() — split on Python universal newlines; \n suffices for
    // the well-formed frontmatter blocks these tools read.
    for (const raw of _splitlines(block)) {
        // line = raw.rstrip() — strip trailing whitespace (Python str.rstrip).
        const line = _rstrip(raw);
        if (!line || line.startsWith('#')) {
            continue;
        }
        if (currentListKey !== null && line.startsWith('  - ')) {
            const existing = out[currentListKey];
            const list = Array.isArray(existing) ? existing : [];
            if (!Array.isArray(existing)) {
                out[currentListKey] = list;
            }
            list.push(line.slice(4).trim());
            continue;
        }
        currentListKey = null;
        // re.match(r"^([a-zA-Z_][\w-]*)\s*:\s*(.*)$", line)
        const m = /^([a-zA-Z_][\w-]*)[ \t\r\f\v]*:[ \t\r\f\v]*(.*)$/u.exec(line);
        if (!m) {
            continue;
        }
        const key = m[1] as string;
        let val = (m[2] as string).trim();
        if (val === '') {
            currentListKey = key;
            continue;
        }
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

/** Mirror Python str.splitlines() for the newline shapes frontmatter uses. */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    // Python splitlines() drops a trailing newline (no empty tail element).
    return s.split(/\r\n|\r|\n/u);
}

/** Mirror Python str.rstrip() — strip trailing ASCII + Unicode whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

export interface Skill {
    name: string;
    description: string;
    personas: string[];
    terms: Set<string>;
    /** `triggers[].keyword` / `.phrase` prose. Indexed only under keyword-v2. */
    triggerText: string[];
}

function _load_skills(skillsDir: string): Skill[] {
    const skills: Skill[] = [];
    for (const skillMd of _globSkillMd(skillsDir)) {
        const fm = _parse_frontmatter(skillMd);
        const rawName = fm['name'];
        const name = _truthyStr(rawName) ? String(rawName) : path.basename(path.dirname(skillMd));
        const rawDesc = fm['description'];
        const desc = _truthyStr(rawDesc) ? String(rawDesc) : '';
        let personas = fm['personas'] ?? [];
        if (typeof personas === 'string') {
            personas = [personas];
        }
        const personaList = [...personas];
        const rawTriggers = fm['triggers'];
        const triggerText = Array.isArray(rawTriggers)
            ? triggerTextFromFlatLines(rawTriggers as string[])
            : [];
        skills.push({
            name,
            description: desc,
            personas: personaList,
            terms: _tokenize(name + ' ' + desc),
            triggerText,
        });
    }
    return skills;
}

/** Python `fm.get(key) or default` — falsy strings ('', undefined) fall through. */
function _truthyStr(v: string | string[] | undefined): boolean {
    if (typeof v === 'string') {
        return v !== '';
    }
    return false;
}

/**
 * Sorted SKILL.md files (mirrors `sorted(skills_dir.glob("*<slash>SKILL.md"))`).
 *
 * Python sorts `Path` objects component-wise. Since every match is
 * `<dir>/SKILL.md`, sorting by the directory component reproduces that order.
 */
function _globSkillMd(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const dirs: string[] = [];
    for (const name of names) {
        const dir = path.join(root, name);
        const skillMd = path.join(dir, 'SKILL.md');
        try {
            if (fs.statSync(dir).isDirectory() && fs.statSync(skillMd).isFile()) {
                dirs.push(name);
            }
        } catch {
            // not a dir / no SKILL.md
        }
    }
    dirs.sort();
    return dirs.map((name) => path.join(root, name, 'SKILL.md'));
}

function _score(taskTerms: Set<string>, skill: Skill, opts: RankOptions = {}): number {
    // Single-sourced in `src/shared/skillRanking.ts`. Under keyword-v1 (the
    // default) `skill.terms` is already `tokenize(name + ' ' + description)`, so
    // the precomputed set is reused unchanged; keyword-v2 re-derives the term
    // set with the skill's trigger prose folded in.
    const rankable = {
        name: skill.name,
        description: skill.description,
        personas: skill.personas,
        triggerText: skill.triggerText,
    };
    const terms = opts.includeTriggers ? _sharedSkillTerms(rankable, opts) : skill.terms;
    return scoreSkill(taskTerms, rankable, terms);
}

export type RankRow = [string, number, string[]];

export function rank(task: string, skillsDir: string, opts: RankOptions = {}): RankRow[] {
    const taskTerms = _tokenize(task);
    const skills = _load_skills(skillsDir);
    const rows: RankRow[] = [];
    for (const s of skills) {
        const score = _score(taskTerms, s, opts);
        if (score > 0) {
            rows.push([s.name, score, [...s.personas]]);
        }
    }
    // rows.sort(key=lambda r: (-r[1], r[0])) — Python stable tuple sort.
    rows.sort((a, b) => {
        if (b[1] !== a[1]) {
            return b[1] - a[1];
        }
        if (a[0] < b[0]) {
            return -1;
        }
        if (a[0] > b[0]) {
            return 1;
        }
        return 0;
    });
    return rows;
}

/** Mirror Python `f"{s:<{w}}"` (left-justify) over code-point width. */
function _ljust(s: string, w: number): string {
    const len = pyLen(s);
    return len >= w ? s : s + ' '.repeat(w - len);
}

/** Mirror Python `f"{n:3d}"` (right-justify width 3). */
function _rjust3(n: number): string {
    const s = String(n);
    return s.length >= 3 ? s : ' '.repeat(3 - s.length) + s;
}

function _print_human(rowsIn: RankRow[], top: number | null): string[] {
    let rows = rowsIn;
    if (top) {
        rows = rows.slice(0, top);
    }
    if (rows.length === 0) {
        return ['(no relevant skills found)'];
    }
    const width = Math.max(...rows.map((r) => pyLen(r[0])));
    const lines: string[] = [];
    for (const [name, score, personas] of rows) {
        const personaStr = personas.length > 0 ? personas.join(', ') : '—';
        lines.push(`  ${_rjust3(score)}  ${_ljust(name, width)}  ${personaStr}`);
    }
    return lines;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True default) -------------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

// --- argparse surface --------------------------------------------------------

const PROG = 'score_skill_relevance.py';

interface Args {
    task: string;
    /** `null` when no catalogue root exists — a DIFFERENT answer from an empty ranking. */
    skills_dir: string | null;
    top: number;
    json: boolean;
    sample: boolean;
}

function _argError(message: string): never {
    // argparse prints usage + "PROG: error: MESSAGE" to stderr, exits 2.
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

function _parseInt(raw: string): number {
    // argparse type=int → Python int(); rejects non-integer strings.
    if (!/^[+-]?\d+$/u.test(raw.trim())) {
        _argError(`argument --top: invalid int value: '${raw}'`);
    }
    return parseInt(raw, 10);
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        task: '',
        skills_dir: DEFAULT_SKILLS_DIR,
        top: 0,
        json: false,
        sample: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--sample') {
            args.sample = true;
        } else if (a === '--task') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --task: expected one argument');
            }
            args.task = v;
        } else if (a.startsWith('--task=')) {
            args.task = a.slice('--task='.length);
        } else if (a === '--skills-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --skills-dir: expected one argument');
            }
            args.skills_dir = v;
        } else if (a.startsWith('--skills-dir=')) {
            args.skills_dir = a.slice('--skills-dir='.length);
        } else if (a === '--top') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --top: expected one argument');
            }
            args.top = _parseInt(v);
        } else if (a.startsWith('--top=')) {
            args.top = _parseInt(a.slice('--top='.length));
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export const _SAMPLE = {
    task: 'build a livewire component for the user dashboard with reactive state',
};

/**
 * Why this catalogue root cannot be ranked, or `null` when it can.
 *
 * `road-to-inbox-harvest-2026-08-f-skill-selection-evidence` 1.2. Three states,
 * and the middle one is the one that actually bit: a root that does not exist, a
 * root that exists and is EMPTY, and a readable root. `.claude/skills` is a
 * gitignored projection, so a fresh worktree has the second — and the ranker
 * reported it as "no relevant skills found", exit 0, on a task that scores 47
 * against `src/skills`.
 *
 * An empty directory is not a missing directory, and neither is an empty result.
 */
function catalogueDeficit(dir: string | null): string | null {
    if (dir === null) {
        return `no catalogue root resolved — tried ${DEFAULT_CATALOGUE_ROOTS.join(', ')} under ${ROOT}`;
    }
    try {
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            return `${dir} is not a directory`;
        }
        if (fs.readdirSync(dir).length === 0) {
            return `${dir} exists and is EMPTY — an empty catalogue, not an empty result`;
        }
    } catch (e) {
        return `${dir} could not be read: ${e instanceof Error ? e.message : String(e)}`;
    }
    return null;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const task = args.sample ? _SAMPLE.task : args.task;
    if (!task) {
        _argError('--task is required (or pass --sample)');
    }
    // 1.2 — "no matches" and "no catalogue" are DIFFERENT answers and now have
    // different exit codes. `missing-skill-recovery` already draws that line for
    // the MCP tool (`status: no_catalogue`); the CLI did not, and an agent
    // reading `(no relevant skills found)` from an unreachable catalogue
    // concludes "no skill covers this" — the exact wrong conclusion that rule
    // exists to prevent.
    // The check covers an EXPLICIT --skills-dir too, not only the default. An
    // operator who passes a wrong path is in exactly the position the silent
    // failure was about, and answering them with "(no relevant skills found)"
    // is the same wrong answer with a different cause.
    const unreadable = catalogueDeficit(args.skills_dir);
    if (unreadable !== null) {
        if (args.json) {
            process.stdout.write(
                pyJsonDumpsIndent2({
                    task,
                    status: 'no_catalogue',
                    reason: unreadable,
                    ...(args.skills_dir === null ? { tried: [...DEFAULT_CATALOGUE_ROOTS] } : { skills_dir: args.skills_dir }),
                }),
            );
            process.stdout.write('\n');
        } else {
            process.stderr.write(
                `(no skills catalogue read — ${unreadable})\n` +
                    'This is NOT "no skill matches": nothing was read, so no conclusion about ' +
                    'skill coverage follows from it.\n',
            );
        }
        return 3;
    }
    // Non-null past the deficit check above, which returns before this line
    // whenever the root cannot be ranked.
    const rows = rank(task, args.skills_dir as string);
    if (args.json) {
        const sliced = args.top ? rows.slice(0, args.top) : rows;
        const payload = sliced.map(([n, s, p]) => ({ name: n, score: s, personas: p }));
        process.stdout.write(pyJsonDumpsIndent2({ task, ranked: payload }));
        process.stdout.write('\n');
    } else {
        const lines = _print_human(rows, args.top || null);
        process.stdout.write(lines.join('\n') + '\n');
    }
    return 0;
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

const _isMain = _isCliEntry();
if (_isMain) {
    process.exitCode = main();
}
