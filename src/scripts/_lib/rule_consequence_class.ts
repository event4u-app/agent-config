/**
 * The high-consequence rule class — one reader for the config, the projector
 * and the test.
 *
 * The criterion itself is prose and lives where an author meets it: the
 * `consequence_class` property of `src/scripts/schemas/rule.schema.json`. This
 * module does not restate it. It reads the list the criterion produced
 * (`src/config/rule-consequence-class.json`), joins it to what each rule file
 * actually declares, and answers the one question `project_thin_rules` asks:
 * may this rule's stub carry its own law, and if not, has that been declared?
 *
 * WHY A DECLARED `no_stub` SUBSET RATHER THAN A SHORTER CLASS. A member whose
 * law section is missing or over the ceiling cannot ship as stub-plus-law —
 * there is nothing short enough to copy. Two ways to handle that: drop it from
 * the class, or keep it in the class and record why it cannot stand. Dropping
 * it makes the class shrinkable by NOT writing a law, which is the incentive a
 * criterion must not create. Keeping it leaves the obligation visible and costs
 * only a full-bodied projection, which is what those rules get today anyway.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const CLASS_CONFIG_REL = 'src/config/rule-consequence-class.json';

export const CLAUSES = ['irreversible-external', 'security-boundary', 'authority-bypass'] as const;
export type Clause = (typeof CLAUSES)[number];

export interface ClassMember {
    clause: Clause;
    /** What this rule's own law obligates, and what violating it costs. */
    why: string;
}

export interface NoStubEntry extends ClassMember {
    /** Why the law cannot stand in a stub today. */
    reason: string;
}

export interface ConsequenceClassConfig {
    criterion_ref: string;
    members: Record<string, ClassMember>;
    /** Subset of `members` that projects full-bodied, each with its reason. */
    no_stub: Record<string, NoStubEntry>;
    /** Near misses the criterion rejected, each with the reason it was rejected. */
    excluded: Record<string, string>;
}

export function readConsequenceClass(repoRoot: string): ConsequenceClassConfig {
    const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, CLASS_CONFIG_REL), 'utf-8')) as Partial<
        ConsequenceClassConfig
    >;
    return {
        criterion_ref: raw.criterion_ref ?? '',
        members: raw.members ?? {},
        no_stub: raw.no_stub ?? {},
        excluded: raw.excluded ?? {},
    };
}

/** Ids whose stub carries their law — members minus the declared `no_stub` set. */
export function stubLawIds(cfg: ConsequenceClassConfig): Set<string> {
    return new Set(Object.keys(cfg.members).filter((id) => cfg.no_stub[id] === undefined));
}

/** The `consequence_class:` value a rule file declares, or `null`. */
export function declaredClause(ruleText: string): Clause | null {
    const m = /^consequence_class:\s*"?([a-z-]+)"?\s*$/m.exec(ruleText);
    if (m === null) return null;
    const v = m[1] as string;
    return (CLAUSES as readonly string[]).includes(v) ? (v as Clause) : null;
}
