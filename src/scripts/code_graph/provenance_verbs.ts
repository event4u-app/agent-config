/**
 * `code-graph provenance <what>` — since when, and for which ticket and pull
 * request, from the local history.
 *
 *   a ticket key (`ABC-12`) or a PR (`#7`, `!7`)  what its commits introduced
 *                                                 (files, routes) and touched
 *   a file path                                   introduced, last changed, changes
 *   a symbol or route (id or label)               the line history of its span
 *
 * The why — ticket title, status, description, PR text — is never read or
 * stored here: the answer names the keys and numbers, and the agent asks the
 * user's own tracker for the text when it needs it.
 */
import { gitProbe } from '../_lib/spawn_env.js';
import { type CommitRef, commitLine, type ProvenanceIndex, SPAN_DEPTH, spanHistory, ticketKeysOf } from './provenance.js';
import type { CodeGraph, CodeNode } from './types.js';

type G = Pick<CodeGraph, 'nodes'>;

export interface ProvenanceAnswer {
    query: string;
    kind: 'ticket' | 'pr' | 'file' | 'element' | 'none';
    lines: string[];
}

const TICKET = /^[A-Z][A-Z0-9]+-\d+$/;
const PR = /^[#!]\d+$/;

function elementOf(g: G, q: string): CodeNode | undefined {
    return g.nodes.find((n) => n.id === q) ?? g.nodes.find((n) => n.label === q && n.kind !== 'file');
}

/** Routes whose own line was introduced by one of `commits`, read on demand from the files those commits touched. */
function routesIntroducedBy(root: string, g: G, index: ProvenanceIndex, commits: ReadonlySet<number>, files: ReadonlySet<string>, cacheDir: string): string[] {
    const shas = new Set([...commits].map((i) => index.commits[i]?.sha));
    const out: string[] = [];
    for (const n of g.nodes) {
        if (n.kind !== 'route' || !files.has(n.source_file)) continue;
        const line = n.source_location[0] ?? 0;
        if (line < 1) continue;
        const h = spanHistory(root, n.source_file, line, line, { cacheDir, index, keys: ticketKeysOf(root) });
        const intro = h && !h.bounded ? h.commits[h.commits.length - 1] : undefined;
        if (intro && shas.has(intro.sha)) out.push(`${n.label}  (${n.source_file}:${line})`);
    }
    return out.sort();
}

export function provenanceAnswer(root: string, g: G, index: ProvenanceIndex, query: string, cacheDir: string): ProvenanceAnswer {
    const lines: string[] = [];
    if (index.reason) lines.push(`note: ${index.reason}`);
    if (TICKET.test(query) || PR.test(query)) {
        const isTicket = TICKET.test(query);
        const ids = (isTicket ? index.tickets[query] : index.prs[query]) ?? [];
        if (ids.length === 0) {
            lines.push(`${query}: no commit in the history read names it${isTicket ? ' in a branch name or at the head of a subject (add the key to `ticket_keys` in .git-convention.yml to read bodies too)' : ''}`);
            return { query, kind: isTicket ? 'ticket' : 'pr', lines };
        }
        const commits = new Set(ids);
        lines.push(`${query} — ${ids.length} commit(s):`);
        for (const i of ids) lines.push(`  ${commitLine(index.commits[i] as CommitRef)}`);
        const introduced = Object.entries(index.files).filter(([, f]) => f.introduced !== null && commits.has(f.introduced)).map(([p]) => p).sort();
        const touched = [...new Set(ids.flatMap((i) => index.touched[i] ?? []))].sort();
        lines.push(`introduced (${introduced.length}):`);
        for (const f of introduced) lines.push(`  ${f}`);
        const routes = routesIntroducedBy(root, g, index, commits, new Set(touched), cacheDir);
        if (routes.length) {
            lines.push(`routes introduced (${routes.length}):`);
            for (const r of routes) lines.push(`  ${r}`);
        }
        const rest = touched.filter((f) => !introduced.includes(f));
        lines.push(`changed (${rest.length}):`);
        for (const f of rest) lines.push(`  ${f}`);
        lines.push(isTicket ? `why: ${query}'s title and description live in its tracker — ask it; nothing of its text is stored here` : `why: the description of ${query} lives in the forge — ask it; nothing of its text is stored here`);
        return { query, kind: isTicket ? 'ticket' : 'pr', lines };
    }
    const file = index.files[query];
    if (file) {
        const intro = file.introduced !== null ? index.commits[file.introduced] : undefined;
        lines.push(`${query}`);
        lines.push(`  introduced:   ${intro ? commitLine(intro) : 'unknown — older than the history read'}`);
        lines.push(`  last changed: ${commitLine(index.commits[file.last] as CommitRef)}`);
        lines.push(`  changes:      ${file.changes}`);
        try {
            const log = gitProbe(root, ['log', '--follow', '-n20', '--format=%h %cs %s', '--', query]).trim();
            if (log) {
                lines.push('  timeline (newest first, 20 at most):');
                for (const l of log.split('\n')) lines.push(`    ${l}`);
            }
        } catch {
            /* the index answer stands without a timeline */
        }
        return { query, kind: 'file', lines };
    }
    const n = elementOf(g, query);
    if (n && n.source_file) {
        const start = n.source_location[0] ?? 0;
        const end = n.source_location[2] ?? start;
        if (start > 0) {
            const h = spanHistory(root, n.source_file, start, Math.max(start, end), { cacheDir, index, keys: ticketKeysOf(root) });
            if (h && h.commits.length) {
                lines.push(`${n.label} (${n.kind}) — ${n.source_file}:${start}${end > start ? `-${end}` : ''}`);
                lines.push(`  introduced:   ${h.bounded ? `unknown — more than ${SPAN_DEPTH} commits changed these lines; the oldest read is ${commitLine(h.commits[h.commits.length - 1] as CommitRef)}` : commitLine(h.commits[h.commits.length - 1] as CommitRef)}`);
                lines.push(`  last changed: ${commitLine(h.commits[0] as CommitRef)}`);
                lines.push('  timeline:');
                for (const c of h.commits) lines.push(`    ${commitLine(c)}`);
                return { query, kind: 'element', lines };
            }
        }
    }
    lines.push(`${query}: neither a ticket key, a PR number, a file in the history nor an element of the graph`);
    return { query, kind: 'none', lines };
}
