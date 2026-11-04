/**
 * Read-only reader of the host's own auto-memory — the `host-memory` row of
 * `src/config/source-registry.json`.
 *
 * Claude Code keeps corrections the user gave it as one markdown file per fact
 * under `<config>/projects/<project>/memory/`. A correction recorded there was
 * an arrival before the self-repair loop ever saw it, so the subject index
 * counts it as one (owner answer OQ-33, 2026-10-29: read-only, no consent
 * prompt).
 *
 * The directory belongs to the host. This module opens files for reading and
 * never for writing, creates nothing and deletes nothing; the test pins that by
 * running it against a read-only fixture and comparing bytes afterwards.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface HostMemoryEntry {
    /** Directory name of the host project the memory belongs to. */
    project: string;
    name: string;
    description: string;
    type: string;
    body: string;
}

/** Cap per file: a memory is one fact, and a huge file is not one. */
const MAX_FILE_BYTES = 16_384;

/**
 * Host config roots to scan. `CLAUDE_CONFIG_DIR` relocates the host's whole
 * config tree, so it replaces `~/.claude` rather than adding to it.
 */
export function hostConfigRoots(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string[] {
    const relocated = env['CLAUDE_CONFIG_DIR'];
    return [relocated !== undefined && relocated !== '' ? relocated : path.join(home, '.claude')];
}

function frontmatter(text: string): { fields: Record<string, string>; body: string } {
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (m === null) return { fields: {}, body: text };
    const fields: Record<string, string> = {};
    for (const line of (m[1] as string).split('\n')) {
        const kv = /^\s*([a-z_]+):\s*(.*)$/.exec(line);
        if (kv !== null) fields[kv[1] as string] = (kv[2] as string).trim();
    }
    return { fields, body: m[2] as string };
}

function listDir(dir: string): string[] {
    try {
        return fs.readdirSync(dir).sort();
    } catch {
        return [];
    }
}

/**
 * Every memory file under `<root>/projects/<project>/memory/*.md`. The index
 * file is a list of pointers, not a fact, and is skipped. Unreadable or
 * oversized files are skipped, never fatal.
 */
export function readHostMemory(roots: readonly string[] = hostConfigRoots()): HostMemoryEntry[] {
    const out: HostMemoryEntry[] = [];
    for (const root of roots) {
        const projects = path.join(root, 'projects');
        for (const project of listDir(projects)) {
            const dir = path.join(projects, project, 'memory');
            for (const file of listDir(dir)) {
                if (!file.endsWith('.md') || file === 'MEMORY.md') continue;
                let text: string;
                try {
                    const p = path.join(dir, file);
                    if (fs.statSync(p).size > MAX_FILE_BYTES) continue;
                    text = fs.readFileSync(p, 'utf-8');
                } catch {
                    continue;
                }
                const { fields, body } = frontmatter(text);
                out.push({
                    project,
                    name: fields['name'] ?? file.slice(0, -3),
                    description: fields['description'] ?? '',
                    type: fields['type'] ?? '',
                    body: body.trim(),
                });
            }
        }
    }
    return out;
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * How many recorded corrections name `subject`. Only `feedback` memories are
 * corrections — a `user` or `reference` memory naming the same word is not a
 * complaint that arrived. The match is a whole-word, case-insensitive hit in
 * the name, the description or the body.
 */
export function hostMemoryArrivals(entries: readonly HostMemoryEntry[], subject: string): number {
    const s = subject.trim();
    if (s === '') return 0;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(s)}($|[^\\p{L}\\p{N}_])`, 'iu');
    return entries.filter(
        (e) => e.type === 'feedback' && (re.test(e.name) || re.test(e.description) || re.test(e.body)),
    ).length;
}
