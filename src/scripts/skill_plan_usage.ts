#!/usr/bin/env tsx
/**
 * `skill_plan_usage` — the skills a roadmap planned, read back against what a
 * session actually did.
 *
 * A step names its planned skills with an indented `uses:` line and a skill it
 * decided against with `waived: <skill> — <reason>`, the reason from a closed set
 * (`docs/contracts/roadmap-revalidation-v1.md` § Planned skills). Applied is read
 * from tool events only — a `Skill` call or a read of that skill's `SKILL.md` —
 * because a skill named in prose is a claim, not an application. Rules are not
 * observable here and are reported as such, never as unused.
 *
 *   skill_plan_usage <roadmap.md> [--transcript <file.jsonl>]... [--json]
 *
 * Without `--transcript` it reads the newest session of this checkout's store.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';
import { defaultStore } from './report_skill_activation.js';

export const WAIVER_REASONS = ['not-applicable-scope', 'unavailable-on-host', 'already-satisfied'] as const;

export interface PlannedSkill {
    skill: string;
    step: string;
}

export interface Waiver extends PlannedSkill {
    reason: string;
}

export interface Plan {
    /** Steps read; a roadmap with none is a dead input, not an empty plan. */
    steps: number;
    planned: PlannedSkill[];
    waived: Waiver[];
    invalidWaivers: Waiver[];
}

export type UsageState = 'applied' | 'waived' | 'missing';

export interface UsageReport {
    rows: Array<{ skill: string; steps: string[]; state: UsageState; reason?: string }>;
    unplanned: string[];
    invalidWaivers: Waiver[];
}

const STEP_RE = /^- \[[ x~-]\] \*\*(\d+\.\d+[a-z]?)\b/;
const SKILL_RE = /^[a-z0-9][a-z0-9:-]*$/;

function validReason(reason: string): boolean {
    return (WAIVER_REASONS as readonly string[]).includes(reason) || /^superseded-by:[a-z0-9][a-z0-9:-]*$/.test(reason);
}

export function parsePlan(text: string): Plan {
    const plan: Plan = { steps: 0, planned: [], waived: [], invalidWaivers: [] };
    let step: string | null = null;
    for (const line of text.split('\n')) {
        const s = STEP_RE.exec(line);
        if (s !== null) {
            step = s[1] as string;
            plan.steps += 1;
            continue;
        }
        if (step === null) continue;
        if (/^(- |#)/.test(line)) {
            step = null;
            continue;
        }
        const uses = /^\s+uses:\s*(.+)$/.exec(line);
        if (uses !== null) {
            for (const name of (uses[1] as string).split(',').map((x) => x.trim()).filter((x) => SKILL_RE.test(x))) {
                plan.planned.push({ skill: name, step });
            }
            continue;
        }
        const waived = /^\s+waived:\s*([a-z0-9][a-z0-9:-]*)\s*[—-]+\s*(.+)$/.exec(line);
        if (waived !== null) {
            const w = { skill: waived[1] as string, step, reason: (waived[2] as string).trim() };
            (validReason(w.reason) ? plan.waived : plan.invalidWaivers).push(w);
        }
    }
    return plan;
}

const SKILL_FILE_RE = /\/skills\/([a-z0-9][a-z0-9-]*)\/SKILL\.md$/;

/** Skills a session applied, from tool events only. */
export function appliedSkills(transcripts: readonly string[]): Set<string> {
    const out = new Set<string>();
    for (const file of transcripts) {
        let body: string;
        try {
            body = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const line of body.split('\n')) {
            let entry: Record<string, unknown>;
            try {
                entry = JSON.parse(line) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (entry['type'] !== 'assistant') continue;
            const msg = entry['message'];
            const content = msg !== null && typeof msg === 'object' ? (msg as Record<string, unknown>)['content'] : null;
            if (!Array.isArray(content)) continue;
            for (const part of content as unknown[]) {
                if (part === null || typeof part !== 'object') continue;
                const p = part as Record<string, unknown>;
                if (p['type'] !== 'tool_use') continue;
                const input = (p['input'] ?? {}) as Record<string, unknown>;
                if (p['name'] === 'Skill' && typeof input['skill'] === 'string') out.add(input['skill']);
                if (p['name'] === 'Read' && typeof input['file_path'] === 'string') {
                    const m = SKILL_FILE_RE.exec(input['file_path']);
                    if (m !== null) out.add(m[1] as string);
                }
            }
        }
    }
    return out;
}

export function planUsage(plan: Plan, applied: ReadonlySet<string>): UsageReport {
    const order: string[] = [];
    const steps = new Map<string, string[]>();
    for (const p of plan.planned) {
        if (!steps.has(p.skill)) {
            order.push(p.skill);
            steps.set(p.skill, []);
        }
        steps.get(p.skill)!.push(p.step);
    }
    const waiver = new Map(plan.waived.map((w) => [w.skill, w.reason]));
    const rows = order.map((skill) => {
        const base = { skill, steps: steps.get(skill) ?? [] };
        if (applied.has(skill)) return { ...base, state: 'applied' as const };
        const reason = waiver.get(skill);
        return reason !== undefined ? { ...base, state: 'waived' as const, reason } : { ...base, state: 'missing' as const };
    });
    const unplanned = [...applied].filter((s) => !steps.has(s)).sort();
    return { rows, unplanned, invalidWaivers: plan.invalidWaivers };
}

export function renderUsage(rep: UsageReport): string {
    const out = ['plan versus use — skills'];
    if (rep.rows.length === 0) out.push('  no step carries a uses: line');
    for (const r of rep.rows) {
        out.push(`  ${r.state.padEnd(9)} ${r.skill} (${r.steps.join(', ')})${r.reason !== undefined ? ` — ${r.reason}` : ''}`);
    }
    if (rep.unplanned.length > 0) out.push(`  unplanned applied: ${rep.unplanned.join(', ')}`);
    for (const w of rep.invalidWaivers) out.push(`  invalid waiver: ${w.skill} (${w.step}) — "${w.reason}" is not a closed reason`);
    out.push('rules: not-observable in this read-out');
    return `${out.join('\n')}\n`;
}

function newestSession(store: string): string[] {
    try {
        const files = fs
            .readdirSync(store)
            .filter((f) => f.endsWith('.jsonl'))
            .map((f) => path.join(store, f))
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        return files.slice(0, 1);
    } catch {
        return [];
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const roadmap = argv.find((a) => !a.startsWith('--') && a.endsWith('.md'));
    if (roadmap === undefined) {
        process.stderr.write('usage: skill_plan_usage <roadmap.md> [--transcript <file.jsonl>]... [--json]\n');
        return 2;
    }
    const transcripts: string[] = [];
    argv.forEach((a, i) => {
        if (a === '--transcript' && argv[i + 1] !== undefined) transcripts.push(argv[i + 1] as string);
    });
    const files = transcripts.length > 0 ? transcripts : newestSession(defaultStore(process.cwd()));
    let text: string;
    try {
        text = fs.readFileSync(roadmap, 'utf-8');
    } catch {
        process.stderr.write(`skill_plan_usage: cannot read ${roadmap}\n`);
        return 2;
    }
    const plan = parsePlan(text);
    const json = argv.includes('--json');
    try {
        reportScanned(
            { gate: 'skill_plan_usage', scanned: plan.steps, units: 'roadmap steps', roots: [roadmap] },
            json ? process.stderr.write.bind(process.stderr) : process.stdout.write.bind(process.stdout),
        );
    } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    const rep = planUsage(plan, appliedSkills(files));
    process.stdout.write(json ? `${JSON.stringify({ transcripts: files, ...rep }, null, 2)}\n` : renderUsage(rep));
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
