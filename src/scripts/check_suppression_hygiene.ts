#!/usr/bin/env tsx
/**
 * Suppression hygiene across every human-authored allowlist and baseline.
 *
 * Three properties, all of which this estate previously carried by convention:
 *
 * 1. **Shrink-only, mechanically.** Every list is compared entry-SET against
 *    the base ref, not entry-COUNT against a checked-in number. A count
 *    comparison passes swap-one-out-add-one-in; the set comparison does not.
 *    (`_lib/ratchet_base_ref.ts` carries the mechanism and the rename handling.)
 * 2. **Every human-authored entry carries a `reason`.** An unexplained
 *    suppression cannot be audited by the next reader, and "the diff explains
 *    it" stops being true the moment the diff is six months old.
 * 3. **Every NEW entry additionally carries a `falsifier`** — a re-runnable
 *    command that decides the entry. An entry with a falsifier is a ratchet;
 *    one without is a hole. Existing entries are grandfathered by count rather
 *    than retro-filled, because a retro-fill of 38 entries would be 38 guesses
 *    at what a past author meant, and a plausible-looking guess is worse than
 *    an admitted gap.
 *
 * **Why estate-level rather than one call per gate.** The roadmap step that
 * charters this names the framework-leakage allowlist as the first adopter,
 * and it is first in the inventory below. The enforcement itself lives here,
 * once, for two reasons the per-gate wiring cannot match: a NEW allowlist added
 * next month is caught by the inventory check even if its author never wires
 * anything, and a hot lint that runs on every save does not acquire a
 * dependency on git plumbing (`git show`, rename detection, base-ref
 * resolution) which is exactly where CI-vs-local divergence gets introduced.
 *
 * **Gaming risk.** The cheapest degenerate pass is a `falsifier` field holding
 * a command that always exits 0 (`true`, `echo ok`). This gate rejects the
 * literal degenerate forms and enforces a minimum length; it cannot execute the
 * command to check that it discriminates, and does not pretend to. The residual
 * is a human read at review time, and it is named here so that it is a known
 * gap rather than an assumed guarantee.
 *
 * **Lifecycle.** This gate lands ENFORCED, not advisory, because it was run
 * against the real corpus before wiring and the live estate already satisfies
 * it: all 38 object-tier entries across 10 surfaces carry a `reason`, and the
 * `falsifier` requirement applies to NEW entries only. Advisory-until-empty is
 * the rule for a gate whose corpus has findings on day one; this one had none,
 * and shipping it advisory would have been a hedge rather than a stage.
 *
 * CLI contract: exit 0 = clean, 1 = growth, missing reason, missing falsifier
 * on a new entry, an un-inventoried suppression file, or a dead scope.
 * `--quiet` suppresses the per-file green lines.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import {
    BaseRefUnavailableError,
    compareToBaseRef,
    resolveBaseRef,
    type RatchetComparison,
} from './_lib/ratchet_base_ref.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const QUIET = process.argv.slice(2).includes('--quiet');

/** Minimum characters in a `reason` / `falsifier` before it can be audited. */
export const MIN_REASON_CHARS = 20;

/**
 * Falsifier values that satisfy the schema while deciding nothing.
 *
 * Named explicitly rather than described, so the check is testable.
 */
const DEGENERATE_FALSIFIERS = new Set(['true', ':', 'echo ok', 'exit 0', 'n/a', 'none', 'tbd']);

/**
 * Entry tiers.
 *
 * - `object` — human-authored records; carry `reason`, and `falsifier` when new.
 * - `string_list` — bare-string carve-outs whose entry IS the whole record, so
 *   there is nowhere to put a reason. Subject to no-growth only; a file-level
 *   rationale lives in the JSON's own `_comment` / `_doc` key.
 */
export type SuppressionTier = 'object' | 'string_list';

export interface SuppressionSpec {
    /** Repo-relative path. */
    file: string;
    /** Key holding the entry list (or `null` when the root IS the list). */
    listKey: string | null;
    tier: SuppressionTier;
    /** Field names, in order, that identify an entry for set comparison. */
    keyFields?: readonly string[];
    /** Field carrying the human rationale (`reason` unless noted). */
    reasonField?: string;
    /**
     * Whether the entry SET may gain members.
     *
     * `forbidden` (default) is right for a suppression list: a new entry is a
     * new hole. `requires_falsifier` is right for a registry OF ratchets —
     * `gate-violation-baselines.json` gains an entry every time a new gate
     * records its debt, and refusing that would mean no gate may ever be
     * baselined, which forbids the practice this whole roadmap is asking for.
     * Its shrink-only property is the per-entry `count`, enforced by
     * `_lib/gate_baseline.ts`, not set membership.
     */
    growth?: 'forbidden' | 'requires_falsifier';
    /**
     * Fields that decide whether an entry is position-keyed or content-keyed.
     *
     * The two-tier split this roadmap asks for is, in this tree, entirely about
     * ONE surface: human entries keyed by line number. Nothing here mixes human
     * and machine-generated records — that half of the split is already the
     * shape. What does exist is the recorded drift failure, where inserting a
     * paragraph above an allowlisted line re-fires the ratchet on an entry
     * nobody touched. Reporting the position-keyed count per run makes the
     * migration to content anchors visible instead of aspirational.
     */
    driftKey?: { positionField: string; anchorField: string };
    /**
     * Accept this baseline as absent at the base ref — for the ONE change that
     * introduces it, then removed.
     *
     * Without it a brand-new baseline is a permanent red: the ratchet compares
     * against `origin/main`, where the file does not exist yet, and
     * `ratchet_base_ref` is deliberately fail-closed there because
     * absent-at-base and mistyped-path look identical from inside. Setting it
     * makes the verdict `new_baseline` rather than growth, so the bootstrap
     * entries are not each reported as a new hole.
     *
     * Remove the flag once the introducing commit is an ancestor of the base
     * ref — leaving it set would silently accept a later mistyped path. That
     * removal is **enforced, not remembered**: the scan below fails when the
     * flag is set and the baseline already resolves at the base ref, so the
     * flag closes itself one merge after it was needed.
     */
    newInThisChange?: boolean;
    /** Why this list exists at all — printed with the count, so absence is visible. */
    what: string;
}

/**
 * The declared inventory of human-authored suppression surfaces.
 *
 * `check_suppression_inventory` (below) fails when a `*allowlist*.json` or
 * `*baseline*.json` exists under the scanned roots and is absent here — an
 * allowlist nobody listed is an allowlist nobody ratchets.
 */
export const SUPPRESSION_INVENTORY: readonly SuppressionSpec[] = [
    {
        file: 'src/scripts/lint_framework_leakage_allowlist.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['file'],
        driftKey: { positionField: 'lines', anchorField: 'anchor' },
        what: 'per-line framework-token exemptions in generic artefacts',
    },
    {
        file: 'src/scripts/pack_dependency_allowlist.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['pack', 'slug'],
        what: 'cross-pack dependency edges accepted as-is',
    },
    {
        file: 'src/scripts/lint_skill_originality_allowlist.json',
        listKey: 'pairs',
        tier: 'object',
        keyFields: ['skill_a', 'skill_b'],
        what: 'skill pairs allowed to overlap',
    },
    {
        file: 'src/scripts/lint_workflow_security_allowlist.json',
        listKey: 'findings',
        tier: 'object',
        keyFields: ['workflow', 'rule'],
        what: 'accepted workflow-security findings',
    },
    {
        file: 'src/scripts/lint_skill_scripts_readonly_allowlist.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['path'],
        what: 'skill scripts permitted to write',
    },
    {
        file: 'src/scripts/audit_skill_overlap_allowlist.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['skill_a', 'skill_b', 'path'],
        what: 'accepted skill-overlap findings',
    },
    {
        file: 'src/scripts/lint_skill_descriptions_allowlist.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['skill', 'path'],
        what: 'accepted skill-description findings',
    },
    {
        file: 'src/scripts/check_no_conflict_markers_allowlist.json',
        listKey: 'files',
        tier: 'string_list',
        what: 'files permitted to contain conflict-marker-shaped text',
    },
    {
        file: 'src/scripts/external_sources_denylist.json',
        listKey: 'skip_paths',
        tier: 'string_list',
        what: 'paths exempt from the external-source scan',
    },
    {
        file: 'src/config/lapsed-beta-baseline.json',
        listKey: 'contracts',
        tier: 'string_list',
        // `newInThisChange` removed 2026-08-26: the baseline resolves at the base
        // ref, so the bootstrap window this flag exists for has closed. Same
        // self-closing contract as the sibling entry below — the gate reported
        // the stale flag rather than leaving it to silently accept a future
        // mistyped path as a fresh baseline forever.

        what:
            'beta contracts already lapsed at 2026-08-25, which WARN instead of ' +
            'failing check_beta_review_markers — every lapse outside this list is ' +
            'an error, so the list is the ratchet and may not grow',
    },
    {
        file: 'src/config/gate-violation-baselines.json',
        listKey: 'gates',
        tier: 'object',
        reasonField: 'note',
        growth: 'requires_falsifier',
        what: 'per-gate known-debt counts',
    },
    {
        // The root IS the list — a bare array of rule filenames, so entries are
        // content-keyed by construction and cannot drift on line numbers.
        // `forbidden` growth is the whole point: this baseline exists so a NEW
        // rule cannot join the silent set, and `lint_rule_enforcement_declaration`
        // additionally fails when an entry stops being undeclared, so the list is
        // shrink-only from both directions.
        file: 'src/config/rule-enforcement-baseline.json',
        listKey: null,
        tier: 'string_list',
        what: 'rules predating the enforced_by-declaration ratchet',
    },
    {
        // Two committed prompt→verdict bindings that do not re-derive. Both
        // sit inside round records § 2.7 declares immutable, so neither may be
        // repaired by editing the record — the entry pins BOTH hashes, so a
        // later repair or a further corruption reds instead of passing.
        file: 'src/config/review-prompt-binding-baseline.json',
        listKey: 'entries',
        tier: 'object',
        keyFields: ['slug'],
        // `newInThisChange` removed: the baseline now resolves at the base ref,
        // so the bootstrap window this flag exists for has closed. That is the
        // self-closing contract below working as designed — the gate reported
        // the stale flag rather than leaving it to silently accept a future
        // mistyped path as a fresh baseline.
        what: 'review prompts whose recorded prompt_hash does not re-derive',
    },
];

export interface SuppressionFinding {
    file: string;
    entry: string;
    kind: 'growth' | 'missing_reason' | 'missing_falsifier' | 'degenerate_falsifier' | 'uninventoried';
    detail: string;
}

interface LoadedEntry {
    key: string;
    reason: string;
    falsifier: string;
    /** True when the entry is keyed by position and carries no content anchor. */
    positionKeyed: boolean;
}

function entryKey(spec: SuppressionSpec, value: unknown, index: number): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value !== null && typeof value === 'object') {
        const rec = value as Record<string, unknown>;
        const parts = (spec.keyFields ?? []).map((f) => (typeof rec[f] === 'string' ? String(rec[f]) : ''));
        const joined = parts.filter((p) => p !== '').join('|');
        if (joined !== '') {
            return joined;
        }
    }
    return `#${String(index)}`;
}

/** Read one suppression file into comparable entries. */
export function loadEntries(spec: SuppressionSpec, repoRoot = REPO_ROOT): LoadedEntry[] {
    const raw = fs.readFileSync(path.join(repoRoot, spec.file), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const container = spec.listKey === null ? parsed : (parsed as Record<string, unknown>)[spec.listKey];
    const reasonField = spec.reasonField ?? 'reason';

    const rows: LoadedEntry[] = [];
    const push = (value: unknown, key: string): void => {
        const rec = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
        const drift = spec.driftKey;
        const anchored =
            drift !== undefined &&
            typeof rec[drift.anchorField] === 'string' &&
            String(rec[drift.anchorField]).trim() !== '';
        const positional =
            drift !== undefined && Array.isArray(rec[drift.positionField]) && !anchored;
        rows.push({
            key,
            reason: typeof rec[reasonField] === 'string' ? String(rec[reasonField]).trim() : '',
            falsifier: typeof rec['falsifier'] === 'string' ? String(rec['falsifier']).trim() : '',
            positionKeyed: positional,
        });
    };

    if (Array.isArray(container)) {
        container.forEach((item, i) => push(item, entryKey(spec, item, i)));
    } else if (container !== null && typeof container === 'object') {
        for (const [k, v] of Object.entries(container as Record<string, unknown>)) {
            push(v, k);
        }
    }
    return rows;
}

/** Every `*allowlist*.json` / `*baseline*.json` under the scanned roots. */
export function discoverSuppressionFiles(repoRoot = REPO_ROOT): string[] {
    const roots = ['src/scripts', 'src/config'];
    const out: string[] = [];
    for (const root of roots) {
        const dir = path.join(repoRoot, root);
        let names: string[];
        try {
            names = fs.readdirSync(dir);
        } catch {
            continue;
        }
        for (const name of names) {
            if (!name.endsWith('.json')) {
                continue;
            }
            if (/allowlist|denylist|baselines?/i.test(name)) {
                out.push(`${root}/${name}`);
            }
        }
    }
    return out.sort();
}

export function main(): number {
    const findings: SuppressionFinding[] = [];
    const ledger = new GateLedger('check_suppression_hygiene');

    // An un-inventoried suppression file is the growth path this gate would
    // otherwise miss entirely: adding a brand-new allowlist is unbounded growth
    // that no per-file ratchet can see.
    const declared = new Set(SUPPRESSION_INVENTORY.map((s) => s.file));
    const discovered = discoverSuppressionFiles();
    for (const file of discovered) {
        if (!declared.has(file)) {
            findings.push({
                file,
                entry: '(whole file)',
                kind: 'uninventoried',
                detail:
                    'a suppression-shaped file that SUPPRESSION_INVENTORY does not declare — add it ' +
                    'there (with its entry shape) so it is ratcheted, or rename it if it is not a ' +
                    'suppression surface',
            });
        }
    }

    try {
        assertScanned({
            gate: 'check_suppression_hygiene',
            scanned: SUPPRESSION_INVENTORY.length,
            units: 'suppression file(s)',
            roots: ['src/scripts', 'src/config'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const baseRef = resolveBaseRef(REPO_ROOT);
    if (baseRef === null) {
        process.stderr.write(
            '❌  check_suppression_hygiene: no base ref resolves (tried RATCHET_BASE_REF, ' +
                'GITHUB_BASE_REF, the PR merge parent, origin/main, main). A shrink-only check ' +
                'that cannot see its "before" has verified nothing, so this is a failure rather ' +
                'than a skip.\n',
        );
        return 1;
    }

    ledger.plan(SUPPRESSION_INVENTORY.map((s) => s.file));
    const lines: string[] = [];

    for (const spec of SUPPRESSION_INVENTORY) {
        const absolute = path.join(REPO_ROOT, spec.file);
        if (!fs.existsSync(absolute)) {
            // A declared file that vanished is a dead entry in the inventory,
            // not an absence of findings.
            ledger.fail(spec.file, 'declared in SUPPRESSION_INVENTORY but absent on disk');
            findings.push({
                file: spec.file,
                entry: '(whole file)',
                kind: 'uninventoried',
                detail: 'declared in SUPPRESSION_INVENTORY but absent on disk',
            });
            continue;
        }

        const entries = loadEntries(spec);
        const reasonField = spec.reasonField ?? 'reason';

        // Declared BEFORE the stale-flag branch below, which is a file-level
        // finding: it must feed the single terminal resolution at the end of
        // this iteration rather than resolve the target itself. Resolving twice
        // is a `LedgerUsageError` that aborts the whole gate.
        let fileFindings = 0;

        let comparison: RatchetComparison;
        try {
            comparison = compareToBaseRef({
                baselinePath: spec.file,
                baseRef,
                repoRoot: REPO_ROOT,
                entriesOf: (parsed) => entriesOfSpec(spec, parsed),
                ...(spec.newInThisChange === true ? { allowNewBaseline: true } : {}),
            });
            // Self-closing bootstrap flag. `newInThisChange` exists for the ONE
            // change that introduces a baseline, and the comment on the field says
            // to remove it afterwards — which is exactly the kind of instruction
            // that gets forgotten, because nothing goes red when it is ignored and
            // a stale flag silently accepts a later mistyped path. So the check
            // closes itself: once the baseline resolves at the base ref, the
            // verdict is no longer `new_baseline`, and keeping the flag is a
            // finding rather than a note in someone's follow-up list.
            if (spec.newInThisChange === true && comparison.verdict !== 'new_baseline') {
                const detail =
                    `\`newInThisChange\` is still set, but the baseline now resolves at ${baseRef} — ` +
                    'the flag has served its purpose and must be removed from SUPPRESSION_INVENTORY. ' +
                    'Leaving it set makes a future mistyped path pass as a new baseline forever.';
                findings.push({ file: spec.file, entry: '(whole file)', kind: 'uninventoried', detail });
                fileFindings += 1;
            }
        } catch (exc) {
            if (exc instanceof BaseRefUnavailableError) {
                ledger.fail(spec.file, exc.message);
                findings.push({ file: spec.file, entry: '(whole file)', kind: 'growth', detail: exc.message });
                continue;
            }
            throw exc;
        }

        const added = new Set(comparison.added);

        for (const entry of entries) {
            if (spec.tier === 'object' && entry.reason.length < MIN_REASON_CHARS) {
                findings.push({
                    file: spec.file,
                    entry: entry.key,
                    kind: 'missing_reason',
                    detail: `\`${reasonField}\` is missing or shorter than ${String(MIN_REASON_CHARS)} characters`,
                });
                fileFindings += 1;
            }
            if (!added.has(entry.key)) {
                continue; // grandfathered: falsifier is required of NEW entries only
            }
            if (comparison.verdict === 'growth' && (spec.growth ?? 'forbidden') === 'forbidden') {
                findings.push({
                    file: spec.file,
                    entry: entry.key,
                    kind: 'growth',
                    detail: `absent at ${baseRef} — this list is shrink-only`,
                });
                fileFindings += 1;
            }
            if (spec.tier !== 'object') {
                continue;
            }
            if (entry.falsifier.length < MIN_REASON_CHARS) {
                findings.push({
                    file: spec.file,
                    entry: entry.key,
                    kind: 'missing_falsifier',
                    detail:
                        'a NEW entry must carry `falsifier`: a re-runnable command that decides it. ' +
                        'An entry with a falsifier is a ratchet; one without is a hole',
                });
                fileFindings += 1;
            } else if (DEGENERATE_FALSIFIERS.has(entry.falsifier.toLowerCase())) {
                findings.push({
                    file: spec.file,
                    entry: entry.key,
                    kind: 'degenerate_falsifier',
                    detail: `\`${entry.falsifier}\` always succeeds — it decides nothing`,
                });
                fileFindings += 1;
            }
        }

        if (fileFindings > 0) {
            ledger.fail(spec.file, `${String(fileFindings)} finding(s)`);
        } else {
            ledger.complete(spec.file);
        }

        const reset = comparison.verdict === 'reset' ? ` — RE-BASELINED: ${comparison.resetReason ?? ''}` : '';
        const positional = entries.filter((e) => e.positionKeyed).length;
        const drift =
            positional > 0 ? `, ${String(positional)} position-keyed (drift-fragile, migrate to anchors)` : '';
        lines.push(
            `  ${spec.file}: ${String(entries.length)} entry(ies) (${String(comparison.baseCount)} at base, ` +
                `${String(comparison.removed.length)} removed)${drift} — ${spec.what}${reset}`,
        );
    }

    process.stdout.write(
        `suppression hygiene: ${String(SUPPRESSION_INVENTORY.length)} declared surface(s), ` +
            `${String(discovered.length)} discovered, base ${baseRef}\n`,
    );
    if (!QUIET) {
        for (const line of lines) {
            process.stdout.write(`${line}\n`);
        }
    }
    ledger.report();
    process.stdout.write(`scanned: ${String(SUPPRESSION_INVENTORY.length)}\n`);

    if (findings.length > 0) {
        process.stderr.write(`\n❌  ${String(findings.length)} suppression-hygiene finding(s):\n`);
        for (const f of findings) {
            process.stderr.write(`    ${f.file} → ${f.entry} [${f.kind}]\n        ${f.detail}\n`);
        }
        return 1;
    }
    return 0;
}

/** Entry keys for one spec, applied to a parsed baseline from either side. */
export function entriesOfSpec(spec: SuppressionSpec, parsed: unknown): string[] {
    const container = spec.listKey === null ? parsed : (parsed as Record<string, unknown>)[spec.listKey];
    if (Array.isArray(container)) {
        return container.map((item, i) => entryKey(spec, item, i));
    }
    if (container !== null && typeof container === 'object') {
        return Object.keys(container as Record<string, unknown>);
    }
    return [];
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (installed projection, or macOS /var → /private/var
    // temp dirs) makes the raw URLs differ: compare realpaths so the entry guard
    // still fires instead of silently no-opping.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { QUIET };
