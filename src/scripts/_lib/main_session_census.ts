/**
 * Main-session default-context census.
 *
 * The subagent census in `preamble_byte_census.ts` models a cold start from files
 * on disk. A main session is measurable instead: the host records what it
 * delivered as transcript attachments — `instructions` (every CLAUDE.md and rule
 * file it loaded, with content), `skill_listing` (the catalog text the model saw),
 * and `hook_success` / `hook_additional_context` (hook output injected into the
 * context). This module reads those and attributes the load per asset.
 *
 * "303 listed skills is not 303 loaded": the catalog is split into entries that
 * carry a description and entries that arrive as a bare name, because a host that
 * truncates its catalog keeps the name and drops the text.
 *
 * Only the FIRST `instructions` and `skill_listing` deliveries count — later ones
 * are re-deliveries after a compaction, not the default load. Hook output is
 * aggregated over the whole transcript with a per-occurrence mean, because a
 * `UserPromptSubmit` hook costs its output on every turn. A `SessionStart` hook
 * fired by `compact` or `resume` is listed but not counted as default load.
 *
 * The two hook attachment types are kept apart because they do not reach the
 * same reader: `hook_additional_context` is model context, while `hook_success`
 * is the hook's plain stdout, which the host adds to context only for
 * `SessionStart` and `UserPromptSubmit` and otherwise shows in the transcript
 * alone. A per-tool-call figure that merges them can price output the model
 * never received.
 *
 * Characters are what the transcript holds; `approx_tokens` divides by 4 and is
 * labelled approximate wherever it is shown.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

type Dict = Record<string, unknown>;

export interface InstructionBucket {
    path: string;
    scope: string;
    chars: number;
}
export interface SkillEntry {
    name: string;
    chars: number;
    described: boolean;
}
export interface HookBucket {
    event: string;
    hook: string;
    attachment: 'hook_success' | 'hook_additional_context';
    model_visible: boolean;
    occurrences: number;
    total_chars: number;
    mean_chars: number;
}
export interface MainSessionCensus {
    instructions: InstructionBucket[];
    skills: { listed: number; described: number; name_only: number; chars: number; entries: SkillEntry[] };
    hooks: HookBucket[];
    totals: { session_start_chars: number; per_turn_chars: number; approx_tokens: number };
}

const CHARS_PER_TOKEN = 4;
const STDOUT_IS_CONTEXT = new Set(['SessionStart', 'UserPromptSubmit']);

function shorten(p: string, roots: { home: string; repo: string }): string {
    if (p.startsWith(`${roots.repo}/`)) return p.slice(roots.repo.length + 1);
    if (p.startsWith(`${roots.home}/`)) return `~/${p.slice(roots.home.length + 1)}`;
    return p;
}

function catalogEntries(content: string): SkillEntry[] {
    const entries: SkillEntry[] = [];
    for (const line of content.split('\n')) {
        const m = /^- ([^:\s]+)(:\s*(.*))?$/.exec(line);
        if (m) entries.push({ name: m[1] as string, chars: line.length, described: (m[3] ?? '').trim() !== '' });
        else if (line.trim() !== '' && entries.length > 0) {
            const last = entries[entries.length - 1] as SkillEntry;
            last.chars += line.length + 1;
        }
    }
    return entries;
}

function hookText(a: Dict): string {
    const c = a['content'];
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
    return '';
}

/** The census of one transcript, or null when it holds no `instructions` delivery. */
export function censusMainSession(lines: readonly string[], roots: { home: string; repo: string }): MainSessionCensus | null {
    let instructions: InstructionBucket[] | null = null;
    let skills: MainSessionCensus['skills'] | null = null;
    const hooks = new Map<string, HookBucket>();
    for (const line of lines) {
        if (!line.includes('"attachment"')) continue;
        let a: Dict;
        try {
            a = ((JSON.parse(line) as Dict)['attachment'] ?? {}) as Dict;
        } catch {
            continue;
        }
        const type = a['type'];
        if (type === 'instructions' && instructions === null && Array.isArray(a['files'])) {
            instructions = (a['files'] as Dict[]).map((f) => ({ path: shorten(String(f['path'] ?? ''), roots), scope: String(f['type'] ?? ''), chars: String(f['content'] ?? '').length }));
        } else if (type === 'skill_listing' && skills === null && typeof a['content'] === 'string') {
            const entries = catalogEntries(a['content']);
            const described = entries.filter((e) => e.described).length;
            skills = { listed: entries.length, described, name_only: entries.length - described, chars: entries.reduce((s, e) => s + e.chars, 0), entries };
        } else if (type === 'hook_success' || type === 'hook_additional_context') {
            const text = hookText(a);
            if (text === '') continue;
            const event = String(a['hookEvent'] ?? '?');
            const hook = String(a['hookName'] ?? event);
            const attachment: HookBucket['attachment'] = type;
            const model_visible = type === 'hook_additional_context' || STDOUT_IS_CONTEXT.has(event);
            const k = `${event}\u0000${hook}\u0000${type}`;
            const b = hooks.get(k) ?? { event, hook, attachment, model_visible, occurrences: 0, total_chars: 0, mean_chars: 0 };
            b.occurrences += 1;
            b.total_chars += text.length;
            b.mean_chars = Math.round(b.total_chars / b.occurrences);
            hooks.set(k, b);
        }
    }
    if (instructions === null) return null;
    const sk = skills ?? { listed: 0, described: 0, name_only: 0, chars: 0, entries: [] };
    const hookList = [...hooks.values()].sort((x, y) => y.mean_chars * y.occurrences - x.mean_chars * x.occurrences || x.hook.localeCompare(y.hook));
    const session_start_chars =
        instructions.reduce((s, f) => s + f.chars, 0) + sk.chars + hookList.filter((h) => h.event === 'SessionStart' && !/:(compact|resume)$/.test(h.hook)).reduce((s, h) => s + h.mean_chars, 0);
    const per_turn_chars = hookList.filter((h) => h.event === 'UserPromptSubmit').reduce((s, h) => s + h.mean_chars, 0);
    return {
        instructions,
        skills: sk,
        hooks: hookList,
        totals: { session_start_chars, per_turn_chars, approx_tokens: Math.round(session_start_chars / CHARS_PER_TOKEN) },
    };
}

/** Newest top-level `.jsonl` in a project store; subagent transcripts live one level down and are skipped. */
export function newestTranscript(storeDir: string): string | null {
    let names: string[];
    try {
        names = fs.readdirSync(storeDir).filter((n) => n.endsWith('.jsonl'));
    } catch {
        return null;
    }
    const withTime = names.map((n) => ({ p: path.join(storeDir, n), t: fs.statSync(path.join(storeDir, n)).mtimeMs }));
    withTime.sort((a, b) => b.t - a.t);
    return withTime[0]?.p ?? null;
}

export function renderMainSession(c: MainSessionCensus, transcript: string): string {
    const pct = (n: number): string => `${((100 * n) / Math.max(1, c.totals.session_start_chars)).toFixed(1)}%`;
    const out: string[] = [
        `Main-session default context — measured from ${transcript} (characters as delivered; tokens ≈ chars / ${CHARS_PER_TOKEN})`,
        '',
        `Session start: ${c.totals.session_start_chars} chars (~${c.totals.approx_tokens} tokens) · every prompt turn adds ${c.totals.per_turn_chars} chars of hook output`,
        '',
        `Instruction files (${c.instructions.length}, ${c.instructions.reduce((s, f) => s + f.chars, 0)} chars):`,
        ...[...c.instructions].sort((a, b) => b.chars - a.chars).map((f) => `  ${String(f.chars).padStart(7)}  ${pct(f.chars).padStart(6)}  ${f.scope.padEnd(8)} ${f.path}`),
        '',
        `Skill catalog: ${c.skills.chars} chars — skills: ${c.skills.listed} listed, ${c.skills.described} with a description, ${c.skills.name_only} name only`,
        ...[...c.skills.entries].sort((a, b) => b.chars - a.chars).slice(0, 20).map((e) => `  ${String(e.chars).padStart(7)}  ${e.described ? 'described' : 'name only'}  ${e.name}`),
        c.skills.entries.length > 20 ? `  … ${c.skills.entries.length - 20} more (--format json lists every entry)` : '',
        '',
        `Hook output (${c.hooks.length} hook(s)):`,
        ...c.hooks.map((h) => `  ${String(h.mean_chars).padStart(7)} chars × ${String(h.occurrences).padStart(3)}  ${h.event} · ${h.hook}${h.model_visible ? '' : '  (stdout, not model-visible)'}`),
    ];
    return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
