/**
 * Validity on knowledge facts. Every fact carries `valid_from`, `valid_until`,
 * `recorded_at` and optional `supersedes`; a derived claim keeps the ids it is
 * `based_on` and is retracted the moment one of them disappears.
 *
 * Contradictions expire by one interval rule, never by a model: two facts on
 * the same subject with different values, whose intervals overlap, end the
 * older one where the newer one starts. "Older" is the earlier `valid_from`,
 * then the earlier `recorded_at`, then the smaller id — so the result never
 * depends on input order.
 */

export interface KnowledgeFact {
    id: string;
    subject: string;
    value: string;
    /** ISO date-time */
    valid_from: string;
    valid_until: string | null;
    recorded_at: string;
    supersedes?: string[];
    based_on?: string[];
}

export interface ResolvedFact extends KnowledgeFact {
    state: 'valid' | 'expired' | 'superseded' | 'retracted';
    reason: string | null;
}

const older = (a: KnowledgeFact, b: KnowledgeFact): number => (a.valid_from < b.valid_from ? -1 : a.valid_from > b.valid_from ? 1 : a.recorded_at < b.recorded_at ? -1 : a.recorded_at > b.recorded_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const overlaps = (a: KnowledgeFact, b: KnowledgeFact): boolean => (a.valid_until === null || a.valid_until > b.valid_from) && (b.valid_until === null || b.valid_until > a.valid_from);

/**
 * Apply supersession, contradiction expiry and derived-claim retraction, then
 * state each fact at `at`. `known` is the set of ids that still exist outside
 * this list (paths, records); a `based_on` id in neither retracts the claim.
 */
export function resolveFacts(facts: readonly KnowledgeFact[], at: string, known: ReadonlySet<string> = new Set()): ResolvedFact[] {
    const out = new Map<string, ResolvedFact>(facts.map((f) => [f.id, { ...f, state: 'valid', reason: null }] as const));
    for (const f of [...out.values()].sort(older)) {
        for (const s of f.supersedes ?? []) {
            const old = out.get(s);
            if (!old) continue;
            if (old.valid_until === null || old.valid_until > f.valid_from) old.valid_until = f.valid_from;
            old.state = 'superseded';
            old.reason = `superseded by ${f.id}`;
        }
    }
    const bySubject = new Map<string, ResolvedFact[]>();
    for (const f of out.values()) (bySubject.get(f.subject) ?? bySubject.set(f.subject, []).get(f.subject))?.push(f);
    for (const list of bySubject.values()) {
        list.sort(older);
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i] as ResolvedFact;
                const b = list[j] as ResolvedFact;
                if (a.value === b.value || !overlaps(a, b)) continue;
                a.valid_until = b.valid_from;
                if (a.state === 'valid') a.reason = `contradicted by ${b.id} from ${b.valid_from}`;
            }
        }
    }
    // Retraction cascades: a claim based on a retracted claim is retracted too.
    let changed = true;
    while (changed) {
        changed = false;
        for (const f of out.values()) {
            if (f.state === 'retracted') continue;
            const missing = (f.based_on ?? []).find((b) => {
                const dep = out.get(b);
                return dep ? dep.state === 'retracted' : !known.has(b);
            });
            if (missing !== undefined) {
                f.state = 'retracted';
                f.reason = `based on ${missing}, which is gone`;
                changed = true;
            }
        }
    }
    for (const f of out.values()) {
        if (f.state !== 'valid') continue;
        if (f.valid_from > at) {
            f.state = 'expired';
            f.reason = 'not yet valid';
        } else if (f.valid_until !== null && f.valid_until <= at) f.state = 'expired';
    }
    return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}
