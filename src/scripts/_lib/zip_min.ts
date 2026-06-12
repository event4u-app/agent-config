/**
 * Minimal ZIP writer/reader on Node builtins only (`node:zlib`).
 *
 * Internal helper for the TypeScript twin of
 * `src/scripts/_lib/claude_desktop_bundler.py` (ADR-090 py2ts Phase 2):
 * the repo ships no ZIP dependency, and the ADR contract forbids adding
 * one — so the bundler twin writes the (well-specified) ZIP container
 * itself and compresses entries with `zlib.deflateRawSync`
 * (= Python's `zipfile.ZIP_DEFLATED`).
 *
 * Scope is deliberately tiny — exactly what the bundler needs:
 * - writer: method 8 (deflate), no ZIP64, no encryption, no data
 *   descriptors, fixed 1980-01-01 timestamp (deterministic output).
 * - reader: central-directory walk + `inflateRawSync` (methods 0/8);
 *   used by the vitest twin and the differential parity suite, which
 *   additionally cross-checks the format against Python's `zipfile`.
 */
import * as zlib from 'node:zlib';

export interface ZipEntry {
    readonly name: string;
    readonly data: Buffer;
}

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;
// DOS date 1980-01-01, time 00:00:00 — deterministic bundles.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function isAscii(s: string): boolean {
    // eslint-disable-next-line no-control-regex
    return /^[\x00-\x7f]*$/.test(s);
}

/** Serialize `entries` (in order) into a ZIP archive buffer. */
export function zip_write_sync(entries: readonly ZipEntry[]): Buffer {
    const chunks: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = Buffer.from(entry.name, 'utf-8');
        // General-purpose flag bit 11: UTF-8 name (only when needed).
        const flags = isAscii(entry.name) ? 0 : 0x0800;
        const crc = crc32(entry.data);
        const compressed = zlib.deflateRawSync(entry.data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(LOCAL_HEADER_SIG, 0);
        local.writeUInt16LE(20, 4); // version needed to extract
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(METHOD_DEFLATED, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28); // extra field length
        chunks.push(local, nameBytes, compressed);

        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(CENTRAL_HEADER_SIG, 0);
        cen.writeUInt16LE(20, 4); // version made by
        cen.writeUInt16LE(20, 6); // version needed to extract
        cen.writeUInt16LE(flags, 8);
        cen.writeUInt16LE(METHOD_DEFLATED, 10);
        cen.writeUInt16LE(DOS_TIME, 12);
        cen.writeUInt16LE(DOS_DATE, 14);
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(compressed.length, 20);
        cen.writeUInt32LE(entry.data.length, 24);
        cen.writeUInt16LE(nameBytes.length, 28);
        cen.writeUInt16LE(0, 30); // extra field length
        cen.writeUInt16LE(0, 32); // comment length
        cen.writeUInt16LE(0, 34); // disk number start
        cen.writeUInt16LE(0, 36); // internal attributes
        cen.writeUInt32LE(0, 38); // external attributes
        cen.writeUInt32LE(offset, 42); // local header offset
        central.push(cen, nameBytes);

        offset += local.length + nameBytes.length + compressed.length;
    }

    const centralBuf = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(EOCD_SIG, 0);
    eocd.writeUInt16LE(0, 4); // this disk
    eocd.writeUInt16LE(0, 6); // disk with central directory
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16); // central directory offset
    eocd.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([...chunks, centralBuf, eocd]);
}

/** Parse a ZIP archive buffer; entries come back in central-directory order. */
export function zip_read_sync(buf: Buffer): ZipEntry[] {
    // Scan backwards for the end-of-central-directory record.
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === EOCD_SIG) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1) {
        throw new Error('zip_read_sync: end-of-central-directory record not found');
    }

    const entryCount = buf.readUInt16LE(eocdOffset + 10);
    let p = buf.readUInt32LE(eocdOffset + 16);
    const entries: ZipEntry[] = [];

    for (let n = 0; n < entryCount; n++) {
        if (buf.readUInt32LE(p) !== CENTRAL_HEADER_SIG) {
            throw new Error(`zip_read_sync: bad central directory signature at ${p}`);
        }
        const method = buf.readUInt16LE(p + 10);
        const compressedSize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localOffset = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf-8', p + 46, p + 46 + nameLen);

        if (buf.readUInt32LE(localOffset) !== LOCAL_HEADER_SIG) {
            throw new Error(`zip_read_sync: bad local header signature for '${name}'`);
        }
        const localNameLen = buf.readUInt16LE(localOffset + 26);
        const localExtraLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const compressed = buf.subarray(dataStart, dataStart + compressedSize);

        let data: Buffer;
        if (method === METHOD_DEFLATED) {
            data = zlib.inflateRawSync(compressed);
        } else if (method === METHOD_STORED) {
            data = Buffer.from(compressed);
        } else {
            throw new Error(`zip_read_sync: unsupported compression method ${method} for '${name}'`);
        }
        entries.push({ name, data });

        p += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}
