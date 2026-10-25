/**
 * G2 — the threat-modeling corpus grounds a conversational ownership claim to
 * the `delegated-action` class, and a description that matches two surface
 * classes never prints `Evidence gap: none` while one of them is dropped.
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

const INCIDENT = 'AI support chatbot tool that changes the account email for a user who names their username';

const DELEGATED = [
    INCIDENT,
    'LLM agent tool calling MCP server function that updates customer records',
    'give the AI agent a function to change account settings on behalf of the user',
    'build an MCP server tool that resets a user password',
    'helpdesk assistant performs account recovery for a caller who says the account is theirs',
];

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

describe('G2 — delegated-action grounding', () => {
    it.each(DELEGATED)('grounds %j to delegated-action', async (q) => {
        const g = await groundQuery(q);
        expect(g.category).toBe('delegated-action');
        const threats = [g.selections.threats.best, ...g.selections.threats.alternatives];
        expect(threats.map((t) => t['Surface Class'])).toContain('delegated-action');
    });

    it('the incident query no longer reports a clean evidence gap while dropping authentication', async () => {
        const g = await groundQuery(INCIDENT);
        expect(g.evidence_gap.some((x) => x.startsWith('none'))).toBe(false);
        expect(g.evidence_gap.join('\n')).toMatch(/authentication/);
    });

    it('a composite description names the dropped class in the evidence gap', async () => {
        const g = await groundQuery('billing refund endpoint that also accepts an uploaded csv file import');
        const classes = ['billing', 'file-upload'];
        expect(classes).toContain(g.category);
        const dropped = classes.find((c) => c !== g.category) as string;
        expect(g.evidence_gap.join('\n')).toContain(`'${dropped}'`);
    });

    it('a single-class description keeps its clean gap', async () => {
        const g = await groundQuery('terraform security group ingress cidr for the database subnet');
        expect(g.category).toBe('infrastructure');
        expect(g.evidence_gap.join('\n')).not.toMatch(/also matches/);
    });

    it('six delegated-action threat rows, each with controls and a non-empty negative test', () => {
        const rows = readCsv(path.join(DATA, 'threats.csv')).filter((r) => r['Surface Class'] === 'delegated-action');
        expect(rows).toHaveLength(6);
        for (const r of rows) {
            expect(r['Abuse Case']?.length, r.Threat).toBeGreaterThan(40);
            expect(r['Required Controls']?.length, r.Threat).toBeGreaterThan(40);
            expect(r['Negative Tests'], r.Threat).toMatch(/^Test: .{20,}/);
        }
    });

    it('every surface class has a reasoning rule', () => {
        const classes = new Set(readCsv(path.join(DATA, 'surfaces.csv')).map((r) => r['Surface Class']));
        const ruled = new Set(readCsv(path.join(DATA, 'reasoning.csv')).map((r) => r.Surface_Class));
        for (const c of classes) expect(ruled.has(c), c).toBe(true);
    });

    it('the identity-change row is actor-neutral and tests the delegated actor', () => {
        const row = readCsv(path.join(DATA, 'threats.csv')).find((r) =>
            r.Threat?.startsWith('Identity or credential change'),
        ) as Row;
        expect(row['Abuse Case']).toMatch(/an AI assistant acting on a request/);
        expect(row['Negative Tests']).toMatch(/assistant|delegated/i);
    });
});
