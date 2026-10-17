/**
 * A TrueType face built in memory at test time.
 *
 * Decision A7 of `road-to-type-with-a-witness`: no font binary is committed and
 * nothing is downloaded, so the witness fixtures need a face that exists only
 * for the length of a test. Every printable ASCII character maps to one
 * rectangle glyph whose advance differs from its neighbour's, so a sample set
 * in this face measures differently from any fallback — which is what lets a
 * reading tell "this face painted" from "something else painted".
 *
 * The output passes Chromium's OpenType sanitizer: the required tables, a
 * format-4 cmap, long `loca` offsets and table checksums.
 */

const UNITS_PER_EM = 1000;
const FIRST_CHAR = 0x20;
const LAST_CHAR = 0x7e;

export interface TestFaceOptions {
    /** The family name written into the `name` table. */
    family: string;
    /** `usWeightClass`; the face is upright and carries this one weight. */
    weight?: number;
}

class Writer {
    private readonly bytes: number[] = [];
    u8(v: number): this {
        this.bytes.push(v & 0xff);
        return this;
    }
    u16(v: number): this {
        return this.u8(v >> 8).u8(v);
    }
    i16(v: number): this {
        return this.u16(v < 0 ? v + 0x10000 : v);
    }
    u32(v: number): this {
        return this.u16(Math.floor(v / 0x10000) & 0xffff).u16(v & 0xffff);
    }
    raw(buf: readonly number[]): this {
        for (const b of buf) this.bytes.push(b);
        return this;
    }
    pad4(): this {
        while (this.bytes.length % 4 !== 0) this.bytes.push(0);
        return this;
    }
    get length(): number {
        return this.bytes.length;
    }
    out(): number[] {
        return this.bytes;
    }
}

function checksum(table: readonly number[]): number {
    let sum = 0;
    for (let i = 0; i < table.length; i += 4) {
        const word =
            ((table[i] ?? 0) << 24) | ((table[i + 1] ?? 0) << 16) | ((table[i + 2] ?? 0) << 8) | (table[i + 3] ?? 0);
        sum = (sum + (word >>> 0)) >>> 0;
    }
    return sum;
}

/** Glyph 0 is `.notdef`, glyph 1 the space, glyphs 2.. one rectangle per character. */
function glyphCount(): number {
    return 2 + (LAST_CHAR - FIRST_CHAR);
}

function advanceOf(glyph: number): number {
    if (glyph <= 1) return 500;
    return 420 + ((glyph * 37) % 5) * 90;
}

function rectangleGlyph(advance: number): number[] {
    const x0 = 60;
    const x1 = advance - 60;
    const y0 = 0;
    const y1 = 700;
    const w = new Writer();
    w.i16(1).i16(x0).i16(y0).i16(x1).i16(y1); // one contour + bbox
    w.u16(3); // endPtsOfContours
    w.u16(0); // instructionLength
    for (let i = 0; i < 4; i++) w.u8(0x01); // on-curve, 16-bit deltas
    // Clockwise, as TrueType expects for an outer contour: (x0,y0) (x0,y1) (x1,y1) (x1,y0).
    for (const dx of [x0, 0, x1 - x0, 0]) w.i16(dx);
    for (const dy of [y0, y1 - y0, 0, y0 - y1]) w.i16(dy);
    return w.pad4().out();
}

function nameTable(family: string, weight: number): number[] {
    const sub = weight >= 600 ? 'Bold' : 'Regular';
    const records: Array<[number, string]> = [
        [1, family],
        [2, sub],
        [3, `${family}-${sub}-test`],
        [4, `${family} ${sub}`],
        [6, `${family.replace(/\s+/g, '')}-${sub}`],
    ];
    const strings = records.map(([, s]) => {
        const out: number[] = [];
        for (const ch of s) {
            const c = ch.charCodeAt(0);
            out.push(c >> 8, c & 0xff);
        }
        return out;
    });
    const w = new Writer();
    w.u16(0).u16(records.length).u16(6 + records.length * 12);
    let offset = 0;
    records.forEach(([id], i) => {
        const len = (strings[i] as number[]).length;
        w.u16(3).u16(1).u16(0x0409).u16(id).u16(len).u16(offset);
        offset += len;
    });
    for (const s of strings) w.raw(s);
    return w.out();
}

function cmapTable(): number[] {
    const segCount = 2;
    const sub = new Writer();
    sub.u16(4).u16(16 + segCount * 8).u16(0);
    sub.u16(segCount * 2).u16(4).u16(1).u16(0); // searchRange, entrySelector, rangeShift
    sub.u16(LAST_CHAR).u16(0xffff); // endCode
    sub.u16(0); // reservedPad
    sub.u16(FIRST_CHAR).u16(0xffff); // startCode
    sub.i16(1 - FIRST_CHAR).i16(1); // idDelta: space -> glyph 1
    sub.u16(0).u16(0); // idRangeOffset
    const w = new Writer();
    w.u16(0).u16(1).u16(3).u16(1).u32(12).raw(sub.out());
    return w.out();
}

/** A complete TrueType file, ready to serve as `font/ttf`. */
export function buildTestFace(opts: TestFaceOptions): Buffer {
    const weight = opts.weight ?? 400;
    const n = glyphCount();
    const glyphs: number[][] = [];
    for (let g = 0; g < n; g++) glyphs.push(g === 1 ? [] : rectangleGlyph(advanceOf(g)));

    const glyf: number[] = [];
    const loca = new Writer();
    for (const g of glyphs) {
        loca.u32(glyf.length);
        glyf.push(...g);
    }
    loca.u32(glyf.length);

    const head = new Writer()
        .u32(0x00010000).u32(0x00010000).u32(0) // version, fontRevision, checkSumAdjustment
        .u32(0x5f0f3cf5).u16(0x000b).u16(UNITS_PER_EM)
        .u32(0).u32(0).u32(0).u32(0) // created, modified
        .i16(0).i16(-200).i16(1000).i16(900) // bbox
        .u16(weight >= 600 ? 1 : 0).u16(8).i16(2).i16(1).i16(0)
        .out();
    const hhea = new Writer()
        .u32(0x00010000).i16(800).i16(-200).i16(0).u16(1000)
        .i16(0).i16(0).i16(900).i16(1).i16(0).i16(0)
        .i16(0).i16(0).i16(0).i16(0).i16(0).u16(n)
        .out();
    const hmtx = new Writer();
    for (let g = 0; g < n; g++) hmtx.u16(advanceOf(g)).i16(g === 1 ? 0 : 60);
    const maxp = new Writer()
        .u32(0x00010000).u16(n).u16(4).u16(1).u16(0).u16(0).u16(2)
        .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0)
        .out();
    const os2 = new Writer()
        .u16(4).i16(600).u16(weight).u16(5).u16(0)
        .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(50).i16(300).i16(0)
        .raw(new Array(10).fill(0)) // panose
        .u32(1).u32(0).u32(0).u32(0) // ulUnicodeRange: Basic Latin
        .raw([0x54, 0x45, 0x53, 0x54]) // achVendID
        .u16(weight >= 600 ? 0x20 : 0x40).u16(FIRST_CHAR).u16(LAST_CHAR)
        .i16(800).i16(-200).i16(0).u16(900).u16(200)
        .u32(1).u32(0) // ulCodePageRange
        .i16(500).i16(700).u16(0).u16(0x20).u16(0)
        .out();
    const post = new Writer().u32(0x00030000).u32(0).i16(-100).i16(50).u32(0).u32(0).u32(0).u32(0).u32(0).out();

    const tables: Array<[string, number[]]> = [
        ['OS/2', os2],
        ['cmap', cmapTable()],
        ['glyf', glyf],
        ['head', head],
        ['hhea', hhea],
        ['hmtx', hmtx.out()],
        ['loca', loca.out()],
        ['maxp', maxp],
        ['name', nameTable(opts.family, weight)],
        ['post', post],
    ];

    const numTables = tables.length;
    let entrySelector = 0;
    while (1 << (entrySelector + 1) <= numTables) entrySelector++;
    const searchRange = (1 << entrySelector) * 16;
    const font = new Writer();
    font.u32(0x00010000).u16(numTables).u16(searchRange).u16(entrySelector).u16(numTables * 16 - searchRange);

    let offset = 12 + numTables * 16;
    const body = new Writer();
    let headOffset = 0;
    for (const [tag, data] of tables) {
        const padded = [...data];
        while (padded.length % 4 !== 0) padded.push(0);
        for (const ch of tag) font.u8(ch.charCodeAt(0));
        font.u32(checksum(padded)).u32(offset).u32(data.length);
        if (tag === 'head') headOffset = offset;
        body.raw(padded);
        offset += padded.length;
    }
    const bytes = [...font.out(), ...body.out()];
    const adjust = (0xb1b0afba - checksum(bytes)) >>> 0;
    const at = headOffset + 8;
    bytes[at] = (adjust >>> 24) & 0xff;
    bytes[at + 1] = (adjust >>> 16) & 0xff;
    bytes[at + 2] = (adjust >>> 8) & 0xff;
    bytes[at + 3] = adjust & 0xff;
    return Buffer.from(bytes);
}
