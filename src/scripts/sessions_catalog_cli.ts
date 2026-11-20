#!/usr/bin/env node
/**
 * `agent-config sessions:catalog` — every Claude Code and Codex session on
 * this machine, newest first; refreshes `sessions.json` + `SESSIONS.md` in the
 * user-global agent-config folder on every call.
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    type CatalogStatus,
    context_label,
    fmt_age,
    fmt_tokens,
    index_json_path,
    index_md_path,
    publish_index,
    repo_label,
    resume_line,
} from './_lib/session_catalog.js';

const CATALOG_STATUSES: readonly CatalogStatus[] = ['active', 'idle', 'inactive'];

function usage(): number {
    process.stderr.write(
        'usage: agent-config sessions:catalog [--json] [--all | --limit N] [--status active|idle|inactive] [--live]\n',
    );
    return 2;
}

export function cmd_catalog(
    argv: string[] = process.argv.slice(2),
    env: NodeJS.ProcessEnv = process.env,
    home?: string,
): number {
    let json = false;
    let limit: number | null = 20;
    let status: CatalogStatus | null = null;
    let live_only = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') json = true;
        else if (a === '--all') limit = null;
        else if (a === '--live') live_only = true;
        else if (a === '--limit') {
            const n = Number(argv[++i]);
            if (!Number.isInteger(n) || n < 1) return usage();
            limit = n;
        } else if (a === '--status') {
            const s = argv[++i] as CatalogStatus;
            if (!CATALOG_STATUSES.includes(s)) return usage();
            status = s;
        } else return usage();
    }
    const index = publish_index({ env, ...(home !== undefined ? { home } : {}) });
    let rows = index.sessions;
    if (status !== null) rows = rows.filter((r) => r.status === status);
    if (live_only) rows = rows.filter((r) => r.live);
    if (limit !== null) rows = rows.slice(0, limit);
    if (json) {
        process.stdout.write(`${JSON.stringify({ ...index, sessions: rows }, null, 2)}\n`);
        return 0;
    }
    const c = index.counts;
    const out: string[] = [
        `${c.total} sessions · ${c.active} active · ${c.idle} idle · ${c.inactive} inactive · ${c.live} live`,
        `written: ${index_json_path(env, home)} · ${index_md_path(env, home)}`,
        '',
    ];
    for (const r of rows) {
        const repos = r.repos.map(repo_label).join(', ') || '—';
        out.push(
            `${r.status.padEnd(8)} ${fmt_age(r.idle_seconds).padStart(6)}  ${r.session_id}  ${r.host}·${r.surface}` +
                `  ${r.profile === null ? '—' : `${r.profile.provider}/${r.profile.name}`}  ${r.model ?? '—'}` +
                `  tokens ${fmt_tokens(r.usage?.total_tokens)}${r.usage_complete ? '' : '+'}` +
                (r.subagent_usage !== null ? ` (+${fmt_tokens(r.subagent_usage.total_tokens)} in ${r.subagents} subagents)` : '') +
                ` ctx ${context_label(r)}`,
            `         ${r.title ?? '(untitled)'} — ${repos}`,
        );
        const resume = resume_line(r);
        if (resume !== null) out.push(`         resume: ${resume}`);
    }
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(cmd_catalog());
}
