/**
 * The one vocabulary of the code graph: every node kind and every relation, per
 * lane, with the direction each relation runs in.
 *
 * Nothing outside this file may introduce a kind or a relation. `CodeNode.kind`
 * and `Relation` in `types.ts` are derived from it, the lane merge refuses a
 * fact whose kind is absent here, and a test scans the readers for kinds this
 * file does not list. A lane is capped so the map stays a map: a new kind has to
 * displace one or argue for a higher cap in the same change.
 *
 * Directions: a relation lists the kinds it may start from and end at; `*` is
 * any kind of the code lane (files and symbols). A relation is read in its
 * stated direction only — `supersedes` points from the newer decision to the
 * older one, never the other way.
 */

/** Bump on any change to a kind, a relation or a direction. */
export const VOCABULARY_VERSION = 1;

/** Maximum kinds and relations a lane may own. */
export const LANE_CAP = { kinds: 14, relations: 18 } as const;

export const LANES = ['code', 'data', 'interfaces', 'runtime', 'delivery', 'history', 'decisions', 'flows'] as const;
export type Lane = (typeof LANES)[number];

interface RelationDef {
    readonly from: readonly string[];
    readonly to: readonly string[];
}

export const VOCABULARY = {
    code: {
        kinds: ['file', 'class', 'interface', 'trait', 'function', 'method', 'constant', 'type', 'enum', 'skipped', 'route'],
        relations: {
            calls: { from: ['*', 'job', 'workflow'], to: ['*', 'workflow', 'action'] },
            imports: { from: ['*'], to: ['*'] },
            uses: { from: ['*', 'job', 'workflow'], to: ['*', 'column', 'action', 'image'] },
            inherits: { from: ['*'], to: ['*'] },
            member: { from: ['*', 'table', 'service'], to: ['*', 'route', 'column', 'operation'] },
            tests: { from: ['*'], to: ['*'] },
            'routes-to': { from: ['route', '*', 'target', 'resource'], to: ['*', 'service', 'resource'] },
            renders: { from: ['*'], to: ['*'] },
            includes: { from: ['*', 'workflow'], to: ['*', 'workflow'] },
            injects: { from: ['*'], to: ['*'] },
            documents: { from: ['*'], to: ['*'] },
        },
    },
    data: {
        kinds: ['table', 'column'],
        relations: {
            migrates: { from: ['*'], to: ['table'] },
            persists: { from: ['*'], to: ['table'] },
            relates: { from: ['*'], to: ['*'] },
            references: { from: ['table', 'column', 'resource'], to: ['table', 'column', 'resource'] },
            reads: { from: ['*'], to: ['*', 'column', 'table'] },
            writes: { from: ['*'], to: ['column', 'table'] },
        },
    },
    interfaces: {
        kinds: ['service', 'operation'],
        relations: {
            'calls-out': { from: ['*'], to: ['service', 'operation'] },
            'configured-by': { from: ['service', 'resource', 'workflow', 'job'], to: ['*', 'env-var', 'resource'] },
            'described-by': { from: ['service', 'operation'], to: ['file'] },
        },
    },
    runtime: {
        kinds: ['resource', 'environment', 'env-var', 'image', 'network', 'port', 'volume', 'target'],
        relations: {
            'deploys-to': { from: ['job', 'workflow', 'resource', 'image'], to: ['environment', 'resource', 'service'] },
            'based-on': { from: ['image', 'service'], to: ['image'] },
            'uses-image': { from: ['service', 'resource', 'job'], to: ['image'] },
            'depends-on': { from: ['service', 'resource', 'target'], to: ['service', 'resource', 'target'] },
            connects: { from: ['service', 'resource'], to: ['service', 'resource'] },
            publishes: { from: ['service', 'resource', 'image'], to: ['port'] },
            mounts: { from: ['service', 'resource'], to: ['volume'] },
            'on-network': { from: ['service', 'resource'], to: ['network'] },
            'owned-by': { from: ['resource'], to: ['resource'] },
            selects: { from: ['resource', 'target'], to: ['resource', 'service'] },
            'resolves-to': { from: ['target', 'resource', 'service'], to: ['resource', 'service', 'target'] },
        },
    },
    delivery: {
        kinds: ['workflow', 'job', 'action', 'trigger'],
        relations: {
            triggers: { from: ['workflow', 'job', 'trigger'], to: ['workflow', 'job'] },
            needs: { from: ['job'], to: ['job'] },
            contains: { from: ['workflow'], to: ['job', 'trigger', 'action'] },
            builds: { from: ['job'], to: ['image'] },
            delivers: { from: ['job', 'image'], to: ['environment', 'image', 'resource'] },
            consumes: { from: ['job', 'workflow'], to: ['image', 'action', 'job'] },
        },
    },
    history: {
        kinds: [],
        relations: {
            'co-changes': { from: ['file'], to: ['file'] },
        },
    },
    decisions: {
        kinds: ['decision'],
        relations: {
            governs: { from: ['decision'], to: ['*', 'table', 'column', 'service', 'operation', 'resource', 'environment', 'workflow', 'job'] },
            supersedes: { from: ['decision'], to: ['decision'] },
        },
    },
    flows: {
        kinds: ['flow'],
        relations: {},
    },
} as const satisfies Record<Lane, { kinds: readonly string[]; relations: Record<string, RelationDef> }>;

type V = typeof VOCABULARY;
/** Every node kind the graph may carry. */
export type VocabKind = { [L in Lane]: V[L]['kinds'][number] }[Lane];
/** Every relation the graph may carry. */
export type VocabRelation = { [L in Lane]: keyof V[L]['relations'] & string }[Lane];

const CODE_KINDS: ReadonlySet<string> = new Set(VOCABULARY.code.kinds);

/** All kinds, all relations, and each relation's lane and direction. */
export const KINDS: ReadonlySet<string> = new Set(LANES.flatMap((l) => [...VOCABULARY[l].kinds]));
export const RELATIONS: ReadonlyMap<string, { lane: Lane } & RelationDef> = new Map(
    LANES.flatMap((l) => Object.entries(VOCABULARY[l].relations as Record<string, RelationDef>).map(([r, d]) => [r, { lane: l, ...d }] as const)),
);

export function laneOfKind(kind: string): Lane | undefined {
    return LANES.find((l) => (VOCABULARY[l].kinds as readonly string[]).includes(kind));
}

const matches = (allowed: readonly string[], kind: string): boolean => allowed.includes(kind) || (allowed.includes('*') && CODE_KINDS.has(kind));

/** Why an edge of `relation` from a `fromKind` node to a `toKind` node breaks the vocabulary, or null. */
export function directionError(relation: string, fromKind: string | undefined, toKind: string | undefined): string | null {
    const def = RELATIONS.get(relation);
    if (!def) return `relation "${relation}" is not in the vocabulary`;
    if (fromKind !== undefined && !matches(def.from, fromKind)) return `"${relation}" may not start at a ${fromKind}`;
    if (toKind !== undefined && !matches(def.to, toKind)) return `"${relation}" may not end at a ${toKind}`;
    return null;
}

/** Vocabulary breaches of a graph-shaped value: unknown kinds, unknown relations, reversed directions. */
export function vocabularyErrors(g: { nodes: ReadonlyArray<{ id: string; kind: string }>; edges: ReadonlyArray<{ source: string; target: string; relation: string }> }): string[] {
    const errors: string[] = [];
    const kindOf = new Map(g.nodes.map((n) => [n.id, n.kind]));
    for (const n of g.nodes) if (!KINDS.has(n.kind)) errors.push(`node ${n.id}: kind "${n.kind}" is not in the vocabulary`);
    for (const e of g.edges) {
        const err = directionError(e.relation, kindOf.get(e.source), kindOf.get(e.target));
        if (err) errors.push(`edge ${e.source} -> ${e.target}: ${err}`);
    }
    return errors;
}
