#!/usr/bin/env tsx
/**
 * Trigger-precision budget (road-to-renewal-foundation Phase 3, step 2).
 *
 * ## The defect this measures
 *
 * Every `keyword` trigger is matched as an UNANCHORED, case-insensitive
 * substring of the prompt (`router_telemetry.ts::trigger_matches`). A short
 * keyword therefore fires on words that merely contain it: `AC` fired
 * `cross-source-consistency` on "black", "back", "contact"; `CAC` fired the
 * finance floor on "cache". The shorter the keyword, the more of the English
 * language it claims.
 *
 * ## Why a COUNT ratchet and not a rewrite
 *
 * The obvious repair — "promote the noisy keywords to `phrase:`" — is a
 * NO-OP: `keyword` and `phrase` run the same substring comparison
 * (`router_telemetry.ts` lines for both branches are identical), so the two
 * kinds differ in documentation only. The other obvious repair — anchoring
 * `keyword` on word boundaries — is the real fix, but it changes shipped
 * activation semantics for all 316 single-token keywords at once and belongs
 * in its own change with its own before/after (recorded as the reopen term in
 * the Phase 3 pre-registration).
 *
 * So this gate does the one thing that is both safe and durable: it fixes the
 * population in place. Short keywords that exist today are recorded; a NEW one
 * cannot land. Every removal is a normal commit that lowers the number.
 *
 * ## Scope of "short"
 *
 * ASCII keywords of ≤ 3 characters. Non-ASCII short keywords are excluded by
 * construction: the eight emoji triggers on
 * `no-decorative-emojis-in-git-surfaces` are one code point each and cannot
 * collide with prose substrings, so counting them would be noise.
 *
 * A pure length rule is deliberate. A collision count against a system word
 * list would be sharper but is not portable (no dictionary on a CI runner),
 * and an embedded word list is a second source of truth to maintain.
 *
 * Exit: 0 within budget · 1 usage/IO error · 2 over budget.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');

/**
 * Ratchet, seeded 2026-08-02 at the measured population after removing the
 * two provably redundant entries (`AC`, already covered by the
 * `acceptance criteria` keyword on the same rule; `CAC`, which collided with
 * "cache" while `LTV` and `payback` already carry the unit-economics signal).
 * MAY ONLY MOVE DOWN.
 */
export const SHORT_KEYWORD_BUDGET = 22;

export interface ShortKeyword {
    keyword: string;
    rule: string;
    tier: string;
}

interface RouterRule {
    id: string;
    triggers?: Array<Record<string, unknown>>;
}

/** Every ASCII `keyword` trigger of ≤ 3 characters, sorted for stable output. */
export function short_keywords(router: Record<string, unknown>): ShortKeyword[] {
    const out: ShortKeyword[] = [];
    for (const tier of ['tier_1', 'tier_2']) {
        const entries = router[tier];
        if (!Array.isArray(entries)) continue;
        for (const raw of entries) {
            const rule = raw as RouterRule;
            for (const trigger of rule.triggers ?? []) {
                if (!('keyword' in trigger)) continue;
                const keyword = String(trigger['keyword']);
                const ascii = [...keyword].every((c) => c.codePointAt(0)! < 128);
                if (keyword.length <= 3 && ascii) {
                    out.push({ keyword, rule: rule.id, tier });
                }
            }
        }
    }
    out.sort(
        (a, b) =>
            (a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0) ||
            (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0),
    );
    return out;
}

export function main(): number {
    if (!fs.existsSync(ROUTER)) {
        process.stderr.write(
            `error: ${path.relative(REPO_ROOT, ROUTER)} not found — run \`task sync\` first\n`,
        );
        return 1;
    }
    let router: Record<string, unknown>;
    try {
        router = JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Record<string, unknown>;
    } catch (e) {
        process.stderr.write(`error: cannot parse router.json (${String(e)})\n`);
        return 1;
    }

    // The routed-rule population, not `found` below: `found` counts VIOLATIONS,
    // so zero is the direction this ratchet is pushing toward. A router.json
    // regenerated over a moved rule tree parses fine and yields zero short
    // keywords — indistinguishable from a clean run. Exit 1 is the existing
    // "gate could not run" code (missing / unparseable router); 2 stays
    // "over budget".
    const routed = ['tier_1', 'tier_2'].reduce(
        (n, tier) => n + (Array.isArray(router[tier]) ? (router[tier] as unknown[]).length : 0),
        0,
    );
    try {
        assertScanned({
            gate: 'lint_trigger_precision',
            scanned: routed,
            units: 'routed rule(s)',
            roots: ['dist/router.json'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`error: ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const found = short_keywords(router);
    const over = found.length > SHORT_KEYWORD_BUDGET;

    if (over) {
        process.stdout.write(
            `❌  trigger precision: ${found.length} short (≤3 char) keyword triggers > budget ${SHORT_KEYWORD_BUDGET}\n`,
        );
        for (const s of found) {
            process.stdout.write(`      ${s.keyword.padEnd(6)} ${s.rule}  [${s.tier}]\n`);
        }
        process.stdout.write(
            '\n    A short keyword is matched as an unanchored substring, so it fires on\n' +
                '    every word that merely contains it. Lengthen it into an unambiguous\n' +
                '    string, or drop it when a longer trigger on the same rule already\n' +
                '    carries the signal. Raising SHORT_KEYWORD_BUDGET is not the fix.\n',
        );
        return 2;
    }

    process.stdout.write(
        `✅  trigger precision: ${found.length} short (≤3 char) keyword triggers ` +
            `/ budget ${SHORT_KEYWORD_BUDGET}` +
            (found.length < SHORT_KEYWORD_BUDGET
                ? ` — lower the budget to ${found.length} to lock the gain in\n`
                : '\n'),
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
