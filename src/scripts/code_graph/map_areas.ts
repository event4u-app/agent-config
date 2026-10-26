/**
 * The knowledge areas beside Code — Data, Interfaces, Runtime, Delivery,
 * Impact, Agent — as `map.json` carries them in its top-level `areas` section.
 *
 * Each area is filled by its own reader. A reader that did not run leaves its
 * key out, and the viewer shows the area with "no data yet" and the reason; a
 * reader that ran and found nothing writes its payload with `empty` set. Every
 * fact carries a witness: the file and line it was read from, a hash of what
 * was read there, and the confirm state that hash had against the working tree
 * when the map was written. Nothing here is fetched from a database, a cloud,
 * a daemon or an endpoint, and no `.env` value is ever a field: configuration
 * appears by NAME only.
 *
 * `map.json` is `{ meta, model, areas }`; `model.areas` is something else — the
 * Louvain groups of the Code area.
 */

/** Area ids in nav order after Overview and Code. */
export const KNOWLEDGE_AREA_IDS = ['data', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'] as const;
export type KnowledgeAreaId = (typeof KNOWLEDGE_AREA_IDS)[number];

/**
 * A witness against the working tree after `confirm` re-read it. `unconfirmed`
 * means nobody re-read it since the index: an index fact, not a checked one.
 * `added` is a fact the working-tree overlay holds that the committed index does not.
 */
export type ConfirmState = 'confirmed' | 'moved' | 'changed' | 'gone' | 'added' | 'unconfirmed';
export const CONFIRM_STATES: readonly ConfirmState[] = ['confirmed', 'moved', 'changed', 'gone', 'added', 'unconfirmed'];

/** T1 code or migration · T2 committed dump or contract · T3 user-produced snapshot · T4 framework oracle output. */
export type SourceRung = 'T1' | 'T2' | 'T3' | 'T4';

/** Whether a reader saw all of its population: a partial read makes every count a lower bound. */
export type Completeness = 'complete' | 'partial' | 'unknown';

export interface Witness {
    /** Repository-relative POSIX path; never absolute, never `..`. */
    file: string;
    /** 1-based line of the span that was read. */
    line: number;
    /** Hex digest of the span as read when the fact was recorded. */
    hash: string;
    confirm: ConfirmState;
    rung?: SourceRung;
}

/** One drift finding: rule id from its family (`DR-` data, `IF-` interfaces, `RT-` runtime, `DL-` delivery). */
export interface AreaFinding {
    id: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    /** What it is about: `table.column`, a service, a job. */
    subject: string;
    message: string;
    /** The rule's title, e.g. `code relation without a foreign key`. */
    title?: string;
    /** `advice` informs; `gate` blocks once its precision is recorded. */
    tier?: 'advice' | 'gate';
    /** The fix the rule proposes; the map never applies it. */
    fix?: string;
    /** Both sides when the finding compares two facts. */
    witnesses: Witness[];
    /** The engine a rule is specific to (`mysql`, `postgres`), when it is. */
    engine?: string;
    completeness: Completeness;
}

export interface AreaPayloadBase {
    /** The reader that wrote the payload, shown in the area header. */
    reader: string;
    completeness: Completeness;
    /** Set when the reader ran and found nothing; shown as the area's reason. */
    empty?: string;
    findings: AreaFinding[];
}

// Data — tables, columns, keys, ORM relations.

export interface DataColumn {
    name: string;
    type: string;
    nullable: boolean;
    key?: 'pk' | 'fk' | 'uk' | 'ix';
    witness: Witness;
    /**
     * The column as the actual schema (a T3 snapshot or T4 oracle file) has it;
     * `null` when that schema covers the table and lacks the column. Absent when
     * no actual schema covers the table.
     */
    actual?: { type: string; nullable: boolean; family?: string; witness: Witness } | null;
    /** The type family the drift rules compare (`integer`, `text`, `timestamp` …), so the page agrees with DR-11. */
    family?: string;
    /** Where the code reads or writes the column by a literal name; absent when it never does. */
    code?: { reads: Witness[]; writes: Witness[] };
}

export interface DataTable {
    name: string;
    /** The connection the table lives on (`default` when the code names none). */
    connection: string;
    columns: DataColumn[];
    /** Files of the models that persist to this table. */
    models: string[];
    witness: Witness;
}

export interface DataForeignKey {
    from: { table: string; column: string };
    to: { table: string; column: string };
    onDelete?: string;
    onUpdate?: string;
    witness: Witness;
}

export interface DataRelation {
    kind: '1:1' | '1:n' | 'n:1' | 'n:m' | 'polymorphic';
    /** Model or table names. */
    from: string;
    to: string;
    /** Key column the relation uses, when the code names one. */
    key?: string;
    witness: Witness;
}

export interface DataPayload extends AreaPayloadBase {
    engine?: string;
    /** Files the actual schema was read from (T3 snapshots, T4 oracle output). */
    actualSources?: string[];
    /** One Mermaid ERD page per cluster of tables joined by foreign keys; `tables` holds `DataTable.name`s. */
    erd?: Array<{ cluster: string; file: string; tables: string[] }>;
    tables: DataTable[];
    foreignKeys: DataForeignKey[];
    relations: DataRelation[];
}

// Interfaces — external services and the operations the code calls.

export interface InterfaceParam {
    name: string;
    type?: string;
    required: boolean;
}

export interface InterfaceOperation {
    name: string;
    /** HTTP method, SOAP action or RPC name, when the protocol has one. */
    method?: string;
    path?: string;
    params: InterfaceParam[];
    /** Call sites in this tree. */
    callers: Witness[];
    /** Where the contract declares the operation, when a contract is in the tree. */
    contract?: Witness;
    witness: Witness;
}

export interface InterfaceService {
    name: string;
    protocol: 'rest' | 'soap' | 'graphql' | 'grpc' | 'sdk' | 'webhook' | 'unknown';
    direction: 'outbound' | 'inbound';
    /** Configuration NAMES the service is bound through (`PARTNER_URL`); never their values. */
    configNames: string[];
    operations: InterfaceOperation[];
    /** Contract files in the tree that describe the service. */
    contracts?: string[];
    /** Hosts written in code for the service (names only). */
    hosts?: string[];
    witness: Witness;
}

export interface InterfacesPayload extends AreaPayloadBase {
    services: InterfaceService[];
}

// Runtime — infrastructure resources, environments, services and ports.

export interface RuntimePort {
    /** Host port; absent when the service only exposes a container port. */
    published?: number;
    target: number;
    protocol?: 'tcp' | 'udp';
}

export interface RuntimeService {
    name: string;
    image?: string;
    ports: RuntimePort[];
    networks: string[];
    /** Environment variable NAMES the service declares; never values. */
    envNames: string[];
    environment?: string;
    /** Named volumes and bind sources the service mounts, with the path inside the container. */
    volumes?: Array<{ name: string; target: string }>;
    /** Services this one declares it depends on, by name as written. */
    dependsOn?: string[];
    witness: Witness;
}

/** A declared reference between two resources; `to` may name a resource no file declares. */
export interface RuntimeLink {
    from: string;
    to: string;
    /** Graph relation: `references`, `connects`, `routes-to`, `selects`, `owned-by`, `configured-by`. */
    relation: string;
    /** How the files express it, e.g. `aws_security_group_rule`, `envFrom`. */
    mechanism?: string;
    witness: Witness;
}

export interface RuntimeResource {
    name: string;
    /** Provider type, e.g. `aws_db_instance`, `Deployment`. */
    type: string;
    module?: string;
    /** Environments the resource is declared for. */
    environments: string[];
    witness: Witness;
}

export interface RuntimePayload extends AreaPayloadBase {
    environments: string[];
    resources: RuntimeResource[];
    services: RuntimeService[];
    links?: RuntimeLink[];
}

// Delivery — workflows, jobs and the build → image → deploy chain.

export interface DeliveryWorkflow {
    /** Repository-relative workflow file. */
    file: string;
    name: string;
    triggers: string[];
    /** Each trigger's event with its branch filter as written (an empty list filters nothing), whether a path filter narrows it, and the one job it gates when it is a job's own rule. */
    events?: Array<{ event: string; branches: string[]; paths: boolean; job?: string }>;
    witness: Witness;
}

export interface DeliveryJob {
    /** Unique within the payload: `<workflow file>#<job id>`. */
    id: string;
    workflow: string;
    name: string;
    needs: string[];
    environment?: string;
    /** The job's condition as written; the map never evaluates it. */
    condition?: string;
    /** Reusable workflows and actions the job uses. */
    uses: string[];
    system?: 'github' | 'gitlab';
    /** The CI system's own stage name, where it has one (GitLab). */
    stage?: string;
    /** Branch restrictions the job itself declares; `<default>` is the default branch. */
    branches?: string[];
    isTest?: boolean;
    isDeploy?: boolean;
    witness: Witness;
}

export interface DeliveryChainStep {
    kind: 'build' | 'image' | 'deploy';
    name: string;
    environment?: string;
    /** Job id this step runs in. */
    job?: string;
    witness: Witness;
}

export interface DeliveryPayload extends AreaPayloadBase {
    workflows: DeliveryWorkflow[];
    jobs: DeliveryJob[];
    environments: string[];
    chain: DeliveryChainStep[];
}

// Impact — what a working diff reaches, across the areas.

export type ImpactLayer = 'code' | 'tests' | 'data' | 'interfaces' | 'runtime' | 'delivery';

export interface ImpactItem {
    layer: ImpactLayer;
    name: string;
    /** Why it is affected, as a relation from a changed fact. */
    why: string;
    witness: Witness;
}

export interface ImpactRiskTerm {
    term: string;
    /** The graph fact the term counts, in words. */
    fact: string;
    contribution: number;
    /** How many facts the term counted and the weight each one carries: contribution = count × weight. */
    count?: number;
    weight?: number;
    witness?: Witness;
}

export interface ImpactPayload extends AreaPayloadBase {
    /** The rev the working tree was diffed against. */
    rev: string;
    changed: string[];
    affected: ImpactItem[];
    risk?: { total: number; terms: ImpactRiskTerm[] };
}

// Agent — the verbs an agent calls and the context pack it gets.

export interface AgentVerb {
    /** The graph verb as the CLI names it. `explain` is the 2-hop neighbourhood query, never generated prose. */
    name: string;
    /** The question it answers. */
    answers: string;
    /** `agent-config code-graph <verb> …` */
    cli: string;
    /** The MCP tool that answers the same, when there is one. */
    mcp?: string;
    /** What the verb takes, what it returns, and what it guarantees about the answer. */
    input?: string;
    output?: string;
    guarantee?: string;
}

export interface AgentPackItem {
    kind: string;
    name: string;
    why: string;
    tokens: number;
    witness: Witness;
}

export interface AgentPayload extends AreaPayloadBase {
    verbs: AgentVerb[];
    contextPack?: {
        returned: number;
        total: number;
        hasMore: boolean;
        budgetTokens: number;
        usedTokens: number;
        items: AgentPackItem[];
    };
}

/** A guided walk over facts; a step whose input hash no longer matches is stale. */
export interface MapTour {
    id: string;
    title: string;
    steps: Array<{
        /** Route the step opens: `code`, `data`, … */
        area: 'code' | KnowledgeAreaId;
        /** Key of the item the step selects within that area. */
        item?: string;
        text: string;
        inputHash: string;
        state: 'fresh' | 'stale';
    }>;
}

export interface MapAreas {
    data?: DataPayload;
    interfaces?: InterfacesPayload;
    runtime?: RuntimePayload;
    delivery?: DeliveryPayload;
    impact?: ImpactPayload;
    agent?: AgentPayload;
    tours?: MapTour[];
}

/** Every witness in the areas section, each with a label naming the fact it backs. */
export function witnessesOf(areas: MapAreas): Array<[string, Witness]> {
    const out: Array<[string, Witness]> = [];
    const push = (where: string, w: Witness | undefined): void => {
        if (w) out.push([where, w]);
    };
    const findings = (id: string, list: AreaFinding[] | undefined): void => {
        for (const f of list ?? []) for (const w of f.witnesses) push(`${id} finding ${f.id}`, w);
    };
    const d = areas.data;
    if (d) {
        for (const t of d.tables) {
            push(`data table ${t.name}`, t.witness);
            for (const c of t.columns) {
                push(`data column ${t.name}.${c.name}`, c.witness);
                push(`data actual column ${t.name}.${c.name}`, c.actual?.witness);
                for (const w of c.code?.reads ?? []) push(`data read of ${t.name}.${c.name}`, w);
                for (const w of c.code?.writes ?? []) push(`data write of ${t.name}.${c.name}`, w);
            }
        }
        for (const k of d.foreignKeys) push(`data fk ${k.from.table}.${k.from.column}`, k.witness);
        for (const r of d.relations) push(`data relation ${r.from} → ${r.to}`, r.witness);
        findings('data', d.findings);
    }
    const i = areas.interfaces;
    if (i) {
        for (const s of i.services) {
            push(`interfaces service ${s.name}`, s.witness);
            for (const o of s.operations) {
                push(`interfaces operation ${o.name}`, o.witness);
                push(`interfaces contract ${o.name}`, o.contract);
                for (const c of o.callers) push(`interfaces caller of ${o.name}`, c);
            }
        }
        findings('interfaces', i.findings);
    }
    const r = areas.runtime;
    if (r) {
        for (const x of r.resources) push(`runtime resource ${x.name}`, x.witness);
        for (const x of r.services) push(`runtime service ${x.name}`, x.witness);
        for (const x of r.links ?? []) push(`runtime link ${x.from} → ${x.to}`, x.witness);
        findings('runtime', r.findings);
    }
    const v = areas.delivery;
    if (v) {
        for (const x of v.workflows) push(`delivery workflow ${x.name}`, x.witness);
        for (const x of v.jobs) push(`delivery job ${x.id}`, x.witness);
        for (const x of v.chain) push(`delivery chain ${x.name}`, x.witness);
        findings('delivery', v.findings);
    }
    const m = areas.impact;
    if (m) {
        for (const x of m.affected) push(`impact ${x.name}`, x.witness);
        for (const x of m.risk?.terms ?? []) push(`impact risk ${x.term}`, x.witness);
        findings('impact', m.findings);
    }
    const a = areas.agent;
    if (a) {
        for (const x of a.contextPack?.items ?? []) push(`agent pack ${x.name}`, x.witness);
        findings('agent', a.findings);
    }
    return out;
}

/**
 * What would make a payload unsafe or unreadable on the page: a witness that is
 * not a repository-relative path (it would put a host path into a committed
 * artefact), a line that is not a positive integer, a missing hash, an unknown
 * confirm state. Empty when the section is sound.
 */
export function areaProblems(areas: MapAreas): string[] {
    const problems: string[] = [];
    for (const [where, w] of witnessesOf(areas)) {
        if (typeof w.file !== 'string' || w.file === '' || w.file.startsWith('/') || /^[a-z]:/i.test(w.file) || w.file.includes('\\') || w.file.split('/').includes('..')) {
            problems.push(`${where}: witness file must be a repository-relative POSIX path, got ${JSON.stringify(w.file)}`);
        }
        if (!Number.isInteger(w.line) || w.line < 1) problems.push(`${where}: witness line must be a positive integer, got ${String(w.line)}`);
        if (typeof w.hash !== 'string' || !/^[0-9a-f]{6,}$/i.test(w.hash)) problems.push(`${where}: witness hash must be hex, got ${JSON.stringify(w.hash)}`);
        if (!CONFIRM_STATES.includes(w.confirm)) problems.push(`${where}: unknown confirm state ${JSON.stringify(w.confirm)}`);
    }
    for (const key of Object.keys(areas)) {
        if (key !== 'tours' && !(KNOWLEDGE_AREA_IDS as readonly string[]).includes(key)) problems.push(`unknown area '${key}'`);
    }
    return problems;
}

/** One line per area for MAP.md: what the reader found, or that no reader ran. */
export function areaSummaryLines(areas: MapAreas): string[] {
    const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
    return KNOWLEDGE_AREA_IDS.map((id) => {
        const p = areas[id];
        if (!p) return `- ${id}: no data yet — no reader for this area ran on this tree`;
        if (p.empty) return `- ${id}: ${p.reader} found nothing — ${p.empty}`;
        let what: string;
        switch (id) {
            case 'data': {
                const d = p as DataPayload;
                what = `${count(d.tables.length, 'table', 'tables')}, ${count(d.foreignKeys.length, 'foreign key', 'foreign keys')}, ${count(d.relations.length, 'relation', 'relations')}`;
                break;
            }
            case 'interfaces': {
                const s = (p as InterfacesPayload).services;
                what = `${count(s.length, 'service', 'services')}, ${count(s.reduce((n, x) => n + x.operations.length, 0), 'operation', 'operations')}`;
                break;
            }
            case 'runtime': {
                const r = p as RuntimePayload;
                what = `${count(r.resources.length, 'resource', 'resources')}, ${count(r.services.length, 'service', 'services')}, ${count(r.environments.length, 'environment', 'environments')}`;
                break;
            }
            case 'delivery': {
                const v = p as DeliveryPayload;
                what = `${count(v.workflows.length, 'workflow', 'workflows')}, ${count(v.jobs.length, 'job', 'jobs')}`;
                break;
            }
            case 'impact': {
                const m = p as ImpactPayload;
                what = `${count(m.changed.length, 'changed file', 'changed files')} since ${m.rev}, ${count(m.affected.length, 'affected item', 'affected items')}`;
                break;
            }
            default:
                what = count((p as AgentPayload).verbs.length, 'verb', 'verbs');
        }
        const lower = p.completeness === 'complete' ? '' : ` (${p.completeness} read: counts are lower bounds)`;
        return `- ${id}: ${what}, ${count(p.findings.length, 'finding', 'findings')} — ${p.reader}${lower}`;
    });
}
