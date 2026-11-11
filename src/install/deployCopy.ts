/**
 * One deployed file, in one pass — the bytes the installer would write, and the
 * write itself only when the target does not already hold them.
 *
 * The copy loop used to pay, per file and per host, a copy, a read-back to
 * stamp the package tag, a second write of the stamped text, and a third read
 * to digest the result for the transaction log. An upgrade deploys the same
 * tree to every detected host and nearly every file is unchanged between two
 * versions, so almost all of that I/O rewrote bytes that were already there.
 * Here the final bytes are built in memory from one read of the source, and a
 * target that already holds them is left alone.
 *
 * It lives beside the installer rather than inside `src/scripts/install.ts`
 * because that file is the largest source this package ships and
 * `check_source_size_budget` ratchets exactly that number.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { is_ancestor } from '../scripts/_lib/global_deploy_inventory.js';

export const PACKAGE_TAG_ID = 'event4u/agent-config';

/** Split on `\n`, keeping each terminator — Python's `str.splitlines(keepends=True)` for `\n` text. */
function splitLinesKeepEnds(text: string): string[] {
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '\n') {
            out.push(text.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < text.length) out.push(text.slice(start));
    return out;
}

function setKey(block: string[], key: string, value: string): void {
    const prefix = `${key}:`;
    const rendered = `${key}: ${value}\n`;
    for (let idx = 0; idx < block.length; idx += 1) {
        if ((block[idx] as string).startsWith(prefix)) {
            block[idx] = rendered;
            return;
        }
    }
    block.push(rendered);
}

/**
 * `text` with `package:` (and `source_path:` when known) set in its
 * frontmatter. Text without a closed frontmatter block is returned unchanged —
 * the tag is ownership evidence on files that already carry metadata, never a
 * reason to invent a block.
 */
export function tagFrontmatter(text: string, sourceValue: string | null): string {
    if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return text;
    const lines = splitLinesKeepEnds(text);
    let closeIdx: number | null = null;
    for (let i = 1; i < lines.length; i += 1) {
        if ((lines[i] as string).replace(/[\r\n]+$/, '') === '---') {
            closeIdx = i;
            break;
        }
    }
    if (closeIdx === null) return text;
    const fm = lines.slice(1, closeIdx);
    setKey(fm, 'package', PACKAGE_TAG_ID);
    if (sourceValue !== null) setKey(fm, 'source_path', sourceValue);
    return [lines[0], ...fm, ...lines.slice(closeIdx)].join('');
}

export function sha256OfBytes(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/** The file's bytes, or `null` when it is absent or unreadable. */
export function readBytesOrNull(p: string): Buffer | null {
    try {
        return fs.readFileSync(p);
    } catch {
        return null;
    }
}

/**
 * The bytes a deploy of `source` leaves at `target`: the source itself, with
 * the package tag stamped when the target is a `.md`. The same `Buffer` is
 * returned when nothing is stamped, so the caller can tell by identity.
 *
 * `sourceValue` is a thunk because resolving it costs path work that only a
 * `.md` needs.
 */
export function deployedBytes(source: Buffer, target: string, sourceValue: () => string | null): Buffer {
    if (path.extname(target) !== '.md') return source;
    const text = source.toString('utf-8');
    const tagged = tagFrontmatter(text, sourceValue());
    return tagged === text ? source : Buffer.from(tagged, 'utf-8');
}

function permissionBits(p: string): number | null {
    try {
        return fs.statSync(p).mode & 0o777;
    } catch {
        return null;
    }
}

/** One package file, read and stamped: what a deploy of it leaves at a target. */
export interface PreparedFile {
    /** The package bytes as shipped. */
    readonly source: Buffer;
    /** The bytes the deploy writes — `source` itself when nothing is stamped. */
    readonly out: Buffer;
    readonly sha256: string;
    /** The source's permission bits, or `null` when they could not be read. */
    readonly mode: number | null;
}

/**
 * Prepared files of one deploy run, keyed by resolved source.
 *
 * A global deploy puts the same package tree under every detected host, so
 * without this each source is read, stamped and digested once per host. The
 * owner scopes it to a single run: the package tree does not change while a
 * deploy is in flight, and nothing may assume that beyond it.
 */
export type PreparedCache = Map<string, PreparedFile>;

/**
 * Read `source` and build the bytes a deploy of it leaves at `target`.
 *
 * Only the target's extension enters the result (it decides whether the tag is
 * stamped), so it is part of the cache key and the rest of the path is not.
 */
export function prepareFile(
    source: string,
    target: string,
    sourceValue: () => string | null,
    cache: PreparedCache | null = null,
): PreparedFile {
    const key = `${path.extname(target) === '.md' ? 'md' : 'raw'}:${source}`;
    const hit = cache?.get(key);
    if (hit !== undefined) return hit;
    const bytes = fs.readFileSync(source);
    const out = deployedBytes(bytes, target, sourceValue);
    const prepared: PreparedFile = { source: bytes, out, sha256: sha256OfBytes(out), mode: permissionBits(source) };
    cache?.set(key, prepared);
    return prepared;
}

/**
 * Put a prepared file at `target` and return the SHA-256 of the bytes now there.
 *
 * `onDisk` is what the target held when the caller classified it. The write is
 * elided only when content AND permission bits already match: a script that
 * became executable between two versions has identical bytes and still has to
 * be copied.
 */
export function putPrepared(prepared: PreparedFile, source: string, target: string, onDisk: Buffer | null): string {
    if (onDisk !== null && prepared.mode !== null && onDisk.equals(prepared.out) && permissionBits(target) === prepared.mode) {
        return prepared.sha256;
    }
    // The copy carries the source's permission bits; the stamped text is then
    // written into that file, which keeps them.
    fs.copyFileSync(source, target);
    if (prepared.out !== prepared.source) fs.writeFileSync(target, prepared.out);
    return prepared.sha256;
}

/**
 * Would dereferencing `entry` escape the package root?
 *
 * `install.ts::_copy_dir_dereferencing_symlinks` copies the REALPATH of every entry, so a
 * symlink in the shipped tree pointing outside the package would copy an
 * arbitrary readable file into the deploy destination — and those destinations
 * are agent-readable instruction dirs (`~/.claude/rules/`, `~/.codeium/…`). A
 * tampered tarball carrying `rules/x.md -> ~/.ssh/id_rsa` would land that file
 * where an agent reads rules.
 *
 * Defence-in-depth for `docs/threat-model.md` row b (supply-chain compromise):
 * the package is the install-time trust anchor, so this is not the primary
 * control — but the check is one comparison and `package_root` was already
 * threaded through, so there is no reason to ship without it.
 *
 * Both sides are realpath'd before comparing, so a macOS `/var` → `/private/var`
 * root does not read as an escape. A `null` package_root means the caller did
 * not scope the copy (several do) — unchanged, permissive behaviour there.
 */
export function escapesPackageRoot(resolved: string, packageRoot: string | null): boolean {
    if (packageRoot === null) return false;
    const root = realRoot(packageRoot);
    // Unresolvable root — cannot judge containment, so do not block the copy.
    if (root === null) return false;
    return !is_ancestor(root, resolved);
}

const realRoots = new Map<string, string>();

/** Realpath of a package root, or `null` when unresolvable — asked once per deployed file, so resolved once per process. */
export function realRoot(root: string): string | null {
    let real = realRoots.get(root);
    if (real === undefined) {
        try {
            real = fs.realpathSync(root);
        } catch {
            return null;
        }
        realRoots.set(root, real);
    }
    return real;
}
