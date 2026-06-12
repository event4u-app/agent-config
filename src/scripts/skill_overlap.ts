#!/usr/bin/env node
/**
 * Structural overlap detection across skills (description + triggers).
 *
 * TypeScript twin of `src/scripts/skill_overlap.py` (ADR-090, Phase 8 /
 * Wave 8b). The public surface, CLI contract, exit codes, stderr text,
 * stdout text, and rendered markdown mirror the Python original EXACTLY
 * — same custom frontmatter parser, same tokenizer + stopword set, same
 * symbol-path regex, same Jaccard math with `round(x, 3)` banker's
 * rounding, same thresholds, same `combinations` pair order, same sort
 * key, same byte-for-byte report body. No behaviour changes.
 *
 * Output is a baseline, not a verdict.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pyRound } from './_lib/value_ladder.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// parent.parent.parent of the .py file (src/scripts/skill_overlap.py) is the
// repo root — two dirs up from src/scripts.
const REPO = path.resolve(_HERE, '..', '..');
const SKILLS = path.join(REPO, '.agent-src.uncondensed', 'skills');
const OUT = path.join(REPO, 'agents', 'metrics', 'skill-overlap.md');

const STRONG_TOKEN = 0.6;
const STRONG_SYMBOL = 0.6;
const CANDIDATE_TOKEN = 0.3;
const CANDIDATE_SYMBOL = 0.5;
const SYMBOL_MIN_SET = 4;

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a', 'an',
    'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are', 'this',
    'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no', 'after',
    'before', 'during', 'user', 'agent', 'code', 'project', 'via', 'into',
    'onto', 'even', 'without', 'naming', 'skill', 'skills', 'rule', 'rules',
    'command', 'commands', 'guideline', 'guidelines',
]);

// Python: re.compile(r"`?(?:dist/agent-src(?:\.uncondensed)?|agents|scripts|docs|tests|\.augment|\.claude)/[A-Za-z0-9_./-]+`?")
const PATH_RE =
    /`?(?:dist\/agent-src(?:\.uncondensed)?|agents|scripts|docs|tests|\.augment|\.claude)\/[A-Za-z0-9_./-]+`?/g;
// Python: re.compile(r"[A-Za-z][A-Za-z0-9_-]{2,}")
const TOKEN_RE = /[A-Za-z][A-Za-z0-9_-]{2,}/g;

interface SkillEntry {
    slug: string;
    tokens: Set<string>;
    symbols: Set<string>;
}

interface Pair {
    skill_a: string;
    skill_b: string;
    tier: string;
    description_jaccard: number;
    symbol_jaccard: number;
}

/** Python-string ordering (codepoint), for `sorted(...)` parity. */
function pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function parse_frontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---')) {
        return [{}, text];
    }
    const parts = _splitN(text, '---', 2);
    if (parts.length < 3) {
        return [{}, text];
    }
    const fmRaw = parts[1] as string;
    const body = parts[2] as string;
    const fm: Record<string, string> = {};
    let currentKey: string | null = null;
    let buf: string[] = [];
    for (const line of fmRaw.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        if (line.startsWith(' ') && currentKey !== null) {
            buf.push(line.trim());
            continue;
        }
        if (currentKey !== null) {
            fm[currentKey] = buf.length ? buf.join(' ') : (fm[currentKey] ?? '');
        }
        if (line.includes(':')) {
            const idx = line.indexOf(':');
            const k = line.slice(0, idx).trim();
            let v = line.slice(idx + 1).trim();
            currentKey = k;
            buf = [];
            if (v) {
                v = _stripQuotes(v.trim());
                fm[currentKey] = v;
                currentKey = null;
            }
        }
    }
    if (currentKey !== null && buf.length) {
        fm[currentKey] = buf.join(' ');
    }
    return [fm, body];
}

/** Mirror Python `str.split(sep, maxsplit)`. */
function _splitN(text: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = text;
    let n = 0;
    while (n < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        n += 1;
    }
    out.push(rest);
    return out;
}

/** Mirror Python `.strip().strip('"').strip("'")` chain used in the source. */
function _stripQuotes(v: string): string {
    let s = v;
    s = _strip(s, '"');
    s = _strip(s, "'");
    return s;
}

function _strip(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

export function tokenize(text: string): Set<string> {
    const out = new Set<string>();
    const matches = (text || '').match(TOKEN_RE) ?? [];
    for (const t of matches) {
        const lower = t.toLowerCase();
        if (!STOPWORDS.has(lower) && !/^\d+$/.test(t) && lower.length > 2) {
            out.add(lower);
        }
    }
    return out;
}

export function symbol_set(body: string): Set<string> {
    const out = new Set<string>();
    const matches = (body || '').match(PATH_RE) ?? [];
    for (const m of matches) {
        out.add(_strip(m, '`'));
    }
    return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) {
        return 0.0;
    }
    let inter = 0;
    for (const x of a) {
        if (b.has(x)) {
            inter += 1;
        }
    }
    const union = new Set([...a, ...b]).size;
    return inter / union;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export function load_skills(root: string): SkillEntry[] {
    const skills: SkillEntry[] = [];
    if (!_isDir(root)) {
        return skills;
    }
    // sorted(root.glob("*/SKILL.md")) — by full POSIX path string.
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return skills;
    }
    const skillMds: string[] = [];
    for (const name of names) {
        const md = path.join(root, name, 'SKILL.md');
        try {
            if (fs.statSync(md).isFile()) {
                skillMds.push(md);
            }
        } catch {
            /* not a file */
        }
    }
    skillMds.sort(pyStrCmp);
    for (const skillMd of skillMds) {
        const slug = path.basename(path.dirname(skillMd));
        const text = fs.readFileSync(skillMd, 'utf-8');
        const [fm, body] = parse_frontmatter(text);
        const desc = fm['description'] ?? '';
        const trig = ['triggers', 'keywords', 'intents', 'domain']
            .map((k) => fm[k] ?? '')
            .join(' ');
        skills.push({
            slug,
            tokens: tokenize(desc + ' ' + trig),
            symbols: symbol_set(body),
        });
    }
    return skills;
}

export function analyse(skills: SkillEntry[]): Pair[] {
    const pairs: Pair[] = [];
    // itertools.combinations(skills, 2) — index order, i<j.
    for (let i = 0; i < skills.length; i++) {
        for (let k = i + 1; k < skills.length; k++) {
            const a = skills[i] as SkillEntry;
            const b = skills[k] as SkillEntry;
            const j = jaccard(a.tokens, b.tokens);
            let s: number;
            if (Math.min(a.symbols.size, b.symbols.size) >= SYMBOL_MIN_SET) {
                s = jaccard(a.symbols, b.symbols);
            } else {
                s = 0.0;
            }
            let tier: string;
            if (j >= STRONG_TOKEN || s >= STRONG_SYMBOL) {
                tier = 'strong';
            } else if (j >= CANDIDATE_TOKEN || s >= CANDIDATE_SYMBOL) {
                tier = 'candidate';
            } else {
                continue;
            }
            pairs.push({
                skill_a: a.slug,
                skill_b: b.slug,
                tier,
                description_jaccard: pyRound(j, 3),
                symbol_jaccard: pyRound(s, 3),
            });
        }
    }
    // pairs.sort(key=lambda p: (p["tier"] != "strong",
    //                           -max(p["description_jaccard"], p["symbol_jaccard"])))
    // Python's sort is stable; a tie keeps combinations order.
    pairs.sort((p1, p2) => {
        const t1 = p1.tier !== 'strong' ? 1 : 0;
        const t2 = p2.tier !== 'strong' ? 1 : 0;
        if (t1 !== t2) {
            return t1 - t2;
        }
        const m1 = -Math.max(p1.description_jaccard, p1.symbol_jaccard);
        const m2 = -Math.max(p2.description_jaccard, p2.symbol_jaccard);
        if (m1 < m2) return -1;
        if (m1 > m2) return 1;
        return 0;
    });
    return pairs;
}

/** Python `str(float)` repr for our rounded Jaccard values. */
function pyFloatStr(value: number): string {
    if (Number.isInteger(value)) {
        return `${value}.0`;
    }
    return String(value);
}

export function render(pairs: Pair[], total: number): string {
    const strong = pairs.filter((p) => p.tier === 'strong');
    const candidate = pairs.filter((p) => p.tier === 'candidate');
    const lines: string[] = [
        '# Skill Structural Overlap (baseline)',
        '',
        '> Generated by `scripts/skill_overlap.py`. Scans',
        '> `.agent-src.uncondensed/skills/*/SKILL.md` frontmatter (description +',
        '> trigger metadata) and body symbol references. Reports pairs in two',
        `> tiers: **strong** ≥ ${pyFloatStr(STRONG_TOKEN)} description-token Jaccard or ≥ ${pyFloatStr(STRONG_SYMBOL)}`,
        `> symbol-set Jaccard (roadmap floor); **candidate** ≥ ${pyFloatStr(CANDIDATE_TOKEN)} / ≥ ${pyFloatStr(CANDIDATE_SYMBOL)}`,
        '> (empirical calibration — skill descriptions encode distinct trigger',
        '> language by design, so the roadmap floor catches structural carbon-',
        '> copies only). See [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)',
        '> Phase 2 Step 2.',
        '',
        `**Skills scanned:** ${total} · **Strong pairs:** ${strong.length} · ` +
            `**Candidate pairs:** ${candidate.length}`,
        '',
        '| # | skill_a | skill_b | tier | desc_jaccard | symbol_jaccard |',
        '|---|---|---|---|---|---|',
    ];
    let i = 0;
    for (const p of pairs) {
        i += 1;
        lines.push(
            `| ${i} | \`${p.skill_a}\` | \`${p.skill_b}\` | ${p.tier} | ` +
                `${pyFloatStr(p.description_jaccard)} | ${pyFloatStr(p.symbol_jaccard)} |`,
        );
    }
    lines.push('');
    lines.push(
        '**Read-out:** `strong` pairs are first-cut merge / supersede candidates. ' +
            '`candidate` pairs are worth a Phase 2 Step 3 review but the description ' +
            'signal is faint — usage data (30-day activation report) is the deciding ' +
            'input, not this report. Structural overlap alone is evidence, not a verdict.',
    );
    lines.push('');
    return lines.join('\n');
}

/**
 * Mirror `Path.relative_to(REPO)` — throws when `p` is NOT under `REPO`
 * (Python `ValueError` → traceback + exit 1). Latent behaviour replicated
 * intentionally; flagged as a divergence candidate.
 */
function _relativeToRepo(p: string): string {
    const abs = path.resolve(p);
    const rel = path.relative(REPO, abs);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(
            `'${abs}' is not in the subpath of '${REPO}' ` +
                `OR one path is relative and the other is absolute.`,
        );
    }
    return rel.split(path.sep).join('/');
}

interface ParsedArgs {
    out: string;
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { out: OUT, quiet: false };
    const fail = (msg: string): never => {
        process.stderr.write(`skill_overlap: error: ${msg}\n`);
        process.exit(2);
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--out') {
            const v = argv[++i];
            if (v === undefined) fail('argument --out: expected one argument');
            out.out = path.resolve(v as string);
        } else if (a.startsWith('--out=')) {
            out.out = path.resolve(a.slice('--out='.length));
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: skill_overlap [-h] [--out OUT] [--quiet]\n');
            process.exit(0);
        } else {
            fail(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const skills = load_skills(SKILLS);
    if (!skills.length) {
        process.stderr.write(`no skills under ${SKILLS}\n`);
        return 1;
    }
    const pairs = analyse(skills);
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, render(pairs, skills.length), 'utf-8');
    if (!args.quiet) {
        process.stdout.write(
            `✅  Wrote ${_relativeToRepo(args.out)} ` +
                `(${skills.length} skills, ${pairs.length} pair(s) flagged)\n`,
        );
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
    // Symlinked temp dirs (e.g. macOS /var → /private/var) make the raw URLs
    // differ; compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    process.exitCode = main();
}
