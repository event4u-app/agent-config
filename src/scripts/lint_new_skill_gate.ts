#!/usr/bin/env tsx
/**
 * Forward gate for NEW skills (6.0.0-C Phase 4 Step 8b).
 *
 * TypeScript twin of `src/scripts/lint_new_skill_gate.py` (ADR-096, Phase 4 /
 * Wave 4b — PORT). Mirrors the CLI contract EXACTLY — the `--baseline` (default
 * `main`) and `--quiet` argparse flags, the git diff/status forward-only skill
 * detection, byte-identical violation messages, stdout-only output (no
 * stderr split except the git-failure exit-3 path), and exit codes
 * (0 clean · 1 violations · 3 internal/git error). snake_case kept. No
 * behaviour changes — latent quirks replicated.
 *
 * A newly added skill must clear two gates before it joins the surface:
 *
 *   1. Triggers stub — `evals/triggers.json` with >= MIN_TRIGGER should-trigger
 *      AND >= MIN_TRIGGER should-not-trigger queries.
 *   2. Dedupe — its body must not exceed DEDUPE_THRESHOLD content overlap with
 *      any EXISTING same-domain skill (shared `packs:`).
 *
 * FORWARD-ONLY: only SKILL.md files added since `--baseline` are gated.
 *
 * The Python original imports `_parse`, `_cosine`, `collect`, `Skill` from
 * `audit_skill_overlap`. That module has no TS twin in this batch, so the four
 * needed symbols are ported privately below (faithful 1:1 of the originals);
 * when `audit_skill_overlap` is ported in its own phase these can be
 * re-pointed at its twin without behaviour change.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// Path(__file__).resolve().parent.parent.parent — repo root (three dirs up).
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const MIN_TRIGGER = 5;
const DEDUPE_THRESHOLD = 0.7;

// --- audit_skill_overlap symbols (ported 1:1) --------------------------------

const _FM_RE = /^---\n([\s\S]*?)\n---/;
const _STOPWORDS = new Set<string>([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a', 'an',
    'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are', 'this',
    'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no', 'after',
    'before', 'during', 'user', 'agent', 'code', 'project', 'via', 'into',
    'onto', 'even', 'without', 'naming', 'run', 'runs', 'running', 'each',
    'every', 'one', 'two', 'now', 'then', 'also', 'based', 'default', 'skill',
    'you', 'your', 'should', 'must', 'see', 'do', 'not',
]);

/** Mirror of `audit_skill_overlap.Skill`. `vector` is a token→count Counter. */
interface Skill {
    name: string;
    relpath: string;
    packs: Set<string>;
    vector: Map<string, number>;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Mirror `_skill_roots()`. */
function _skill_roots(): string[] {
    const pkgs = path.join(ROOT, 'packages');
    let roots: string[] = [];
    if (_isDir(pkgs)) {
        let entries: string[];
        try {
            entries = fs.readdirSync(pkgs);
        } catch {
            entries = [];
        }
        entries.sort();
        for (const name of entries) {
            const cand = path.join(pkgs, name, '.agent-src.uncondensed', 'skills');
            if (_isDir(cand)) {
                roots.push(cand);
            }
        }
    }
    const legacy = path.join(ROOT, '.agent-src.uncondensed', 'skills');
    if (roots.length === 0 && _isDir(legacy)) {
        roots = [legacy];
    }
    return roots;
}

/** Mirror `_keyword_vector(text)`. */
function _keyword_vector(text: string): Map<string, number> {
    const counter = new Map<string, number>();
    const re = /[a-z][a-z0-9_-]{2,}/g;
    const lower = text.toLowerCase();
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
        const t = m[0];
        if (!_STOPWORDS.has(t)) {
            counter.set(t, (counter.get(t) ?? 0) + 1);
        }
    }
    return counter;
}

/** Mirror `_cosine(a, b)`. */
function _cosine(a: Map<string, number>, b: Map<string, number>): number {
    let num = 0;
    let hasShared = false;
    for (const [t, av] of a) {
        const bv = b.get(t);
        if (bv !== undefined) {
            hasShared = true;
            num += av * bv;
        }
    }
    if (!hasShared) {
        return 0.0;
    }
    let da = 0;
    for (const v of a.values()) da += v * v;
    da = Math.sqrt(da);
    let db = 0;
    for (const v of b.values()) db += v * v;
    db = Math.sqrt(db);
    return da && db ? num / (da * db) : 0.0;
}

/** `yaml.safe_load` with PyYAML-lenient duplicate keys; null on empty. */
function _safeLoad(text: string): unknown {
    try {
        const doc = YAML.parse(text, { version: '1.1', uniqueKeys: false });
        return doc ?? null;
    } catch {
        return null;
    }
}

/** Mirror `_parse(md)`. `md` is an absolute path string. */
function _parse(md: string): Skill {
    const text = fs.readFileSync(md, 'utf-8');
    let fm: unknown = {};
    let body = text;
    const m = _FM_RE.exec(text);
    if (m) {
        fm = _safeLoad(m[1] as string) ?? {};
        body = text.slice(m.index + m[0].length);
    }
    const fmObj = fm !== null && typeof fm === 'object' && !Array.isArray(fm)
        ? (fm as Record<string, unknown>)
        : null;
    const name = fmObj ? fmObj['name'] : undefined;
    const packs = fmObj ? fmObj['packs'] : undefined;
    return {
        name: name ? String(name) : path.basename(path.dirname(md)),
        relpath: _relToRoot(md),
        packs: Array.isArray(packs) ? new Set(packs.map((x) => String(x))) : new Set(),
        vector: _keyword_vector(body),
    };
}

/** Mirror `md.relative_to(ROOT)` (POSIX). */
function _relToRoot(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

/** Mirror `collect()`. */
function collect(): Skill[] {
    const skills: Skill[] = [];
    const seen = new Set<string>();
    for (const root of _skill_roots()) {
        for (const md of _rglobSorted(root, 'SKILL.md')) {
            if (md.split(path.sep).includes('_archive')) {
                continue;
            }
            const key = path.basename(path.dirname(md));
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            skills.push(_parse(md));
        }
    }
    return skills;
}

/** sorted(root.rglob(name)) — every descendant file/dir whose basename matches. */
function _rglobSorted(root: string, name: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name === name) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

// --- git helpers -------------------------------------------------------------

/** Mirror `_git(args)` — exit 3 with the same stderr text on failure. */
function _git(args: string[]): string {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    if (r.error) {
        // FileNotFoundError / TimeoutExpired path.
        process.stderr.write(`❌  git ${args.join(' ')} failed: ${r.error.message}\n`);
        process.exit(3);
    }
    if (r.status !== 0) {
        process.stderr.write(`❌  git ${args.join(' ')} exit ${r.status}: ${r.stderr}\n`);
        process.exit(3);
    }
    return r.stdout;
}

/** Mirror `added_skill_files(baseline)`. */
function added_skill_files(baseline: string): string[] {
    const out = new Set<string>();
    for (const p of _git(['diff', '--name-only', '--diff-filter=A', `${baseline}...HEAD`]).split(
        '\n',
    )) {
        if (p.trim().endsWith('/SKILL.md')) {
            out.add(p.trim());
        }
    }
    for (const line of _git(['status', '--porcelain', '-uall']).split('\n')) {
        const st = line.slice(0, 2).trim();
        const pathPart = line.slice(3).trim().split(' -> ').pop() as string;
        if (pathPart.endsWith('/SKILL.md') && ['A', '??', 'AM'].includes(st)) {
            out.add(pathPart);
        }
    }
    return [...out].sort();
}

// --- gate checks -------------------------------------------------------------

/** Mirror `check_triggers(skill_dir)`. `skill_dir` is an absolute path. */
function check_triggers(skillDir: string): string | null {
    const tj = path.join(skillDir, 'evals', 'triggers.json');
    if (!_exists(tj)) {
        const relTj = _relToRoot(tj);
        return (
            `missing \`${relTj}\` — a new skill needs a ` +
            `triggers stub (${MIN_TRIGGER} should-trigger + ${MIN_TRIGGER} ` +
            `should-not-trigger queries; see skill-writing § 1c)`
        );
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(tj, 'utf-8'));
    } catch (exc) {
        return `triggers.json is invalid JSON: ${_jsonDecodeMessage(exc)}`;
    }
    const queries =
        data !== null && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, unknown>)['queries']
            : undefined;
    if (!Array.isArray(queries)) {
        return 'triggers.json has no `queries` list';
    }
    let pos = 0;
    let neg = 0;
    for (const q of queries) {
        if (q !== null && typeof q === 'object' && !Array.isArray(q)) {
            const trig = (q as Record<string, unknown>)['trigger'];
            if (trig === true) pos += 1;
            else if (trig === false) neg += 1;
        }
    }
    if (pos < MIN_TRIGGER || neg < MIN_TRIGGER) {
        return (
            `triggers.json has ${pos} should-trigger / ${neg} ` +
            `should-not-trigger — need >= ${MIN_TRIGGER} of each`
        );
    }
    return null;
}

/** Mirror `check_dedupe(new, existing)`. */
function check_dedupe(newSkill: Skill, existing: Skill[]): string | null {
    for (const other of existing) {
        if (other.relpath === newSkill.relpath) {
            continue;
        }
        if (!_setsIntersect(newSkill.packs, other.packs)) {
            continue; // different domain — not a dedupe target
        }
        const sim = _cosine(newSkill.vector, other.vector);
        if (sim >= DEDUPE_THRESHOLD) {
            return (
                `${_pctRound(sim)} content overlap with existing same-domain skill ` +
                `\`${other.name}\` (${other.relpath}) — exceeds ` +
                `${_pctRound(DEDUPE_THRESHOLD)}. Merge into it or extend it instead ` +
                `of adding a near-duplicate (evidence-based-pruning.md)`
            );
        }
    }
    return null;
}

function _setsIntersect(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) {
        if (b.has(x)) return true;
    }
    return false;
}

/** Python `f"{x:.0%}"` — round-half-to-even percentage with a trailing `%`. */
function _pctRound(x: number): string {
    return `${_roundHalfEven(x * 100)}%`;
}

/** Python `round()` uses banker's rounding (round-half-to-even). */
function _roundHalfEven(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}

/** Best-effort JSONDecodeError-style message (Python text differs; flagged). */
function _jsonDecodeMessage(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

// --- main --------------------------------------------------------------------

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    const parsed = _parseArgs(args);
    if (parsed.exit !== null) {
        return parsed.exit;
    }
    const { baseline, quiet } = parsed;

    const added = added_skill_files(baseline);
    if (added.length === 0) {
        if (!quiet) {
            process.stdout.write(`✅  No new skills added (baseline: ${baseline}).\n`);
        }
        return 0;
    }

    const addedSet = new Set(added);
    const allSkills = collect();
    const existing = allSkills.filter((s) => !addedSet.has(s.relpath));

    const violations: string[] = [];
    for (const relpath of added) {
        const skillDir = path.dirname(path.join(ROOT, relpath));
        if (!_exists(skillDir)) {
            continue;
        }
        const newSkill = _parse(path.join(ROOT, relpath));
        const tmsg = check_triggers(skillDir);
        if (tmsg !== null) {
            violations.push(`${relpath} — ${tmsg}`);
        }
        const dmsg = check_dedupe(newSkill, existing);
        if (dmsg !== null) {
            violations.push(`${relpath} — ${dmsg}`);
        }
    }

    if (violations.length > 0) {
        process.stdout.write(`❌  ${violations.length} new-skill gate violation(s):\n`);
        for (const v of violations) {
            process.stdout.write(`  • ${v}\n`);
        }
        process.stdout.write(
            '\nSee docs/contracts/evidence-based-pruning.md and skill-writing § 1c.\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  ${added.length} new skill(s) cleared the triggers + dedupe gate ` +
                `(baseline: ${baseline}).\n`,
        );
    }
    return 0;
}

interface ParsedArgs {
    baseline: string;
    quiet: boolean;
    exit: number | null;
}

function _parseArgs(args: string[]): ParsedArgs {
    let baseline = 'main';
    let quiet = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_new_skill_gate.py [-h] [--baseline BASELINE] [--quiet]\n');
            return { baseline, quiet, exit: 0 };
        }
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '--baseline') {
            baseline = (args[++i] as string) ?? '';
        } else if (a.startsWith('--baseline=')) {
            baseline = a.slice('--baseline='.length);
        } else {
            process.stderr.write(
                'usage: lint_new_skill_gate.py [-h] [--baseline BASELINE] [--quiet]\n' +
                    `lint_new_skill_gate.py: error: unrecognized arguments: ${a}\n`,
            );
            return { baseline, quiet, exit: 2 };
        }
    }
    return { baseline, quiet, exit: null };
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, MIN_TRIGGER, DEDUPE_THRESHOLD, check_triggers, check_dedupe, added_skill_files };
