/**
 * Drift rules as data, and the small evaluator that runs them over lane output.
 *
 * Rule format: a rule is a plain object: `id`, `title`, `tier` (`advice` until its precision
 * on planted fixtures is recorded), a `message` template, and one `match` shape.
 * A selector picks facts: `{ lane?, rung?, kind, where? }`; `where` maps an attribute to
 * a literal (equality), `{ in: [...] }`, `{ not: value }` or `{ exists: bool }`.
 *
 *   fact       every selected fact is a finding; `context` names the attribute
 *              holding the id of the fact that gives the second witness
 *   collision  selected facts grouped by the `key` attributes; a group whose
 *              `distinct` attribute takes two or more values is a finding per pair
 *   missing    a selected fact whose `key` value no fact of `against` carries;
 *              silent while `against` selects nothing (no population to be absent from)
 *   mismatch   a selected fact whose `key` value (after `aliases`) is not among the
 *              values the `against` facts carry; silent unless both sides exist
 *   dangling   a relation whose target is no fact of any lane
 *   unreached  a selected fact from which no `target` fact is reachable over the
 *              `via` relations (followed from → to); the fact's `context`
 *              attribute names the second witness
 *
 * Message templates substitute `{name}`, `{id}`, `{attr.<k>}` from the first
 * subject and `{other.name}`, `{other.attr.<k>}` from the second.
 *
 * Every finding carries two witnesses — the fact that drifted and the fact it
 * drifted against — because a finding a reader cannot check on both ends is a claim.
 */
import type { LaneFact, LaneOutput, LaneRelation, SourceRung, Witness } from '../lane_fact.js';

type Literal = string | number | boolean | null;
export type Cond = Literal | { in: Literal[] } | { not: Literal } | { exists: boolean };

export interface Selector {
    lane?: LaneOutput['lane'];
    /** source rungs to consider; all when absent */
    rung?: SourceRung[];
    kind: string | string[];
    where?: Record<string, Cond>;
}

interface RuleBase {
    id: string;
    title: string;
    tier: 'advice' | 'gate';
    message: string;
}

export type DriftRule = RuleBase &
    (
        | { match: 'fact'; select: Selector; context: string }
        | { match: 'collision'; select: Selector; key: string[]; distinct: string }
        | { match: 'missing'; select: Selector; key: string; against: Selector & { key: string } }
        | { match: 'mismatch'; select: Selector; key: string; against: Selector & { key: string }; aliases?: Record<string, string> }
        | { match: 'dangling'; relation: string | string[]; lane?: LaneOutput['lane'] }
        | { match: 'unreached'; select: Selector; via: string[]; target: Selector }
    );

export interface DriftFinding {
    rule: string;
    title: string;
    tier: 'advice' | 'gate';
    message: string;
    subjects: [string, string];
    witnesses: [Witness, Witness];
}

type Tagged = LaneFact & { lane: LaneOutput['lane'] };

function holds(v: unknown, c: Cond): boolean {
    if (c !== null && typeof c === 'object') {
        if ('in' in c) return c.in.some((x) => x === v || (Array.isArray(v) && v.includes(x as string)));
        if ('not' in c) return v !== c.not;
        return (v !== undefined && v !== null && v !== '') === c.exists;
    }
    return v === c;
}

function selects(f: Tagged, s: Selector): boolean {
    if (s.lane && f.lane !== s.lane) return false;
    if (s.rung && !s.rung.includes(f.rung)) return false;
    const kinds = Array.isArray(s.kind) ? s.kind : [s.kind];
    if (!kinds.includes(f.kind)) return false;
    return Object.entries(s.where ?? {}).every(([k, c]) => holds(f.attrs[k], c));
}

function fill(tpl: string, a: { id: string; name: string; attrs: Record<string, unknown> }, b?: { id: string; name: string; attrs: Record<string, unknown> }): string {
    return tpl.replace(/\{(other\.)?(name|id|attr\.([\w-]+))\}/g, (_m, other: string | undefined, what: string, attr: string | undefined) => {
        const src = other ? b : a;
        if (!src) return '';
        if (attr) return String(src.attrs[attr] ?? '');
        return what === 'name' ? src.name : src.id;
    });
}

function finding(rule: DriftRule, a: { id: string; name: string; attrs: Record<string, unknown>; witness: Witness }, b: { id: string; name: string; attrs: Record<string, unknown>; witness: Witness }): DriftFinding {
    return {
        rule: rule.id,
        title: rule.title,
        tier: rule.tier,
        message: fill(rule.message, a, b),
        subjects: [a.id, b.id],
        witnesses: [a.witness, b.witness],
    };
}

export function evaluateRules(rules: readonly DriftRule[], outputs: readonly LaneOutput[]): DriftFinding[] {
    const facts: Tagged[] = outputs.flatMap((o) => o.facts.map((f) => ({ ...f, lane: o.lane })));
    const relations: (LaneRelation & { lane: LaneOutput['lane'] })[] = outputs.flatMap((o) => o.relations.map((r) => ({ ...r, lane: o.lane })));
    const byId = new Map(facts.map((f) => [f.id, f]));
    const out: DriftFinding[] = [];
    for (const rule of rules) {
        switch (rule.match) {
            case 'fact':
                for (const f of facts.filter((x) => selects(x, rule.select))) {
                    const ctx = byId.get(String(f.attrs[rule.context] ?? ''));
                    if (ctx) out.push(finding(rule, f, ctx));
                }
                break;
            case 'collision': {
                const groups = new Map<string, Tagged[]>();
                for (const f of facts.filter((x) => selects(x, rule.select))) {
                    const k = rule.key.map((a) => String(f.attrs[a] ?? '')).join('\u0000');
                    groups.set(k, [...(groups.get(k) ?? []), f]);
                }
                for (const g of groups.values()) {
                    const firstOf = new Map<string, Tagged>();
                    for (const f of g) {
                        const d = String(f.attrs[rule.distinct] ?? '');
                        if (!firstOf.has(d)) firstOf.set(d, f);
                    }
                    const reps = [...firstOf.values()];
                    for (let i = 1; i < reps.length; i++) out.push(finding(rule, reps[i]!, reps[0]!));
                }
                break;
            }
            case 'missing': {
                const pop = facts.filter((x) => selects(x, rule.against));
                if (pop.length === 0) break;
                const have = new Set(pop.map((p) => String(p.attrs[rule.against.key] ?? '')));
                for (const f of facts.filter((x) => selects(x, rule.select))) {
                    if (!have.has(String(f.attrs[rule.key] ?? ''))) out.push(finding(rule, f, pop[0]!));
                }
                break;
            }
            case 'mismatch': {
                const norm = (v: unknown): string => {
                    const s = String(v ?? '').toLowerCase();
                    return rule.aliases?.[s] ?? s;
                };
                const pop = facts.filter((x) => selects(x, rule.against) && norm(x.attrs[rule.against.key]) !== '');
                const sel = facts.filter((x) => selects(x, rule.select) && norm(x.attrs[rule.key]) !== '');
                if (pop.length === 0 || sel.length === 0) break;
                const have = new Set(pop.map((p) => norm(p.attrs[rule.against.key])));
                for (const f of sel) {
                    if (!have.has(norm(f.attrs[rule.key]))) out.push(finding(rule, f, pop[0]!));
                }
                break;
            }
            case 'dangling': {
                const rels = Array.isArray(rule.relation) ? rule.relation : [rule.relation];
                for (const r of relations) {
                    if (!rels.includes(r.relation) || (rule.lane && r.lane !== rule.lane) || byId.has(r.to)) continue;
                    const from = byId.get(r.from);
                    if (!from) continue;
                    out.push(finding(rule, { id: r.to, name: String(r.attrs['target_name'] ?? r.to), attrs: r.attrs, witness: r.witness }, from));
                }
                break;
            }
            case 'unreached': {
                const next = new Map<string, string[]>();
                for (const r of relations) if (rule.via.includes(r.relation)) next.set(r.from, [...(next.get(r.from) ?? []), r.to]);
                for (const f of facts.filter((x) => selects(x, rule.select))) {
                    const seen = new Set<string>([f.id]);
                    const queue = [...(next.get(f.id) ?? [])];
                    let reached = false;
                    while (queue.length > 0 && !reached) {
                        const id = queue.shift()!;
                        if (seen.has(id)) continue;
                        seen.add(id);
                        const t = byId.get(id);
                        if (t && selects(t, rule.target)) reached = true;
                        queue.push(...(next.get(id) ?? []));
                    }
                    if (reached) continue;
                    const ctx = byId.get(String(f.attrs['context'] ?? ''));
                    if (ctx) out.push(finding(rule, f, ctx));
                }
                break;
            }
        }
    }
    return out;
}
