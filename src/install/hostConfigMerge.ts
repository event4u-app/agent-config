/**
 * Merge the installer's keys into a host settings file without losing a
 * foreign line.
 *
 * Host settings are often not strict JSON: VS Code reads JSONC, users truncate
 * files, editors leave duplicated keys. Each case ends in a named status, and
 * the file is rewritten only when it parsed as strict JSON — rewriting a JSONC
 * file would drop its comments. An overwrite leaves `<file>.agent-config.bak`
 * (written once, so it keeps the pre-agent-config original) and is re-read
 * afterwards; a mismatch puts the pre-write bytes back.
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
}

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

export function mergeHostConfigFile(
    p: string,
    incoming: Record<string, unknown>,
    merge: HostConfigMerger,
    io: HostConfigIo = defaultIo,
): HostConfigOutcome {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        io.write(p, jsonDumpsIndent(incoming, 4) + '\n');
        return { status: 'created' };
    }

    const original = fs.readFileSync(p, 'utf-8');
    const parsed = parseHostConfig(original);
    if (parsed.kind === 'invalid') return { status: 'skipped-invalid', detail: parsed.reason };

    const touched = findDuplicateKeys(parsed.kind === 'jsonc' ? stripJsonc(original) : original).filter(
        (d) => d.container === '' && d.key in incoming,
    );
    if (touched.length > 0) {
        const d = touched[0]!;
        return {
            status: 'skipped-duplicate-key',
            detail: `"${d.key}" appears on lines ${String(d.firstLine)} and ${String(d.laterLine)}`,
        };
    }

    const merged = merge(parsed.data, incoming);
    if (jsonEqual(merged, parsed.data)) return { status: 'unchanged' };
    if (parsed.kind === 'jsonc') return { status: 'skipped-jsonc', detail: 'comments would be lost on rewrite' };

    const backup = p + BACKUP_SUFFIX;
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, 'utf-8');
    io.write(p, jsonDumpsIndent(merged, 4) + '\n');

    const reread = parseObject(fs.readFileSync(p, 'utf-8'));
    if (typeof reread === 'string' || !jsonEqual(reread, merged)) {
        fs.writeFileSync(p, original, 'utf-8');
        return { status: 'skipped-readback-mismatch', detail: 'original bytes restored' };
    }
    return { status: 'updated' };
}
