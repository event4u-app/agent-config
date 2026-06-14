#!/usr/bin/env node
/**
 * corpus-grounding · decision_engine — reasoning layer (interface v1).
 *
 * TypeScript twin of `src/skills/corpus-grounding/scripts/decision_engine.py`
 * (ADR-096 Python→TS migration). Manifest-parameterised conditional grounding
 * (ADR-061 §3 tier 2): multi-domain search per the manifest's reasoning plan,
 * decision-rule evaluation (JSON conditionals + an optional dynamically-loaded
 * escape hatch where JSON caps out), best-match selection, and a
 * grounded-output dict that ALWAYS carries a confidence score + an
 * evidence-gap line (contract — prevents false precision / authority
 * inflation).
 *
 * The Python original uses `importlib.util` to load a manifest-relative
 * `reasoning.rules_module` Python file and call its `evaluate(...)`. The twin
 * mirrors this with a dynamic `import()` of the manifest-relative module —
 * resolved to a `.ts` (dev/tsx) or `.js` (compiled) twin, NEVER a `.py`. See
 * `_load_rules_callable` for the resolution + boundary note.
 *
 * Pure stdlib. No network, no subprocess. Writes only under persist_grounding
 * (opt-in). Interface contract: SKILL.md.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    DEFAULT_MAX_RESULTS,
    floatVal,
    load_csv,
    PyFloat,
    search_rows,
    type Row,
} from './bm25_search.js';
import {
    ManifestError,
    type Manifest,
    resolve_data_path,
} from './schema_validator.js';

// Re-export so `ground` (and external callers) can import PyFloat from here too.
export { PyFloat } from './bm25_search.js';

/** A grounded / search result dict — heterogeneous, mirrors the Python dict. */
export type ResultDict = Record<string, unknown>;

// ── Python-parity numeric helpers ───────────────────────────────────────────

/**
 * Python 3 `round(x, ndigits)` — round-half-to-even (banker's rounding) on the
 * exact IEEE-754 value. JS `Math.round` is half-away-from-zero, so we round the
 * 17-significant-digit decimal expansion (round-trips every double uniquely),
 * mirroring `src/scripts/_lib/value_ladder.ts::pyRound`.
 */
export function pyRound(value: number, ndigits = 0): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        const factor = 10 ** ndigits;
        return value > 0
            ? (Math.round(abs * factor) / factor) * sign
            : -Math.round(abs * factor) / factor;
    }
    const dot = str.indexOf('.');
    const intPart = dot === -1 ? str : str.slice(0, dot);
    let fracPart = dot === -1 ? '' : str.slice(dot + 1);
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    const scaledIntStr = intPart + keepFrac;
    let scaledInt = BigInt(scaledIntStr === '' ? '0' : scaledIntStr);
    const firstDecider = deciderStr.charAt(0);
    const restNonZero = /[1-9]/u.test(deciderStr.slice(1));
    let roundUp = false;
    if (firstDecider > '5' || (firstDecider === '5' && restNonZero)) {
        roundUp = true;
    } else if (firstDecider === '5' && !restNonZero) {
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    const factor = 10 ** ndigits;
    return (Number(scaledInt) / factor) * sign;
}

/** Python `str(x)` for the value shapes this module sees. */
function pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (value instanceof PyFloat) {
        return _floatStr(value.value);
    }
    return String(value);
}

/** Python `repr()` of a string for dict-repr blobs. */
function _strRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    let quote = "'";
    if (hasSingle && !hasDouble) {
        quote = '"';
    }
    let body = s.replace(/\\/g, '\\\\');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    }
    return `${quote}${body}${quote}`;
}

/** Python `repr()` of a value for embedding in a dict-repr blob. */
function _valueRepr(value: unknown): string {
    if (typeof value === 'string') {
        return _strRepr(value);
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

/**
 * Python `str(dict)` — the repr used by `_select_best_match`'s blob match.
 * Shape: `{'k': 'v', 'k2': 2}`. Keys are insertion-ordered (matches Python 3.7+
 * dict ordering and JS object key order).
 */
function pyDictRepr(obj: ResultDict): string {
    const parts = Object.keys(obj).map((k) => `${_strRepr(k)}: ${_valueRepr(obj[k])}`);
    return `{${parts.join(', ')}}`;
}

/** Python float → str for f-string / repr (integral floats keep `.0`). */
function _floatStr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

// ── detection ────────────────────────────────────────────────────────────

/** Escape a string for use as a literal inside a RegExp (Python re.escape). */
function _reEscape(s: string): string {
    // Python re.escape escapes all non-alphanumeric, non-underscore chars.
    let out = '';
    for (const ch of s) {
        if (/[A-Za-z0-9_]/u.test(ch)) {
            out += ch;
        } else {
            out += `\\${ch}`;
        }
    }
    return out;
}

/** Keyword-vote routing of a query onto one of the manifest's domains. */
export function detect_domain(manifest: Manifest, query: string): string {
    const detect = (manifest.detect as Record<string, unknown> | null) || {};
    const query_lower = query.toLowerCase();
    const scores: Record<string, number> = {};
    for (const name of Object.keys(detect)) {
        if (name === '_stack') {
            continue;
        }
        const keywords = detect[name];
        let count = 0;
        if (Array.isArray(keywords)) {
            for (const kw of keywords) {
                // Python: re.search(r"\b" + re.escape(str(kw).lower()) + r"\b", query_lower)
                const re = new RegExp(`\\b${_reEscape(pyStr(kw).toLowerCase())}\\b`, 'u');
                if (re.test(query_lower)) {
                    count += 1;
                }
            }
        }
        scores[name] = count;
    }
    const names = Object.keys(scores);
    if (names.length > 0) {
        // Python: max(scores, key=lambda k: scores[k]) — first key with max value
        // (stable; ties resolve to insertion order).
        let best = names[0] as string;
        for (const name of names) {
            if ((scores[name] as number) > (scores[best] as number)) {
                best = name;
            }
        }
        if ((scores[best] as number) > 0) {
            return best;
        }
    }
    const dd = manifest.default_domain;
    if (dd !== undefined && dd !== null && dd !== '' && dd !== false) {
        return String(dd);
    }
    // next(iter(manifest["domains"])) — first domain key.
    const domains = manifest.domains as Record<string, unknown>;
    return Object.keys(domains)[0] as string;
}

// ── search ops ─────────────────────────────────────────────────────────────

/** Search one manifest domain. Adds confidence + evidence_gap. */
export function search_domain(
    manifest: Manifest,
    query: string,
    domain: string | null = null,
    max_results: number | null = null,
    filters: Record<string, unknown> | null = null,
): ResultDict {
    let dom = domain;
    if (dom === null) {
        dom = detect_domain(manifest, query);
    }
    const domains = manifest.domains as Record<string, ResultDict>;
    if (!(dom in domains)) {
        return {
            error: `Unknown domain: ${_strRepr(dom)}. Available: ${_sortedListRepr(Object.keys(domains))}`,
            count: 0,
            results: [],
        };
    }
    const cfg = domains[dom] as ResultDict;
    // merged_filters = dict(cfg.get("filters") or {}); if filters: merged.update(filters)
    const merged_filters: Record<string, unknown> = { ...((cfg.filters as Record<string, unknown> | null) || {}) };
    if (filters) {
        for (const k of Object.keys(filters)) {
            merged_filters[k] = filters[k];
        }
    }
    const result: ResultDict = search_rows(
        resolve_data_path(manifest, cfg.file as string),
        cfg.search_cols as string[],
        cfg.output_cols as string[],
        query,
        max_results ?? (cfg.max_results as number | undefined) ?? DEFAULT_MAX_RESULTS,
        (Object.keys(merged_filters).length > 0 ? merged_filters : null) as never,
        (manifest.retriever as string | undefined) ?? 'bm25',
    ) as ResultDict;
    result.domain = dom;
    result.query = query;
    result.file = cfg.file;
    _attach_confidence(result);
    return result;
}

/** Search one stack axis (optional manifest extension). */
export function search_stack(
    manifest: Manifest,
    query: string,
    stack: string,
    max_results: number = DEFAULT_MAX_RESULTS,
    filters: Record<string, unknown> | null = null,
): ResultDict {
    const stacks = (manifest.stacks as Record<string, string> | null) || {};
    if (!(stack in stacks)) {
        return {
            error: `Unknown stack: ${_strRepr(stack)}. Available: ${_sortedListRepr(Object.keys(stacks))}`,
            count: 0,
            results: [],
        };
    }
    const cols = manifest.stack_cols as ResultDict;
    const result: ResultDict = search_rows(
        resolve_data_path(manifest, stacks[stack] as string),
        cols.search_cols as string[],
        cols.output_cols as string[],
        query,
        max_results,
        filters as never,
        (manifest.retriever as string | undefined) ?? 'bm25',
    ) as ResultDict;
    result.domain = 'stack';
    result.stack = stack;
    result.query = query;
    result.file = stacks[stack];
    _attach_confidence(result);
    return result;
}

/** Confidence from BM25 score shape; evidence gap when weak/empty. */
function _attach_confidence(result: ResultDict): void {
    const scores = (result.scores as (PyFloat | number)[] | null) || [];
    const gaps: string[] = [];
    let label: string;
    let numeric: number;
    if (scores.length === 0) {
        label = 'low';
        numeric = 0.0;
        const dom = result.domain;
        gaps.push(
            `no corpus rows matched the query in domain ` +
                `'${dom === undefined || dom === null ? '?' : String(dom)}' — answer falls back to agent priors`,
        );
    } else {
        const top = floatVal(scores[0] as PyFloat | number);
        numeric = pyRound(Math.min(1.0, top / 10.0), 3);
        if (top >= 4.0) {
            label = 'high';
        } else if (top >= 1.5) {
            label = 'medium';
        } else {
            label = 'low';
            gaps.push('top BM25 score is weak — treat the match as a hint, not a verdict');
        }
    }
    result.confidence = { label, score: new PyFloat(numeric) };
    result.evidence_gap = gaps;
}

// ── rules ────────────────────────────────────────────────────────────────

/**
 * Evaluate JSON conditional rules against the query/context.
 *
 * Upstream rule shape: `{"if_<condition>": "<directive>"}`. A condition matches
 * when its underscore-separated tokens appear in the query or in a truthy
 * context flag of the same name. Returns `{"matched": {...}, "unmatched": {...}}`
 * — both surfaced, so the agent sees the full rule space (auditable).
 */
export function evaluate_rules(
    rules: Record<string, unknown>,
    query: string,
    context: Record<string, unknown> | null = null,
): ResultDict {
    const ctx = context || {};
    const query_lower = query.toLowerCase();
    const matched: ResultDict = {};
    const unmatched: ResultDict = {};
    for (const key of Object.keys(rules || {})) {
        const directive = rules[key];
        const cond = key.startsWith('if_') ? key.slice(3) : key;
        const tokens = cond.split('_').filter((t) => t.length > 0);
        // Python: bool(context.get(cond)) or (tokens and all(t in query_lower ...))
        const ctxHit = _bool(ctx[cond]);
        const tokenHit = tokens.length > 0 && tokens.every((t) => query_lower.includes(t));
        const hit = ctxHit || tokenHit;
        (hit ? matched : unmatched)[key] = directive;
    }
    return { matched, unmatched };
}

/** Python bool(x) truthiness. */
function _bool(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** A rules-callable: evaluate(rules, query, context) -> dict. */
type RulesCallable = (
    rules: Record<string, unknown>,
    query: string,
    context: Record<string, unknown>,
) => ResultDict;

/**
 * Optional escape hatch: `reasoning.rules_module` beside the manifest exposing
 * `evaluate(rules, query, context)`. The Python original loads a `.py` via
 * `importlib`. The twin loads the corresponding module via dynamic `import()`,
 * resolved to a `.ts`/`.js` twin — NEVER a `.py`. If the manifest names a
 * module whose extension is `.py`, the twin remaps it to `.ts` (dev) / `.js`
 * (compiled). A `.py`-only module with no twin is a migration boundary: the
 * load throws ManifestError naming the missing twin (port it, or document the
 * boundary).
 *
 * Runtime-safety: only a manifest-relative module inside the skill dir is
 * loadable (same containment rule as corpus files, via resolve_data_path).
 *
 * NOTE: async, because dynamic import() is async. The caller (`ground`) is
 * therefore async too.
 */
export async function _load_rules_callable(manifest: Manifest): Promise<RulesCallable | null> {
    const reasoning = (manifest.reasoning as Record<string, unknown> | null) || {};
    const rel = reasoning.rules_module as string | undefined;
    if (!rel) {
        return null;
    }
    const resolved = resolve_data_path(manifest, rel);
    // Remap a manifest-declared .py to the ported twin; resolve a bare/.ts/.js
    // to the on-disk twin. NEVER import a .py.
    const candidate = _resolveTwinPath(resolved);
    if (!fs.existsSync(candidate)) {
        throw new ManifestError(`reasoning.rules_module not found: ${resolved}`);
    }
    const mod = (await import(pathToFileURL(candidate).href)) as Record<string, unknown>;
    const fn = mod.evaluate;
    if (typeof fn !== 'function') {
        throw new ManifestError(`${resolved} must expose evaluate(rules, query, context)`);
    }
    return fn as RulesCallable;
}

/** Map a manifest-declared module path to its TS/JS twin on disk. */
function _resolveTwinPath(resolved: string): string {
    const ext = path.extname(resolved);
    if (ext === '.py') {
        const stem = resolved.slice(0, resolved.length - ext.length);
        if (fs.existsSync(`${stem}.ts`)) {
            return `${stem}.ts`;
        }
        return `${stem}.js`;
    }
    if (ext === '') {
        if (fs.existsSync(`${resolved}.ts`)) {
            return `${resolved}.ts`;
        }
        return `${resolved}.js`;
    }
    return resolved;
}

/** Exact → partial → keyword match of a category onto the rule rows. */
function _find_reasoning_rule(rows: Row[], match_column: string, category: string): Row {
    const category_lower = category.toLowerCase();
    for (const rule of rows) {
        if (pyStr(rule[match_column] ?? '').toLowerCase() === category_lower) {
            return rule;
        }
    }
    for (const rule of rows) {
        const cat = pyStr(rule[match_column] ?? '').toLowerCase();
        if (cat && (category_lower.includes(cat) || cat.includes(category_lower))) {
            return rule;
        }
    }
    for (const rule of rows) {
        const cat = pyStr(rule[match_column] ?? '').toLowerCase();
        const keywords = cat.replace(/\//g, ' ').replace(/-/g, ' ').split(/\s+/u).filter((w) => w.length > 0);
        if (keywords.some((kw) => category_lower.includes(kw))) {
            return rule;
        }
    }
    return {};
}

/** Priority-keyword re-ranking of a domain's results (upstream port). */
function _select_best_match(
    results: Row[],
    priority_keywords: string[],
    name_col: string | null | undefined,
): Row {
    if (results.length === 0) {
        return {};
    }
    if (priority_keywords.length === 0) {
        return results[0] as Row;
    }
    if (name_col) {
        for (const priority of priority_keywords) {
            const p = priority.toLowerCase().trim();
            for (const result of results) {
                const name = pyStr(result[name_col] ?? '').toLowerCase();
                if (p && (name.includes(p) || p.includes(name))) {
                    return result;
                }
            }
        }
    }
    const scored: [number, Row][] = [];
    for (const result of results) {
        const blob = pyDictRepr(result as ResultDict).toLowerCase();
        let score = 0;
        for (const kw of priority_keywords) {
            const k = kw.toLowerCase().trim();
            if (!k) {
                continue;
            }
            if (name_col && pyStr(result[name_col] ?? '').toLowerCase().includes(k)) {
                score += 10;
            } else if (pyStr(result.Keywords ?? '').toLowerCase().includes(k)) {
                score += 3;
            } else if (blob.includes(k)) {
                score += 1;
            }
        }
        scored.push([score, result]);
    }
    // Python: scored.sort(key=lambda x: x[0], reverse=True) — stable.
    const indexed = scored.map((pair, i) => ({ pair, i }));
    indexed.sort((a, b) => {
        const d = b.pair[0] - a.pair[0];
        if (d !== 0) {
            return d;
        }
        return a.i - b.i;
    });
    const sorted = indexed.map((x) => x.pair);
    if (sorted.length > 0 && (sorted[0] as [number, Row])[0] > 0) {
        return (sorted[0] as [number, Row])[1];
    }
    return results[0] as Row;
}

// ── grounding ────────────────────────────────────────────────────────────

/**
 * Conditional grounding: category → rules → planned multi-domain search.
 *
 * Returns the interface-v1 grounded dict (see Python docstring). Async because
 * `_load_rules_callable` is async (dynamic import).
 */
export async function ground(
    manifest: Manifest,
    query: string,
    context: Record<string, unknown> | null = null,
): Promise<ResultDict> {
    const reasoning = manifest.reasoning as Record<string, unknown> | null | undefined;
    if (!reasoning) {
        throw new ManifestError(
            `manifest domain ${_valueRepr(manifest.domain)} has no reasoning block ` +
                '(tier is lookup-only — use search instead of ground)',
        );
    }

    const gaps: string[] = [];

    // 1 — category lookup.
    let category = (manifest.default_category as string | undefined) ?? 'General';
    const cat_domain = reasoning.category_domain as string | undefined;
    const cat_column = reasoning.category_column as string | undefined;
    if (cat_domain && cat_column) {
        const cat_result = search_domain(manifest, query, cat_domain, 1);
        const rows = (cat_result.results as Row[] | null) || [];
        if (rows.length > 0) {
            const v = (rows[0] as Row)[cat_column];
            // Python: str(rows[0].get(cat_column) or category)
            category = v !== undefined && v !== null && v !== '' ? pyStr(v) : category;
        } else {
            gaps.push(
                `category lookup in '${cat_domain}' found nothing — ` +
                    `grounding against default category '${category}'`,
            );
        }
    }

    // 2 — reasoning rule for the category.
    const rules_path = resolve_data_path(manifest, reasoning.file as string);
    const rule_rows: Row[] = fs.existsSync(rules_path) ? load_csv(rules_path) : [];
    const rule = _find_reasoning_rule(rule_rows, reasoning.match_column as string, category);
    if (Object.keys(rule).length === 0) {
        gaps.push(
            `no reasoning rule matched category '${category}' — ` +
                'selections below are unweighted corpus hits',
        );
    }

    // 3 — decision rules (JSON; optional dynamically-loaded escape hatch).
    let raw_rules: Record<string, unknown> = {};
    const rules_column = reasoning.rules_column as string | undefined;
    if (rules_column && _bool(rule[rules_column])) {
        try {
            raw_rules = JSON.parse(rule[rules_column] as string) as Record<string, unknown>;
        } catch {
            gaps.push(`decision rules in column '${rules_column}' are not valid JSON`);
        }
    }
    const custom = await _load_rules_callable(manifest);
    const rules_evaluation = custom
        ? custom(raw_rules, query, context || {})
        : evaluate_rules(raw_rules, query, context);

    // 4 — priority keywords from the rule.
    let priority: string[] = [];
    const priority_column = reasoning.priority_column as string | undefined;
    if (priority_column && _bool(rule[priority_column])) {
        priority = pyStr(rule[priority_column])
            .split('+')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }

    // 5 — planned multi-domain search.
    const selections: ResultDict = {};
    const domain_confidences: number[] = [];
    const plan = (reasoning.plan as Record<string, unknown> | null) || {};
    const priority_domain = reasoning.priority_domain as string | undefined;
    const name_cols = (reasoning.name_columns as Record<string, string> | null) || {};
    for (const domain_name of Object.keys(plan)) {
        const max_results = plan[domain_name];
        let q = query;
        if (domain_name === priority_domain && priority.length > 0) {
            q = `${query} ${priority.slice(0, 2).join(' ')}`;
        }
        const result = search_domain(manifest, q, domain_name, _int(max_results));
        const results = (result.results as Row[] | null) || [];
        const best =
            domain_name === priority_domain
                ? _select_best_match(results, priority, name_cols[domain_name])
                : results.length > 0
                  ? (results[0] as Row)
                  : {};
        selections[domain_name] = {
            best,
            // Python: [r for r in results if r is not best] — identity compare.
            alternatives: results.filter((r) => r !== best),
            confidence: result.confidence,
        };
        for (const g of (result.evidence_gap as string[] | null) || []) {
            gaps.push(g);
        }
        const conf = (result.confidence as ResultDict | null) || {};
        const score = conf.score;
        domain_confidences.push(score instanceof PyFloat ? score.value : (score as number | undefined) ?? 0.0);
    }

    // 6 — aggregate confidence (weakest link wins).
    const numeric = domain_confidences.length > 0 ? pyRound(Math.min(...domain_confidences), 3) : 0.0;
    const label = numeric >= 0.4 ? 'high' : numeric >= 0.15 ? 'medium' : 'low';

    // rule with the rules_column dropped.
    const ruleOut: Row = {};
    for (const k of Object.keys(rule)) {
        if (k !== rules_column) {
            ruleOut[k] = rule[k] as string;
        }
    }

    return {
        domain: manifest.domain,
        query,
        category,
        rule: ruleOut,
        rules_evaluation,
        selections,
        confidence: { label, score: new PyFloat(numeric) },
        evidence_gap:
            gaps.length > 0 ? gaps : ['none — every planned domain returned a scored match'],
    };
}

/** Python int(x) for a plan value (int or numeric string). */
function _int(value: unknown): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return Math.trunc(Number(value));
}

// ── persistence ────────────────────────────────────────────────────────────

/**
 * Opt-in (--persist): write the grounded output as a master file + optional
 * page override (upstream MASTER.md pattern, generalized).
 *
 * Writes ONLY under `output_dir` (caller-chosen). Returns created paths.
 */
export function persist_grounding(
    grounded: ResultDict,
    output_dir: string,
    project: string | null = null,
    page: string | null = null,
): ResultDict {
    const project_slug = (project ?? pyStr(grounded.query ?? 'default'))
        .toLowerCase()
        .replace(/ /g, '-');
    const base = path.join(output_dir, 'design-system', project_slug);
    fs.mkdirSync(base, { recursive: true });
    const created: string[] = [];

    const master = path.join(base, 'MASTER.md');
    fs.writeFileSync(master, _render_markdown(grounded, true), 'utf-8');
    created.push(master);

    if (page) {
        const pages = path.join(base, 'pages');
        fs.mkdirSync(pages, { recursive: true });
        const page_file = path.join(pages, `${page.toLowerCase().replace(/ /g, '-')}.md`);
        fs.writeFileSync(
            page_file,
            `# ${_title(page)} — page overrides\n\n` +
                '> Rules here OVERRIDE the project MASTER.md for this page only.\n' +
                '> Start empty; add only deviations.\n',
            'utf-8',
        );
        created.push(page_file);
    }
    return { status: 'success', created_files: created };
}

/** Python str.title() — capitalize the first letter of each word run. */
function _title(s: string): string {
    return s.replace(/[A-Za-z]+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Generic markdown rendering of a grounded output (interface v1). */
export function _render_markdown(grounded: ResultDict, master = false): string {
    const lines: string[] = [];
    if (master) {
        lines.push(
            '# Design System Master File',
            '',
            '> **LOGIC:** When building a specific page, first check ' +
                '`pages/<page>.md`. If it exists, its rules **override** this ' +
                'master file. Otherwise follow the rules below.',
            '',
        );
    }
    const conf = (grounded.confidence as ResultDict | null) || {};
    lines.push(
        `## Grounded recommendation: ${pyStr(grounded.query ?? '')}`,
        '',
        `- **Domain:** ${pyStr(grounded.domain ?? '')}`,
        `- **Category:** ${pyStr(grounded.category ?? '')}`,
        `- **Confidence:** ${pyStr(conf.label ?? '?')} ` + `(${_confScore(conf.score)})`,
        '',
    );
    const selections = (grounded.selections as ResultDict | null) || {};
    for (const domain of Object.keys(selections)) {
        const sel = (selections[domain] as ResultDict | null) || {};
        const best = (sel.best as Row | null) || {};
        if (Object.keys(best).length === 0) {
            continue;
        }
        lines.push(`### ${domain}`);
        for (const key of Object.keys(best)) {
            let value_str = pyStr(best[key]);
            if (value_str.length > 300) {
                value_str = `${value_str.slice(0, 300)}…`;
            }
            if (value_str) {
                lines.push(`- **${key}:** ${value_str}`);
            }
        }
        lines.push('');
    }
    const matched = ((grounded.rules_evaluation as ResultDict | null) || {}).matched as ResultDict | null;
    const matchedObj = matched || {};
    if (Object.keys(matchedObj).length > 0) {
        lines.push('### Matched decision rules');
        for (const key of Object.keys(matchedObj)) {
            lines.push(`- \`${key}\` → ${pyStr(matchedObj[key])}`);
        }
        lines.push('');
    }
    lines.push('### Evidence gap');
    for (const gap of (grounded.evidence_gap as string[] | null) || []) {
        lines.push(`- ${gap}`);
    }
    lines.push('');
    return lines.join('\n');
}

/**
 * Render the confidence score inside the f-string `({score})`. Python's
 * `grounded.get('confidence', {}).get('score', 0)` defaults to int 0 (no
 * `.0`); a present score is a float (with `.0` when integral).
 */
function _confScore(score: unknown): string {
    if (score instanceof PyFloat) {
        return _floatStr(score.value);
    }
    if (score === undefined || score === null) {
        return '0';
    }
    return String(score);
}

/** repr of a sorted list of strings: `['a', 'b']`. */
function _sortedListRepr(items: string[]): string {
    const sorted = [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `[${sorted.map((i) => _strRepr(i)).join(', ')}]`;
}
