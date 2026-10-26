/**
 * The record every lane reader emits before it is merged into the code graph.
 *
 * A lane reader (data, interfaces, runtime, delivery, history, decisions, flows)
 * reads files only — never a network, a daemon or a `.env` value — and returns
 * facts in this one shape so a single merge step can turn them into graph nodes
 * and edges. Every fact carries the witness it was read from; the graph is an
 * index of these witnesses, never the truth (ADR-303).
 */

/** Where a fact came from, on the source ladder. */
export type SourceRung =
    /** code, migrations, manifests, workflow and IaC files in the repository */
    | 'T1'
    /** committed dumps and contract files (OpenAPI, WSDL, SDL, .proto) */
    | 'T2'
    /** a snapshot file the user produced (schema-only dump, `docker compose config`) */
    | 'T3'
    /** a framework oracle's output file */
    | 'T4';

export interface Witness {
    /** repository-relative path, forward slashes */
    file: string;
    /** 1-based line of the span's first line */
    line: number;
    /** short hash of the exact span text that was read; see `spanHash` */
    hash: string;
}

export interface LaneFact {
    /** a kind from the shared vocabulary file */
    kind: string;
    /** stable id, unique within its kind, derived from content — never positional */
    id: string;
    /** human label */
    name: string;
    /** typed attributes; names and declared values only, never a secret value */
    attrs: Record<string, string | number | boolean | string[] | null>;
    witness: Witness;
    rung: SourceRung;
    /** the file that owns this fact: replacing the file replaces exactly its facts */
    owner: string;
}

export interface LaneRelation {
    /** a relation from the shared vocabulary file */
    relation: string;
    from: string;
    to: string;
    attrs: Record<string, string | number | boolean | string[] | null>;
    witness: Witness;
    rung: SourceRung;
    owner: string;
    /** true when the link rests on a name match rather than a stated mechanism */
    guess: boolean;
}

/**
 * Attributes a lane derives about a fact another reader owns (a table's soft
 * deletes, a column's referenced table). Every key carries the lane as prefix
 * (`data:soft_deletes`), so a re-merge of the lane removes exactly what it added.
 */
export interface LaneAnnotation {
    /** the graph node the attributes belong to */
    id: string;
    attrs: Record<string, string | number | boolean | string[] | null>;
}

export interface LaneOutput {
    lane: 'data' | 'interfaces' | 'runtime' | 'delivery' | 'history' | 'decisions' | 'flows';
    facts: LaneFact[];
    relations: LaneRelation[];
    annotations?: LaneAnnotation[];
    /** files the reader looked at and could not read, with the reason */
    skipped: { file: string; reason: string }[];
}

/** FNV-1a over the span text, 8 hex chars: cheap, stable, enough to tell "changed". */
export function spanHash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
