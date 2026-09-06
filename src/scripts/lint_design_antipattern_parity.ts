/**
 * Gate: catalog ↔ slop-rule parity (road-to-design-detector-evidence Phase 1).
 *
 * `src/scripts/design_slop_rules.ts` states in its header that every rule cites
 * its catalog id "so prose ↔ rule stay traceable". Nothing enforced that. The
 * unit test validates the *shape* `/^[A-Z]+\d+$/` and never opens
 * `docs/guidelines/design-antipatterns.md`, so a rule citing `Z99` passed, and a
 * catalog entry could silently lose or gain a detector with no signal anywhere.
 * The tree happened to be consistent; the defect was that consistency was
 * unguarded, not that it was absent.
 *
 * This gate makes the claim true, in both directions:
 *
 *   A. every non-`Q*` catalog entry appears exactly once in § Detector status
 *   B. every § Detector status row names a catalog entry that exists
 *   C. the set of `backed` rows equals the registry's `catalogId` set
 *   D. every status is one of the five allowed values
 *   E. every non-`backed` row carries a reason
 *
 * `Q*` entries are out of scope by construction: they are objective floors owned
 * by `lint_design_quality`, not aesthetic tells, and the status table says so.
 *
 * Pure core (`parityFindings`) takes both documents as text, so the failure
 * paths are unit-testable without the filesystem. Exit 0 = clean, 1 = at least
 * one finding.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const QUIET = process.argv.includes('--quiet');
const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const CATALOG = path.join(REPO, 'docs', 'guidelines', 'design-antipatterns.md');
const REGISTRY = path.join(REPO, 'src', 'scripts', 'design_slop_rules.ts');

/** The five statuses § Detector status may use. */
export const STATUSES = ['backed', 'floor', 'judgment-only', 'deferred', 'candidate'] as const;
export type Status = (typeof STATUSES)[number];

export interface ParityFinding {
    kind: string;
    msg: string;
    /**
     * The catalog id this finding is about, when it is about one.
     *
     * Carried explicitly so the per-target ledger can attribute a failure
     * without parsing it back out of `msg`. Absent on structural findings
     * (a missing § Detector status section is about the document, not an id).
     */
    id?: string;
}

const ENTRY_ROW = /^\|\s*((?:V|C|T|L|M|CP)\d+)\s*\|/gm;
const STATUS_ROW = /^\|\s*((?:V|C|T|L|M|CP)\d+)\s*\|\s*([a-z-]*)\s*\|([^|]*)\|/gm;
const STATUS_SECTION = /^## Detector status$([\s\S]*?)(?=^## )/m;
const CATALOG_ID = /^\s+catalogId:\s*"([A-Z]+\d+)"/gm;

/** The five classes a catalog row may claim (road-to-one-motion-authority 2.1). */
export const CLASSES = ['floor', 'invariant', 'craft-presumption', 'style-preference', 'reference-constraint'] as const;
/** How a fix is checked. `feel` is the perceptual mode `evidence-artifact-types.md` adds. */
export const VERIFICATIONS = ['static', 'render', 'feel', 'judgment'] as const;
/** Remediation names an order, worst-first, drawn from these verbs. */
export const REMEDIATION_VERBS = ['delete', 'reduce', 'retune', 'replace'] as const;

export interface CensusCells { class: string; remediation: string; verification: string }

const CENSUS_ROW = /^\|\s*((?:V|C|T|L|M|CP)\d+)\s*\|(.*)$/gm;

/**
 * The three census cells per catalog entry, read from the LAST three columns.
 *
 * Read positionally from the end rather than by header index because the four
 * original columns carry free prose containing pipes inside inline code, and a
 * header-indexed read would mis-align on exactly the rows whose prose is
 * richest. The three census cells are short closed-vocabulary tokens, so the
 * tail of the row is the one part that parses reliably.
 */
export function censusCells(catalogMd: string): Map<string, CensusCells> {
    const section = STATUS_SECTION.exec(catalogMd)?.[0] ?? '';
    const outside = section === '' ? catalogMd : catalogMd.replace(section, '');
    const out = new Map<string, CensusCells>();
    for (const m of outside.matchAll(CENSUS_ROW)) {
        const cells = (m[2] ?? '').split('|').map((c) => c.trim());
        while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
        if (cells.length < 6) continue;
        out.set(m[1] as string, {
            class: cells[cells.length - 3] ?? '',
            remediation: cells[cells.length - 2] ?? '',
            verification: cells[cells.length - 1] ?? '',
        });
    }
    return out;
}

/** Catalog entry ids outside the § Detector status section. */
export function catalogEntries(catalogMd: string): string[] {
    const section = STATUS_SECTION.exec(catalogMd)?.[0] ?? '';
    const outside = section === '' ? catalogMd : catalogMd.replace(section, '');
    return [...outside.matchAll(ENTRY_ROW)].map((m) => m[1] as string);
}

/** `id -> {status, note}` parsed from the § Detector status table. */
export function statusRows(catalogMd: string): Map<string, { status: string; note: string }> {
    const section = STATUS_SECTION.exec(catalogMd)?.[1] ?? '';
    const out = new Map<string, { status: string; note: string }>();
    for (const m of section.matchAll(STATUS_ROW)) {
        out.set(m[1] as string, { status: (m[2] ?? '').trim(), note: (m[3] ?? '').trim() });
    }
    return out;
}

/** `catalogId` values declared by the rule registry. */
export function registryCatalogIds(registryTs: string): string[] {
    return [...registryTs.matchAll(CATALOG_ID)].map((m) => m[1] as string);
}

/** Pure invariant check over both documents. */
export function parityFindings(catalogMd: string, registryTs: string): ParityFinding[] {
    const out: ParityFinding[] = [];

    if (STATUS_SECTION.exec(catalogMd) === null) {
        return [
            {
                kind: 'no-status-section',
                msg: 'design-antipatterns.md has no `## Detector status` section — the parity claim has nothing to check against',
            },
        ];
    }

    const entries = catalogEntries(catalogMd);
    const seen = new Set<string>();
    for (const id of entries) {
        if (seen.has(id)) out.push({ kind: 'duplicate-entry', id, msg: `${id}: appears more than once in the catalog tables` });
        seen.add(id);
    }

    const rows = statusRows(catalogMd);

    // A — every catalog entry is classified.
    for (const id of seen) {
        if (!rows.has(id)) {
            out.push({ kind: 'unclassified', id, msg: `${id}: catalog entry missing from § Detector status` });
        }
    }
    // B — every classified row names a real entry.
    for (const id of rows.keys()) {
        if (!seen.has(id)) {
            out.push({ kind: 'orphan-status', id, msg: `${id}: § Detector status row names an entry that no catalog table defines` });
        }
    }
    // D + E — status vocabulary and reasons.
    for (const [id, row] of rows) {
        if (!(STATUSES as readonly string[]).includes(row.status)) {
            out.push({
                kind: 'bad-status',
                id,
                msg: `${id}: status '${row.status || '(empty)'}' is not one of ${STATUSES.join(', ')}`,
            });
            continue;
        }
        if (row.status !== 'backed' && row.note === '') {
            out.push({ kind: 'missing-reason', id, msg: `${id}: status '${row.status}' carries no reason` });
        }
    }

    // F — the census columns: present, non-empty, and from the closed vocabularies.
    const census = censusCells(catalogMd);
    for (const id of seen) {
        const cells = census.get(id);
        if (cells === undefined) {
            out.push({ kind: 'missing-census', id, msg: `${id}: catalog row carries no class / remediation / verification cells` });
            continue;
        }
        if (!(CLASSES as readonly string[]).includes(cells.class)) {
            out.push({ kind: 'bad-class', id, msg: `${id}: class '${cells.class || '(empty)'}' is not one of ${CLASSES.join(', ')}` });
        }
        if (!(VERIFICATIONS as readonly string[]).includes(cells.verification)) {
            out.push({ kind: 'bad-verification', id, msg: `${id}: verification '${cells.verification || '(empty)'}' is not one of ${VERIFICATIONS.join(', ')}` });
        }
        const verbs = cells.remediation.split('→').map((v) => v.trim()).filter((v) => v !== '');
        if (verbs.length === 0 || !verbs.every((v) => (REMEDIATION_VERBS as readonly string[]).includes(v))) {
            out.push({ kind: 'bad-remediation', id, msg: `${id}: remediation '${cells.remediation || '(empty)'}' is not a → order over ${REMEDIATION_VERBS.join(', ')}` });
        }
    }

    // G — the two axes are INDEPENDENT (road-to-one-motion-authority Risk 3).
    // Class is a property of the rule, status a property of its enforcement.
    // A `floor` that nothing can detect is legitimately `judgment-only`, and a
    // `style-preference` that happens to be greppable is legitimately `backed`.
    // This gate asserts the independence positively rather than merely allowing
    // it: a run in which class turned out to determine status would mean the
    // second axis had collapsed into the first and is carrying no information.
    const pairs = [...seen]
        .map((id) => ({ cls: census.get(id)?.class ?? '', status: rows.get(id)?.status ?? '' }))
        .filter((p) => p.cls !== '' && p.status !== '');
    const byClass = new Map<string, Set<string>>();
    for (const p of pairs) {
        const set = byClass.get(p.cls) ?? new Set<string>();
        set.add(p.status);
        byClass.set(p.cls, set);
    }
    if (pairs.length > 0 && [...byClass.values()].every((statuses) => statuses.size === 1)) {
        out.push({
            kind: 'axes-collapsed',
            msg: 'every class maps to exactly one status — the class column is carrying no information the status column does not already carry. Class describes the rule, status describes its enforcement; if they have become the same axis, one of them is wrong.',
        });
    }

    // C — backed set equals the registry set, both directions.
    const backed = new Set([...rows].filter(([, r]) => r.status === 'backed').map(([id]) => id));
    const registry = new Set(registryCatalogIds(registryTs));
    for (const id of backed) {
        if (!registry.has(id)) {
            out.push({ kind: 'backed-without-rule', id, msg: `${id}: marked backed but no registry rule declares that catalogId` });
        }
    }
    for (const id of registry) {
        if (!backed.has(id)) {
            const known = rows.get(id);
            out.push({
                kind: 'rule-without-backed',
                id,
                msg: known
                    ? `${id}: a registry rule declares this catalogId but § Detector status marks it '${known.status}'`
                    : `${id}: a registry rule declares this catalogId and no catalog entry carries it`,
            });
        }
    }

    return out;
}

function _print(s: string): void {
    if (!QUIET) process.stdout.write(`${s}\n`);
}

export function main(): number {
    try {
        assertWatchlistResolves({
            gate: 'lint_design_antipattern_parity',
            candidates: [path.relative(REPO, CATALOG), path.relative(REPO, REGISTRY)],
            repoRoot: REPO,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const catalogMd = fs.readFileSync(CATALOG, 'utf-8');
    const registryTs = fs.readFileSync(REGISTRY, 'utf-8');
    const findings = parityFindings(catalogMd, registryTs);

    const rows = statusRows(catalogMd);
    const entries = catalogEntries(catalogMd).length;
    const backed = [...rows.values()].filter((r) => r.status === 'backed').length;

    // Per-target completeness accounting. The target is a catalog ID, and the
    // planned set is the UNION of the three places an id can appear — catalog
    // tables, the § Detector status table, and the rule registry — because this
    // gate's whole subject is parity BETWEEN those sets. Planning only the
    // catalog would leave an orphan status row or a registry-only id
    // unaccounted, which is the direction the gate exists to catch.
    const ledger = new GateLedger('lint_design_antipattern_parity');
    const targets = [
        ...new Set([
            ...catalogEntries(catalogMd),
            ...rows.keys(),
            ...registryCatalogIds(registryTs),
        ]),
    ].sort();
    ledger.plan(targets);
    const failedIds = new Set(findings.map((f) => f.id).filter((v): v is string => v !== undefined));
    for (const id of targets) {
        if (failedIds.has(id)) ledger.fail(id, 'parity finding');
        else ledger.complete(id);
    }
    ledger.report();

    if (findings.length === 0) {
        _print(`✅  catalog ↔ rule parity OK — ${entries} entries classified, ${backed} detector-backed`);
        return 0;
    }
    _print(`❌  catalog ↔ rule parity — ${findings.length} finding(s):`);
    for (const f of findings) _print(`  - ${f.msg}`);
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
