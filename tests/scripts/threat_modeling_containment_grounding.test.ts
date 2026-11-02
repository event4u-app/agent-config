/**
 * Containment prompts — maintenance mode, a kill switch, break-glass, shutting a
 * product down on a disclosed vulnerability — ground to the `containment` class
 * with a containment threat row (road-to-a-switch-built-before-it-is-needed 2.1,
 * ADR-304). Before that class existed they landed on nothing.
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

const CONTAINMENT = [
    'add a maintenance mode to the admin area',
    'kill switch to disable the app when a vulnerability is disclosed',
    'break-glass access for the operator when the site is down',
    'Wartungsmodus und Notabschaltung bei Sicherheitslücken',
    'feature flag to turn off uploads during an incident',
];

const CLASSES = (rows: Row[]) => rows.map((t) => t['Surface Class']);

describe('containment grounding', () => {
    it.each(CONTAINMENT)('grounds %j to containment with a containment threat row', async (q) => {
        const g = await groundQuery(q);
        expect(g.category).toBe('containment');
        expect(CLASSES([g.selections.threats.best, ...g.selections.threats.alternatives])).toContain('containment');
    });

    it('a login form is not a containment surface', async () => {
        const g = await groundQuery('login form with password reset');
        expect(g.category).not.toBe('containment');
    });

    it('the corpus names the lockout, fail-open, timer-release and poisoned-advisory classes', () => {
        const rows = readCsv(path.join(DATA, 'threats.csv')).filter((r) => r['Surface Class'] === 'containment');
        const text = rows.map((r) => `${r['Threat']} ${r['Abuse Case']}`).join(' ').toLowerCase();
        for (const needle of [/locks? out/, /fails? open/, /timer|expiry/, /advisory/, /backups?/, /query string|url secret/, /no lever/]) {
            expect(text).toMatch(needle);
        }
        expect(rows.every((r) => /Decided by:/.test(r['Negative Tests'] ?? ''))).toBe(true);
    });
});
