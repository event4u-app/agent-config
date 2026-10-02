#!/usr/bin/env node
/**
 * Which one-token keyword triggers fire on prompts that belong to other rules.
 *
 * Step 1.3 of `road-to-rule-triggers-and-links-that-hold`. A single common word
 * — `rename`, `delete` — is a legitimate trigger for the rule that owns the
 * subject and a standing cost for every prompt that merely uses the word. This
 * reports which words sit at which share of the corpus. **Report only.** A
 * trigger change is a separate decision per rule, because a common word can be
 * exactly right: `augment-edit-discipline` genuinely wants to fire on a rename.
 *
 * The corpus is `tests/eval/routing-matrix/*.yaml`, the frozen set this tree
 * already evaluates routing against. Each `positives[].prompt` is labelled with
 * its file's rule. For a one-token keyword `K` on rule `R`, the share is:
 *
 *     |{ prompt : label(prompt) != R  and  K occurs as a word }|
 *     ---------------------------------------------------------
 *             |{ prompt : label(prompt) != R }|
 *
 * `near_misses` are deliberately NOT in the denominator. They carry a negative
 * label against their own file's rule and no positive label against any other,
 * so counting them would mix "belongs to another rule" with "belongs to no
 * rule" — two different claims, and only the first is what a cross-firing
 * trigger costs.
 *
 * The 5 % threshold is a stated default for a report, not a gate (D3). Nothing
 * acts on the figure automatically.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

// ledger-exempt: a REPORTER, not a gate. Its only non-zero exit says the
// corpus or the rule directory could not be read.

const _HERE = fileURLToPath(import.meta.url);

export const DEFAULT_THRESHOLD = 0.05;

export interface LabelledPrompt {
    rule: string;
    prompt: string;
    /** `positive` — belongs to `rule`. `near_miss` — declared NOT to be `rule`. */
    kind: 'positive' | 'near_miss';
}

export interface TriggerRow {
    rule: string;
    keyword: string;
    /** Foreign POSITIVE prompts the keyword occurs in. */
    hits: number;
    /** Prompts labelled positive against any other rule. */
    foreign: number;
    share: number;
    /**
     * Occurrences in a near-miss the rule ITSELF declares — the keyword fires
     * on a prompt that rule's own fixture says it must not fire on. A declared
     * false positive, and the sharpest row this report can produce.
     */
    own_near_miss_hits: number;
    own_near_misses: number;
    /** Occurrences in another rule's near-miss list. */
    foreign_near_miss_hits: number;
    /** Which rules those foreign positives belong to, highest first. */
    top_labels: { rule: string; count: number }[];
}

/** Every prompt in the matrix, labelled with its file's rule and its kind. */
export function loadCorpus(matrixDir: string): LabelledPrompt[] {
    const out: LabelledPrompt[] = [];
    const files = fs
        .readdirSync(matrixDir)
        .filter((n) => n.endsWith('.yaml'))
        .sort();
    for (const file of files) {
        const doc = parseYaml(fs.readFileSync(path.join(matrixDir, file), 'utf-8')) as {
            rule?: unknown;
            positives?: { prompt?: unknown }[];
            near_misses?: { prompt?: unknown }[];
        } | null;
        const rule = typeof doc?.rule === 'string' ? doc.rule : '';
        if (!rule) continue;
        for (const [items, kind] of [
            [doc?.positives, 'positive'],
            [doc?.near_misses, 'near_miss'],
        ] as const) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                if (typeof item?.prompt === 'string' && item.prompt.trim()) {
                    out.push({ rule, prompt: item.prompt, kind });
                }
            }
        }
    }
    return out;
}

/** One-token keyword triggers per rule, from `src/rules/*.md` frontmatter. */
export function singleTokenKeywords(rulesDir: string): { rule: string; keyword: string }[] {
    const out: { rule: string; keyword: string }[] = [];
    const files = fs
        .readdirSync(rulesDir)
        .filter((n) => n.endsWith('.md'))
        .sort();
    for (const file of files) {
        const content = fs.readFileSync(path.join(rulesDir, file), 'utf-8');
        if (!content.startsWith('---')) continue;
        const end = content.indexOf('\n---', 3);
        const block = end === -1 ? content : content.slice(0, end);
        const rule = file.replace(/\.md$/, '');
        for (const m of block.matchAll(/^\s*-\s*keyword:\s*["']?([^"'\n]+?)["']?\s*$/gm)) {
            const kw = (m[1] as string).trim();
            if (kw === '' || /\s/.test(kw)) continue;
            out.push({ rule, keyword: kw });
        }
    }
    return out;
}

/** Word-boundary, case-insensitive, with the keyword's own characters escaped. */
function occursAsWord(prompt: string, keyword: string): boolean {
    const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${esc}(?:$|[^\\p{L}\\p{N}_])`, 'iu').test(prompt);
}

export function rows(
    corpus: readonly LabelledPrompt[],
    keywords: readonly { rule: string; keyword: string }[],
): TriggerRow[] {
    const out: TriggerRow[] = [];
    for (const { rule, keyword } of keywords) {
        const foreign = corpus.filter((c) => c.rule !== rule && c.kind === 'positive');
        if (foreign.length === 0) continue;
        const hitting = foreign.filter((c) => occursAsWord(c.prompt, keyword));
        const ownNear = corpus.filter((c) => c.rule === rule && c.kind === 'near_miss');
        const foreignNear = corpus.filter((c) => c.rule !== rule && c.kind === 'near_miss');
        const labels = new Map<string, number>();
        for (const h of hitting) labels.set(h.rule, (labels.get(h.rule) ?? 0) + 1);
        out.push({
            rule,
            keyword,
            hits: hitting.length,
            foreign: foreign.length,
            share: hitting.length / foreign.length,
            own_near_miss_hits: ownNear.filter((c) => occursAsWord(c.prompt, keyword)).length,
            own_near_misses: ownNear.length,
            foreign_near_miss_hits: foreignNear.filter((c) => occursAsWord(c.prompt, keyword)).length,
            top_labels: [...labels.entries()]
                .map(([r, count]) => ({ rule: r, count }))
                .sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule))
                .slice(0, 5),
        });
    }
    out.sort(
        (a, b) =>
            b.share - a.share ||
            b.own_near_miss_hits - a.own_near_miss_hits ||
            b.foreign_near_miss_hits - a.foreign_near_miss_hits ||
            a.rule.localeCompare(b.rule) ||
            a.keyword.localeCompare(b.keyword),
    );
    return out;
}

export function renderTable(data: readonly TriggerRow[]): string[] {
    const L: string[] = [];
    L.push(
        '| Rule | Keyword | Foreign positives | Share | Own near-miss hits | Foreign near-miss hits | Mostly labelled against |',
    );
    L.push('|---|---|---:|---:|---:|---:|---|');
    for (const r of data) {
        const labels = r.top_labels.map((l) => `\`${l.rule}\` ${String(l.count)}`).join(', ') || '—';
        L.push(
            `| \`${r.rule}\` | \`${r.keyword}\` | ${String(r.hits)}/${String(r.foreign)} | ` +
                `${(r.share * 100).toFixed(1)} % | ${String(r.own_near_miss_hits)}/${String(r.own_near_misses)} | ` +
                `${String(r.foreign_near_miss_hits)} | ${labels} |`,
        );
    }
    return L;
}

const USAGE =
    'usage: report_single_token_triggers [--root DIR] [--threshold F] [--json | --table] [--all]\n' +
    '  --threshold  share above which a row is reported (default 0.05)\n' +
    '  --all        report every one-token keyword, not just those over the threshold\n';

export function main(): number {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(USAGE);
        return 0;
    }
    const KNOWN = ['--root', '--threshold', '--json', '--table', '--all'];
    // A silently-ignored `--treshold` would report against a threshold the
    // operator did not ask for, while still printing the default in the header.
    for (const a of argv) {
        if (a.startsWith('-') && !KNOWN.includes(a)) {
            process.stderr.write(`unknown argument: ${a}\n${USAGE}`);
            return 2;
        }
    }
    const flagValue = (f: string): string | null => {
        const i = argv.indexOf(f);
        return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
    };
    const root = flagValue('--root') ?? process.cwd();
    const rawT = flagValue('--threshold');
    const threshold = rawT === null ? DEFAULT_THRESHOLD : Number.parseFloat(rawT);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        process.stderr.write('--threshold must be a fraction between 0 and 1\n');
        return 2;
    }

    const matrixDir = path.join(root, 'tests', 'eval', 'routing-matrix');
    const rulesDir = path.join(root, 'src', 'rules');
    if (!fs.existsSync(matrixDir) || !fs.existsSync(rulesDir)) {
        process.stderr.write(`missing ${matrixDir} or ${rulesDir}\n`);
        return 1;
    }

    const corpus = loadCorpus(matrixDir);
    const keywords = singleTokenKeywords(rulesDir);
    const all = rows(corpus, keywords);
    // A keyword reaches the report by EITHER axis: the share the step names, or
    // a hit on a near-miss. Filtering on the share alone would have hidden the
    // only rows this corpus actually produces — see the report's own § on why
    // the 5 % threshold finds nothing here.
    const data = argv.includes('--all')
        ? all
        : all.filter((r) => r.share > threshold || r.own_near_miss_hits > 0 || r.foreign_near_miss_hits > 0);

    if (argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ threshold, corpus: corpus.length, keywords: keywords.length, rows: data }, null, 2)}\n`,
        );
        return 0;
    }
    if (argv.includes('--table')) {
        process.stdout.write(`${renderTable(data).join('\n')}\n`);
        return 0;
    }

    const positives = corpus.filter((c) => c.kind === 'positive').length;
    process.stdout.write(
        `corpus ${String(corpus.length)} prompt(s) — ${String(positives)} positive, ` +
            `${String(corpus.length - positives)} near-miss · ` +
            `${String(keywords.length)} one-token keyword(s) over ` +
            `${String(new Set(keywords.map((k) => k.rule)).size)} rule(s)\n` +
            `${String(all.filter((r) => r.share > threshold).length)} row(s) above ` +
            `${(threshold * 100).toFixed(1)} % of foreign positives · ` +
            `${String(data.length)} reportable on either axis\n\n`,
    );
    for (const r of data) {
        process.stdout.write(
            `  ${(r.share * 100).toFixed(1).padStart(5)} %  ${r.keyword.padEnd(18)} ${r.rule.padEnd(32)} ` +
                `pos ${String(r.hits)}/${String(r.foreign)}  own-near ${String(r.own_near_miss_hits)}/${String(r.own_near_misses)}  ` +
                `foreign-near ${String(r.foreign_near_miss_hits)}\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
