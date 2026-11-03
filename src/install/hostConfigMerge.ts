/**
 * Merge the installer's keys into a host settings file without losing a
 * foreign line.
 *
 * Host settings are often not strict JSON: VS Code reads JSONC, users truncate
 * files, editors leave duplicated keys. Each case ends in a named status, and
 * the file is rewritten only when it parsed as strict JSON — rewriting a JSONC
 * file would drop its comments. A rewrite re-serialises the whole file from a
 * strict parse, which keeps only the last of two equal keys, so a duplicate key
 * ANYWHERE in the file refuses a rewrite, not only one in a container the merge
 * touches. An overwrite leaves `<file>.agent-config.bak` — refreshed on every
 * changing write, so it holds the bytes just before the latest write and never
 * keeps a secret the live file has since dropped — and is re-read afterwards;
 * a mismatch puts the pre-write bytes back.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { findDuplicateKeys } from '../scripts/_lib/json_duplicate_keys.js';
import { isPlainObject, jsonEqual } from '../scripts/_lib/json_merge.js';
import { jsonDumpsIndent } from '../scripts/_lib/json_python_parity.js';

export type HostConfigStatus =
    | 'created'
    | 'updated'
    | 'unchanged'
    | 'skipped-invalid'
    | 'skipped-jsonc'
    | 'skipped-duplicate-key'
    | 'skipped-readback-mismatch';

export interface HostConfigOutcome {
    status: HostConfigStatus;
    /** Why a skip happened, for the report line. */
    detail?: string;
}

export type ParsedHostConfig =
    | { kind: 'strict'; data: Record<string, unknown> }
    | { kind: 'jsonc'; data: Record<string, unknown> }
    | { kind: 'invalid'; reason: string };

export type HostConfigMerger = (
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
) => Record<string, unknown>;

export interface HostConfigIo {
    write: (p: string, content: string) => void;
    /** How a written file is laid out. Default: 4-space indent, insertion order. */
    serialize?: (data: Record<string, unknown>) => string;
}

const defaultSerialize = (data: Record<string, unknown>): string => jsonDumpsIndent(data, 4) + '\n';

const defaultIo: HostConfigIo = {
    write: (p, content) => fs.writeFileSync(p, content, 'utf-8'),
};

export const BACKUP_SUFFIX = '.agent-config.bak';

/** Remove `//` and block comments and trailing commas, leaving string contents alone. */
export function stripJsonc(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            const start = i;
            i += 1;
            while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
            i += 1;
            out += text.slice(start, i);
            continue;
        }
        if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        if (ch === ',') {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j] ?? '')) j += 1;
            if (text[j] === '}' || text[j] === ']') {
                i += 1;
                continue;
            }
        }
        out += ch;
        i += 1;
    }
    return out;
}

function parseObject(text: string): Record<string, unknown> | string {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
    return isPlainObject(data) ? data : 'top-level value is not an object';
}

export function parseHostConfig(text: string): ParsedHostConfig {
    const strict = parseObject(text);
    if (typeof strict !== 'string') return { kind: 'strict', data: strict };
    const lenient = parseObject(stripJsonc(text));
    if (typeof lenient !== 'string') return { kind: 'jsonc', data: lenient };
    return { kind: 'invalid', reason: strict };
}

/** The snippet a user adds by hand when the merge refuses. */
export function manualSnippet(incoming: Record<string, unknown>): string {
    return jsonDumpsIndent(incoming, 4);
}

/** Same dotted form `findDuplicateKeys` reports a container in. */
function keyPath(container: string, key: string): string {
    return container === '' ? key : `${container}.${key}`;
}

/**
 * Every key the merge writes, in every object container it descends into. A
 * duplicate is ambiguous only where the merge reads or replaces it — one level
 * deep or five — so the refusal covers each container `incoming` reaches.
 */
function touchedKeyPaths(incoming: Record<string, unknown>, container = '', out = new Set<string>()): Set<string> {
    for (const [key, value] of Object.entries(incoming)) {
        const here = keyPath(container, key);
        out.add(here);
        if (isPlainObject(value)) touchedKeyPaths(value, here, out);
    }
    return out;
}

export function mergeHostConfigFile(
    p: string,
    incoming: Record<string, unknown>,
    merge: HostConfigMerger,
    io: HostConfigIo = defaultIo,
): HostConfigOutcome {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        io.write(p, (io.serialize ?? defaultSerialize)(incoming));
        return { status: 'created' };
    }

    const original = fs.readFileSync(p, 'utf-8');
    const parsed = parseHostConfig(original);
    if (parsed.kind === 'invalid') return { status: 'skipped-invalid', detail: parsed.reason };

    const touchedKeys = touchedKeyPaths(incoming);
    const duplicates = findDuplicateKeys(parsed.kind === 'jsonc' ? stripJsonc(original) : original);
    const refuse = (d: (typeof duplicates)[number], why: string): HostConfigOutcome => ({
        status: 'skipped-duplicate-key',
        detail: `"${keyPath(d.container, d.key)}" appears on lines ${String(d.firstLine)} and ${String(d.laterLine)}${why}`,
    });
    // A duplicate the merge reads is ambiguous even when nothing is written.
    const touched = duplicates.find((d) => touchedKeys.has(keyPath(d.container, d.key)));
    if (touched !== undefined) return refuse(touched, '');

    const merged = merge(parsed.data, incoming);
    if (jsonEqual(merged, parsed.data)) return { status: 'unchanged' };
    if (parsed.kind === 'jsonc') return { status: 'skipped-jsonc', detail: 'comments would be lost on rewrite' };
    // Any other duplicate would be collapsed by the whole-file rewrite.
    if (duplicates[0] !== undefined) return refuse(duplicates[0], ' (a rewrite would keep only the last)');

    return overwriteWithBackup(p, original, merged, io);
}

/**
 * Write `data` to `p` as a whole-file overwrite — for callers that already
 * decided the full content (a healed key set, a `--force` rewrite) and so have
 * nothing to merge. The same backup and readback as a merge: a pre-existing
 * file leaves a refreshed `<file>.agent-config.bak`, and the result is re-read,
 * with the pre-write bytes put back on a mismatch. No duplicate-key refusal:
 * the caller already chose the whole content.
 */
export function writeHostConfig(p: string, data: Record<string, unknown>, io: HostConfigIo = defaultIo): HostConfigOutcome {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        io.write(p, (io.serialize ?? defaultSerialize)(data));
        return { status: 'created' };
    }
    return overwriteWithBackup(p, fs.readFileSync(p, 'utf-8'), data, io);
}

function overwriteWithBackup(
    p: string,
    original: string,
    data: Record<string, unknown>,
    io: HostConfigIo,
): HostConfigOutcome {
    const backup = p + BACKUP_SUFFIX;
    fs.writeFileSync(backup, original, 'utf-8');
    io.write(p, (io.serialize ?? defaultSerialize)(data));

    const reread = parseObject(fs.readFileSync(p, 'utf-8'));
    if (typeof reread === 'string' || !jsonEqual(reread, data)) {
        fs.writeFileSync(p, original, 'utf-8');
        return { status: 'skipped-readback-mismatch', detail: 'original bytes restored' };
    }
    return { status: 'updated' };
}
