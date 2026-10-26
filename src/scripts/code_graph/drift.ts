/**
 * The one drift engine: rules are data, findings have one shape, one tier
 * vocabulary (`advice` · `gate`), one evaluator for every lane.
 *
 * The engine reads one population of facts and relations, built either from a
 * code graph (after the lanes were merged into it) or straight from lane reader
 * outputs. A rule picks facts with a selector and states, in one of a few match
 * shapes, what makes a picked fact a finding:
 *
 *   expect     the fact must also have an edge from or to one end, a node built
 *              from its attributes, or an attribute equal to another fact's;
 *              with no `expect` every picked fact is a finding
 *   fact       every picked fact is a finding; `counter` names the attribute
 *              holding the second witness (a fact id, a `file:line:hash` ref,
 *              or a pair of refs)
 *   collision  picked facts grouped by `key`; a group whose `distinct` attribute
 *              takes two or more values is a finding per extra value
 *   missing    a picked fact whose `key` no fact of `against` carries; silent
 *              while `against` picks nothing (no population to be absent from)
 *   mismatch   a picked fact whose `key` (after `aliases`) is not among the
 *              values `against` carries; silent unless both sides exist
 *   join       a picked fact and the `against` fact with the same key whose
 *              `compare` attributes differ
 *   dangling   a relation whose target is no fact
 *   unreached  a picked fact from which no `target` fact is reachable over `via`
 *
 * Adding a class of drift is a new row in a rule table, never a branch here.
 * Rule ids carry their lane's family (`DR-` data, `IF-` interfaces, `RT-`
 * runtime, `DL-` delivery). A finding carries the witness of the fact that
 * triggered it and the witness it is judged against, the engine and
 * completeness of the schema it belongs to, its tier, and — where the rule has
 * one — a fix proposal as text: the engine never changes anything. A waiver
 * needs a non-empty reason; one without is refused and reported, never silently
 * honoured. Every report prints the basis it was computed from.
 */
import * as fs from 'node:fs';

import { ALL_DRIFT_RULES } from './drift_rules.js';
import type { LaneOutput, SourceRung } from './lanes/lane_fact.js';
import type { CodeGraph } from './types.js';
import { LANES, type Lane, laneOfKind, VOCABULARY_VERSION } from './vocabulary.js';

type AttrValue = string | number | boolean | null;
type Attrs = Record<string, unknown>;

/**
 * An attribute test. A literal is equality, an array of literals is any-of; the
 * object forms read as their names say. `match` is a regular expression.
 */
export type Cond =
    | AttrValue
    | AttrValue[]
    | { eq: AttrValue }
    | { in: AttrValue[] }
    | { not: AttrValue }
    | { exists: boolean }
    | { truthy: true }
    | { minItems: number }
    | { match: string };

/**
 * Which facts a rule looks at. Every given field must match. A `where` key is an
 * attribute of the fact; `source.k` / `target.k` read the nodes at an edge's
 * ends (for a node, both are the node itself); `ctx.k` reads the schema context
 * — the fact's table and that table's connection.
 */
export interface DriftSelect {
    /** Relation(s) to pick edges; omit to pick nodes. */
    edge?: string | string[];
    /** A node kind (with `edge`: the kind of the edge's source). */
    kind?: string | string[];
    to_kind?: string | string[];
    lane?: string;
    rung?: SourceRung[];
    resolved_via?: string;
    attrs?: Record<string, Cond>;
    where?: Record<string, Cond>;
}

/**
 * What must hold for a selected fact. `$source`, `$target` and `$self` name its
 * ends; `{attr.x}`, `{source.attr.x}`, `{target.attr.x}` read attributes.
 */
export type DriftExpect =
    | { edge_from: string; relation: string; to_kind?: string }
    | { edge_to: string; relation: string; from_kind?: string }
    | { node: string }
    | { equal: [string, string]; aliases?: Record<string, string> };

interface RuleHead {
    id: string;
    /** Defaults to the lane of the id's family. */
    lane?: Lane;
    title: string;
    tier: 'advice' | 'gate';
    /** Measured precision on the planted fixtures; a `gate` rule must carry one. */
    precision?: number;
    /** A class the lane reports but another skill judges. */
    handoff?: 'threat-modeling' | null;
    message: string;
    /** A proposal as text; a map by engine picks the variant for the subject's engine (`default` otherwise). */
    fix?: string | Record<string, string>;
    /** Facts the rule does not apply to, by the same keys as `where`. */
    exempt?: Array<Record<string, Cond>>;
    /** The rule stays silent unless at least one fact matches this. */
    requires?: DriftSelect;
}

type AgainstSelect = DriftSelect & { key: string };

export type DriftRule = RuleHead &
    (
        | { match?: 'expect'; select: DriftSelect; expect?: DriftExpect | DriftExpect[]; subject?: string }
        | { match: 'fact'; select: DriftSelect; counter?: string; counter_required?: boolean }
        | { match: 'collision'; select: DriftSelect; key: string[]; distinct: string }
        | { match: 'missing'; select: DriftSelect; key: string; against: AgainstSelect; counter?: string }
        | { match: 'mismatch'; select: DriftSelect; key: string; against: AgainstSelect; aliases?: Record<string, string> }
        | { match: 'join'; select: DriftSelect; key: string; against: AgainstSelect; compare: string[]; aliases?: Record<string, string> }
        | { match: 'dangling'; relation: string | string[]; lane?: Lane }
        | { match: 'unreached'; select: DriftSelect; via: string[]; target: DriftSelect; counter?: string }
    );

export interface Waiver {
    rule: string;
    subject: string;
    reason: string;
}

export interface FindingWitness {
    /** The fact the witness belongs to, when it is one. */
    id: string | null;
    file: string | null;
    line: number | null;
    hash: string | null;
    /** `file:line`, or the file alone when no line is known. */
    at: string | null;
}

export interface DriftFinding {
    rule: string;
    lane: Lane;
    title: string;
    tier: 'advice' | 'gate';
    handoff: 'threat-modeling' | null;
    subject: string;
    /** The fact that drifted, then what it drifted against. */
    subjects: [string, string | null];
    message: string;
    /** The fact that triggered the rule, then the one it is judged against (null when there is none). */
    witnesses: [FindingWitness, FindingWitness | null];
    engine: string;
    completeness: string;
    fix?: string;
    waived?: { reason: string };
}

export interface DriftReport {
    /** What the findings were computed from. */
    basis: {
        input: 'graph' | 'lanes';
        /** The lanes read (`graph` for a whole graph). */
        lane: string;
        graph_checksum: string | null;
        vocabulary_version: number;
        facts: number;
        relations: number;
        skipped: number;
        rules: string[];
        waivers: number;
    };
    findings: DriftFinding[];
    /** Rules and waivers refused before evaluation, with the reason. */
    refused: string[];
}

const FAMILY: Record<string, Lane> = { DR: 'data', IF: 'interfaces', RT: 'runtime', DL: 'delivery' };

export function laneOfRule(r: Pick<DriftRule, 'id' | 'lane'>): Lane | undefined {
    return r.lane ?? FAMILY[r.id.slice(0, 2)];
}

/** Why a rule cannot be evaluated, or null. */
export function ruleError(r: DriftRule): string | null {
    if (!/^[A-Z]{2}-[A-Z0-9]+$/.test(r.id)) return `${r.id}: id must be a family prefix and a number`;
    const fam = FAMILY[r.id.slice(0, 2)];
    if (fam !== undefined && r.lane !== undefined && fam !== r.lane) return `${r.id}: the ${r.id.slice(0, 2)} family belongs to the ${fam} lane, not ${r.lane}`;
    const lane = laneOfRule(r);
    if (lane === undefined || !(LANES as readonly string[]).includes(lane)) return `${r.id}: unknown lane ${String(lane)}`;
    if (r.tier !== 'advice' && r.tier !== 'gate') return `${r.id}: tier must be advice or gate`;
    if (r.tier === 'gate' && typeof r.precision !== 'number') return `${r.id}: a gate rule needs a recorded precision`;
    if (!r.message || !r.title) return `${r.id}: title and message are required`;
    return null;
}

/** Rules from a JSON file holding an array of rules. */
export function loadRules(file: string): DriftRule[] {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    if (!Array.isArray(raw)) throw new Error(`${file}: a rule file holds an array of rules`);
    return raw as DriftRule[];
}

// ---- population -----------------------------------------------------------

interface PWitness {
    file: string | null;
    line: number | null;
    hash: string | null;
}

interface PFact {
    id: string;
    kind: string;
    name: string;
    lane: string;
    rung: SourceRung;
    attrs: Attrs;
    witness: PWitness;
    guess: boolean;
}

interface PRel {
    relation: string;
    from: string;
    to: string;
    lane: string;
    rung: SourceRung;
    attrs: Attrs;
    witness: PWitness;
    guess: boolean;
    resolved_via: string | null;
}

interface Population {
    facts: PFact[];
    relations: PRel[];
    skipped: number;
    checksum: string | null;
    lanes: string;
}

function fromGraph(g: CodeGraph): Population {
    const facts: PFact[] = g.nodes.map((n) => {
        const w = n.fact?.witness;
        const line = n.source_location[0];
        return {
            id: n.id,
            kind: n.kind,
            name: n.label,
            lane: n.fact?.lane ?? laneOfKind(n.kind) ?? 'code',
            rung: n.fact?.rung ?? 'T1',
            attrs: (n.fact?.attrs ?? {}) as Attrs,
            witness: w ? { file: w.file, line: w.line, hash: w.hash } : { file: n.source_file || null, line: line ?? null, hash: null },
            guess: false,
        };
    });
    const nodeWitness = new Map(facts.map((f) => [f.id, f.witness]));
    const relations: PRel[] = g.edges.map((e) => {
        const w = e.fact?.witness;
        return {
            relation: e.relation,
            from: e.source,
            to: e.target,
            lane: e.fact?.lane ?? 'code',
            rung: e.fact?.rung ?? 'T1',
            attrs: (e.fact?.attrs ?? {}) as Attrs,
            witness: w ? { file: w.file, line: w.line, hash: w.hash } : (nodeWitness.get(e.source) ?? { file: null, line: null, hash: null }),
            guess: e.confidence !== 'EXTRACTED',
            resolved_via: e.resolved_via,
        };
    });
    return { facts, relations, skipped: 0, checksum: g.source_checksum, lanes: 'graph' };
}

function fromLanes(outputs: readonly LaneOutput[]): Population {
    const facts: PFact[] = outputs.flatMap((o) =>
        o.facts.map((f) => ({ id: f.id, kind: f.kind, name: f.name, lane: o.lane, rung: f.rung, attrs: f.attrs as Attrs, witness: { ...f.witness }, guess: f.attrs['guess'] === true })),
    );
    const relations: PRel[] = outputs.flatMap((o) =>
        o.relations.map((r) => ({ relation: r.relation, from: r.from, to: r.to, lane: o.lane, rung: r.rung, attrs: r.attrs as Attrs, witness: { ...r.witness }, guess: r.guess, resolved_via: r.guess ? 'name-lookup' : 'lane-read' })),
    );
    return { facts, relations, skipped: outputs.reduce((n, o) => n + o.skipped.length, 0), checksum: null, lanes: [...new Set(outputs.map((o) => o.lane))].join(',') };
}

const isGraph = (x: unknown): x is CodeGraph => typeof x === 'object' && x !== null && 'nodes' in x && 'edges' in x;

// ---- conditions and templates -------------------------------------------

const asList = <T>(v: T | readonly T[] | undefined): readonly T[] => (v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T]);

function holds(v: unknown, c: Cond): boolean {
    if (Array.isArray(c)) return c.some((x) => x === v || (Array.isArray(v) && v.includes(x)));
    if (c !== null && typeof c === 'object') {
        if ('eq' in c) return v === c.eq;
        if ('in' in c) return c.in.some((x) => x === v || (Array.isArray(v) && v.includes(x)));
        if ('not' in c) return v !== c.not;
        if ('exists' in c) return (v !== undefined && v !== null && v !== '') === c.exists;
        if ('truthy' in c) return !!v && (!Array.isArray(v) || v.length > 0);
        if ('minItems' in c) return Array.isArray(v) && v.length >= c.minItems;
        return typeof v === 'string' && new RegExp(c.match).test(v);
    }
    return v === c;
}

/** A fact or relation as the rules see it. */
interface Subject {
    id: string;
    name: string;
    attrs: Attrs;
    witness: PWitness;
    guess: boolean;
    /** For a relation: its ends. For a fact: itself. */
    source: string;
    target: string;
    rung: SourceRung;
    lane: string;
    kind?: string;
    relation?: string;
    resolved_via?: string | null;
    edge: boolean;
}

interface Index {
    byId: Map<string, PFact>;
    out: Map<string, PRel[]>;
    inn: Map<string, PRel[]>;
    ctxOf: (id: string) => Attrs;
}

function buildIndex(p: Population): Index {
    const byId = new Map(p.facts.map((f) => [f.id, f]));
    const out = new Map<string, PRel[]>();
    const inn = new Map<string, PRel[]>();
    for (const r of p.relations) {
        out.set(r.from, [...(out.get(r.from) ?? []), r]);
        inn.set(r.to, [...(inn.get(r.to) ?? []), r]);
    }
    const memo = new Map<string, Attrs>();
    /** The schema context of a fact: its table's attributes, over its connection's. */
    const ctxOf = (id: string): Attrs => {
        const hit = memo.get(id);
        if (hit) return hit;
        const self = byId.get(id);
        let table: PFact | undefined;
        if (self?.kind === 'table') table = self;
        else {
            const m = (inn.get(id) ?? []).find((e) => e.relation === 'member' && byId.get(e.from)?.kind === 'table');
            table = m ? byId.get(m.from) : undefined;
        }
        const connName = table?.attrs['connection'] ?? self?.attrs['connection'];
        const conn = typeof connName === 'string' ? byId.get(`connection:${connName}`) : undefined;
        const ctx: Attrs = { ...(conn?.attrs ?? {}), ...(table?.attrs ?? {}) };
        if (table) ctx['table'] = table.name;
        memo.set(id, ctx);
        return ctx;
    };
    return { byId, out, inn, ctxOf };
}

function readPath(s: Subject, key: string, ix: Index): unknown {
    if (key === '$name') return s.name;
    if (key === '$id') return s.id;
    if (key === '$ref') return s.id.replace(/@\w+$/, '');
    const dot = key.indexOf('.');
    if (dot > 0) {
        const scope = key.slice(0, dot);
        const rest = key.slice(dot + 1);
        if (scope === 'source') return s.edge ? ix.byId.get(s.source)?.attrs[rest] : s.attrs[rest];
        if (scope === 'target') return s.edge ? ix.byId.get(s.target)?.attrs[rest] : s.attrs[rest];
        if (scope === 'ctx') return ix.ctxOf(s.edge ? s.source : s.id)[rest];
        if (scope === 'target_ctx') return ix.ctxOf(s.edge ? s.target : s.id)[rest];
    }
    return s.attrs[key];
}

const condsHold = (s: Subject, conds: Record<string, Cond> | undefined, ix: Index): boolean => Object.entries(conds ?? {}).every(([k, c]) => holds(readPath(s, k, ix), c));

function render(v: unknown): string {
    if (Array.isArray(v)) return v.join(', ');
    return v === null || v === undefined ? '' : String(v);
}

interface Other {
    id: string | null;
    name: string;
    attrs: Attrs;
}

/**
 * Fill a template. `strict` returns null when an attribute it names is absent,
 * so a subject never names a fact that is not there.
 */
function fill(tpl: string, s: Subject, ix: Index, other: Other | null, strict: boolean): string | null {
    let missing = false;
    const got = (v: unknown): string => {
        if (v === undefined || v === null || v === '') missing = true;
        return render(v);
    };
    const text = tpl
        .replace(/\$source/g, s.source)
        .replace(/\$target/g, s.target)
        .replace(/\$self/g, s.edge ? s.source : s.id)
        .replace(/\{(other\.|source\.|target\.)?(?:attr\.([\w:-]+)|(ctx|target_ctx)\.([\w:-]+)|(name|id|subject)|([\w:-]+))\}/g, (_m, scope: string | undefined, attr?: string, ctxScope?: string, ctx?: string, word?: string, bare?: string) => {
            if (scope === 'other.') {
                if (!other) return got(undefined);
                if (attr) return got(other.attrs[attr]);
                if (word === 'name') return got(other.name);
                if (word === 'id') return got(other.id);
                return got(other.attrs[bare ?? '']);
            }
            if (scope === 'source.' || scope === 'target.') {
                const id = scope === 'source.' ? s.source : s.target;
                const f = ix.byId.get(id);
                if (word === 'name') return got(f?.name ?? id);
                if (word === 'id') return got(id);
                return got(f?.attrs[attr ?? bare ?? '']);
            }
            if (attr) return got(s.attrs[attr]);
            if (ctx) return got(ix.ctxOf(ctxScope === 'target_ctx' || !s.edge ? s.target : s.source)[ctx]);
            if (word === 'subject') return got(s.id);
            if (word === 'name') return got(s.name);
            if (word === 'id') return got(s.id);
            return got(s.attrs[bare ?? '']);
        });
    return strict && missing ? null : text;
}

function parseRef(ref: unknown): PWitness | null {
    if (typeof ref !== 'string') return null;
    const m = /^(.*):(\d+):([0-9a-f]{6,})$/.exec(ref);
    return m ? { file: m[1] as string, line: Number(m[2]), hash: m[3] as string } : null;
}

const toWitness = (id: string | null, w: PWitness | null | undefined): FindingWitness | null =>
    w ? { id, file: w.file, line: w.line, hash: w.hash, at: w.file ? (w.line ? `${w.file}:${w.line}` : w.file) : null } : null;

// ---- evaluation ------------------------------------------------------------

function selectFrom(p: Population, ix: Index, sel: DriftSelect): Subject[] {
    const kinds = asList(sel.kind);
    const toKinds = asList(sel.to_kind);
    const conds = { ...(sel.attrs ?? {}), ...(sel.where ?? {}) };
    const ok = (s: Subject): boolean =>
        (sel.lane === undefined || s.lane === sel.lane) && (sel.rung === undefined || sel.rung.includes(s.rung)) && condsHold(s, conds, ix);
    if (sel.edge !== undefined) {
        const rels = asList(sel.edge);
        return p.relations
            .filter((r) => rels.includes(r.relation))
            .filter((r) => (kinds.length === 0 || kinds.includes(ix.byId.get(r.from)?.kind ?? '')) && (toKinds.length === 0 || toKinds.includes(ix.byId.get(r.to)?.kind ?? '')))
            .filter((r) => sel.resolved_via === undefined || r.resolved_via === sel.resolved_via)
            .map(
                (r): Subject => ({
                    id: `${r.from} -> ${r.to}`,
                    name: `${r.from} ${r.relation} ${r.to}`,
                    attrs: r.attrs,
                    witness: r.witness,
                    guess: r.guess,
                    source: r.from,
                    target: r.to,
                    rung: r.rung,
                    lane: r.lane,
                    relation: r.relation,
                    resolved_via: r.resolved_via,
                    edge: true,
                }),
            )
            .filter(ok);
    }
    return p.facts
        .filter((f) => kinds.length === 0 || kinds.includes(f.kind))
        .map((f): Subject => ({ id: f.id, name: f.name, attrs: f.attrs, witness: f.witness, guess: f.guess, source: f.id, target: f.id, rung: f.rung, lane: f.lane, kind: f.kind, edge: false }))
        .filter(ok);
}

function expectHolds(x: DriftExpect, s: Subject, ix: Index): boolean | null {
    if ('equal' in x) {
        const norm = (v: string | null): string | null => (v === null ? null : (x.aliases?.[v.toLowerCase()] ?? v.toLowerCase()));
        const a = norm(fill(x.equal[0], s, ix, null, true));
        const b = norm(fill(x.equal[1], s, ix, null, true));
        return a === null || b === null ? null : a === b;
    }
    if ('node' in x) {
        const id = fill(x.node, s, ix, null, true);
        return id === null ? null : ix.byId.has(id);
    }
    if ('edge_from' in x) {
        const from = fill(x.edge_from, s, ix, null, true);
        if (from === null) return null;
        return (ix.out.get(from) ?? []).some((e) => e.relation === x.relation && (x.to_kind === undefined || ix.byId.get(e.to)?.kind === x.to_kind));
    }
    const to = fill(x.edge_to, s, ix, null, true);
    if (to === null) return null;
    return (ix.inn.get(to) ?? []).some((e) => e.relation === x.relation && (x.from_kind === undefined || ix.byId.get(e.from)?.kind === x.from_kind));
}

interface Hit {
    a: Subject;
    /** The second side: a fact, a bare witness, or nothing. */
    b: { id: string | null; name: string; attrs: Attrs; witness: PWitness } | null;
    /** Overrides the first witness (a counter pair names both). */
    ownWitness?: PWitness | null;
    subject?: string;
}

function asOther(f: PFact | undefined): Hit['b'] {
    return f ? { id: f.id, name: f.name, attrs: f.attrs, witness: f.witness } : null;
}

function hitsOf(r: DriftRule, p: Population, ix: Index): Hit[] {
    const hits: Hit[] = [];
    switch (r.match) {
        case undefined:
        case 'expect': {
            for (const s of selectFrom(p, ix, r.select)) {
                const xs = asList(r.expect);
                if (xs.length > 0) {
                    const verdicts = xs.map((x) => expectHolds(x, s, ix));
                    if (verdicts.some((v) => v === null) || verdicts.every((v) => v === true)) continue;
                }
                const subject = fill(r.subject ?? (s.edge ? '$source' : '$self'), s, ix, null, true);
                if (subject === null) continue;
                hits.push({ a: s, b: asOther(ix.byId.get(subject)), subject });
            }
            break;
        }
        case 'fact': {
            for (const s of selectFrom(p, ix, r.select)) {
                const v = r.counter ? s.attrs[r.counter] : undefined;
                if (Array.isArray(v)) {
                    const w0 = parseRef(v[0]);
                    const w1 = parseRef(v[1]);
                    hits.push({ a: s, ownWitness: w0 ?? s.witness, b: w1 ? { id: null, name: String(v[1]), attrs: {}, witness: w1 } : null });
                    continue;
                }
                const ctx = typeof v === 'string' ? ix.byId.get(v) : undefined;
                if (ctx) {
                    hits.push({ a: s, b: asOther(ctx) });
                    continue;
                }
                const w = parseRef(v);
                if (!w && r.counter_required) continue;
                hits.push({ a: s, b: w ? { id: null, name: String(v), attrs: {}, witness: w } : null });
            }
            break;
        }
        case 'collision': {
            const groups = new Map<string, Subject[]>();
            for (const s of selectFrom(p, ix, r.select)) {
                const k = r.key.map((a) => render(readPath(s, a, ix))).join('\u0000');
                groups.set(k, [...(groups.get(k) ?? []), s]);
            }
            for (const g of groups.values()) {
                const firstOf = new Map<string, Subject>();
                for (const s of g) {
                    const d = render(readPath(s, r.distinct, ix));
                    if (!firstOf.has(d)) firstOf.set(d, s);
                }
                const reps = [...firstOf.values()];
                for (let i = 1; i < reps.length; i++) hits.push({ a: reps[i]!, b: { id: reps[0]!.id, name: reps[0]!.name, attrs: reps[0]!.attrs, witness: reps[0]!.witness } });
            }
            break;
        }
        case 'missing':
        case 'mismatch':
        case 'join': {
            const norm = (v: unknown): string => {
                const s = render(v).toLowerCase();
                return ('aliases' in r ? r.aliases?.[s] : undefined) ?? s;
            };
            const keyOf = (s: Subject, key: string): string => (r.match === 'missing' ? render(readPath(s, key, ix)) : norm(readPath(s, key, ix)));
            const pop = selectFrom(p, ix, r.against).filter((x) => keyOf(x, r.against.key) !== '');
            const sel = selectFrom(p, ix, r.select).filter((x) => r.match === 'missing' || keyOf(x, r.key) !== '');
            if (pop.length === 0 || (r.match !== 'missing' && sel.length === 0)) break;
            const other = (x: Subject): Hit['b'] => ({ id: x.id, name: x.name, attrs: x.attrs, witness: x.witness });
            if (r.match === 'join') {
                const byKey = new Map(pop.map((x) => [keyOf(x, r.against.key), x]));
                for (const s of sel) {
                    const o = byKey.get(keyOf(s, r.key));
                    if (!o) continue;
                    const differs = r.compare.some((c) => {
                        const a = readPath(s, c, ix);
                        const b = readPath(o, c, ix);
                        return a !== undefined && b !== undefined && norm(a) !== norm(b);
                    });
                    if (differs) hits.push({ a: s, b: other(o) });
                }
                break;
            }
            const have = new Set(pop.map((x) => keyOf(x, r.against.key)));
            for (const s of sel) {
                if (have.has(keyOf(s, r.key))) continue;
                const named = r.match === 'missing' && r.counter ? ix.byId.get(render(readPath(s, r.counter, ix))) : undefined;
                hits.push({ a: s, b: named ? asOther(named) : other(pop[0]!) });
            }
            break;
        }
        case 'dangling': {
            const rels = asList(r.relation);
            for (const rel of p.relations) {
                if (!rels.includes(rel.relation) || (r.lane && rel.lane !== r.lane) || ix.byId.has(rel.to)) continue;
                const from = ix.byId.get(rel.from);
                if (!from) continue;
                hits.push({
                    a: { id: rel.to, name: render(rel.attrs['target_name'] ?? rel.to), attrs: rel.attrs, witness: rel.witness, guess: rel.guess, source: rel.from, target: rel.to, rung: rel.rung, lane: rel.lane, relation: rel.relation, edge: false },
                    b: asOther(from),
                });
            }
            break;
        }
        case 'unreached': {
            const next = new Map<string, string[]>();
            for (const rel of p.relations) if (r.via.includes(rel.relation)) next.set(rel.from, [...(next.get(rel.from) ?? []), rel.to]);
            const targets = new Set(selectFrom(p, ix, r.target).map((t) => t.id));
            for (const s of selectFrom(p, ix, r.select)) {
                const seen = new Set<string>([s.id]);
                const queue = [...(next.get(s.id) ?? [])];
                let reached = false;
                while (queue.length > 0 && !reached) {
                    const id = queue.shift()!;
                    if (seen.has(id)) continue;
                    seen.add(id);
                    if (targets.has(id)) reached = true;
                    queue.push(...(next.get(id) ?? []));
                }
                if (reached) continue;
                const ctx = ix.byId.get(render(s.attrs[r.counter ?? 'context']));
                if (ctx) hits.push({ a: s, b: asOther(ctx) });
            }
            break;
        }
    }
    return hits;
}

const COMPLETENESS_ORDER = ['unknown', 'partial', 'complete'];

/**
 * Evaluate rules over a graph (lanes merged in) or over lane outputs. Without
 * rules: every rule of the lanes present in the input — all of them for a graph.
 */
export function evaluateDrift(input: CodeGraph | LaneOutput | readonly LaneOutput[], rules?: readonly DriftRule[], waivers: readonly Waiver[] = []): DriftReport {
    const p = isGraph(input) ? fromGraph(input) : fromLanes(Array.isArray(input) ? (input as readonly LaneOutput[]) : [input as LaneOutput]);
    const ruleSet = rules ?? (isGraph(input) ? ALL_DRIFT_RULES : ALL_DRIFT_RULES.filter((r) => p.lanes.split(',').includes(laneOfRule(r) ?? '')));
    const refused: string[] = [];
    const live = ruleSet.filter((r) => {
        const err = ruleError(r);
        if (err) refused.push(err);
        return err === null;
    });
    const waived = new Map<string, string>();
    for (const w of waivers) {
        if (typeof w.reason !== 'string' || w.reason.trim() === '') refused.push(`waiver ${w.rule} on ${w.subject}: a waiver needs a non-empty reason`);
        else waived.set(`${w.rule}\0${w.subject}`, w.reason.trim());
    }
    const ix = buildIndex(p);
    const dataCompleteness = (): string => {
        const cs = p.facts.filter((f) => f.kind === 'table').map((f) => String(f.attrs['completeness'] ?? 'unknown'));
        return cs.length === 0 ? 'unknown' : cs.reduce((a, b) => (COMPLETENESS_ORDER.indexOf(a) <= COMPLETENESS_ORDER.indexOf(b) ? a : b));
    };

    const findings = new Map<string, DriftFinding>();
    for (const r of live) {
        if (r.requires && selectFrom(p, ix, r.requires).length === 0) continue;
        const lane = laneOfRule(r) as Lane;
        for (const h of hitsOf(r, p, ix)) {
            if ((r.exempt ?? []).some((ex) => condsHold(h.a, ex, ix))) continue;
            const subject = h.subject ?? h.a.id;
            const dedupe = h.subject !== undefined ? `${r.id}\0${subject}` : `${r.id}\0${r.title}\0${subject}\0${h.b?.id ?? h.b?.name ?? ''}`;
            if (findings.has(dedupe)) continue;
            const ctx = ix.ctxOf(h.subject !== undefined && ix.byId.has(subject) ? subject : h.a.edge ? h.a.source : h.a.id);
            const hasSchema = ctx['completeness'] !== undefined || ctx['engine'] !== undefined;
            const engine = String(ctx['effective_engine'] ?? ctx['engine'] ?? 'unknown');
            const fix = r.fix === undefined ? undefined : typeof r.fix === 'string' ? r.fix : (r.fix[engine] ?? r.fix['default']);
            const reason = waived.get(`${r.id}\0${subject}`);
            const trigger = h.subject !== undefined && h.a.edge ? h.a.source : h.a.id;
            const second = h.b;
            const against = h.subject !== undefined ? trigger : (second?.id ?? (second?.witness.file ? `${second.witness.file}:${second.witness.line ?? ''}` : null));
            const other: Other | null = h.b ? { id: h.b.id, name: h.b.name, attrs: h.b.attrs } : null;
            findings.set(dedupe, {
                rule: r.id,
                lane,
                title: r.title,
                tier: r.tier,
                handoff: r.handoff ?? null,
                subject,
                subjects: [subject, against],
                message: fill(r.message, h.a, ix, other, false) ?? r.message,
                witnesses: [
                    toWitness(trigger, h.ownWitness ?? h.a.witness) as FindingWitness,
                    second ? toWitness(second.id, second.witness) : null,
                ],
                engine,
                completeness: hasSchema ? String(ctx['completeness'] ?? 'unknown') : lane === 'data' ? dataCompleteness() : h.a.guess ? 'partial' : 'complete',
                ...(fix ? { fix: fill(fix, h.a, ix, other, false) ?? fix } : {}),
                ...(reason ? { waived: { reason } } : {}),
            });
        }
    }
    const order = new Map(live.map((r, i) => [r.id, i]));
    return {
        basis: {
            input: isGraph(input) ? 'graph' : 'lanes',
            lane: p.lanes,
            graph_checksum: p.checksum,
            vocabulary_version: VOCABULARY_VERSION,
            facts: p.facts.length,
            relations: p.relations.length,
            skipped: p.skipped,
            rules: [...new Set(live.map((r) => r.id))],
            waivers: waived.size,
        },
        findings: [...findings.values()].sort((a, b) => (order.get(a.rule)! - order.get(b.rule)! || (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0))),
        refused,
    };
}

/** The findings alone, rules first: the shape the lane tests read. */
export function evaluateRules(rules: readonly DriftRule[], outputs: readonly LaneOutput[]): DriftFinding[] {
    return evaluateDrift(outputs, rules).findings;
}

/** One line per finding, after the basis line. */
export function renderDrift(r: DriftReport): string[] {
    const head = r.basis.input === 'graph' ? `graph ${(r.basis.graph_checksum ?? '').slice(0, 12)}` : `lanes ${r.basis.lane}`;
    const lines = [`basis: ${head} · vocabulary v${r.basis.vocabulary_version} · ${r.basis.rules.length} rule(s) · ${r.basis.waivers} waiver(s)`];
    for (const f of r.findings) {
        const w2 = f.witnesses[1]?.at ?? '?';
        lines.push(`${f.rule} [${f.tier}${f.waived ? `, waived: ${f.waived.reason}` : ''}] ${f.message} — at ${f.witnesses[0].at ?? '?'} and ${w2} (engine ${f.engine}, ${f.completeness})`);
        if (f.fix) for (const l of f.fix.split('\n')) lines.push(`    fix: ${l}`);
    }
    for (const x of r.refused) lines.push(`refused: ${x}`);
    return lines;
}
