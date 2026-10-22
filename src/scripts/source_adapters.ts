/**
 * source_adapters.ts — the local sources of the foreign-source door: a path
 * read in place, a tar archive, and an already-present clone. Each yields one
 * `SourceRef` whose pin and digest make a later run checkable against the same
 * bytes.
 *
 * Nothing here executes the source. A clone is pinned by reading `.git/HEAD`
 * and its refs as files, because even `git rev-parse` would honour the clone's
 * own config. An archive is parsed, never unpacked: an entry that would land
 * outside the archive refuses the whole source. Network kinds go through
 * `network_sources.ts` and fail here with a pointer there.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { detectSpdxFromText, resolveLicenseSignals, scanDirectoryLicenseSignals } from './_lib/detect_target_license.js';

export const FETCH_BLOCKER = 'source-fetch-authorization';
export const DEFAULT_MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

export type SourceKind = 'local-path' | 'archive' | 'local-clone';

export interface SourceRef {
    identity: string;
    kind: SourceKind;
    license: string;
    pin: string;
    digest: string;
    tier: 'read';
    files: Record<string, string>;
}

export class SourceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SourceError';
    }
}

function sha(data: string | Buffer): string {
    return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function treeDigest(files: Record<string, string>): string {
    return sha(
        Object.keys(files)
            .sort()
            .map((k) => `${k}\0${files[k] as string}\n`)
            .join(''),
    );
}

function unsupported(arg: string, why: string): SourceError {
    return new SourceError(
        `${arg}: ${why} — resolveSource reads local paths, tar archives and present clones; a network source goes through network_sources.ts under the fetch answer of ${FETCH_BLOCKER} (ADR-288 D7)`,
    );
}

function walk(rootAbs: string): Record<string, string> {
    const files: Record<string, string> = {};
    const real = fs.realpathSync(rootAbs);
    const visit = (dir: string): void => {
        for (const name of fs.readdirSync(dir).sort()) {
            if (name === '.git') continue;
            const abs = path.join(dir, name);
            const st = fs.lstatSync(abs);
            if (st.isSymbolicLink()) {
                let target: string;
                try {
                    target = fs.realpathSync(abs);
                } catch {
                    // Dangling: nothing to read, and links are never followed here anyway.
                    continue;
                }
                if (target !== real && !target.startsWith(`${real}${path.sep}`)) {
                    throw new SourceError(`${abs}: symlink points outside the source`);
                }
                continue;
            }
            if (st.isDirectory()) visit(abs);
            else if (st.isFile()) files[path.relative(rootAbs, abs).split(path.sep).join('/')] = sha(fs.readFileSync(abs));
        }
    };
    visit(rootAbs);
    return files;
}

function dirLicense(dirAbs: string): string {
    return resolveLicenseSignals(scanDirectoryLicenseSignals(dirAbs, '.')).spdxId ?? 'unknown';
}

function readHeadSha(cloneAbs: string): string {
    const gitDir = path.join(cloneAbs, '.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (/^[0-9a-f]{40}$/.test(head)) return head;
    const ref = /^ref: (\S+)$/.exec(head)?.[1];
    if (ref === undefined) throw new SourceError(`${cloneAbs}: unreadable HEAD`);
    const loose = path.join(gitDir, ref);
    if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
    const packed = path.join(gitDir, 'packed-refs');
    if (fs.existsSync(packed)) {
        for (const line of fs.readFileSync(packed, 'utf8').split('\n')) {
            const [shaPart, name] = line.split(' ');
            if (name === ref && shaPart !== undefined && /^[0-9a-f]{40}$/.test(shaPart)) return shaPart;
        }
    }
    throw new SourceError(`${cloneAbs}: HEAD ref ${ref} has no commit (empty clone)`);
}

function cString(buf: Buffer, start: number, len: number): string {
    const raw = buf.subarray(start, start + len);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

function assertInside(name: string, archive: string): void {
    if (name.startsWith('/')) throw new SourceError(`${archive}: absolute entry ${name}`);
    const norm = path.posix.normalize(name);
    if (norm === '..' || norm.startsWith('../') || name.split('/').includes('..')) {
        throw new SourceError(`${archive}: entry ${name} contains ../`);
    }
}

function readTar(archiveAbs: string, maxBytes: number): { files: Record<string, string>; license: string } {
    if (fs.statSync(archiveAbs).size > maxBytes) throw new SourceError(`${archiveAbs}: archive exceeds ${maxBytes} bytes`);
    let buf = fs.readFileSync(archiveAbs);
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf, { maxOutputLength: maxBytes });
    if (buf.length > maxBytes) throw new SourceError(`${archiveAbs}: archive exceeds ${maxBytes} bytes unpacked`);
    if (cString(buf, 257, 5) !== 'ustar') throw unsupported(archiveAbs, 'not a tar archive');
    const files: Record<string, string> = {};
    let license = 'unknown';
    for (let off = 0; off + 512 <= buf.length; ) {
        const header = buf.subarray(off, off + 512);
        if (header.every((b) => b === 0)) break;
        const prefix = cString(header, 345, 155);
        const base = cString(header, 0, 100);
        const name = prefix.length > 0 ? `${prefix}/${base}` : base;
        const size = parseInt(cString(header, 124, 12).trim() || '0', 8);
        const type = String.fromCharCode(header[156] as number);
        assertInside(name, archiveAbs);
        if (type === '1' || type === '2') {
            const link = cString(header, 157, 100);
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), link));
            if (link.startsWith('/') || resolved === '..' || resolved.startsWith('../')) {
                throw new SourceError(`${archiveAbs}: symlink ${name} points outside the archive`);
            }
        }
        const body = buf.subarray(off + 512, off + 512 + size);
        if (type === '0' || type === '\0') {
            files[name] = sha(body);
            if (/(^|\/)(LICENSE|LICENSE\.md|COPYING)$/.test(name) && license === 'unknown') {
                license = detectSpdxFromText(body.toString('utf8')) ?? 'unknown';
            }
        }
        off += 512 + Math.ceil(size / 512) * 512;
    }
    return { files, license };
}

export function resolveSource(arg: string, opts: { maxArchiveBytes?: number } = {}): SourceRef {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg) || /^[\w.-]+@[\w.-]+:/.test(arg)) {
        throw unsupported(arg, 'a network source');
    }
    const abs = path.resolve(arg);
    if (!fs.existsSync(abs)) throw new SourceError(`${arg}: no such path`);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
        const files = walk(abs);
        const digest = treeDigest(files);
        if (fs.existsSync(path.join(abs, '.git', 'HEAD'))) {
            return { identity: abs, kind: 'local-clone', license: dirLicense(abs), pin: readHeadSha(abs), digest, tier: 'read', files };
        }
        return { identity: abs, kind: 'local-path', license: dirLicense(abs), pin: digest, digest, tier: 'read', files };
    }
    if (/\.(tar|tgz|tar\.gz)$/.test(abs)) {
        const { files, license } = readTar(abs, opts.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES);
        const digest = treeDigest(files);
        return { identity: abs, kind: 'archive', license, pin: digest, digest, tier: 'read', files };
    }
    throw unsupported(arg, 'an unsupported source kind');
}
