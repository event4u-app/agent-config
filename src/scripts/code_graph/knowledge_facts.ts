/**
 * Committed knowledge into the fact layer (roadmap I.2). Every committed
 * knowledge artefact becomes a node; a curated memory entry gets `about` edges
 * to the paths it names, and a named path that no longer resolves is told
 * apart as `moved` (git saw a rename, the new path is given) or `gone`.
 *
 * Sources: ADRs in both layouts (flat `ADR-*.md` and per-topic folders),
 * curated memory entries, team-knowledge pages, decision ledgers, owner
 * questions, retro proposals, and review and council records linked by
 * pull-request number. Facts come from files and git; no model writes or
 * summarises anything here.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

type Git = (args: readonly string[]) => string;

export type KnowledgeKind = 'decision' | 'memory' | 'page' | 'ledger' | 'owner-question' | 'proposal' | 'review' | 'council';

export interface KnowledgeNode {
    id: string;
    kind: KnowledgeKind;
    file: string;
    label: string;
    /** `#N` when the record names a pull request */
    pr: string | null;
}

export interface AboutEdge {
    source: string;
    target: string;
    relation: 'about';
}

export interface PathFinding {
    memory: string;
    path: string;
    state: 'moved' | 'gone';
    /** the current path of a moved file */
    now: string | null;
}

export interface KnowledgeFacts {
    nodes: KnowledgeNode[];
    edges: AboutEdge[];
    findings: PathFinding[];
}

function list(dir: string, re: RegExp, deep = false): string[] {
    const out: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory() && deep && !e.name.startsWith('.')) out.push(...list(p, re, deep));
        else if (e.isFile() && re.test(e.name)) out.push(p);
    }
    return out.sort();
}

const PR = /(?:\bPR\s*#|pull\/|\bpr-)(\d+)\b/i;

/** Repository paths a text names: backticked or bare tokens with a directory and an extension. */
export function namedPaths(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(/(?<![\w./-])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,6})(?::\d+)?(?![\w/-])/g)) {
        const p = (m[1] as string).replace(/^\.\//, '');
        if (p.startsWith('http') || p.includes('..') || p.startsWith('~')) continue;
        out.add(p);
    }
    return [...out].sort();
}

/** old path → new path for every rename in history, oldest rename first so a chain resolves forward. */
export function renameMap(git: Git): Map<string, string> {
    const map = new Map<string, string>();
    let out: string;
    try {
        out = git(['log', '--reverse', '-M', '--diff-filter=R', '--name-status', '--format=']);
    } catch {
        return map;
    }
    for (const line of out.split('\n')) {
        const cols = line.split('\t');
        if ((cols[0] ?? '').startsWith('R') && cols[1] && cols[2]) map.set(cols[1], cols[2]);
    }
    return map;
}

/** Where a renamed path went, following a chain; null when git saw no rename of it. */
export function renamedTo(renames: ReadonlyMap<string, string>, file: string): string | null {
    let cur = file;
    for (let hops = 0; renames.has(cur) && hops < 20; hops++) cur = renames.get(cur) as string;
    return cur !== file ? cur : null;
}

export function collectKnowledge(root: string, opts: { git: Git }): KnowledgeFacts {
    const rel = (p: string): string => path.relative(root, p).split(path.sep).join('/');
    const nodes: KnowledgeNode[] = [];
    const edges: AboutEdge[] = [];
    const findings: PathFinding[] = [];
    const node = (kind: KnowledgeKind, file: string, label: string, text = ''): KnowledgeNode => {
        const pr = PR.exec(`${path.basename(file)} ${text.slice(0, 4000)}`)?.[1];
        const n: KnowledgeNode = { id: `${kind}:${rel(file)}`, kind, file: rel(file), label, pr: pr ? `#${pr}` : null };
        nodes.push(n);
        return n;
    };
    const read = (f: string): string => {
        try {
            return fs.readFileSync(f, 'utf-8');
        } catch {
            return '';
        }
    };
    for (const f of list(path.join(root, 'docs', 'decisions'), /^ADR-\d+.*\.md$/)) node('decision', f, path.basename(f, '.md').match(/^ADR-\d+/)?.[0] ?? path.basename(f));
    let topics: string[] = [];
    try {
        topics = fs.readdirSync(path.join(root, 'docs', 'adrs'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    } catch {
        /* no topic layout */
    }
    for (const t of topics) for (const f of list(path.join(root, 'docs', 'adrs', t), /^\d+.*\.md$/)) node('decision', f, `${t}/${path.basename(f, '.md')}`);

    const exists = (p: string): boolean => fs.existsSync(path.join(root, p));
    let renames: Map<string, string> | null = null;
    for (const f of list(path.join(root, 'agents', 'memory'), /\.ya?ml$/)) {
        let doc: { entries?: Array<Record<string, unknown>> } | null = null;
        try {
            doc = parseYaml(read(f)) as typeof doc;
        } catch {
            continue;
        }
        for (const e of doc?.entries ?? []) {
            if (typeof e['id'] !== 'string') continue;
            const text = JSON.stringify(e);
            const pr = PR.exec(text)?.[1];
            const n: KnowledgeNode = { id: `memory:${e['id']}`, kind: 'memory', file: rel(f), label: e['id'] as string, pr: pr ? `#${pr}` : null };
            nodes.push(n);
            for (const p of namedPaths(text)) {
                if (exists(p)) {
                    edges.push({ source: n.id, target: p, relation: 'about' });
                    continue;
                }
                const now = renamedTo((renames ??= renameMap(opts.git)), p);
                if (now !== null && exists(now)) {
                    edges.push({ source: n.id, target: now, relation: 'about' });
                    findings.push({ memory: n.id, path: p, state: 'moved', now });
                } else findings.push({ memory: n.id, path: p, state: 'gone', now: null });
            }
        }
    }
    for (const f of list(path.join(root, 'agents', 'knowledge'), /\.md$/, true)) node('page', f, rel(f));
    for (const f of list(path.join(root, 'agents', 'decisions'), /\.(md|jsonl)$/, true)) node('ledger', f, rel(f));
    if (fs.existsSync(path.join(root, 'agents', 'owner-questions.md'))) node('owner-question', path.join(root, 'agents', 'owner-questions.md'), 'owner-questions');
    for (const f of list(path.join(root, 'agents', 'proposals'), /\.md$/)) if (path.basename(f) !== 'README.md') node('proposal', f, path.basename(f, '.md'));
    for (const f of list(path.join(root, 'agents', 'evidence', 'reviews'), /\.(md|json)$/, true)) node('review', f, path.basename(f), read(f));
    for (const f of list(path.join(root, 'agents', 'evidence', 'council'), /\.(md|json)$/, true)) node('council', f, path.basename(f), read(f));
    return { nodes, edges, findings };
}
