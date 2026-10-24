/**
 * Seed the two lineage ledgers from the provenance stores that already exist.
 *
 * Tracked side: one `mechanisms.jsonl` row per `harvests.jsonl` row — id, verdict, the
 * asserting artefact and the date carried over, nothing else. `harvests.jsonl` stays, so
 * every citation keeps resolving.
 *
 * Local side: every harvest `source_ref` and every `skills-provenance.yml` entry becomes a
 * sealed source plus an edge to its mechanism. Nothing is invented on the way: an opaque
 * harvest ref has no revision, so its edge records `pin: unknown`; a skills entry keeps the
 * sealed pin it already carries. The tracked yml is read, never written.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { canonicalize } from '../harvest_reference_tokens.js';
import type { HarvestRecord, MechanismRecord } from '../lint_harvest_provenance.js';
import { PIN_UNKNOWN, type EdgeRow, type Ledger, type SourceKind, type SourceRow } from './lineage_ledger.js';
import { decrypt, encrypt, is_token } from './link_crypto.js';
import { sourceId } from './source_id.js';

export const HARVESTS_REL = 'provenance/harvests.jsonl';
export const SKILLS_PROVENANCE_REL = 'agents/settings/contexts/skills-provenance.yml';

export function seedMechanismsFromHarvests(harvests: readonly HarvestRecord[]): MechanismRecord[] {
    return harvests.map((h) => ({
        mechanism_id: h.harvest_id,
        verdict: h.verdict,
        realised_in: [h.stated_in],
        decided_at: h.harvested_at,
    }));
}

const PINNED_REF_RE = /^(.+)@([0-9a-fA-F]{7,64})$/;

function kindOf(identity: string): SourceKind {
    if (identity.startsWith('opaque:')) return 'unknown';
    return canonicalize(identity) === null ? 'url' : 'repo';
}

export interface ImportResult {
    readonly ledger: Ledger;
    /** One line per entry that could not be imported, naming why. Never a guess in its place. */
    readonly refused: string[];
}

function readHarvests(root: string): HarvestRecord[] {
    const file = path.join(root, HARVESTS_REL);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as HarvestRecord);
}

/** Build the local rows for `root` without writing anything. `keys[0]` seals; all keys decrypt. */
export function buildLocalImport(root: string, keys: readonly string[]): ImportResult {
    const key = keys[0] as string;
    const sources = new Map<string, SourceRow>();
    const edges: EdgeRow[] = [];
    const refused: string[] = [];
    const addSource = (identity: string, sealed: string, license: string): string => {
        const id = sourceId(identity, key);
        if (!sources.has(id)) sources.set(id, { source_id: id, kind: kindOf(identity), identity: sealed, license, watch: false });
        return id;
    };

    for (const h of readHarvests(root)) {
        let identity = h.source_ref;
        let pin: string = PIN_UNKNOWN;
        if (is_token(h.source_ref)) {
            try {
                identity = decrypt(h.source_ref, [...keys]);
            } catch (e) {
                refused.push(`${h.harvest_id}: source_ref does not decrypt with the configured key (${(e as Error).message})`);
                continue;
            }
        } else if (!identity.startsWith('opaque:')) {
            const m = PINNED_REF_RE.exec(identity);
            if (m) {
                identity = m[1] as string;
                pin = encrypt(m[2] as string, key);
            }
        }
        const id = addSource(identity, encrypt(identity, key), 'unknown');
        edges.push({ source_id: id, mechanism_id: h.harvest_id, pin, locator: encrypt(h.evidence_locator, key) });
    }

    const ymlFile = path.join(root, SKILLS_PROVENANCE_REL);
    if (fs.existsSync(ymlFile)) {
        const doc = (parseYaml(fs.readFileSync(ymlFile, 'utf-8')) ?? {}) as Record<string, Record<string, unknown> | null>;
        for (const [skill, entry] of Object.entries(doc)) {
            const sealedSource = entry?.source_enc;
            if (typeof sealedSource !== 'string' || !is_token(sealedSource)) {
                refused.push(`${skill}: no sealed source_enc`);
                continue;
            }
            let identity: string;
            try {
                identity = decrypt(sealedSource, [...keys]);
            } catch (e) {
                refused.push(`${skill}: source_enc does not decrypt with the configured key (${(e as Error).message})`);
                continue;
            }
            const pinned = entry?.pinned_to_enc;
            const license = typeof entry?.license === 'string' && entry.license !== '' ? entry.license : 'unknown';
            const id = addSource(identity, sealedSource, license);
            edges.push({ source_id: id, mechanism_id: skill, pin: typeof pinned === 'string' && is_token(pinned) ? pinned : PIN_UNKNOWN, locator: null });
        }
    }
    return { ledger: { sources: [...sources.values()], edges }, refused };
}
