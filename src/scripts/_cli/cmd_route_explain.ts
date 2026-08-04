#!/usr/bin/env tsx
/**
 * `agent-config route:explain "<prompt>" [--files a,b]` — deterministic,
 * offline trace of which rules the router's triggers match for one prompt.
 *
 * The validation surface the routing-correctness mandate asks for: matched
 * triggers, tier, injected-vs-pointer disposition, budget consumption, and
 * rejected candidates — all from `dist/router.json` + the ONE shared matcher
 * (`_lib/router_match.ts`, parity-by-construction with `router_telemetry`
 * and `explain route`).
 *
 * Measurement level (ADR-126): this shows TRIGGER MATCHING only. Whether the
 * host actually invokes a matched rule is a different measurement and is NOT
 * made here — the mandatory first output line says so on every run.
 *
 * Exit codes: `0` at least one non-kernel rule matched, `1` nothing matched
 * (kernel is always active, so "no match" still leaves the kernel), `2`
 * invocation error (missing prompt, unreadable router.json).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    match_prompt,
    _asRuleList,
    type Router,
    type Rule,
    type Trigger,
} from '../_lib/router_match.js';
import { measure, method_note } from '../_lib/token_count.js';
import { load_agent_settings } from '../_lib/agent_settings.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ROUTER_JSON = path.join(REPO_ROOT, 'dist', 'router.json');
const RULES_DIST_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');

export const MEASUREMENT_HEADER =
    'Measurement level: trigger matching only — what the host actually invokes is NOT measured here (ADR-126).';

interface RuleReport {
    id: string;
    tier: string;
    matched: string[]; // "kind: value" labels
    routes_to: string[];
    disposition: string;
    body_chars: number;
    body_tokens_gpt: number;
}

interface Report {
    measurement_level: string;
    prompt: string;
    files: string[];
    profile: string;
    projection_mode: string;
    kernel_always: string[];
    matches: RuleReport[];
    rejected: { reason: string; ids: string[] }[];
    budget: { matched_chars: number; matched_tokens_gpt: number; method: string };
}

function _trigger_label(trigger: Trigger): string {
    for (const kind of ['keyword', 'phrase', 'command', 'path_prefix', 'file_pattern']) {
        if (kind in trigger) {
            return `${kind}: ${String(trigger[kind])}`;
        }
    }
    return `trigger: ${JSON.stringify(trigger)}`;
}

/** Projection mode from settings; the shipped default is eager-all. */
export function _projection_mode(): string {
    try {
        const settings = load_agent_settings({ cwd: REPO_ROOT }) as Record<string, unknown>;
        const lp = settings['lean_projection'];
        if (lp !== null && typeof lp === 'object' && !Array.isArray(lp)) {
            const mode = (lp as Record<string, unknown>)['mode'];
            if (typeof mode === 'string' && mode.trim() !== '') {
                return mode.trim();
            }
        }
    } catch {
        // settings unreadable → shipped default
    }
    return 'eager-all';
}

function _disposition(tier: string, projection_mode: string): string {
    if (tier === 'kernel') {
        return 'injected (kernel, always full-bodied)';
    }
    // Disposition is decided at projection time, not at runtime — say so
    // instead of inventing a runtime injection the router does not perform.
    return projection_mode === 'eager-all'
        ? `injected at projection time (${tier}, lean_projection.mode: eager-all)`
        : `router-resolved pointer at projection time (${tier}, lean_projection.mode: ${projection_mode})`;
}

function _rule_body_size(rule_id: string): { chars: number; tokens: number } {
    const p = path.join(RULES_DIST_DIR, `${rule_id}.md`);
    try {
        const text = fs.readFileSync(p, 'utf-8');
        const m = measure(text);
        return { chars: m.chars, tokens: m.tokens_gpt };
    } catch {
        return { chars: 0, tokens: 0 };
    }
}

export function build_report(
    router: Router,
    prompt: string,
    files: string[],
    profile: string,
): Report {
    const projection_mode = _projection_mode();
    const result = match_prompt(router, prompt, profile, files.length > 0 ? files : null, null);

    const matchedByRule = new Map<string, { tier: string; labels: string[] }>();
    for (const mt of result.matched_triggers) {
        const id = String(mt.rule);
        const entry = matchedByRule.get(id) ?? { tier: mt.tier.replace('_', '-'), labels: [] };
        entry.labels.push(_trigger_label(mt.trigger));
        matchedByRule.set(id, entry);
    }

    const routesById = new Map<string, string[]>();
    for (const tierKey of ['tier_1', 'tier_2'] as const) {
        for (const rule of _asRuleList(router[tierKey])) {
            routesById.set(String(rule['id']), ((rule['routes_to'] as unknown[]) ?? []).map(String));
        }
    }

    const matches: RuleReport[] = [...matchedByRule.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, { tier, labels }]) => {
            const size = _rule_body_size(id);
            return {
                id,
                tier,
                matched: labels,
                routes_to: routesById.get(id) ?? [],
                disposition: _disposition(tier, projection_mode),
                body_chars: size.chars,
                body_tokens_gpt: size.tokens,
            };
        });

    const rejected_no_match: string[] = [];
    for (const tierKey of ['tier_1', 'tier_2'] as const) {
        if (tierKey === 'tier_2' && profile !== 'full') continue;
        for (const rule of _asRuleList(router[tierKey])) {
            const id = String(rule['id']);
            if (!matchedByRule.has(id)) rejected_no_match.push(id);
        }
    }
    rejected_no_match.sort();
    const rejected: Report['rejected'] = [
        { reason: 'no trigger matched', ids: rejected_no_match },
    ];
    if (profile !== 'full') {
        rejected.push({
            reason: `tier-2 excluded by profile '${profile}' (tier-2 is considered under profile 'full' only)`,
            ids: _asRuleList(router['tier_2']).map((r: Rule) => String(r['id'])).sort(),
        });
    }

    const kernel_always = (Array.isArray(router['kernel']) ? router['kernel'] : []).map(String);
    const matched_chars = matches.reduce((s, m) => s + m.body_chars, 0);
    const matched_tokens = matches.reduce((s, m) => s + m.body_tokens_gpt, 0);

    return {
        measurement_level: MEASUREMENT_HEADER,
        prompt,
        files,
        profile,
        projection_mode,
        kernel_always,
        matches,
        rejected,
        budget: { matched_chars, matched_tokens_gpt: matched_tokens, method: method_note() },
    };
}

export function render_text(report: Report): string {
    const out: string[] = [];
    out.push(report.measurement_level);
    out.push('');
    out.push(`prompt: ${JSON.stringify(report.prompt)}`);
    if (report.files.length > 0) out.push(`files: ${report.files.join(', ')}`);
    out.push(`profile: ${report.profile} · projection mode: ${report.projection_mode}`);
    out.push('');
    out.push(`kernel (always active, ${report.kernel_always.length}): ${report.kernel_always.join(', ')}`);
    out.push('');
    out.push(`matched rules (${report.matches.length}):`);
    for (const m of report.matches) {
        out.push(`  · ${m.id}  [${m.tier}]`);
        for (const label of m.matched) out.push(`      matched ${label}`);
        out.push(`      disposition: ${m.disposition}`);
        if (m.routes_to.length > 0) out.push(`      routes_to: ${m.routes_to.join(', ')}`);
        out.push(`      body: ${m.body_chars} chars ≈ ${m.body_tokens_gpt} GPT tokens`);
    }
    if (report.matches.length === 0) {
        out.push('  · (no trigger matched — only kernel rules active)');
    }
    out.push('');
    out.push(
        `budget consumption of matched non-kernel bodies: ${report.budget.matched_chars} chars`
        + ` ≈ ${report.budget.matched_tokens_gpt} GPT tokens (${report.budget.method})`,
    );
    for (const r of report.rejected) {
        out.push(`rejected — ${r.reason}: ${r.ids.length} rule(s)`);
    }
    return out.join('\n') + '\n';
}

export function main(argv: string[]): number {
    const args = [...argv];
    const as_json = args.includes('--json');
    let files: string[] = [];
    let profile = 'full';
    const positional: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--json') continue;
        if (a === '--files') {
            files = String(args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        } else if (a.startsWith('--files=')) {
            files = a.slice('--files='.length).split(',').map((s) => s.trim()).filter(Boolean);
        } else if (a === '--profile') {
            profile = String(args[++i] ?? 'full');
        } else if (a.startsWith('--profile=')) {
            profile = a.slice('--profile='.length);
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: agent-config route:explain "<prompt>" [--files a,b] [--profile full|balanced] [--json]\n',
            );
            return 0;
        } else {
            positional.push(a);
        }
    }
    const prompt = positional.join(' ').trim();
    if (!prompt) {
        process.stderr.write('route:explain: a prompt is required\n');
        return 2;
    }
    let router: Router;
    try {
        router = JSON.parse(fs.readFileSync(ROUTER_JSON, 'utf-8')) as Router;
    } catch (e) {
        process.stderr.write(`route:explain: cannot read ${ROUTER_JSON}: ${String(e)}\n`);
        return 2;
    }
    const report = build_report(router, prompt, files, profile);
    if (as_json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(render_text(report));
    }
    return report.matches.length === 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
if (process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || path.resolve(process.argv[1]) === _HERE)) {
    process.exitCode = main(process.argv.slice(2));
}
