/**
 * `agent-config settings:sync --prune-removed` — delete leftover values of
 * settings keys this package has removed ({@link REMOVED_KEYS}).
 *
 * The loader ignores such a key and says so on stderr; this is the command
 * that line names, so the notice can stop. It edits the YAML line by line, the
 * way `settings:sync` does, so comments and every live key keep their bytes.
 * A key it cannot locate as a plain block mapping (inside a flow mapping, a
 * list item, an anchor) is left in place and simply not reported as removed.
 */

import * as fs from 'node:fs';

import { _resolve_cascade_paths, user_global_settings_paths } from './agent_settings.js';
import { REMOVED_KEYS } from './settings_removed_keys.js';

interface Line {
    readonly indent: number;
    readonly key: string | null;
    /** A value follows the colon on the same line (scalar or flow collection). */
    readonly inline: boolean;
    /** Blank or comment-only: never decides where a block ends. */
    readonly filler: boolean;
    readonly listItem: boolean;
}

const KEY_RE = /^(\s*)(["']?)([A-Za-z0-9_.-]+)\2\s*:(?:\s+(.*))?$/;

function scan(raw: string): Line {
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (trimmed === '' || trimmed.startsWith('#')) return { indent, key: null, inline: false, filler: true, listItem: false };
    if (trimmed === '-' || trimmed.startsWith('- ')) return { indent, key: null, inline: true, filler: false, listItem: true };
    const m = KEY_RE.exec(raw);
    if (m === null) return { indent, key: null, inline: true, filler: false, listItem: false };
    const rest = (m[4] ?? '').trim();
    return { indent, key: m[3] ?? null, inline: rest !== '' && !rest.startsWith('#'), filler: false, listItem: false };
}

/** One past the last line belonging to the block that line `i` opens. */
function blockEnd(lines: readonly Line[], i: number): number {
    const base = (lines[i] as Line).indent;
    let last = i;
    for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j] as Line;
        if (l.filler) continue;
        if (l.indent > base || (l.listItem && l.indent === base)) last = j;
        else break;
    }
    return last + 1;
}

/** Line indices of each segment of `dotted`, outermost first; null when absent. */
function locate(lines: readonly Line[], dotted: string): number[] | null {
    let from = 0;
    let to = lines.length;
    const chain: number[] = [];
    const segs = dotted.split('.');
    for (let s = 0; s < segs.length; s++) {
        const first = lines.slice(from, to).find((l) => !l.filler);
        if (first === undefined) return null;
        const at = lines.findIndex(
            (l, i) => i >= from && i < to && !l.filler && !l.listItem && l.indent === first.indent && l.key === segs[s],
        );
        if (at < 0) return null;
        chain.push(at);
        if (s < segs.length - 1) {
            if ((lines[at] as Line).inline) return null;
            from = at + 1;
            to = blockEnd(lines, at);
        }
    }
    return chain;
}

/** `text` without the given keys, plus which of them were actually removed. */
export function pruneRemovedText(text: string, keys: readonly string[]): { text: string; removed: string[] } {
    const trailingNewline = text.endsWith('\n');
    let raw = (trailingNewline ? text.slice(0, -1) : text).split('\n');
    const removed: string[] = [];
    for (const key of keys) {
        let lines = raw.map(scan);
        const chain = locate(lines, key);
        if (chain === null) continue;
        let leaf = chain.pop() as number;
        raw.splice(leaf, blockEnd(lines, leaf) - leaf);
        removed.push(key);
        // A parent this removal emptied goes too: `a:` with nothing under it
        // would now read as `a: null`, a value nobody wrote.
        while (chain.length > 0) {
            lines = raw.map(scan);
            leaf = chain.pop() as number;
            if (blockEnd(lines, leaf) !== leaf + 1) break;
            raw.splice(leaf, 1);
        }
    }
    raw = raw.length === 1 && raw[0] === '' ? [] : raw;
    return { text: raw.join('\n') + (trailingNewline && raw.length > 0 ? '\n' : ''), removed };
}

/** The settings files the loader reads for this directory, existing ones only. */
function settingsFiles(cwd: string): string[] {
    const all = [...user_global_settings_paths(), ..._resolve_cascade_paths(cwd, null)];
    return [...new Set(all)].filter((p) => fs.existsSync(p));
}

export function pruneRemovedMain(argv: readonly string[]): number {
    const dryRun = argv.includes('--dry-run');
    const at = argv.findIndex((a) => a === '--path' || a.startsWith('--path='));
    let files: string[];
    if (at >= 0) {
        const a = argv[at] as string;
        const p = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[at + 1];
        if (p === undefined || p === '') {
            process.stderr.write('settings:sync: --path needs a file\n');
            return 2;
        }
        files = [p];
    } else {
        files = settingsFiles(process.cwd());
    }
    const keys = [...REMOVED_KEYS.keys()];
    let total = 0;
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const before = fs.readFileSync(file, 'utf-8');
        const r = pruneRemovedText(before, keys);
        if (r.removed.length === 0) continue;
        total += r.removed.length;
        process.stdout.write(`${file}:\n`);
        for (const k of r.removed) process.stdout.write(`  ${k} — ${REMOVED_KEYS.get(k) ?? ''}\n`);
        if (!dryRun) fs.writeFileSync(file, r.text, 'utf-8');
    }
    if (total === 0) {
        process.stdout.write('No removed settings keys found.\n');
    } else if (dryRun) {
        process.stdout.write(`Dry run — ${total} key(s) would be deleted; nothing written.\n`);
    } else {
        process.stdout.write(`Deleted ${total} removed settings key(s).\n`);
    }
    return 0;
}
