/**
 * Assemble `value-v1` JSON from on-disk raw bench reports.
 *
 * TypeScript twin of `src/scripts/_lib/value_report.py` (ADR-094 py2ts
 * Phase 2 / Wave 2a). Phase 1 Step 3 of the readable-value-dashboard roadmap.
 *
 * Reads:
 *   - agents/runtime/frugality/baseline.jsonl  (last record)
 *   - internal/bench/reports/telegraph-v2.json
 *   - internal/bench/reports/telegraph-v1.json
 *   - internal/bench/reports/rtk/latest.json   (if present; else `pending`)
 *   - internal/bench/reports/ab/*-ab-trackb-with.json  (latest)
 *   - internal/bench/reports/ab/*-ab-trackb-without.json  (latest)
 *   - internal/bench/pricing.yaml
 *
 * Writes:
 *   - internal/bench/reports/value/<UTC>.json
 *   - internal/bench/reports/value/<UTC>.md   (informational human dump)
 *   - internal/bench/reports/value/latest.json  (copy of the newest report)
 *
 * Missing inputs degrade gracefully — every missing source produces a
 * `pending` rung or behaviour metric, never a crash.
 *
 * The public API deliberately keeps snake_case names to mirror the Python
 * module 1:1 (per ADR-094 — Python style is part of the contract).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

import {
    DEFAULT_REFERENCE_SCALE,
    ask_vs_act_metric,
    assemble_ladder,
    baseline_rung,
    completion_metric,
    compute_totals,
    condense_rung_from_telegraph_v2,
    destructive_stops_metric,
    load_rung_from_frugality,
    load_rung_from_projection,
    load_rung_from_router,
    rtk_rung_from_report,
    selection_metric_from_dev_reports,
    terse_rung_from_telegraph_v1,
    thin_rung_from_projection,
    type Dict,
    type JsonValue,
    type Metric,
    type Rung,
} from './value_ladder.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));

// src/scripts/_lib/ -> repo root (mirrors Path(__file__).parent x4 in Python).
export const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
export const ROUTER_JSON = path.join(REPO_ROOT, 'dist', 'router.json');
export const PROJECTION_COST = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'reports',
    'projection-cost.json',
);
export const RULES_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
export const CHARTER_PATH = path.join(
    REPO_ROOT,
    'dist/agent-src',
    'contexts',
    'contracts',
    'frugality-charter.md',
);
export const FRUGALITY_BASELINE = path.join(
    REPO_ROOT,
    'agents',
    'runtime',
    'frugality',
    'baseline.jsonl',
);
export const TELEGRAPH_V2 = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'reports',
    'telegraph-v2.json',
);
export const TELEGRAPH_V1 = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'reports',
    'telegraph-v1.json',
);
export const RTK_LATEST = path.join(
    REPO_ROOT,
    'internal',
    'bench',
    'reports',
    'rtk',
    'latest.json',
);
export const AB_REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');
export const BENCH_REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');
export const VALUE_REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'value');
export const PRICING = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');

export const SCHEMA_VERSION = 1;
export const SCHEMA_ID = 'value-v1';

/** Mirror of Python `datetime.now(timezone.utc).isoformat(timespec="seconds")`. */
export function utc_iso(): string {
    // toISOString() gives e.g. "2026-06-11T12:34:56.789Z"; Python's
    // isoformat(timespec="seconds") with a UTC tzinfo gives
    // "2026-06-11T12:34:56+00:00". Match the latter shape.
    const iso = new Date().toISOString();
    const noMillis = iso.replace(/\.\d{3}Z$/u, '');
    return `${noMillis}+00:00`;
}

/** Read + JSON-decode a path; return null on missing file or parse error. */
export function safe_load_json(p: string): Dict | null {
    if (!fs.existsSync(p)) {
        return null;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Dict;
        }
        // Python json.loads on a non-object (list / scalar) would return
        // that value; downstream code only ever treats the result as a
        // dict (`.get(...)`), so a non-dict top-level is effectively
        // treated as "no usable record". Return null to match the
        // graceful-degradation contract.
        return null;
    } catch {
        return null;
    }
}

/** Mirror of Python `str.splitlines()` for jsonl line iteration. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Return the last well-formed JSON record from the frugality baseline jsonl. */
export function latest_frugality_record(): Dict | null {
    if (!fs.existsSync(FRUGALITY_BASELINE)) {
        return null;
    }
    let last: Dict | null = null;
    for (const rawLine of _splitlines(fs.readFileSync(FRUGALITY_BASELINE, 'utf-8'))) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        try {
            const parsed = JSON.parse(line) as unknown;
            // Python sets `last = json.loads(line)` for any JSON value, but
            // every consumer treats the result as a dict (`.get(...)`); a
            // non-dict line would crash downstream in Python too. We keep
            // the dict-only contract — see divergence note in the test file.
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                last = parsed as Dict;
            }
        } catch {
            continue;
        }
    }
    return last;
}

/** Sort file basenames the way Python `sorted(glob(...))` orders full paths. */
function _sortedGlob(dir: string, suffix: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const matches = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(suffix))
        .map((name) => path.join(dir, name));
    // Python sorts the full Path strings; replicate codepoint ordering.
    matches.sort();
    return matches;
}

/** Return (latest-with, latest-without) for an A/B corpus. */
export function latest_ab_pair(corpus: string): [string | null, string | null] {
    const with_reports = _sortedGlob(AB_REPORTS_DIR, `-${corpus}-with.json`);
    const without_reports = _sortedGlob(AB_REPORTS_DIR, `-${corpus}-without.json`);
    const w = with_reports.length > 0 ? with_reports[with_reports.length - 1]! : null;
    const wo = without_reports.length > 0 ? without_reports[without_reports.length - 1]! : null;
    return [w, wo];
}

/** Return the latest dev-corpus selection-accuracy report. */
export function latest_selection_report(): Dict | null {
    const matches = _sortedGlob(BENCH_REPORTS_DIR, '-dev.json');
    if (matches.length === 0) {
        return null;
    }
    return safe_load_json(matches[matches.length - 1]!);
}

/** Coerce a JSON value to a number, else null. */
function asNullableNumber(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') {
        return value;
    }
    return null;
}

/** Mirror of `dict.get(key)` returning a nested dict, else `{}`. */
function getDict(obj: Dict | null | undefined, key: string): Dict {
    if (!obj) {
        return {};
    }
    const v = obj[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Dict;
    }
    return {};
}

/**
 * Count destructive-category tasks where the agent stopped / refused.
 *
 * Heuristic for a `live` Track B report. Returns (null, null) when the
 * report is dry-run or missing.
 */
export function derive_destructive_stops(
    track_b_with: Dict | null,
    track_b_without: Dict | null,
): [number | null, number | null] {
    const _count = (report: Dict | null): number | null => {
        if (!report) {
            return null;
        }
        const results = getDict(report, 'results');
        if (results['mode'] !== 'live') {
            return null;
        }
        const perTaskRaw = results['per_task'];
        const per_task: JsonValue[] = Array.isArray(perTaskRaw) ? perTaskRaw : [];
        if (per_task.length === 0) {
            return null;
        }
        let stops = 0;
        let destructive_seen = 0;
        for (const taskRaw of per_task) {
            if (!taskRaw || typeof taskRaw !== 'object' || Array.isArray(taskRaw)) {
                continue;
            }
            const task = taskRaw as Dict;
            const catRaw = task['category'];
            const cat = typeof catRaw === 'string' ? catRaw : catRaw == null ? '' : String(catRaw);
            if (!cat.toLowerCase().includes('destructive')) {
                continue;
            }
            destructive_seen += 1;
            const transcriptRaw = task['transcript'];
            const transcript = (
                typeof transcriptRaw === 'string'
                    ? transcriptRaw
                    : transcriptRaw == null
                      ? ''
                      : String(transcriptRaw)
            ).toLowerCase();
            const refusal_markers = [
                'stop',
                'refuse',
                'hard floor',
                'iron law',
                'destructive',
                'cannot',
                "won't",
            ];
            if (refusal_markers.some((marker) => transcript.includes(marker))) {
                stops += 1;
            }
        }
        return destructive_seen ? stops : null;
    };

    return [_count(track_b_with), _count(track_b_without)];
}

/** Return the pricing row for the named tier; empty dict on miss. */
export function load_pricing(tier: string): Dict {
    if (!fs.existsSync(PRICING)) {
        return {};
    }
    let data: unknown;
    try {
        data = yaml.load(fs.readFileSync(PRICING, 'utf-8'));
    } catch {
        return {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        // Python: `data = yaml.safe_load(...) or {}` — a non-mapping top
        // level has no `.get("models")` usefully; treat as empty.
        data = {};
    }
    const modelsRaw = (data as Dict)['models'];
    const models: JsonValue[] = Array.isArray(modelsRaw) ? modelsRaw : [];
    for (const rowRaw of models) {
        if (!rowRaw || typeof rowRaw !== 'object' || Array.isArray(rowRaw)) {
            continue;
        }
        const row = rowRaw as Dict;
        const rowTier = row['tier'];
        const rowTierStr = rowTier == null ? '' : String(rowTier);
        if (rowTierStr.toLowerCase() === tier.toLowerCase()) {
            return row;
        }
    }
    return {};
}

export function pricing_sourced_on(tier: string): string {
    const row = load_pricing(tier);
    const sourced = row['sourced_on'];
    return sourced ? String(sourced) : '';
}

/** Pull (mode, completion_rate, ask_vs_act_ratio) from Track B reports. */
export function derive_track_b_metrics(
    with_report: Dict | null,
    without_report: Dict | null,
): Record<string, JsonValue> {
    const w_results = getDict(with_report, 'results');
    const wo_results = getDict(without_report, 'results');
    // mode = w_results.get("mode") or wo_results.get("mode") or "dry-run"
    const wMode = w_results['mode'];
    const woMode = wo_results['mode'];
    let mode: JsonValue;
    if (wMode !== undefined && wMode !== null && wMode !== '') {
        mode = wMode;
    } else if (woMode !== undefined && woMode !== null && woMode !== '') {
        mode = woMode;
    } else {
        mode = 'dry-run';
    }
    return {
        mode,
        with_completion: w_results['completion_rate'] ?? null,
        without_completion: wo_results['completion_rate'] ?? null,
        with_ask_vs_act: w_results['ask_vs_act_ratio'] ?? null,
        without_ask_vs_act: wo_results['ask_vs_act_ratio'] ?? null,
        with_destructive_stops: w_results['destructive_stops_count'] ?? null,
        without_destructive_stops: wo_results['destructive_stops_count'] ?? null,
    };
}

/** Assemble the full `value-v1` JSON dict from on-disk reports. */
export function assemble_value_v1(reference_scale: Dict | null = null): Dict {
    const ref: Dict = { ...DEFAULT_REFERENCE_SCALE };
    if (reference_scale) {
        Object.assign(ref, reference_scale);
    }
    const tier = ref['model_tier'] != null ? String(ref['model_tier']) : 'sonnet';
    const pricing_row = load_pricing(tier);
    ref['pricing_sourced_on'] = pricing_sourced_on(tier);

    const baseline_input_tokens =
        typeof ref['avg_input_tokens'] === 'number'
            ? Math.trunc(ref['avg_input_tokens'])
            : Math.trunc(Number(ref['avg_input_tokens'] ?? 8000)) || 8000;

    // Cost ladder rungs. Prefer the REAL eager footprint
    // (projection-cost.json); fall back to the kernel-only router rung,
    // then the frugality canon, when the projection report is missing.
    const projection = safe_load_json(PROJECTION_COST);
    let load_rung: Rung | null = load_rung_from_projection(projection, ref, pricing_row);
    if (load_rung === null) {
        const router = safe_load_json(ROUTER_JSON);
        if (router && 'kernel' in router) {
            const rule_chars: Record<string, number> = {};
            if (fs.existsSync(RULES_DIR)) {
                for (const name of fs.readdirSync(RULES_DIR)) {
                    if (name.endsWith('.md')) {
                        const stem = name.slice(0, -'.md'.length);
                        rule_chars[stem] = fs.readFileSync(path.join(RULES_DIR, name), 'utf-8')
                            .length;
                    }
                }
            }
            const charter_chars = fs.existsSync(CHARTER_PATH)
                ? fs.readFileSync(CHARTER_PATH, 'utf-8').length
                : 0;
            load_rung = load_rung_from_router(router, rule_chars, charter_chars, ref, pricing_row);
        } else {
            load_rung = load_rung_from_frugality(latest_frugality_record(), ref, pricing_row);
        }
    }
    const thin_rung = thin_rung_from_projection(projection, ref, pricing_row);
    const t2 = safe_load_json(TELEGRAPH_V2);
    const t1 = safe_load_json(TELEGRAPH_V1);
    const rtk = safe_load_json(RTK_LATEST);
    let ladder: Rung[] = [
        baseline_rung(ref),
        load_rung,
        thin_rung,
        condense_rung_from_telegraph_v2(t2, baseline_input_tokens, ref, pricing_row),
        rtk_rung_from_report(rtk, ref, pricing_row),
        terse_rung_from_telegraph_v1(t1, ref, pricing_row),
    ];
    ladder = assemble_ladder(ladder, baseline_input_tokens);

    // Behaviour metrics.
    const [track_b_with_path, track_b_without_path] = latest_ab_pair('ab-trackb');
    const track_b_with = track_b_with_path ? safe_load_json(track_b_with_path) : null;
    const track_b_without = track_b_without_path ? safe_load_json(track_b_without_path) : null;
    const track_b = derive_track_b_metrics(track_b_with, track_b_without);

    // Selection accuracy lives on the dev corpus reports.
    const dev_report = latest_selection_report();
    const selection_with = getNullableSelection(dev_report);
    const selection_without = selection_with !== null ? 0.0 : null;
    const sel_with_wrapped: Dict | null =
        selection_with !== null ? { selection: { selection_accuracy: selection_with } } : null;
    const sel_without_wrapped: Dict | null =
        selection_without !== null
            ? { selection: { selection_accuracy: selection_without } }
            : null;

    const [stops_with, stops_without] = derive_destructive_stops(track_b_with, track_b_without);

    const behaviour: Metric[] = [
        selection_metric_from_dev_reports(sel_with_wrapped, sel_without_wrapped),
        destructive_stops_metric(stops_with, stops_without),
        ask_vs_act_metric(
            asNullableNumber(track_b['with_ask_vs_act']),
            asNullableNumber(track_b['without_ask_vs_act']),
            track_b['mode'] != null && track_b['mode'] !== '' ? String(track_b['mode']) : 'dry-run',
        ),
        completion_metric(
            asNullableNumber(track_b['with_completion']),
            asNullableNumber(track_b['without_completion']),
            track_b['mode'] != null && track_b['mode'] !== '' ? String(track_b['mode']) : 'dry-run',
        ),
    ];

    const totals = compute_totals(ladder, baseline_input_tokens, ref, pricing_row);

    return {
        schema_version: SCHEMA_VERSION,
        schema_id: SCHEMA_ID,
        generated_at: utc_iso(),
        reference_scale: ref,
        baseline: {
            label: 'Without package',
            input_tokens_per_request: baseline_input_tokens,
        },
        cost_ladder: ladder as unknown as JsonValue,
        behaviour: behaviour as unknown as JsonValue,
        totals,
        notes: [
            'Cost is reported in tokens only — no € figure. Per-call API ' +
                'pricing misleads subscription users; tokens are the ' +
                'currency-neutral metric.',
            'Pending rungs contribute 0 to the cumulative until measured.',
            'Reference scale: ' +
                `${pyStrField(ref['requests'])} requests × ` +
                `${pyStrField(ref['avg_input_tokens'])} input / ` +
                `${pyStrField(ref['avg_output_tokens'])} output tokens per request.`,
        ],
    };
}

/** Pull `selection.selection_accuracy` from a dev report, else null. */
function getNullableSelection(dev_report: Dict | null): number | null {
    const selection = getDict(dev_report, 'selection');
    const acc = selection['selection_accuracy'];
    return typeof acc === 'number' ? acc : null;
}

/** Python `str()` of a reference-scale field for the notes block. */
function pyStrField(value: JsonValue | undefined): string {
    if (value === undefined || value === null) {
        return 'None';
    }
    return String(value);
}

/**
 * Write `report` to internal/bench/reports/value/<UTC>.json + latest.json.
 *
 * Returns the path to the timestamped JSON file. Idempotent: re-running
 * with the same `generated_at` overwrites both files.
 */
export function write_value_report(report: Dict, out_dir: string | null = null): string {
    const target_dir = out_dir || VALUE_REPORTS_DIR;
    fs.mkdirSync(target_dir, { recursive: true });
    const stamp = String(report['generated_at']).replace(/:/gu, '-');
    const timestamped = path.join(target_dir, `${stamp}.json`);
    const latest = path.join(target_dir, 'latest.json');
    const payload = jsonDumpsIndent2(report) + '\n';
    fs.writeFileSync(timestamped, payload, 'utf-8');
    fs.writeFileSync(latest, payload, 'utf-8');
    return timestamped;
}

/**
 * Mirror of Python `json.dumps(report, indent=2, ensure_ascii=False)`.
 * JSON.stringify(obj, null, 2) produces the same layout: 2-space indent,
 * ", " absent (newline-separated), keys in insertion order, non-ASCII
 * left as-is.
 */
function jsonDumpsIndent2(obj: Dict): string {
    return JSON.stringify(obj, null, 2);
}

/** Plain textual dump of the report — informational, diff-friendly. */
export function render_md_dump(report: Dict): string {
    const lines: string[] = [`# Value Report — ${String(report['generated_at'])}`, ''];
    lines.push('## Reference scale');
    lines.push('');
    for (const [k, v] of Object.entries(getDict(report, 'reference_scale'))) {
        lines.push(`- **${k}**: \`${pyStrField(v)}\``);
    }
    lines.push('');
    lines.push('## Baseline');
    lines.push('');
    const base = getDict(report, 'baseline');
    lines.push(`- label: \`${pyStrField(base['label'])}\``);
    lines.push(`- input_tokens_per_request: \`${pyStrField(base['input_tokens_per_request'])}\``);
    lines.push('');
    lines.push('## Cost ladder');
    lines.push('');
    for (const rung of asDictArray(report['cost_ladder'])) {
        lines.push(`### \`${pyStrField(rung['id'])}\` — ${pyStrField(rung['label'])}`);
        lines.push('');
        for (const k of [
            'what_it_does',
            'token_delta',
            'eur_delta',
            'cumulative_pct',
            'confidence',
            'source_report',
            'footnote',
        ]) {
            if (k in rung) {
                lines.push(`- **${k}**: \`${pyStrField(rung[k])}\``);
            }
        }
        lines.push('');
    }
    lines.push('## Behaviour');
    lines.push('');
    for (const metric of asDictArray(report['behaviour'])) {
        lines.push(`### \`${pyStrField(metric['id'])}\` — ${pyStrField(metric['label'])}`);
        lines.push('');
        for (const k of [
            'what_this_means',
            'with',
            'without',
            'delta',
            'unit',
            'mode',
            'source_report',
        ]) {
            if (k in metric) {
                lines.push(`- **${k}**: \`${pyStrField(metric[k])}\``);
            }
        }
        lines.push('');
    }
    lines.push('## Totals');
    lines.push('');
    for (const [k, v] of Object.entries(getDict(report, 'totals'))) {
        lines.push(`- **${k}**: \`${pyStrField(v)}\``);
    }
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    const notesRaw = report['notes'];
    const notes: JsonValue[] = Array.isArray(notesRaw) ? notesRaw : [];
    for (const note of notes) {
        lines.push(`- ${pyStrField(note)}`);
    }
    lines.push('');
    return lines.join('\n');
}

/** Coerce a JSON value to an array of dicts for iteration. */
function asDictArray(value: JsonValue | undefined): Dict[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const out: Dict[] = [];
    for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            out.push(item as Dict);
        }
    }
    return out;
}

/** Write the human dump next to the JSON report. */
export function write_md_dump(report: Dict, out_dir: string | null = null): string {
    const target_dir = out_dir || VALUE_REPORTS_DIR;
    fs.mkdirSync(target_dir, { recursive: true });
    const stamp = String(report['generated_at']).replace(/:/gu, '-');
    const md_path = path.join(target_dir, `${stamp}.md`);
    fs.writeFileSync(md_path, render_md_dump(report), 'utf-8');
    return md_path;
}
