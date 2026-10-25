/**
 * Upload prompts ground to `file-upload` with a file-upload threat row. Each of
 * these was reproduced as a miss on 2026-10-25: the inflected word ("uploaded"),
 * German ("hochladen"), and the processor/scanner phrasings landed on IDOR,
 * tenancy or encryption at rest, or on nothing.
 *
 * Runs the real engine over the real corpus: a change to either one moves this.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ground } from '../../src/skills/corpus-grounding/scripts/decision_engine.js';
import { load_manifest } from '../../src/skills/corpus-grounding/scripts/schema_validator.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const DATA = path.join(REPO, 'src', 'skills', 'threat-modeling', 'data');
const manifest = () => load_manifest(path.join(DATA, 'manifest.json'));

type Row = Record<string, string>;
type Grounded = {
    category: string;
    evidence_gap: string[];
    selections: { threats: { best: Row; alternatives: Row[] } };
};

const groundQuery = async (q: string) => (await ground(manifest(), q)) as unknown as Grounded;

/** Minimal RFC-4180 reader: quoted fields may hold commas and doubled quotes. */
function readCsv(file: string): Row[] {
    const text = fs.readFileSync(file, 'utf-8');
    const records: string[][] = [];
    let field = '';
    let row: string[] = [];
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i] as string;
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n') {
            row.push(field);
            records.push(row);
            row = [];
            field = '';
        } else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        records.push(row);
    }
    const [header, ...body] = records;
    return body.map((r) => Object.fromEntries((header as string[]).map((h, j) => [h, r[j] ?? ''])));
}

const UPLOADS = [
    'user uploads an image avatar, we generate thumbnails with ImageMagick',
    'virus scan uploaded attachments with clamav',
    'handle uploaded files from users',
    'users uploaded images get resized',
    'Bild hochladen und Vorschau erzeugen',
    'store a profile picture the user sends as multipart form data',
];

const CLASSES = (rows: Row[]) => rows.map((t) => t['Surface Class']);

describe('upload grounding', () => {
    it.each(UPLOADS)('grounds %j to file-upload with a file-upload threat row', async (q) => {
        const g = await groundQuery(q);
        expect(g.category).toBe('file-upload');
        expect(CLASSES([g.selections.threats.best, ...g.selections.threats.alternatives])).toContain('file-upload');
    });

    it('a release upload to a registry is not a file-upload surface', async () => {
        const g = await groundQuery('publish the release to npm');
        expect(g.category).not.toBe('file-upload');
    });

    it('the corpus names the processor and the fetch-execution classes, with no version floor', () => {
        const rows = readCsv(path.join(DATA, 'threats.csv')).filter((r) => r['Surface Class'] === 'file-upload');
        const text = rows.map((r) => `${r['Threat']} ${r['Abuse Case']}`).join(' ').toLowerCase();
        expect(text).toMatch(/processor|scanner/);
        expect(text).toMatch(/handler|executes? on fetch|served/);
        // The SSRF row names link-local addresses, which are not versions.
        for (const r of rows.filter((x) => !String(x['Threat']).startsWith('SSRF'))) {
            expect(`${r['Required Controls']} ${r['Negative Tests']}`).not.toMatch(/\b\d+\.\d+\.\d+\b/);
        }
    });
});
