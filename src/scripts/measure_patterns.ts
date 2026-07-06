#!/usr/bin/env node
/**
 * Measure presence of the eight Phase-3.1 judge patterns across all skills.
 *
 * TypeScript twin of `src/scripts/measure_patterns.py` (ADR-200 — Python→TS
 * migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY: flags
 * (`--json`, `--tier`, `--diff-baseline`), exit codes (0 / 3 when the skills
 * dir is missing), byte-identical stdout/stderr. No behaviour changes.
 *
 * Produces the before/after baseline for
 * `agents/roadmaps/road-to-stronger-skills.md`. Zero side-effects: this is a
 * read-only reporter. No skill file is ever mutated.
 *
 * Patterns (see road-to-stronger-skills.md for definitions):
 *   1. System-prompt opening (blockquote role frame under the top heading)
 *   2. Scope routing (`route to [sibling]` inside "Do NOT use when")
 *   3. Validation gate (`## Validation` appears before `## Output format`)
 *   4. Ordered output fields (numbered required-fields list)
 *   5. Severity legend (🔴/🟡/🟢 with concrete definitions)
 *   6. References section with at least one URL
 *   7. Runtime boundary disclaimer
 *   8. Anti-sycophancy rules in "Do NOT"
 *
 * NOTE: scans `src/skills` — the canonical source-of-truth skill library.
 * (The pre-py2ts .py read the now-removed legacy condensed-source skills
 * corpus; repointed here so the scanner runs on the live tree.)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_patterns.ts → parents[2] is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(ROOT, 'src', 'skills');

type Tier = number | string;

// Tier assignments mirror agents/roadmaps/road-to-stronger-skills.md.
const TIERS: Record<string, Tier> = {
    'adversarial-review': 1, 'authz-review': 1, 'code-review': 1,
    'design-review': 1, 'performance-analysis': 1, 'project-analyzer': 1,
    'readme-reviewer': 1, 'receiving-code-review': 1,
    'requesting-code-review': 1, 'security-audit': 1, 'skill-reviewer': 1,
    'threat-modeling': 1, 'validate-feature-fit': 1,
    'verify-before-complete': 1,
    'agent-docs-writing': 2, 'analysis-autonomous-mode': 2,
    'analysis-skill-router': 2, 'blast-radius-analyzer': 2,
    'bug-analyzer': 2, 'code-refactoring': 2, 'data-flow-mapper': 2,
    'command-routing': 2, 'copilot-agents-optimization': 2,
    'description-assist': 2, 'developer-like-execution': 2,
    'feature-planning': 2, 'learning-to-rule-or-skill': 2,
    'project-analysis-core': 2, 'project-analysis-hypothesis-driven': 2,
    'project-analysis-laravel': 2, 'project-analysis-nextjs': 2,
    'project-analysis-node-express': 2, 'project-analysis-react': 2,
    'project-analysis-symfony': 2, 'project-analysis-zend-laminas': 2,
    'sequential-thinking': 2, 'skill-improvement-pipeline': 2,
    'subagent-orchestration': 2, 'systematic-debugging': 2,
    'universal-project-analysis': 2,
    'api-design': 3, 'api-endpoint': 3, 'api-testing': 3,
    'artisan-commands': 3, 'blade-ui': 3, 'command-writing': 3,
    'composer-packages': 3, 'context-document': 3,
    'conventional-commits-writing': 3, 'dashboard-design': 3,
    'dependency-upgrade': 3, 'dto-creator': 3, 'eloquent': 3,
    'fe-design': 3, 'finishing-a-development-branch': 3, 'flux': 3,
    'git-workflow': 3, 'guideline-writing': 3, 'jobs-events': 3,
    'laravel': 3, 'laravel-horizon': 3, 'laravel-mail': 3,
    'laravel-middleware': 3, 'laravel-notifications': 3,
    'laravel-pennant': 3, 'laravel-pulse': 3, 'laravel-reverb': 3,
    'laravel-scheduling': 3, 'laravel-validation': 3, 'livewire': 3,
    'logging-monitoring': 3, 'merge-conflicts': 3, 'migration-creator': 3,
    'module-management': 3, 'openapi': 3, 'override-management': 3,
    'pest-testing': 3, 'php-coder': 3, 'php-debugging': 3,
    'php-service': 3, 'playwright-testing': 3, 'readme-writing': 3,
    'readme-writing-package': 3, 'roadmap-management': 3, 'rule-writing': 3,
    'skill-management': 3, 'skill-writing': 3, 'sql-writing': 3,
    'technical-specification': 3, 'test-driven-development': 3,
    'test-performance': 3, 'upstream-contribute': 3,
    'using-git-worktrees': 3,
    'aws-infrastructure': 4, 'check-refs': 4, 'copilot-config': 4,
    'database': 4, 'devcontainer': 4, 'docker': 4, 'file-editor': 4,
    'github-ci': 4, 'grafana': 4, 'jira-integration': 4, 'lint-skills': 4,
    'mcp': 4, 'multi-tenancy': 4, 'performance': 4, 'project-docs': 4,
    'quality-tools': 4, 'rtk-output-filtering': 4, 'security': 4,
    'sentry-integration': 4, 'terraform': 4, 'terragrunt': 4,
    'traefik': 4, 'websocket': 4,
    'judge-bug-hunter': 'compliant', 'judge-code-quality': 'compliant',
    'judge-security-auditor': 'compliant',
    'judge-test-coverage': 'compliant',
};

// Which patterns count as "required" per tier.
const TIER_TARGETS = new Map<Tier, Set<number>>([
    [1, new Set([1, 2, 3, 4, 5, 6, 7, 8])],
    [2, new Set([1, 2, 3, 4])],
    [3, new Set([1, 2])],
    [4, new Set([2])],
    ['compliant', new Set<number>()],
]);

interface Detection {
    skill: string;
    tier: Tier;
    patterns: Record<number, boolean>;
    score: number;
    required: number;
    present: number;
}

function _sectionIndices(text: string): Map<string, [number, number]> {
    // re.finditer(r"^##\s+(.+?)\s*$", text, re.MULTILINE)
    const re = /^##\s+(.+?)\s*$/gm;
    const headings: Array<[number, string]> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        headings.push([m.index, m[1]!.trim()]);
        if (m.index === re.lastIndex) re.lastIndex++;
    }
    const sections = new Map<string, [number, number]>();
    for (let i = 0; i < headings.length; i++) {
        const [start, title] = headings[i]!;
        const end = i + 1 < headings.length ? headings[i + 1]![0] : text.length;
        // Python dict assignment: later duplicate title overwrites earlier.
        sections.set(title, [start, end]);
    }
    return sections;
}

function _bodyAfterTopHeading(text: string): string {
    const m = /^#\s+.+$/m.exec(text);
    if (!m) return '';
    const after = text.slice(m.index + m[0].length);
    const m2 = /^##\s+/m.exec(after);
    return m2 ? after.slice(0, m2.index) : after;
}

function detect_pattern_1(text: string): boolean {
    const body = _bodyAfterTopHeading(text);
    for (const line of _splitLines(body)) {
        const s = _pyStrip(line);
        if (!s) continue;
        if (s.startsWith('>')) {
            const quote = _pyStrip(_lstripChars(s, '> '));
            return /^You are (a|an|the)\s/.test(quote);
        }
        return false;
    }
    return false;
}

function detect_pattern_2(text: string, sections: Map<string, [number, number]>): boolean {
    const candidates: string[] = [];
    for (const t of sections.keys()) {
        if (/^(when to use|do\s*not\s*use\s*when)/i.test(t)) candidates.push(t);
    }
    const chunk =
        candidates.length === 0
            ? text
            : text.slice(sections.get(candidates[0]!)![0], sections.get(candidates[0]!)![1]);
    return /route to\s*\[`?[a-z0-9-]+`?\]\([^)]*SKILL\.md\)/i.test(chunk);
}

function detect_pattern_3(text: string, sections: Map<string, [number, number]>): boolean {
    let valStart: number | null = null;
    let outStart: number | null = null;
    for (const [t, [s]] of sections) {
        if (valStart === null && t.toLowerCase().startsWith('validation')) valStart = s;
        if (outStart === null && t.toLowerCase().startsWith('output')) outStart = s;
    }
    if (valStart === null || outStart === null || valStart >= outStart) return false;
    for (const [title, [start, end]] of sections) {
        if (title.toLowerCase().startsWith('validation')) {
            const body = text.slice(start, end);
            if (/before finalizing/i.test(body)) return true;
            if (_findall(/^\s*\d+\.\s+/gm, body) >= 3) return true;
        }
    }
    return false;
}

function detect_pattern_4(text: string, sections: Map<string, [number, number]>): boolean {
    for (const [title, [start, end]] of sections) {
        if (title.toLowerCase().startsWith('output')) {
            if (/required fields\s*\(ordered\)/i.test(text.slice(start, end))) return true;
        }
    }
    return false;
}

function detect_pattern_5(text: string): boolean {
    return /🔴[^🔴🟡🟢]{3,}🟡[^🔴🟡🟢]{3,}🟢[^🔴🟡🟢]{3,}/u.test(text);
}

function detect_pattern_6(text: string, sections: Map<string, [number, number]>): boolean {
    for (const [title, [start, end]] of sections) {
        if (title.toLowerCase() === 'references') {
            return /https?:\/\//.test(text.slice(start, end));
        }
    }
    return false;
}

function detect_pattern_7(text: string): boolean {
    const patterns = [
        /runtime confirmation.*(follow[- ]up|implementer)/i,
        /(the judge|this skill) does not execute/i,
        /(leaves|defers) runtime.*(to|for) the implementer/i,
        /is a follow[- ]up for the implementer/i,
    ];
    return patterns.some((p) => p.test(text));
}

function detect_pattern_8(text: string, sections: Map<string, [number, number]>): boolean {
    let body = '';
    for (const [t, [s, e]] of sections) {
        if (t.toLowerCase().startsWith('do not')) body += text.slice(s, e) + '\n';
    }
    if (!body) return false;
    const patterns = [
        /NEVER\s+return\s+`?\w+`?\s+out of politeness/i,
        /NEVER\s+silently\s+fall\s+back/i,
        /NEVER\s+rubber[- ]stamp/i,
        /NEVER\s+accept.*as (a )?substitute/i,
    ];
    return patterns.some((p) => p.test(body));
}

// Detector arity mirrors the .py: 1-arg detectors take (text) only.
const DETECTORS: Record<number, { fn: (...a: never[]) => boolean; argc: number }> = {
    1: { fn: detect_pattern_1 as never, argc: 1 },
    2: { fn: detect_pattern_2 as never, argc: 2 },
    3: { fn: detect_pattern_3 as never, argc: 2 },
    4: { fn: detect_pattern_4 as never, argc: 2 },
    5: { fn: detect_pattern_5 as never, argc: 1 },
    6: { fn: detect_pattern_6 as never, argc: 2 },
    7: { fn: detect_pattern_7 as never, argc: 1 },
    8: { fn: detect_pattern_8 as never, argc: 2 },
};

function scan_skill(p: string): Detection {
    const name = path.basename(path.dirname(p));
    const tier: Tier = name in TIERS ? TIERS[name]! : 'unclassified';
    const text = fs.readFileSync(p, 'utf-8');
    const sections = _sectionIndices(text);
    const results: Record<number, boolean> = {};
    for (let n = 1; n <= 8; n++) {
        const det = DETECTORS[n]!;
        try {
            results[n] =
                det.argc === 2
                    ? (det.fn as (t: string, s: Map<string, [number, number]>) => boolean)(text, sections)
                    : (det.fn as (t: string) => boolean)(text);
        } catch {
            results[n] = false;
        }
    }
    const required = TIER_TARGETS.get(tier) ?? new Set<number>();
    let present = 0;
    for (const pat of required) {
        if (results[pat]) present += 1;
    }
    const score = required.size ? present / required.size : 1.0;
    return {
        skill: name,
        tier,
        patterns: results,
        score: _pyRound(score, 3),
        required: required.size,
        present,
    };
}

function collect(root: string): Detection[] {
    const results: Detection[] = [];
    for (const skillMd of _globSkillMd(root)) {
        results.push(scan_skill(skillMd));
    }
    return results;
}

function _renderTable(rows: Detection[], tierFilter: number | null): string {
    const lines: string[] = [];
    const tiersOrder: Tier[] = [1, 2, 3, 4, 'compliant', 'unclassified'];
    const byTier = new Map<Tier, Detection[]>();
    for (const t of tiersOrder) byTier.set(t, []);
    for (const r of rows) {
        if (!byTier.has(r.tier)) byTier.set(r.tier, []);
        byTier.get(r.tier)!.push(r);
    }
    for (const tier of tiersOrder) {
        const group = byTier.get(tier) ?? [];
        if (group.length === 0) continue;
        if (tierFilter !== null && tier !== tierFilter) continue;
        const label = typeof tier === 'number' ? `Tier ${tier}` : `${tier}`;
        const required = TIER_TARGETS.get(tier) ?? new Set<number>();
        const reqList = [...required].sort((a, b) => a - b);
        lines.push(
            `\n## ${label}  (${group.length} skills, required patterns: ${reqList.length ? `[${reqList.join(', ')}]` : '—'})`,
        );
        lines.push('| Skill | Score | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |');
        lines.push('|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|');
        // sorted(group, key=lambda d: (-d.score, d.skill)) — stable.
        const sortedGroup = _stableSort(group, (a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return _pyStrCmp(a.skill, b.skill);
        });
        for (const r of sortedGroup) {
            const cells: string[] = [];
            for (let pat = 1; pat <= 8; pat++) {
                const has = r.patterns[pat] ?? false;
                const isReq = required.has(pat);
                cells.push(has && isReq ? '✅' : has ? '☑️' : !isReq ? '·' : '❌');
            }
            const pct = required.size ? `${Math.trunc(r.score * 100)}%` : '—';
            lines.push(`| \`${r.skill}\` | ${pct} | ` + cells.join(' | ') + ' |');
        }
    }
    lines.push(
        '\nLegend: ✅ required + present · ❌ required + missing · ' +
            '☑️ present but optional · · not required',
    );
    return lines.join('\n');
}

interface Summary {
    total_skills: number;
    by_tier: Record<string, { count: number; fully_compliant: number; avg_score: number; required_patterns: number[] }>;
}

function _summary(rows: Detection[]): Summary {
    const agg: Summary = { total_skills: rows.length, by_tier: {} };
    for (const tier of [1, 2, 3, 4]) {
        const group = rows.filter((r) => r.tier === tier);
        if (group.length === 0) continue;
        const fully = group.filter((r) => r.score >= 1.0).length;
        const avg = _pyRound(group.reduce((a, r) => a + r.score, 0) / group.length, 3);
        agg.by_tier[String(tier)] = {
            count: group.length,
            fully_compliant: fully,
            avg_score: avg,
            required_patterns: [...(TIER_TARGETS.get(tier) ?? new Set())].sort((a, b) => a - b),
        };
    }
    return agg;
}

interface Args {
    json: boolean;
    tier: number | null;
    diffBaseline: string | null;
}

function parse_args(argv: string[]): Args {
    const args: Args = { json: false, tier: null, diffBaseline: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--json') args.json = true;
        else if (a === '--tier') {
            args.tier = _parseTier(argv[++i]);
        } else if (a.startsWith('--tier=')) {
            args.tier = _parseTier(a.slice('--tier='.length));
        } else if (a === '--diff-baseline') {
            args.diffBaseline = argv[++i] ?? '';
        } else if (a.startsWith('--diff-baseline=')) {
            args.diffBaseline = a.slice('--diff-baseline='.length);
        } else {
            process.stderr.write(`measure_patterns: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

function _parseTier(v: string | undefined): number {
    const n = Number(v);
    if (!Number.isInteger(n) || ![1, 2, 3, 4].includes(n)) {
        process.stderr.write(
            `measure_patterns: error: argument --tier: invalid choice: ${v} (choose from 1, 2, 3, 4)\n`,
        );
        process.exitCode = 2;
        throw new ArgExit();
    }
    return n;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);

    if (!_isDir(SKILLS_DIR)) {
        process.stderr.write(`ERROR: ${SKILLS_DIR} not found\n`);
        return 3;
    }

    const rows = collect(SKILLS_DIR);

    if (args.json) {
        const payload: Json = {
            summary: _summaryToJson(_summary(rows)),
            skills: rows.map(_detectionToJson),
        };
        process.stdout.write(_jsonDumps(payload, { sortKeys: true, indent: 2 }) + '\n');
        return 0;
    }

    const summary = _summary(rows);
    process.stdout.write(`# Pattern Presence — ${summary.total_skills} skills scanned\n\n`);
    process.stdout.write('## Per-tier summary\n\n');
    process.stdout.write('| Tier | Skills | Fully compliant | Avg score | Required |\n');
    process.stdout.write('|---|---:|---:|---:|---|\n');
    for (const t of [1, 2, 3, 4]) {
        const info = summary.by_tier[String(t)];
        if (!info) continue;
        process.stdout.write(
            `| ${t} | ${info.count} | ${info.fully_compliant} | ` +
                `${Math.trunc(info.avg_score * 100)}% | ` +
                `[${info.required_patterns.join(', ')}] |\n`,
        );
    }

    process.stdout.write(_renderTable(rows, args.tier) + '\n');

    if (args.diffBaseline && _isFile(args.diffBaseline)) {
        const prev = JSON.parse(fs.readFileSync(args.diffBaseline, 'utf-8')) as {
            skills?: Array<{ skill: string; score: number }>;
        };
        const prevBy = new Map<string, { skill: string; score: number }>();
        for (const s of prev.skills ?? []) prevBy.set(s.skill, s);
        const moves: Array<[string, number, number]> = [];
        for (const r of rows) {
            const p = prevBy.get(r.skill);
            if (p && p.score !== r.score) moves.push([r.skill, p.score, r.score]);
        }
        if (moves.length) {
            process.stdout.write('\n## Changes since baseline\n\n');
            const sortedMoves = _stableSort(moves, (a, b) => a[2] - a[1] - (b[2] - b[1]));
            for (const [skill, old, nw] of sortedMoves) {
                const arrow = nw > old ? '⬆️' : '⬇️';
                process.stdout.write(
                    `- ${arrow} \`${skill}\`: ${Math.trunc(old * 100)}% → ${Math.trunc(nw * 100)}%\n`,
                );
            }
        }
    }
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

/** Wrapper marking a value as a Python float (renders integer-valued with `.0`). */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _detectionToJson(r: Detection): Json {
    // asdict(Detection) — field order: skill, tier, patterns, score, required, present.
    // patterns is dict[int, bool]; json.dumps renders int keys as strings.
    const pat: { [k: string]: Json } = {};
    for (let n = 1; n <= 8; n++) {
        if (n in r.patterns) pat[String(n)] = r.patterns[n]!;
    }
    return {
        skill: r.skill,
        tier: r.tier,
        patterns: pat,
        score: new PyFloat(r.score),
        required: r.required,
        present: r.present,
    };
}

function _summaryToJson(s: Summary): Json {
    const byTier: { [k: string]: Json } = {};
    for (const [k, v] of Object.entries(s.by_tier)) {
        byTier[k] = {
            count: v.count,
            fully_compliant: v.fully_compliant,
            avg_score: new PyFloat(v.avg_score),
            required_patterns: v.required_patterns,
        };
    }
    return { total_skills: s.total_skills, by_tier: byTier };
}

function _jsonDumps(obj: Json, opts: { sortKeys: boolean; indent: number | null }): string {
    const { sortKeys, indent } = opts;
    const pad = indent !== null ? ' '.repeat(indent) : '';
    const itemSep = indent !== null ? ',' : ', ';
    const kvSep = ': ';

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (indent !== null) {
                const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
                return '[\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + ']';
            }
            return '[' + value.map((v) => enc(v, depth + 1)).join(itemSep) + ']';
        }
        const o = value as { [k: string]: Json };
        let keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        if (sortKeys) keys = [...keys].sort(_pyStrCmp);
        if (indent !== null) {
            const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + kvSep + enc(o[k]!, depth + 1));
            return '{\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + '}';
        }
        return '{' + keys.map((k) => encStr(k) + kvSep + enc(o[k]!, depth + 1)).join(itemSep) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

// --- Python helpers ----------------------------------------------------------

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

function _splitLines(text: string): string[] {
    if (text === '') return [];
    const out = text.split(/\r\n|\r|\n/);
    if (out.length > 0 && out[out.length - 1] === '') out.pop();
    return out;
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Python str.lstrip(chars) — strip any leading chars in the set. */
function _lstripChars(s: string, chars: string): string {
    let i = 0;
    const set = new Set(Array.from(chars));
    const arr = Array.from(s);
    while (i < arr.length && set.has(arr[i]!)) i++;
    return arr.slice(i).join('');
}

function _findall(re: RegExp, text: string): number {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        count += 1;
        if (m.index === r.lastIndex) r.lastIndex++;
    }
    return count;
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

// sorted(root.glob("<star>/SKILL.md")) — component-wise Path sort.
function _globSkillMd(root: string): string[] {
    let dirs: string[];
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isDirectory() || e.isSymbolicLink())
            .map((e) => e.name);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const d of dirs) {
        const cand = path.join(root, d, 'SKILL.md');
        if (_isFile(cand)) out.push(cand);
    }
    // Path sort: compare by parts. All share root prefix; the discriminating
    // component is the skill dir name, then SKILL.md (constant).
    out.sort((a, b) => _pyPathCmp(a, b));
    return out;
}

function _pyPathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const c = _pyStrCmp(pa[i]!, pb[i]!);
        if (c !== 0) return c;
    }
    return pa.length - pb.length;
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

function _stableSort<T>(items: T[], cmp: (a: T, b: T) => number): T[] {
    const indexed = items.map((item, idx) => ({ item, idx }));
    indexed.sort((x, y) => {
        const c = cmp(x.item, y.item);
        if (c !== 0) return c;
        return x.idx - y.idx;
    });
    return indexed.map((e) => e.item);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        // argparse-style error: parse_args already wrote stderr + set exitCode 2.
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}
