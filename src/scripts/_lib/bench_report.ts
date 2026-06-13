// Report emitter for `scripts/bench_run.py` — step-4 Phase 2 Step 4.
//
// Serializes the unified report dict to JSON + Markdown per
// docs/contracts/benchmark-report-schema.md. Filename format:
// `internal/bench/reports/<UTC ISO-8601 with : -> ->-<corpus_id>.{json,md}`.
//
// TypeScript twin of `src/scripts/_lib/bench_report.py` (ADR-094 py2ts
// Phase 2 / Wave 2a). Markdown / JSON rendering is byte-exact with the
// Python original; the inline `:.2%` formatting replicates Python's
// round-half-to-even semantics.
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Sortable lexicographic stamp — drop ':' so filenames stay portable. */
export function utc_now_filename_stamp(): string {
    return _utcStrftime('%Y-%m-%dT%H-%M-%SZ');
}

export function utc_now_iso(): string {
    return _utcStrftime('%Y-%m-%dT%H:%M:%SZ');
}

// Replicate datetime.now(timezone.utc).strftime for the two formats above.
function _utcStrftime(fmt: string): string {
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const M = String(d.getUTCMinutes()).padStart(2, '0');
    const S = String(d.getUTCSeconds()).padStart(2, '0');
    return fmt
        .replace('%Y', Y)
        .replace('%m', m)
        .replace('%d', D)
        .replace('%H', H)
        .replace('%M', M)
        .replace('%S', S);
}

export function report_paths(reportsDir: string, corpusId: string, stamp: string): [string, string] {
    const base = `${stamp}-${corpusId}`;
    return [path.join(reportsDir, `${base}.json`), path.join(reportsDir, `${base}.md`)];
}

export function write_json(filePath: string, report: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${_pyJsonDumps(report, 2)}\n`, 'utf-8');
}

// ── Python-format parity helpers ─────────────────────────────────────────
//
// Python's f"{x:.2%}" rounds half-to-even on the decimal representation.
// JS `toFixed` rounds half away from zero, so we reimplement to stay
// byte-exact with the Python original.

/** Replicate Python `format(x, ".2%")` — value × 100, banker-rounded, '%' suffix. */
function _fmt_pct2(x: number): string {
    return `${_pyFixed(x * 100, 2)}%`;
}

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython's float formatting.
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

function _selection_section(selection: Record<string, unknown>): string {
    const lines: string[] = [
        '## Selection accuracy',
        '',
        `- top-K = **${selection['top_k']}** · ` +
            `hit **${selection['prompts_hit']} / ${selection['prompts_total']}** · ` +
            `accuracy **${_fmt_pct2(selection['selection_accuracy'] as number)}** · ` +
            `target **${_fmt_pct2(selection['target'] as number)}** · ` +
            `verdict **${selection['passed'] ? 'PASS' : 'FAIL'}**`,
        '',
        '| id | hit | expected | top-K ranked |',
        '|---|---|---|---|',
    ];
    const perPrompt = (selection['per_prompt'] as Array<Record<string, unknown>>) ?? [];
    for (const r of perPrompt) {
        const mark = r['hit'] ? '✅' : '❌';
        const expected = ((r['expected_skills'] as string[]) ?? []).join(', ') || '—';
        const ranked = ((r['top_k_ranked'] as string[]) ?? []).join(', ') || '—';
        lines.push(`| \`${r['id']}\` | ${mark} | ${expected} | ${ranked} |`);
    }
    return lines.join('\n');
}

function _token_usage_section(cost: Record<string, unknown>): string {
    // Token-only — the monetary (USD) comparison is intentionally omitted:
    // it assumes per-call API pricing, which misleads subscription users.
    // Tokens are the currency-neutral metric that matters. JSON keeps the
    // raw cost field for back-compat; it is simply not rendered.
    if (cost['source'] === 'unavailable') {
        return (
            '## Token usage\n\n' +
            `- **source:** \`unavailable\` (${(cost['reason'] as string | undefined) ?? 'unknown'})\n` +
            `- **scanned:** \`${(cost['scanned_path'] as string | undefined) ?? '—'}\`\n\n` +
            '_No session jsonl available. Run `node scripts/cost/track.mjs` ' +
            'from a real Claude Code session to populate agents/cost-tracking/sessions.jsonl._\n'
        );
    }
    const totals = cost['totals'] as Record<string, number>;
    const lines: string[] = [
        '## Token usage',
        '',
        `- **source:** \`${cost['source']}\` · sessions scanned: **${cost['sessions_scanned']}**`,
        '',
        '| tier | messages |',
        '|---|---:|',
    ];
    const perTier = cost['per_tier'] as Record<string, { messages: number; cost_usd: number }>;
    for (const tier of Object.keys(perTier)) {
        const slot = perTier[tier] as { messages: number; cost_usd: number };
        if (slot.messages === 0 && slot.cost_usd === 0.0) {
            continue;
        }
        lines.push(`| ${tier} | ${slot.messages} |`);
    }
    lines.push(
        '',
        '| metric | value |',
        '|---|---:|',
        `| input_tokens | ${totals['input_tokens']} |`,
        `| output_tokens | ${totals['output_tokens']} |`,
        `| cache_read_input_tokens | ${totals['cache_read_input_tokens']} |`,
        `| cache_creation_input_tokens | ${totals['cache_creation_input_tokens']} |`,
    );
    return lines.join('\n');
}

function _quality_section(quality: Record<string, unknown>): string {
    if (quality['source'] === 'not_collected') {
        return (
            '## Quality probe\n\n' +
            `- **source:** \`not_collected\` · assertions declared: ` +
            `**${quality['prompts_with_assertion']}**\n` +
            '- _Pass `--agent-output <path-to-outputs.json>` (map of `id -> str`) ' +
            'to score the rubrics. Schema invariant: missing output keeps ' +
            '`verdict.overall` at `partial`._\n'
        );
    }
    const lines: string[] = [
        '## Quality probe',
        '',
        `- **source:** \`${quality['source']}\` · ` +
            `passing **${quality['prompts_passing']} / ${quality['prompts_with_assertion']}** · ` +
            `score **${_fmt_pct2(quality['quality_score'] as number)}**`,
        '',
        '| id | kind | passed | assertion |',
        '|---|---|---|---|',
    ];
    const perPrompt = (quality['per_prompt'] as Array<Record<string, unknown>>) ?? [];
    for (const r of perPrompt) {
        const passed = r['passed'];
        const mark = passed === true ? '✅' : passed === false ? '❌' : '—';
        lines.push(`| \`${r['id']}\` | ${r['assertion_kind']} | ${mark} | \`${r['assertion']}\` |`);
    }
    return lines.join('\n');
}

export function render_markdown(report: Record<string, unknown>): string {
    const corpus = report['corpus'] as Record<string, unknown>;
    const sel = report['selection'] as Record<string, unknown>;
    const cost = report['cost'] as Record<string, unknown>;
    const qual = report['quality'] as Record<string, unknown>;
    const verdict = report['verdict'] as Record<string, unknown>;
    const headline =
        `# Benchmark Report — \`${corpus['id']}\` · ${report['generated_at']}\n\n` +
        '## Headline\n\n' +
        `- **selection** ${_fmt_pct2(sel['selection_accuracy'] as number)} (target ${_fmt_pct2(
            sel['target'] as number,
        )}) → **${verdict['selection']}**\n` +
        `- **tokens** ${
            cost['source'] !== 'unavailable' ? `sessions=${cost['sessions_scanned']}` : (cost['source'] as string)
        }\n` +
        `- **quality** ${_fmt_pct2(qual['quality_score'] as number)} → **${verdict['quality']}**\n` +
        `- **overall** → **${verdict['overall']}**\n`;
    const notes =
        '## Notes\n\n' +
        `- corpus path: \`${corpus['path']}\` · prompts: **${corpus['prompt_count']}**\n` +
        `- baseline collector: \`${(report['runner'] as Record<string, unknown>)['baseline_collector']}\`\n`;
    return (
        [
            headline,
            _selection_section(sel),
            _token_usage_section(cost),
            _quality_section(qual),
            notes,
        ].join('\n\n') + '\n'
    );
}

export function write_markdown(filePath: string, report: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, render_markdown(report), 'utf-8');
}

// ── JSON serializer — Python json.dumps(indent=2) parity ─────────────────
//
// CPython's json.dumps with indent renders ", " / ": " separators, with the
// item separator collapsed to "," at the end of each line. JSON.stringify
// with a numeric indent matches: it uses ",\n" between items and ": " after
// keys, with no trailing whitespace — identical to Python's default with
// indent set. Non-ASCII is kept verbatim in both (Python: ensure_ascii is
// True by default → escapes non-ASCII!). We must therefore escape non-ASCII
// to match Python's default ensure_ascii=True.
function _pyJsonDumps(obj: unknown, indent: number): string {
    const raw = JSON.stringify(obj, null, indent);
    // Python's default ensure_ascii=True escapes every non-ASCII UTF-16 code
    // unit as lowercase \uXXXX (surrogate pairs become two escapes).
    // JSON.stringify leaves them literal, so post-process to match.
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code > 0x7f) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += raw[i];
        }
    }
    return out;
}
