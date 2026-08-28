/**
 * Per-asset delivery ledger — which assets produce the standing payload
 * (`road-to-delivered-cost-truth` step 2.1).
 *
 * `check_preamble_payload_budget` measures three BUCKET totals and refuses
 * growth. It cannot say which asset inside a bucket is producing the cost, so a
 * reduction effort has a number and no target. This module ranks the assets.
 *
 * WHAT "DELIVERY" MEANS PER BUCKET, because the two are not the same shape:
 *
 * - a RULE in the standing set delivers its whole body on every spawn;
 * - a SKILL delivers only its catalogue line — `- <name>: <description>` — on
 *   every spawn. Its body is loaded on activation, which is not standing cost
 *   and is deliberately not counted here.
 *
 * Ranking the two together without that distinction would put every skill body
 * above every rule and send a reduction effort at the wrong half of the tree.
 *
 * MEASUREMENT HONESTY. Each row states whether it was measured with the exact
 * BPE tokenizer or the `chars/4` proxy, and a proxy reading within its own error
 * margin of a threshold is reported `unresolved` rather than classified — the
 * discipline `lint_token_budget_discipline` already applies to the rich band,
 * reused here rather than reinvented.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseFrontmatter } from '../preamble_byte_census.js';
import { gpt_tokens, gpt_tokens_proxy } from './token_count.js';

/** Worst-case per-file error of the character proxy, as measured for the rich band. */
export const PROXY_ERROR_MARGIN = 0.06;

export type AssetKind = 'rule' | 'skill-catalogue-line';

export interface AssetRow {
    /** Repo-relative path of the asset. */
    file: string;
    /** Asset name as the preamble names it. */
    name: string;
    kind: AssetKind;
    /** Tokens this asset contributes to EVERY spawn. */
    tokens: number;
    /**
     * The same asset under the `chars/4` proxy.
     *
     * Carried alongside the BPE figure, not instead of it, because the payload
     * gate counts chars/4 and reconciling a BPE total against a chars/4 total
     * measures the METHODS, not the ledger. See {@link reconcile}.
     */
    proxy_tokens: number;
    /** `exact` when the BPE tokenizer resolved, `proxy` otherwise. */
    method: 'exact' | 'proxy';
    /** Share of the ledger total. */
    share: number;
}

export interface LedgerVerdict {
    rows: AssetRow[];
    total_tokens: number;
    /** True only when EVERY row came from the exact tokenizer. */
    exact_throughout: boolean;
    by_kind: Record<AssetKind, { count: number; tokens: number; proxy_tokens: number }>;
}

/**
 * Is a proxy reading too close to `threshold` to be classified?
 *
 * Symmetric, deliberately: the measured proxy error runs in BOTH directions
 * (−5.3 % on the largest rich artifact), so a band that straddles the threshold
 * yields no verdict rather than a confident wrong one.
 */
export function unresolvedAgainst(tokens: number, method: 'exact' | 'proxy', threshold: number): boolean {
    if (method === 'exact') return false;
    const margin = Math.ceil(tokens * PROXY_ERROR_MARGIN);
    return tokens - margin <= threshold && tokens + margin > threshold;
}

/** Walk the standing rule directory. Each rule delivers its whole body. */
export function measureRules(rulesDir: string, repoRoot: string): AssetRow[] {
    if (!fs.existsSync(rulesDir)) return [];
    const rows: AssetRow[] = [];
    for (const entry of fs.readdirSync(rulesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const abs = path.join(rulesDir, entry.name);
        const text = fs.readFileSync(abs, 'utf-8');
        const count = gpt_tokens(text);
        rows.push({
            file: path.relative(repoRoot, abs),
            name: entry.name.replace(/\.md$/, ''),
            kind: 'rule',
            tokens: count.tokens,
            proxy_tokens: gpt_tokens_proxy(text).tokens,
            method: count.exact ? 'exact' : 'proxy',
            share: 0,
        });
    }
    return rows;
}

/**
 * Walk the skill catalogue. Each skill delivers ONE line, not its body.
 *
 * The line is built the same way `censusSkillsCatalog` builds it — `- <name>:
 * <description>\n` — because a ledger that measured the body would rank a skill
 * that is never activated above a rule that is always delivered.
 */
export function measureSkillCatalogue(skillsDir: string, repoRoot: string): AssetRow[] {
    if (!fs.existsSync(skillsDir)) return [];
    const rows: AssetRow[] = [];
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
        let text: string;
        try {
            text = fs.readFileSync(skillMd, 'utf-8');
        } catch {
            continue;
        }
        // The SAME parser the payload census uses, not a second reader of the
        // same bytes. A regex version reconciled 17.1 % low because a folded
        // multi-line `description:` truncates at the first newline.
        const fm = parseFrontmatter(text);
        const name = typeof fm.name === 'string' && fm.name.length > 0 ? fm.name : entry.name;
        const description = typeof fm.description === 'string' ? fm.description : '';
        const line = `- ${name}: ${description}\n`;
        const count = gpt_tokens(line);
        rows.push({
            file: path.relative(repoRoot, skillMd),
            name,
            kind: 'skill-catalogue-line',
            tokens: count.tokens,
            proxy_tokens: gpt_tokens_proxy(line).tokens,
            method: count.exact ? 'exact' : 'proxy',
            share: 0,
        });
    }
    return rows;
}

export function buildLedger(rulesDir: string, skillsDir: string, repoRoot: string): LedgerVerdict {
    const rows = [...measureRules(rulesDir, repoRoot), ...measureSkillCatalogue(skillsDir, repoRoot)];
    const total = rows.reduce((n, r) => n + r.tokens, 0);
    for (const r of rows) r.share = total > 0 ? r.tokens / total : 0;
    rows.sort((a, b) => b.tokens - a.tokens || a.file.localeCompare(b.file));

    const byKind: Record<AssetKind, { count: number; tokens: number; proxy_tokens: number }> = {
        rule: { count: 0, tokens: 0, proxy_tokens: 0 },
        'skill-catalogue-line': { count: 0, tokens: 0, proxy_tokens: 0 },
    };
    for (const r of rows) {
        byKind[r.kind].count += 1;
        byKind[r.kind].tokens += r.tokens;
        byKind[r.kind].proxy_tokens += r.proxy_tokens;
    }
    return { rows, total_tokens: total, exact_throughout: rows.every((r) => r.method === 'exact'), by_kind: byKind };
}

export interface Reconciliation {
    kind: AssetKind;
    bucket: string;
    /** The ledger's chars/4 total — the SAME method the bucket uses. */
    ledger_proxy_tokens: number;
    /** The ledger's BPE total, reported for contrast, never reconciled against. */
    ledger_exact_tokens: number;
    bucket_tokens: number;
    /** Absolute relative difference, like-for-like. */
    drift: number;
    within_margin: boolean;
}

/**
 * Reconcile the ledger against the payload gate's own bucket totals.
 *
 * LIKE-FOR-LIKE, and this took a correction. The first cut compared the
 * ledger's BPE total against the gate's `chars/4` bucket and set a 15 % margin
 * to absorb the difference. That margin was GUESSED, which is the exact defect
 * this roadmap's own budget file is careful about — and it did not even work:
 * rules reconciled at 1.6 % while skill catalogue lines drifted 28.1 %, because
 * `chars/4` overestimates short structured lines far more than it does prose.
 * The 15 % would have hidden the rule drift and failed the skill drift, and
 * neither verdict would have been about the ledger.
 *
 * So the ledger carries BOTH figures and reconciles the proxy against the
 * proxy. What remains is real disagreement — a different corpus, a different
 * line format, a missed file — which is what a reconciliation is for. The
 * margin can then be tight, because two implementations of one arithmetic
 * should agree closely or one of them is wrong.
 */
export const RECONCILE_MARGIN = 0.02;

export function reconcile(
    ledger: LedgerVerdict,
    buckets: ReadonlyArray<{ name: string; tokens: number }>,
): Reconciliation[] {
    const map: Array<{ kind: AssetKind; bucket: string }> = [
        { kind: 'rule', bucket: 'project-scope rules' },
        { kind: 'skill-catalogue-line', bucket: 'preloaded skills catalog' },
    ];
    const out: Reconciliation[] = [];
    for (const m of map) {
        const bucket = buckets.find((b) => b.name === m.bucket);
        if (bucket === undefined) continue;
        const proxyTokens = ledger.by_kind[m.kind].proxy_tokens;
        const drift =
            bucket.tokens === 0 ? (proxyTokens === 0 ? 0 : 1) : Math.abs(proxyTokens - bucket.tokens) / bucket.tokens;
        out.push({
            kind: m.kind,
            bucket: m.bucket,
            ledger_proxy_tokens: proxyTokens,
            ledger_exact_tokens: ledger.by_kind[m.kind].tokens,
            bucket_tokens: bucket.tokens,
            drift,
            within_margin: drift <= RECONCILE_MARGIN,
        });
    }
    return out;
}

// ─────────────────────────────────────────── growth attribution (step 2.2)

export interface GrowthEntry {
    name: string;
    kind: AssetKind;
    /** Positive = this asset grew or arrived. */
    delta: number;
    status: 'added' | 'grew' | 'shrank' | 'removed';
}

export interface GrowthAttribution {
    /** Assets that grew or arrived, largest first. */
    increases: GrowthEntry[];
    /** Assets that shrank or left, largest saving first. */
    decreases: GrowthEntry[];
    net_delta: number;
}

/**
 * Attribute a payload change to the assets that caused it (step 2.2).
 *
 * A ratchet that says "the payload grew past the ceiling" states a fact and
 * leaves the reader to find the cause; the same refusal naming the asset and its
 * token delta reads as a quantified saving instead of an obstacle. That is the
 * whole difference this function buys, and it is a presentation difference with
 * a real consequence: a refusal nobody can act on gets suppressed rather than
 * fixed.
 *
 * Pure and order-independent — both sides are keyed on `kind:name`, so a
 * reordered ledger produces the same attribution.
 */
export function attributeGrowth(before: readonly AssetRow[], after: readonly AssetRow[]): GrowthAttribution {
    const key = (r: AssetRow): string => `${r.kind}:${r.name}`;
    const b = new Map(before.map((r) => [key(r), r.tokens]));
    const a = new Map(after.map((r) => [key(r), r.tokens]));

    const entries: GrowthEntry[] = [];
    for (const [k, tokens] of a) {
        const prev = b.get(k);
        const [kind, ...rest] = k.split(':');
        const name = rest.join(':');
        if (prev === undefined) {
            entries.push({ name, kind: kind as AssetKind, delta: tokens, status: 'added' });
        } else if (tokens !== prev) {
            entries.push({ name, kind: kind as AssetKind, delta: tokens - prev, status: tokens > prev ? 'grew' : 'shrank' });
        }
    }
    for (const [k, tokens] of b) {
        if (a.has(k)) continue;
        const [kind, ...rest] = k.split(':');
        entries.push({ name: rest.join(':'), kind: kind as AssetKind, delta: -tokens, status: 'removed' });
    }

    const increases = entries.filter((e) => e.delta > 0).sort((x, y) => y.delta - x.delta || x.name.localeCompare(y.name));
    const decreases = entries.filter((e) => e.delta < 0).sort((x, y) => x.delta - y.delta || x.name.localeCompare(y.name));
    return { increases, decreases, net_delta: entries.reduce((n, e) => n + e.delta, 0) };
}

/**
 * Render an attribution as the lines a refusing gate appends to its message.
 *
 * Capped, because a refusal listing 400 assets is as unactionable as one listing
 * none — and the cap is stated rather than silent, so a reader knows the list is
 * a head and not the whole story.
 */
export function renderAttribution(g: GrowthAttribution, limit = 5): string[] {
    if (g.increases.length === 0 && g.decreases.length === 0) return [];
    const out: string[] = [];
    const sign = (n: number): string => (n >= 0 ? `+${String(n)}` : String(n));
    out.push(`    net delivered-token change: ${sign(g.net_delta)} tok`);
    if (g.increases.length > 0) {
        out.push(`    grew or arrived (top ${String(Math.min(limit, g.increases.length))} of ${String(g.increases.length)}):`);
        for (const e of g.increases.slice(0, limit)) {
            out.push(`      ${sign(e.delta).padStart(7)} tok  ${e.name} (${e.kind}, ${e.status})`);
        }
    }
    if (g.decreases.length > 0) {
        out.push(`    shrank or left (top ${String(Math.min(limit, g.decreases.length))} of ${String(g.decreases.length)}):`);
        for (const e of g.decreases.slice(0, limit)) {
            out.push(`      ${sign(e.delta).padStart(7)} tok  ${e.name} (${e.kind}, ${e.status})`);
        }
    }
    return out;
}
