/**
 * archive_precheck — read a ZIP archive's central directory WITHOUT extracting
 * it, and refuse the shapes that turn an "upload the zip unchanged" skill bundle
 * into a write outside its folder or a disk-filling bomb.
 *
 * Refused: path traversal (`..`), absolute or drive-letter paths, symlink
 * entries, nested archives, ZIP64 / encrypted entries (not inspectable here),
 * and entry count, total size or per-entry compression ratio over a cap.
 * Executable entries are not refused — they are NAMED, because a bundle that
 * ships a script is reviewed as code (`supply-chain-intake` § agent assets).
 *
 * Exit: 0 accepted · 1 refused · 2 usage or unreadable / not a ZIP.
 * Reads only the bytes; nothing is written, nothing is executed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

export const CAPS = {
    maxEntries: 2000,
    maxTotalBytes: 100 * 1024 * 1024,
    maxRatio: 100,
    /** Below this a high ratio is noise (a tiny text file compresses well). */
    ratioFloorBytes: 1024 * 1024,
} as const;

const NESTED_ARCHIVE = /\.(zip|skill|jar|tar|tgz|gz|bz2|xz|7z|rar)$/i;
const EXECUTABLE_EXT = /\.(sh|bash|zsh|command|exe|bat|cmd|ps1|py|rb|pl|js|mjs|cjs|bin|app|dll|so|dylib)$/i;

export interface ArchiveEntry {
    readonly name: string;
    readonly compressedSize: number;
    readonly size: number;
    readonly symlink: boolean;
    readonly executable: boolean;
}

export interface PrecheckResult {
    readonly entries: readonly ArchiveEntry[];
    readonly refusals: readonly string[];
    readonly executables: readonly string[];
}

export class NotAZipError extends Error {}

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;

/** Parse the central directory of a ZIP held in `buf`. */
export function readCentralDirectory(buf: Buffer): { entries: ArchiveEntry[]; problems: string[] } {
    const problems: string[] = [];
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
        if (buf.readUInt32LE(i) === EOCD_SIG) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new NotAZipError('no end-of-central-directory record — not a ZIP archive');
    const total = buf.readUInt16LE(eocd + 10);
    const cdSize = buf.readUInt32LE(eocd + 12);
    const cdOffset = buf.readUInt32LE(eocd + 16);
    if (total === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
        problems.push('ZIP64 archive — sizes are not inspectable here, refused rather than guessed');
        return { entries: [], problems };
    }
    if (cdOffset + cdSize > buf.length) throw new NotAZipError('central directory lies outside the file');
    const entries: ArchiveEntry[] = [];
    let p = cdOffset;
    for (let n = 0; n < total; n++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== CDH_SIG) {
            throw new NotAZipError(`central directory entry ${n} is malformed`);
        }
        const madeBy = buf.readUInt16LE(p + 4);
        const flags = buf.readUInt16LE(p + 8);
        const compressedSize = buf.readUInt32LE(p + 20);
        const size = buf.readUInt32LE(p + 24);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const external = buf.readUInt32LE(p + 38);
        const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
        const unixMode = madeBy >> 8 === 3 ? external >>> 16 : 0;
        const symlink = (unixMode & 0o170000) === 0o120000;
        const fileType = unixMode & 0o170000;
        const executable =
            !symlink && fileType !== 0o040000 && ((unixMode & 0o111) !== 0 || EXECUTABLE_EXT.test(name));
        if (flags & 0x1) problems.push(`${name}: encrypted entry — content cannot be read before activation`);
        if (compressedSize === 0xffffffff || size === 0xffffffff) problems.push(`${name}: ZIP64 sizes — refused rather than guessed`);
        entries.push({ name, compressedSize, size, symlink, executable });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return { entries, problems };
}

/** Judge a parsed archive against the caps. */
export function judge(entries: readonly ArchiveEntry[], problems: readonly string[] = []): PrecheckResult {
    const refusals = [...problems];
    if (entries.length > CAPS.maxEntries) refusals.push(`${entries.length} entries exceed the ${CAPS.maxEntries}-entry cap`);
    let totalBytes = 0;
    for (const e of entries) {
        totalBytes += e.size;
        const parts = e.name.replace(/\\/g, '/').split('/');
        if (e.name.startsWith('/') || e.name.startsWith('\\') || /^[A-Za-z]:/.test(e.name)) {
            refusals.push(`${e.name}: absolute path — would extract outside the target folder`);
        } else if (parts.includes('..')) {
            refusals.push(`${e.name}: path traversal (\`..\`) — would extract outside the target folder`);
        }
        if (e.symlink) refusals.push(`${e.name}: symlink entry — can point anywhere after extraction`);
        if (NESTED_ARCHIVE.test(e.name)) refusals.push(`${e.name}: nested archive — its content is not inspected by this check`);
        if (e.size >= CAPS.ratioFloorBytes && e.compressedSize > 0 && e.size / e.compressedSize > CAPS.maxRatio) {
            refusals.push(`${e.name}: compression ratio ${Math.round(e.size / e.compressedSize)}:1 exceeds ${CAPS.maxRatio}:1`);
        }
    }
    if (totalBytes > CAPS.maxTotalBytes) refusals.push(`${totalBytes} uncompressed bytes exceed the ${CAPS.maxTotalBytes}-byte cap`);
    const executables = entries.filter((e) => e.executable && !e.name.endsWith('/')).map((e) => e.name);
    return { entries, refusals, executables };
}

export function precheckFile(file: string): PrecheckResult {
    const { entries, problems } = readCentralDirectory(fs.readFileSync(file));
    return judge(entries, problems);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const file = argv[0];
    if (file === undefined || argv.length !== 1) {
        process.stderr.write('usage: archive_precheck <archive.zip|.skill>\n');
        return 2;
    }
    let result: PrecheckResult;
    try {
        result = precheckFile(path.resolve(file));
    } catch (err) {
        process.stderr.write(`archive_precheck: ${(err as Error).message}\n`);
        return 2;
    }
    process.stdout.write(`${result.entries.length} entries read, nothing extracted.\n`);
    for (const x of result.executables) process.stdout.write(`  executable: ${x}\n`);
    if (result.refusals.length > 0) {
        process.stdout.write('REFUSED:\n');
        for (const r of result.refusals) process.stdout.write(`  ${r}\n`);
        return 1;
    }
    process.stdout.write(
        result.executables.length > 0
            ? 'Accepted for reading — it ships executables: review them as code before activation.\n'
            : 'Accepted for reading. Read every file before activation.\n',
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
