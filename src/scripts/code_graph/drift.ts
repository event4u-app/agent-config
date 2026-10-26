/**
 * The one drift engine: rules are data, findings have one shape.
 *
 * A rule selects facts (edges or nodes, by relation, kind, mechanism and
 * attributes), states what must also hold for each (an edge from or to one end,
 * or a node built from the fact's attributes), and names the subject a finding
 * is about. The engine evaluates every rule the same way; adding a class of
 * drift is a new entry in a rule file, never a branch here. Rule ids carry their
 * lane's family (`DR-` data, `IF-` interfaces, `RT-` runtime, `DL-` delivery).
 *
 * A finding carries the witness of the fact that triggered it and the witness
 * of its subject, the engine and completeness of the schema it was judged
 * against, and its tier — `advice` unless the rule has earned `gate` with a
 * recorded precision. A waiver needs a non-empty reason; one without is refused
 * and reported, never silently honoured. Every report prints the basis it was
 * computed from.
 */
import * as fs from 'node:fs';

import type { CodeEdge, CodeGraph, CodeNode } from './types.js';
import { LANES, type Lane, VOCABULARY_VERSION } from './vocabulary.js';

type AttrValue = string | number | boolean | null;

/** Which facts a rule looks at. Every given field must match. */
export interface DriftSelect {
    /** An edge relation; omit to select nodes. */
    edge?: string;
    /** A node kind (with `edge`: the kind of the edge's source). */
    kind?: string;
    to_kind?: string;
    resolved_via?: string;
    /** Attribute equality on the edge's (or node's) fact; an array means any of. */
    attrs?: Record<string, AttrValue | AttrValue[]>;
}

/**
 * What must hold for a selected fact. `$source`, `$target` and `$self` name its
 * ends; `{attr.x}` inside a template is the fact's attribute `x`.
 */
export type DriftExpect =
    | { edge_from: string; relation: string; to_kind?: string }
    | { edge_to: string; relation: string; from_kind?: string }
    | { node: string };

export interface DriftRule {
    id: string;
    lane: Lane;
    title: string;
    tier: 'advice' | 'gate';
    /** Measured precision on the planted fixtures; a `gate` rule must carry one. */
    precision?: number;
    select: DriftSelect;
    expect: DriftExpect;
    /** What the finding is about; findings with the same subject collapse into one. */
    subject: string;
    /** Facts the rule does not apply to, by attribute. */
    exempt?: Array<Record<string, AttrValue | AttrValue[]>>;
    message: string;
}

export interface Waiver {
    rule: string;
    subject: string;
    reason: string;
}

export interface FindingWitness {
    id: string;
    at: string | null;
    hash: string | null;
}

export interface DriftFinding {
    rule: string;
    lane: Lane;
    tier: 'advice' | 'gate';
    subject: string;
    message: string;
    /** The fact that triggered the rule, then the subject it is about. */
    witnesses: [FindingWitness, FindingWitness];
    engine: string;
    completeness: string;
    waived?: { reason: string };
}

export interface DriftReport {
    /** What the findings were computed from. */
    basis: { graph_checksum: string; vocabulary_version: number; rules: number; waivers: number };
    findings: DriftFinding[];
    /** Rules and waivers refused before evaluation, with the reason. */
    refused: string[];
}

const FAMILY: Record<string, Lane> = { DR: 'data', IF: 'interfaces', RT: 'runtime', DL: 'delivery' };

/** Why a rule cannot be evaluated, or null. */
export function ruleError(r: DriftRule): string | null {
    if (!/^[A-Z]{2}-\d+$/.test(r.id)) return `${r.id}: id must be a family prefix and a number`;
    const fam = FAMILY[r.id.slice(0, 2)];
    if (fam !== undefined && fam !== r.lane) return `${r.id}: the ${r.id.slice(0, 2)} family belongs to the ${fam} lane, not ${r.lane}`;
    if (!(LANES as readonly string[]).includes(r.lane)) return `${r.id}: unknown lane ${r.lane}`;
    if (r.tier === 'gate' && typeof r.precision !== 'number') return `${r.id}: a gate rule needs a recorded precision`;
    if (!r.subject || !r.message) return `${r.id}: subject and message are required`;
    return null;
}

/** Rules from a JSON file holding an array of rules. */
export function loadRules(file: string): DriftRule[] {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    if (!Array.isArray(raw)) throw new Error(`${file}: a rule file holds an array of rules`);
    return raw as DriftRule[];
}

interface Fact {
    node?: CodeNode;
    edge?: CodeEdge;
    attrs: Record<string, unknown>;
}

function matches(value: unknown, want: AttrValue | AttrValue[]): boolean {
    return Array.isArray(want) ? want.some((w) => w === value) : want === value;
}

function attrsMatch(attrs: Record<string, unknown>, want: Record<string, AttrValue | AttrValue[]> | undefined): boolean {
    return Object.entries(want ?? {}).every(([k, v]) => matches(attrs[k], v));
}

export function evaluateDrift(graph: CodeGraph, rules: readonly DriftRule[], waivers: readonly Waiver[] = []): DriftReport {
    const refused: string[] = [];
    const live = rules.filter((r) => {
        const err = ruleError(r);
        if (err) refused.push(err);
        return err === null;
    });
    const waived = new Map<string, string>();
    for (const w of waivers) {
        if (typeof w.reason !== 'string' || w.reason.trim() === '') refused.push(`waiver ${w.rule} on ${w.subject}: a waiver needs a non-empty reason`);
        else waived.set(`${w.rule}\0${w.subject}`, w.reason.trim());
    }

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const out = new Map<string, CodeEdge[]>();
    const inn = new Map<string, CodeEdge[]>();
    for (const e of graph.edges) {
        out.set(e.source, [...(out.get(e.source) ?? []), e]);
        inn.set(e.target, [...(inn.get(e.target) ?? []), e]);
    }
    const kindOf = (id: string): string | undefined => byId.get(id)?.kind;

    const facts = (s: DriftSelect): Fact[] => {
        if (s.edge) {
            return graph.edges
                .filter((e) => e.relation === s.edge)
                .filter((e) => (s.kind === undefined || kindOf(e.source) === s.kind) && (s.to_kind === undefined || kindOf(e.target) === s.to_kind))
                .filter((e) => s.resolved_via === undefined || e.resolved_via === s.resolved_via)
                .map((e) => ({ edge: e, attrs: e.fact?.attrs ?? {} }))
                .filter((f) => attrsMatch(f.attrs, s.attrs));
        }
        return graph.nodes
            .filter((n) => s.kind === undefined || n.kind === s.kind)
            .map((n) => ({ node: n, attrs: n.fact?.attrs ?? {} }))
            .filter((f) => attrsMatch(f.attrs, s.attrs));
    };
    const fill = (template: string, f: Fact): string | null => {
        let missing = false;
        const s = template
            .replace(/\$source/g, f.edge?.source ?? f.node?.id ?? '')
            .replace(/\$target/g, f.edge?.target ?? f.node?.id ?? '')
            .replace(/\$self/g, f.node?.id ?? f.edge?.source ?? '')
            .replace(/\{attr\.(\w+)\}/g, (_m, k: string) => {
                const v = f.attrs[k];
                if (v === undefined || v === null) missing = true;
                return String(v);
            });
        return missing ? null : s;
    };
    const holds = (x: DriftExpect, f: Fact): boolean | null => {
        if ('node' in x) {
            const id = fill(x.node, f);
            return id === null ? null : byId.has(id);
        }
        if ('edge_from' in x) {
            const from = fill(x.edge_from, f);
            if (from === null) return null;
            return (out.get(from) ?? []).some((e) => e.relation === x.relation && (x.to_kind === undefined || kindOf(e.target) === x.to_kind));
        }
        const to = fill(x.edge_to, f);
        if (to === null) return null;
        return (inn.get(to) ?? []).some((e) => e.relation === x.relation && (x.from_kind === undefined || kindOf(e.source) === x.from_kind));
    };
    const witness = (id: string, e?: CodeEdge): FindingWitness => {
        const n = byId.get(id);
        const w = e?.fact?.witness ?? n?.fact?.witness;
        if (w) return { id, at: `${w.file}:${w.line}`, hash: w.hash };
        const line = n?.source_location[0];
        return { id, at: n?.source_file ? (line ? `${n.source_file}:${line}` : n.source_file) : null, hash: null };
    };
    /** Engine and completeness of the schema a subject belongs to: its own fact, or its table's. */
    const context = (id: string): { engine: string; completeness: string } => {
        const own = byId.get(id)?.fact?.attrs;
        const table = (inn.get(id) ?? []).find((e) => e.relation === 'member' && kindOf(e.source) === 'table');
        const attrs = own?.['engine'] !== undefined ? own : table ? byId.get(table.source)?.fact?.attrs : undefined;
        return { engine: String(attrs?.['engine'] ?? 'unknown'), completeness: String(attrs?.['completeness'] ?? 'unknown') };
    };

    const findings = new Map<string, DriftFinding>();
    for (const r of live) {
        for (const f of facts(r.select)) {
            if ((r.exempt ?? []).some((ex) => attrsMatch(f.attrs, ex))) continue;
            if (holds(r.expect, f) !== false) continue;
            const subject = fill(r.subject, f);
            if (subject === null) continue;
            const key = `${r.id}\0${subject}`;
            if (findings.has(key)) continue;
            const trigger = f.edge ? witness(f.edge.source, f.edge) : witness(f.node?.id ?? subject);
            const reason = waived.get(key);
            findings.set(key, {
                rule: r.id,
                lane: r.lane,
                tier: r.tier,
                subject,
                message: fill(r.message, f) ?? r.message,
                witnesses: [trigger, witness(subject)],
                ...context(subject),
                ...(reason ? { waived: { reason } } : {}),
            });
        }
    }
    return {
        basis: { graph_checksum: graph.source_checksum, vocabulary_version: VOCABULARY_VERSION, rules: live.length, waivers: waived.size },
        findings: [...findings.values()].sort((a, b) => (a.rule === b.rule ? (a.subject < b.subject ? -1 : 1) : a.rule < b.rule ? -1 : 1)),
        refused,
    };
}

/** One line per finding, after the basis line. */
export function renderDrift(r: DriftReport): string[] {
    const lines = [
        `basis: graph ${r.basis.graph_checksum.slice(0, 12)} · vocabulary v${r.basis.vocabulary_version} · ${r.basis.rules} rule(s) · ${r.basis.waivers} waiver(s)`,
    ];
    for (const f of r.findings) {
        lines.push(`${f.rule} [${f.tier}${f.waived ? `, waived: ${f.waived.reason}` : ''}] ${f.message} — at ${f.witnesses[0].at ?? '?'} and ${f.witnesses[1].at ?? '?'} (engine ${f.engine}, ${f.completeness})`);
    }
    for (const x of r.refused) lines.push(`refused: ${x}`);
    return lines;
}
