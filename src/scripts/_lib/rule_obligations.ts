/**
 * Stable obligation ids per rule, and which `enforced_by` entry refuses which.
 *
 * A rule holds several obligations, and `enforced_by` used to credit all of
 * them for whatever one gate refuses: `git-history-discipline` counted as gated
 * because a hook refuses `--no-verify`, while its laws against unsolicited
 * rebase and dropped commits are refused by nothing. The inventory names each
 * obligation `<rule>.<obligation>` so a gate is credited with the ids it
 * actually refuses and nothing else.
 *
 * WHY A SIDECAR AND NOT RULE FRONTMATTER. `check_preamble_payload_budget`
 * measures every byte of every projected rule file, frontmatter included, as
 * per-spawn payload, and holds it at zero net growth. Some 290 ids in
 * frontmatter would have been payload no model needs. The ids are routing and
 * accounting data, so they live with the rest of that data in `src/config/`.
 *
 * WHY THE ID IS NOT DERIVED FROM THE LAW TEXT. A hash or an excerpt changes
 * when the law is reworded, and an id that moves on every reword is not stable.
 * The slug names the clause; the law text is free to change under it. That is
 * also why the `# obligation: line N` frontmatter marker is retired: a line
 * number drifts on every edit above it, and at retirement 34 of the 68 markers
 * on rules with a law section no longer pointed inside that section.
 *
 * BINDINGS. `bindings` maps an `enforced_by` entry, spelled exactly as in the
 * rule's frontmatter, to the ids it refuses. An entry with no key here is
 * UNBOUND: it keeps the rule-level credit it always had and is counted
 * separately, never as obligation-level coverage. An entry bound to `[]` is a
 * recorded finding that it refuses none of this rule's obligations.
 *
 * The nine kernel rules are absent by construction: agents cannot write them,
 * and they stay at rule granularity.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { KERNEL_RULE_ID_SET } from './kernel_rules.js';
import { lawSections, ruleBody, splitFrontmatter } from './rule_law_section.js';

export const RULE_OBLIGATIONS_PATH = 'src/config/rule-obligations.json';

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

/** `<rule>.<obligation>`, both halves kebab-case. */
export const OBLIGATION_ID_RE = new RegExp(`^(${SLUG})\\.(${SLUG})$`);

/** The retired per-rule pointer. Kept only so the lint can refuse its return. */
export const OBLIGATION_MARKER_RE = /^#\s*obligation:\s*line\s+\d+\s*$/m;

export interface RuleObligationEntry {
    obligations: string[];
    bindings?: Record<string, string[]>;
}

export interface RuleObligationInventory {
    rules: Record<string, RuleObligationEntry>;
}

export function loadRuleObligations(root: string): RuleObligationInventory {
    const file = path.join(root, RULE_OBLIGATIONS_PATH);
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<RuleObligationInventory>;
    return { rules: raw.rules ?? {} };
}

/** What the lint needs to know about one rule file. */
export interface RuleFacts {
    id: string;
    kernel: boolean;
    hasLawSection: boolean;
    enforcedBy: string[];
    hasMarker: boolean;
}

export function readRuleFacts(id: string, text: string): RuleFacts {
    const [fmBlock] = splitFrontmatter(text);
    let enforcedBy: string[] = [];
    if (fmBlock !== '') {
        const inner = fmBlock.replace(/^---\n/, '').replace(/\n---\n$/, '');
        const fm = (parseYaml(inner) ?? {}) as Record<string, unknown>;
        const raw = fm['enforced_by'];
        if (Array.isArray(raw)) enforcedBy = raw.map(String);
        else if (typeof raw === 'string' && raw !== '') enforcedBy = [raw];
    }
    return {
        id,
        kernel: KERNEL_RULE_ID_SET.has(id),
        hasLawSection: lawSections(ruleBody(text)).length > 0,
        enforcedBy,
        hasMarker: OBLIGATION_MARKER_RE.test(fmBlock),
    };
}

export function collectRuleFacts(rulesDir: string): RuleFacts[] {
    return fs
        .readdirSync(rulesDir)
        .filter((n) => n.endsWith('.md'))
        .sort()
        .map((n) => readRuleFacts(n.slice(0, -3), fs.readFileSync(path.join(rulesDir, n), 'utf-8')));
}

export interface ObligationFinding {
    rule: string;
    code:
        | 'unknown-rule'
        | 'kernel-declared'
        | 'missing'
        | 'empty'
        | 'bad-id'
        | 'wrong-prefix'
        | 'duplicate'
        | 'binding-entry-not-declared'
        | 'binding-id-unknown'
        | 'marker-present';
    message: string;
}

/**
 * Every finding the inventory and the rule tree produce together.
 *
 * Required: every non-kernel rule with a law section has an entry. A rule
 * without one MAY have an entry, and if it does the same checks apply.
 */
export function lintRuleObligations(
    inventory: RuleObligationInventory,
    facts: readonly RuleFacts[],
): ObligationFinding[] {
    const out: ObligationFinding[] = [];
    const byId = new Map(facts.map((f) => [f.id, f]));
    const seen = new Map<string, string>();

    for (const f of facts) {
        if (f.hasMarker) {
            out.push({
                rule: f.id,
                code: 'marker-present',
                message:
                    'carries a `# obligation: line N` marker; it is retired — the ids in ' +
                    `${RULE_OBLIGATIONS_PATH} name the obligation`,
            });
        }
        if (!f.kernel && f.hasLawSection && inventory.rules[f.id] === undefined) {
            out.push({
                rule: f.id,
                code: 'missing',
                message: `has a law section and no entry in ${RULE_OBLIGATIONS_PATH}`,
            });
        }
    }

    for (const [rule, entry] of Object.entries(inventory.rules)) {
        const fact = byId.get(rule);
        if (fact === undefined) {
            out.push({ rule, code: 'unknown-rule', message: 'no such rule under src/rules/' });
            continue;
        }
        if (fact.kernel) {
            out.push({
                rule,
                code: 'kernel-declared',
                message: 'kernel rules stay at rule granularity and carry no obligation ids',
            });
        }
        const ids = Array.isArray(entry.obligations) ? entry.obligations : [];
        if (ids.length === 0) {
            out.push({ rule, code: 'empty', message: 'declares no obligations' });
        }
        const own = new Set<string>();
        for (const id of ids) {
            const m = OBLIGATION_ID_RE.exec(id);
            if (m === null) {
                out.push({ rule, code: 'bad-id', message: `\`${id}\` is not \`<rule>.<obligation>\` kebab-case` });
                continue;
            }
            if (m[1] !== rule) {
                out.push({ rule, code: 'wrong-prefix', message: `\`${id}\` is not prefixed with \`${rule}.\`` });
            }
            const prior = seen.get(id);
            if (prior !== undefined) {
                out.push({ rule, code: 'duplicate', message: `\`${id}\` is declared twice (also under ${prior})` });
            }
            seen.set(id, rule);
            own.add(id);
        }
        for (const [entryName, bound] of Object.entries(entry.bindings ?? {})) {
            if (!fact.enforcedBy.includes(entryName)) {
                out.push({
                    rule,
                    code: 'binding-entry-not-declared',
                    message: `binds \`${entryName}\`, which is not in the rule's enforced_by`,
                });
            }
            for (const id of bound) {
                if (!own.has(id)) {
                    out.push({
                        rule,
                        code: 'binding-id-unknown',
                        message: `\`${entryName}\` binds \`${id}\`, which this rule does not declare`,
                    });
                }
            }
        }
    }
    return out;
}
