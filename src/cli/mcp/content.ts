/**
 * Local content tree — the read-only knowledge surface served by the
 * turnkey stdio-lite MCP server (ADR-085, A2×B1).
 *
 * Reads the bundled `dist/agent-src/` tree + `docs/guidelines/` from disk at
 * boot — the npm package ships both (see `package.json` `files`). This is the
 * local counterpart to the hosted Worker's R2/packed blob: the wire shapes are
 * mirrored verbatim from `internal/workers/mcp/src/{content,prompts,resources}.ts`
 * so both surfaces serve identical content (multi-channel consistency, ADR-085).
 *
 * Pure + I/O-isolated: `loadContentTree` is the ONLY disk read; everything
 * downstream (dispatch) is a pure function of the returned tree.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import yaml from 'js-yaml';

export type PromptKind = 'skill' | 'command';
export type ResourceKind = 'rule' | 'guideline';
export type EntryKind = PromptKind | ResourceKind;

export interface ContentEntry {
    /** Lookup key, e.g. `skill://verify-completion-evidence` or `rule://commit-policy`. */
    uri: string;
    /** Frontmatter `name:` (or a filename/dir fallback). */
    name: string;
    /** Frontmatter `description:` (or empty). */
    description: string;
    /** Body with frontmatter stripped. */
    body: string;
    /** `package` or `project` — frontmatter `source:`, default `package`. */
    source: string;
    kind: EntryKind;
    /** `text/markdown` for resources; omitted for prompts. */
    mime_type?: string;
}

export interface ContentTree {
    /** uri → entry. */
    uris: Record<string, ContentEntry>;
}

const MIME_MARKDOWN = 'text/markdown';
const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

/** Split frontmatter from body. Tolerant: no frontmatter → ({}, raw). */
function parseFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
    const m = FM_RE.exec(raw);
    if (!m) return { fm: {}, body: raw };
    let fm: Record<string, unknown> = {};
    try {
        const parsed = yaml.load(m[1]!);
        if (parsed && typeof parsed === 'object') fm = parsed as Record<string, unknown>;
    } catch {
        // Malformed frontmatter → treat as none; never throw at load time.
        fm = {};
    }
    return { fm, body: raw.slice(m[0].length) };
}

function str(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}

/** Recursively collect `*.md` files under `dir` (empty if `dir` is absent). */
function walkMd(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) out.push(...walkMd(p));
        else if (st.isFile() && name.endsWith('.md')) out.push(p);
    }
    return out;
}

function makeEntry(
    file: string,
    kind: EntryKind,
    scheme: string,
    fallbackName: string,
): ContentEntry {
    const raw = readFileSync(file, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const name = str(fm.name, fallbackName);
    const entry: ContentEntry = {
        uri: `${scheme}://${name}`,
        name,
        description: str(fm.description),
        body: body.trimStart(),
        source: str(fm.source, 'package'),
        kind,
    };
    if (kind === 'rule' || kind === 'guideline') entry.mime_type = MIME_MARKDOWN;
    return entry;
}

/**
 * Load the bundled content tree from `packageRoot`. Skills + commands become
 * prompts; rules + guidelines become resources. Missing trees are skipped
 * (a partial install still serves what is present). Never throws on a single
 * malformed file — that file is skipped with a stderr note.
 */
export function loadContentTree(packageRoot: string): ContentTree {
    const uris: Record<string, ContentEntry> = {};
    const add = (e: ContentEntry): void => {
        // First-writer wins on a uri collision (deterministic by load order).
        if (!(e.uri in uris)) uris[e.uri] = e;
    };
    const safe = (fn: () => void, file: string): void => {
        try {
            fn();
        } catch (err) {
            process.stderr.write(`[mcp-server] skipped ${file}: ${(err as Error).message}\n`);
        }
    };

    const agentSrc = resolve(packageRoot, 'dist', 'agent-src');

    // Skills — dist/agent-src/skills/<name>/SKILL.md
    const skillsDir = join(agentSrc, 'skills');
    if (existsSync(skillsDir)) {
        for (const slug of readdirSync(skillsDir)) {
            const f = join(skillsDir, slug, 'SKILL.md');
            if (existsSync(f)) safe(() => add(makeEntry(f, 'skill', 'skill', slug)), f);
        }
    }

    // Commands — dist/agent-src/commands/**/*.md
    for (const f of walkMd(join(agentSrc, 'commands'))) {
        safe(() => add(makeEntry(f, 'command', 'command', basename(f, '.md'))), f);
    }

    // Rules — dist/agent-src/rules/*.md
    for (const f of walkMd(join(agentSrc, 'rules'))) {
        safe(() => add(makeEntry(f, 'rule', 'rule', basename(f, '.md'))), f);
    }

    // Guidelines — docs/guidelines/**/*.md
    for (const f of walkMd(resolve(packageRoot, 'docs', 'guidelines'))) {
        const fallback = `${basename(dirname(f))}/${basename(f, '.md')}`;
        safe(() => add(makeEntry(f, 'guideline', 'guideline', fallback)), f);
    }

    return { uris };
}

/** All entries of the given kinds (insertion order). */
export function entriesOfKind(tree: ContentTree, kinds: readonly EntryKind[]): ContentEntry[] {
    const set = new Set(kinds);
    return Object.values(tree.uris).filter((e) => set.has(e.kind));
}
