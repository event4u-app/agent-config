#!/usr/bin/env tsx
/**
 * Activation-likelihood heuristic for the Rule-Governance pass
 * (Phase 5.3 of road-to-augment-limit-fit).
 *
 * TypeScript twin of `src/scripts/audit_likelihood.py` (ADR-094 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the Python CLI
 * contract EXACTLY — no flags, exit codes (0 ok / 1 missing audit
 * JSON), the stdout/stderr split, byte-identical stdout messages, and
 * byte-identical written artefacts (`json.dumps(..., indent=2)` for the
 * likelihood dump + the exact appended Markdown section).
 *
 * No `_lib` imports — the Python original has none; it reads the audit
 * JSON written by `audit_auto_rules.py` and globs a fixed corpus.
 *
 * For every auto-rule from `agents/reports/auto-rules-audit.json`:
 *
 * 1. Build a token set from `description`, `triggers[].keyword`,
 *    `triggers[].intent`, and the rule name itself.
 * 2. Index a corpus of skills (`SKILL.md`), contexts, guidelines, and
 *    command files.
 * 3. Score `corpus_hits = sum(1 for token in tokens if token in corpus)`.
 * 4. Flag rules with `< 2` corpus hits as "low-likelihood".
 *
 * No behaviour changes — latent Python quirks replicated, including the
 * `dict(sorted(...)[:8])` top-8 hit truncation and the corpus-keyword
 * heuristic.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/audit_likelihood.py → parent.parent.parent == repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
export const AUDIT_JSON = path.join(REPORT_DIR, 'auto-rules-audit.json');
export const AUDIT_MD = path.join(REPORT_DIR, 'auto-rules-audit.md');
export const LIKELIHOOD_JSON = path.join(REPORT_DIR, 'auto-rules-likelihood.json');

const CORPUS_GLOBS: readonly string[] = [
    '.agent-src.uncondensed/skills/**/SKILL.md',
    '.agent-src.uncondensed/commands/**/*.md',
    'agents/settings/contexts/**/*.md',
    'docs/guidelines/**/*.md',
];

const LOW_LIKELIHOOD_HITS = 2;

const STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a',
    'an', 'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are',
    'this', 'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no',
    'after', 'before', 'during', 'user', 'agent', 'code', 'project',
    'via', 'into', 'onto', 'even', 'without', 'naming', 'rule', 'rules',
    'skill', 'skills', 'command', 'commands', 'files', 'file', 'doc',
    'docs', 'md', 'txt',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/**
 * Mirror Python `re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())`
 * then filter stopwords + `len(t) > 3`. Returns a set (insertion-order
 * irrelevant — callers sort).
 */
export function tokens(text: string): Set<string> {
    const out = new Set<string>();
    const re = /[A-Za-z][A-Za-z0-9_-]{2,}/g;
    const lowered = text.toLowerCase();
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowered)) !== null) {
        const t = m[0];
        if (!STOPWORDS.has(t) && pyLen(t) > 3) {
            out.add(t);
        }
    }
    return out;
}

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

/**
 * Recursive glob for the four fixed patterns. Each pattern is anchored at
 * REPO_ROOT. `**` matches any depth; the trailing component is a basename or
 * `*.md` suffix. Returns SORTED absolute paths (Python `Path.glob` yields
 * unsorted; the Python original does NOT sort, but iterates corpus globs in
 * list order and merely counts tokens into a Counter, so token membership is
 * order-independent — we still walk deterministically).
 */
function _glob(pattern: string): string[] {
    // Patterns: "<dir>/**/SKILL.md", "<dir>/**/*.md".
    const parts = pattern.split('/');
    const starStarIdx = parts.indexOf('**');
    if (starStarIdx < 0) {
        const full = path.join(REPO_ROOT, pattern);
        return _isFile(full) ? [full] : [];
    }
    const base = path.join(REPO_ROOT, ...parts.slice(0, starStarIdx));
    const leaf = parts[parts.length - 1] as string; // "SKILL.md" or "*.md"
    const suffix = leaf.startsWith('*') ? leaf.slice(1) : null; // ".md" or null
    const exactName = leaf.startsWith('*') ? null : leaf; // "SKILL.md" or null
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
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.isFile() || (ent.isSymbolicLink() && _isFile(full))) {
                if (exactName !== null ? ent.name === exactName : suffix !== null && ent.name.endsWith(suffix)) {
                    out.push(full);
                }
            }
        }
    };
    if (_isDir(base)) {
        // Python `Path("base").glob("**/X")` also matches X directly under base
        // (the `**` matches zero directories). Our walk recurses from base and
        // checks files at every level including base itself.
        walk(base);
    }
    out.sort();
    return out;
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

export function build_corpus(): Map<string, number> {
    const counter = new Map<string, number>();
    for (const glob of CORPUS_GLOBS) {
        for (const p of _glob(glob)) {
            if (!_isFile(p)) {
                continue;
            }
            let text: string;
            try {
                // Python `read_text(encoding="utf-8")` raises UnicodeDecodeError on
                // invalid bytes and the caller `continue`s. Node's strict decode
                // via TextDecoder mirrors that; default Buffer.toString is lossy.
                text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(p));
            } catch {
                continue;
            }
            for (const tok of tokens(text)) {
                counter.set(tok, (counter.get(tok) ?? 0) + 1);
            }
        }
    }
    return counter;
}

interface Score {
    name: string;
    tokens: string[];
    hits: Record<string, number>;
    hit_count: number;
    total_hit_volume: number;
    low_likelihood: boolean;
}

/** Mirror set union over four token sources. */
function _ruleTokens(rule: Json): Set<string> {
    const out = new Set<string>();
    const add = (s: Set<string>): void => {
        for (const t of s) {
            out.add(t);
        }
    };
    add(tokens(String(rule['description'] ?? '')));
    add(tokens(String(rule['name'] ?? '').replaceAll('-', ' ')));
    const trig = rule['triggers'] ?? {};
    const kw: Json[] = Array.isArray(trig['keywords']) ? trig['keywords'] : [];
    const intents: Json[] = Array.isArray(trig['intents']) ? trig['intents'] : [];
    add(tokens(kw.map((x) => String(x)).join(' ')));
    add(tokens(intents.map((x) => String(x)).join(' ')));
    return out;
}

export function score(rule: Json, corpus: Map<string, number>): Score {
    const rule_tokens = _ruleTokens(rule);
    // hits = {t: corpus[t] for t in rule_tokens if corpus[t] > 0}
    // Python iterates the set; insertion order of a CPython set is hash-based,
    // but `hits` is only consumed via sorted(...) below, so the dict's own
    // ordering never reaches output. Build deterministically.
    const hits: Array<[string, number]> = [];
    for (const t of [...rule_tokens].sort()) {
        const v = corpus.get(t) ?? 0;
        if (v > 0) {
            hits.push([t, v]);
        }
    }
    // dict(sorted(hits.items(), key=lambda x: -x[1])[:8]) — top-8 by volume desc.
    // Python's sort is stable; ties keep the iteration order of `hits`. Since
    // `hits` here is sorted by token, ties resolve token-ascending — but the
    // CPython original's `hits` dict ordering is hash-based, so ties COULD differ.
    // This is a latent non-determinism candidate (see report). We canonicalise to
    // token-ascending tie-break, which the differential test pins.
    const topHits = stableSortByVolumeDesc(hits).slice(0, 8);
    const hitsObj: Record<string, number> = {};
    for (const [k, v] of topHits) {
        hitsObj[k] = v;
    }
    return {
        name: String(rule['name']),
        tokens: [...rule_tokens].sort(),
        hits: hitsObj,
        hit_count: hits.length,
        total_hit_volume: hits.reduce((s, [, v]) => s + v, 0),
        low_likelihood: hits.length < LOW_LIKELIHOOD_HITS,
    };
}

/** Stable sort of [token, volume] by volume descending. */
function stableSortByVolumeDesc(arr: Array<[string, number]>): Array<[string, number]> {
    return arr
        .map((v, i) => [v, i] as [[string, number], number])
        .sort((a, b) => {
            const d = -a[0][1] - -b[0][1];
            return d !== 0 ? d : a[1] - b[1];
        })
        .map(([v]) => v);
}

export function render_md(scores: Score[]): string {
    const flagged = scores.filter((s) => s.low_likelihood);
    const lines: string[] = [
        '',
        '## Phase 5.3 — Activation likelihood (corpus-keyword)',
        '',
        `Corpus: skills + commands + contexts + guidelines.`,
        `Low-likelihood threshold: \`< ${LOW_LIKELIHOOD_HITS}\` distinct corpus hits.`,
        '',
        `Rules flagged: **${flagged.length} / ${scores.length}**.`,
        '',
        '### Low-likelihood rules',
        '',
    ];
    if (flagged.length === 0) {
        lines.push('_None._', '');
    } else {
        lines.push('| Rule | Hits | Tokens (top) |', '|------|------|--------------|');
        // sorted(flagged, key=lambda x: x["hit_count"]) — stable.
        const sortedFlagged = stableSortBy(flagged, (x) => x.hit_count);
        for (const s of sortedFlagged) {
            const toks = s.tokens.slice(0, 6).map((t) => `\`${t}\``).join(', ') || '—';
            lines.push(`| \`${s.name}\` | ${s.hit_count} | ${toks} |`);
        }
        lines.push('');
    }
    lines.push(
        '### Full ranking (lowest hit-count first, top 20)',
        '',
        '| Rule | Distinct hits | Total hit volume |',
        '|------|---------------|------------------|',
    );
    // sorted(scores, key=lambda x: (x["hit_count"], x["total_hit_volume"]))[:20]
    const ranked = stableSortBy(scores, (x) => [x.hit_count, x.total_hit_volume]).slice(0, 20);
    for (const s of ranked) {
        lines.push(`| \`${s.name}\` | ${s.hit_count} | ${s.total_hit_volume} |`);
    }
    lines.push('');
    return lines.join('\n');
}

/** Stable sort by a numeric key or tuple-of-numbers key (Python tuple compare). */
function stableSortBy<T>(arr: T[], key: (x: T) => number | number[]): T[] {
    return arr
        .map((v, i) => [v, i] as [T, number])
        .sort((a, b) => {
            const ka = key(a[0]);
            const kb = key(b[0]);
            const aa = Array.isArray(ka) ? ka : [ka];
            const bb = Array.isArray(kb) ? kb : [kb];
            for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
                const d = (aa[i] ?? 0) - (bb[i] ?? 0);
                if (d !== 0) {
                    return d;
                }
            }
            return a[1] - b[1];
        })
        .map(([v]) => v);
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True, NO sort_keys) -------

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

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
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

function _scoreToJson(s: Score): Record<string, Json> {
    return {
        name: s.name,
        tokens: s.tokens,
        hits: s.hits,
        hit_count: s.hit_count,
        total_hit_volume: s.total_hit_volume,
        low_likelihood: s.low_likelihood,
    };
}

function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

export function main(): number {
    if (!_isFile(AUDIT_JSON)) {
        process.stderr.write(`❌  Run audit_auto_rules.py first: missing ${AUDIT_JSON}\n`);
        return 1;
    }
    const rules: Json[] = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf-8'))['rules'];
    const corpus = build_corpus();
    const scores = rules.map((r) => score(r, corpus));
    fs.writeFileSync(
        LIKELIHOOD_JSON,
        pyJsonDumpsIndent2({ corpus_size: corpus.size, scores: scores.map(_scoreToJson) }),
        'utf-8',
    );
    let md = _isFile(AUDIT_MD) ? fs.readFileSync(AUDIT_MD, 'utf-8') : '';
    if (md.includes('## Phase 5.3 — Activation likelihood')) {
        // md.split("## Phase 5.3 — Activation likelihood")[0].rstrip() + "\n"
        md = pyRStrip(md.split('## Phase 5.3 — Activation likelihood')[0] as string) + '\n';
    }
    fs.writeFileSync(AUDIT_MD, md + render_md(scores), 'utf-8');
    const flagged = scores.filter((s) => s.low_likelihood);
    process.stdout.write(
        `✅  Likelihood scored: ${scores.length} rules, ${flagged.length} low-likelihood.\n`,
    );
    process.stdout.write(`   JSON: ${_relPosix(LIKELIHOOD_JSON, REPO_ROOT)}\n`);
    return 0;
}

/** Mirror Python str.rstrip() — strip trailing ASCII + Unicode whitespace. */
function pyRStrip(s: string): string {
    return s.replace(/\s+$/, '');
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
