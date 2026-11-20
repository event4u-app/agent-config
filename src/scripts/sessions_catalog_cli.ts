#!/usr/bin/env node
/**
 * `agent-config sessions:catalog` — read the machine-wide session catalog.
 *
 * Its own module rather than a `sessions_cli` subcommand: `sessions_cli` is
 * imported by hook concerns and therefore sits in the dispatch bundle, and the
 * catalog's rendering code must stay in its lazy chunk.
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    type CatalogStatus,
    build_index,
    fmt_age,
    fmt_tokens,
    index_json_path,
    index_md_path,
    publish_index,
    repo_label,
    resume_line,
} from './_lib/session_catalog.js';

function usage(): number {
    process.stderr.write(
        'usage: agent-config sessions:catalog [--json] [--all | --limit N] [--status active|idle|stale|ended] [--render]\n',
    );
    return 2;
}

const CATALOG_STATUSES: readonly CatalogStatus[] = ['active', 'idle', 'stale', 'ended'];

/**
 * Read the machine-wide session catalog. Status is recomputed from the records
 * at call time rather than taken from `sessions.json`, which may be older than
 * the throttle window.
 */
export function cmd_catalog(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): number {
    let json = false;
    let limit: number | null = 20;
    let status: CatalogStatus | null = null;
    let render = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') json = true;
        else if (a === '--all') limit = null;
        else if (a === '--render') render = true;
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
    if (render) publish_index({ env, force: true });
    const index = build_index({ env, prune: render });
    let rows = index.sessions;
    if (status !== null) rows = rows.filter((r) => r.status === status);
    if (limit !== null) rows = rows.slice(0, limit);
    if (json) {
        process.stdout.write(`${JSON.stringify({ ...index, sessions: rows }, null, 2)}\n`);
        return 0;
    }
    const c = index.counts;
    const out: string[] = [
        `${c.total} sessions · ${c.active} active · ${c.idle} idle · ${c.stale} stale · ${c.ended} ended`,
        `index: ${index_json_path(env)} · ${index_md_path(env)}`,
        '',
    ];
    for (const r of rows) {
        const repos = r.repos.map(repo_label).join(', ') || '—';
        out.push(
            `${r.status.padEnd(6)} ${fmt_age(r.idle_seconds).padStart(6)}  ${r.session_id}  ${r.host}·${r.surface}` +
                `  ${r.profile === null ? '—' : `${r.profile.provider}/${r.profile.name}`}  ${r.model ?? '—'}` +
                `  tokens ${fmt_tokens(r.usage?.total_tokens)} ctx ${fmt_tokens(r.context_tokens)}`,
            `       ${r.title ?? '(untitled)'} — ${repos}`,
        );
        const resume = resume_line(r);
        if (resume !== null) out.push(`       resume: ${resume}`);
    }
    process.stdout.write(`${out.join('\n')}\n`);
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(cmd_catalog());
}
