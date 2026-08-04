#!/usr/bin/env tsx
/**
 * `agent-config route:audit [--last N] [--record] [--weekly] [--json]` —
 * replay the shared router matcher over the last N USER prompts of the
 * repo-local chat-history log and render matched-vs-unmatched per prompt.
 * Read-only over the inputs; no LLM call; deterministic.
 *
 * Measurement level (ADR-126): trigger matching only — what the host actually
 * invoked on those turns is NOT measured here. "Should-have-matched" is the
 * human reviewer's judgment over this table, not a computed verdict.
 *
 * `--record` appends one JSONL record per audited prompt to the opt-in
 * routing recorder (`telemetry.routing_recorder.enabled`, default OFF —
 * disabled means zero file IO and a silent exit contribution). The record is
 * PII-excluded by construction: it carries a truncated sha256 of the prompt,
 * never the prompt text, plus matched rule ids / trigger labels and an
 * enforcement join against `agents/runtime/state/rule-trips.json` where a
 * same-named hook concern exists. Delete-and-rerun rebuilds it from chat
 * history — losing it changes no answer (state-store test, ADR-124 § 6).
 *
 * `--weekly` renders the rolling last-7-days picture from the recorder log.
 * Resolver authority note: this instrument is corpus-growth raw material for
 * `internal/bench/layer1-resolver-PREREG.md` (its P2 condition) as a side
 * effect only — the PREREG stays the sole authority over any resolver
 * revival; nothing here builds or scores a resolver.
 *
 * Exit codes: 0 rendered (even when the recorder is disabled), 1 no prompts /
 * no records to audit, 2 invocation or IO error.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { match_prompt, type Router } from '../_lib/router_match.js';
import { load_agent_settings } from '../_lib/agent_settings.js';
import { read_entries } from '../chat_history.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ROUTER_JSON = path.join(REPO_ROOT, 'dist', 'router.json');

// cache-version: v1 — rebuildable audit log: delete-and-rerun rebuilds it from
// chat history (`route:audit --record`); losing it changes no answer.
export const RECORDER_REL = 'agents/runtime/state/routing-telemetry.jsonl';
const RULE_TRIPS_REL = 'agents/runtime/state/rule-trips.json';
export const RECORD_SCHEMA_VERSION = 1;

export const MEASUREMENT_HEADER =
    'Measurement level: trigger matching only — what the host actually invokes is NOT measured here (ADR-126).';
export const PREREG_AUTHORITY_LINE =
    'Resolver authority: internal/bench/layer1-resolver-PREREG.md — this corpus feeds its P2 condition as a side effect; nothing here revives a resolver.';

function recorder_path(): string {
    return process.env['AGENT_ROUTING_TELEMETRY_FILE'] ?? path.join(REPO_ROOT, RECORDER_REL);
}

export function recorder_enabled(): boolean {
    try {
        const settings = load_agent_settings({ cwd: REPO_ROOT }) as Record<string, unknown>;
        const t = settings['telemetry'];
        if (t === null || typeof t !== 'object' || Array.isArray(t)) return false;
        const rr = (t as Record<string, unknown>)['routing_recorder'];
        if (rr === null || typeof rr !== 'object' || Array.isArray(rr)) return false;
        const enabled = (rr as Record<string, unknown>)['enabled'];
        return enabled === true || enabled === 'true' || enabled === 'on' || enabled === 'yes';
    } catch {
        return false; // unparseable means disabled — default-off doctrine
    }
}

interface AuditedPrompt {
    prompt: string;
    matched: { rule: string; tier: string; triggers: string[] }[];
}

function _trigger_label(trigger: Record<string, unknown>): string {
    for (const kind of ['keyword', 'phrase', 'command', 'path_prefix', 'file_pattern']) {
        if (kind in trigger) return `${kind}: ${String(trigger[kind])}`;
    }
    return JSON.stringify(trigger);
}

export function audit_prompts(router: Router, prompts: string[]): AuditedPrompt[] {
    return prompts.map((prompt) => {
        const result = match_prompt(router, prompt, 'full', null, null);
        const byRule = new Map<string, { tier: string; triggers: string[] }>();
        for (const mt of result.matched_triggers) {
            const id = String(mt.rule);
            const entry = byRule.get(id) ?? { tier: mt.tier.replace('_', '-'), triggers: [] };
            entry.triggers.push(_trigger_label(mt.trigger as Record<string, unknown>));
            byRule.set(id, entry);
        }
        const matched = [...byRule.entries()]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([rule, v]) => ({ rule, tier: v.tier, triggers: v.triggers }));
        return { prompt, matched };
    });
}

/** Last N user prompts from the repo chat-history log, oldest first. */
export function load_user_prompts(last: number, history_path?: string | null): string[] {
    let entries: Array<{ t?: unknown; text?: unknown }> = [];
    try {
        entries = read_entries({ path: history_path ?? null }) as Array<{ t?: unknown; text?: unknown }>;
    } catch {
        return [];
    }
    const prompts: string[] = [];
    for (const e of entries) {
        if (e === null || typeof e !== 'object') continue;
        if (e.t !== 'user' || typeof e.text !== 'string') continue;
        const text = e.text.trim();
        // Host-injected meta turns are not user prompts (same filter as the
        // handoff session reader).
        if (text === '' || text.startsWith('<') || text.startsWith('Caveat:')) continue;
        prompts.push(text);
    }
    return prompts.slice(-last);
}

interface TripsDoc {
    concerns?: Record<string, { block?: number; warn?: number }>;
}

function _load_trips(): TripsDoc {
    try {
        return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, RULE_TRIPS_REL), 'utf-8')) as TripsDoc;
    } catch {
        return {};
    }
}

export function build_records(audits: AuditedPrompt[], now_iso: string): Record<string, unknown>[] {
    const trips = _load_trips();
    return audits.map((a) => {
        const enforcement_trips: Record<string, { block: number; warn: number }> = {};
        for (const m of a.matched) {
            const concern = trips.concerns?.[m.rule];
            if (concern) {
                enforcement_trips[m.rule] = { block: concern.block ?? 0, warn: concern.warn ?? 0 };
            }
        }
        // PII-exclusion-by-construction: no free-form prompt field exists in
        // this record type — only a truncated digest and closed-shape labels.
        return {
            schema_version: RECORD_SCHEMA_VERSION,
            ts: now_iso,
            prompt_sha16: crypto.createHash('sha256').update(a.prompt).digest('hex').slice(0, 16),
            matched: a.matched,
            enforcement_trips,
        };
    });
}

export function append_records(records: Record<string, unknown>[], target: string): number {
    if (process.env['AGENT_CONFIG_REPLAY'] === '1') return 0; // replay mode: no state writes
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const fd = fs.openSync(target, 'a', 0o644);
    try {
        for (const r of records) fs.writeSync(fd, JSON.stringify(r) + '\n');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    return records.length;
}

export function render_weekly(target: string, now: Date): { text: string; records: number } {
    let lines: string[] = [];
    try {
        lines = fs.readFileSync(target, 'utf-8').split('\n').filter(Boolean);
    } catch {
        lines = [];
    }
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const perRule = new Map<string, number>();
    let inWindow = 0;
    for (const line of lines) {
        let rec: { ts?: string; matched?: { rule: string }[] };
        try {
            rec = JSON.parse(line) as typeof rec;
        } catch {
            continue;
        }
        const ts = Date.parse(rec.ts ?? '');
        if (Number.isNaN(ts) || ts < cutoff) continue;
        inWindow += 1;
        for (const m of rec.matched ?? []) {
            perRule.set(m.rule, (perRule.get(m.rule) ?? 0) + 1);
        }
    }
    const out: string[] = [MEASUREMENT_HEADER, ''];
    out.push(`routing recorder — rolling 7-day window (${inWindow} recorded prompt(s))`);
    if (inWindow === 0) {
        out.push('  (no records in the window — enable telemetry.routing_recorder and run `route:audit --record`)');
    } else {
        const rows = [...perRule.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        for (const [rule, n] of rows) out.push(`  ${String(n).padStart(4)} × ${rule}`);
    }
    out.push('');
    out.push(PREREG_AUTHORITY_LINE);
    return { text: out.join('\n') + '\n', records: inWindow };
}

export function main(argv: string[]): number {
    const args = [...argv];
    const as_json = args.includes('--json');
    const weekly = args.includes('--weekly');
    const record = args.includes('--record');
    let last = 10;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--last') last = Number(args[++i] ?? '10') || 10;
        else if (a.startsWith('--last=')) last = Number(a.slice('--last='.length)) || 10;
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: agent-config route:audit [--last N] [--record] [--weekly] [--json]\n');
            return 0;
        }
    }

    if (weekly) {
        const { text, records } = render_weekly(recorder_path(), new Date());
        process.stdout.write(text);
        return records === 0 ? 1 : 0;
    }

    let router: Router;
    try {
        router = JSON.parse(fs.readFileSync(ROUTER_JSON, 'utf-8')) as Router;
    } catch (e) {
        process.stderr.write(`route:audit: cannot read ${ROUTER_JSON}: ${String(e)}\n`);
        return 2;
    }
    const prompts = load_user_prompts(last);
    if (prompts.length === 0) {
        process.stdout.write(MEASUREMENT_HEADER + '\n\n');
        process.stdout.write('no user prompts found in the chat-history log — nothing to audit\n');
        return 1;
    }
    const audits = audit_prompts(router, prompts);

    let recorded = 0;
    let recorder_note = '';
    if (record) {
        if (recorder_enabled()) {
            recorded = append_records(build_records(audits, new Date().toISOString()), recorder_path());
            recorder_note = `recorded ${recorded} prompt(s) to ${RECORDER_REL}`;
        } else {
            recorder_note = 'recorder disabled (telemetry.routing_recorder.enabled is off — default) — nothing written';
        }
    }

    if (as_json) {
        process.stdout.write(
            JSON.stringify(
                { measurement_level: MEASUREMENT_HEADER, audited: audits.length, recorded, prompts: audits },
                null,
                2,
            ) + '\n',
        );
        return 0;
    }
    const out: string[] = [MEASUREMENT_HEADER, ''];
    out.push(`audited the last ${audits.length} user prompt(s) — matched rules per prompt`);
    out.push('(should-have-matched is the reviewer\'s judgment over this table, not a computed verdict)');
    out.push('');
    audits.forEach((a, i) => {
        const shown = a.prompt.length > 100 ? a.prompt.slice(0, 97) + '...' : a.prompt;
        out.push(`${String(i + 1).padStart(3)}. ${JSON.stringify(shown)}`);
        if (a.matched.length === 0) {
            out.push('       → (no trigger matched — kernel only)');
        } else {
            for (const m of a.matched) {
                out.push(`       → ${m.rule} [${m.tier}] (${m.triggers.join(' · ')})`);
            }
        }
    });
    if (recorder_note) {
        out.push('');
        out.push(recorder_note);
    }
    process.stdout.write(out.join('\n') + '\n');
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
if (process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || path.resolve(process.argv[1]) === _HERE)) {
    process.exitCode = main(process.argv.slice(2));
}
