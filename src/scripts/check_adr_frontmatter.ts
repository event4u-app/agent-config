#!/usr/bin/env tsx
/**
 * ADR frontmatter gate — and the `review_trigger` field that makes a decision
 * revisitable on purpose rather than by archaeology.
 *
 * Two findings drive this. First, ADR frontmatter was **entirely unvalidated**:
 * `validate_frontmatter.ts` covers skills, rules, commands, and personas, and
 * nothing covered `docs/decisions/`. That is why `review_date` drifted into 11
 * ADRs and back out again with nobody noticing.
 *
 * Second, of 128 ADRs, zero named the condition under which they should be
 * reconsidered — while `decision-record` SKILL § step 4 already *mandates* a
 * "Revisit-if" line and `decision-revisit-gate` already treats an ADR as a lock
 * that must be re-openable. The doctrine was canon; the template just never
 * emitted a slot for it, so 33 authors wrote it in prose and it stayed
 * unfindable. This is a missing field, not a missing idea.
 *
 * `review_trigger` is a named CONDITION, never a date. "Review annually" is
 * ignored by everyone and rots into ceremony; "when a second consumer reports a
 * preservation surprise" fires exactly when it should.
 *
 * Grandfathering is by authorship date, not an allowlist: ADRs dated before the
 * switch warn, ADRs dated on or after it fail. No list to maintain and no
 * exemption to forget — a retrofit of 128 files would be busywork that teaches
 * nobody anything.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_adr_frontmatter          # gate
 *   ./scripts-run src/scripts/check_adr_frontmatter --json
 *
 * Exit codes: 0 ok (warnings allowed) · 1 violation · 2 usage/env error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import {
    type AdrFrontmatter,
    AUTHORITY_BASES,
    AGENTIC_MODES,
    DISCOVERY_STATES,
    EVIDENCE_STRENGTHS,
    PROVENANCE_KINDS,
    evidenceOf,
    provenanceOf,
    readAdrFrontmatter,
    readAdrFrontmatterScalars,
} from './_lib/adr_frontmatter.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs', 'decisions');

/**
 * Grandfathering switch. ADRs dated before this warn on a missing
 * `review_trigger`; ADRs dated on or after it fail.
 */
export const REVIEW_TRIGGER_SINCE = '2026-07-25';

/** Fields every ADR must carry — the shape that already exists in practice. */
const REQUIRED = ['adr', 'status', 'date', 'decision'] as const;

/**
 * Reopen-authority vocabulary (`adr-layout.md` § Reopen authority).
 *
 * Both fields are OPTIONAL and stay optional. An absent `reopen_policy`
 * resolves to `unclassified` at the reader, never to `owner`: with 146 accepted
 * ADRs a fail-closed default would encode the existing blockage into the new
 * schema, which is the one thing both council seats (2026-08-19) rejected in
 * the same words. This validator therefore checks the VALUE when present and
 * never requires the KEY.
 */
const ALLOWED_REOPEN_POLICY = new Set(['directional', 'owner', 'unclassified']);

const ALLOWED_PROTECTED_DIMENSIONS = new Set([
    'purpose',
    'security_floor',
    'privacy_floor',
    'external_commitment',
    'governance',
    'none',
]);

/** Split an inline `[a, b]` list or a folded multi-value string into members. */
export function split_dimensions(raw: string): string[] {
    return raw
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(/[,\s]+/)
        .map((s) =>
            s
                .trim()
                .replace(/^-\s*/, '')
                .replace(/^["'](.*)["']$/, '$1'),
        )
        .filter((s) => s !== '');
}

/**
 * Validate the two optional reopen-authority fields — value only, never
 * presence. A wrong enum is a real error (it silently mis-routes authority);
 * an absent field is the documented default and not a finding.
 */
export function check_reopen_authority(
    rel: string,
    fm: Record<string, string>,
    findings: AdrFinding[],
): void {
    const policy = fm['reopen_policy'];
    if (policy !== undefined && policy !== '' && !ALLOWED_REOPEN_POLICY.has(policy)) {
        findings.push({
            file: rel,
            level: 'error',
            message:
                `\`reopen_policy\` \`${policy}\` is not one of: ` +
                `${[...ALLOWED_REOPEN_POLICY].sort().join(', ')} (absent = unclassified)`,
        });
    }

    const dims = fm['protected_dimensions'];
    if (dims !== undefined && dims !== '') {
        for (const d of split_dimensions(dims)) {
            if (!ALLOWED_PROTECTED_DIMENSIONS.has(d)) {
                findings.push({
                    file: rel,
                    level: 'error',
                    message:
                        `\`protected_dimensions\` member \`${d}\` is not one of: ` +
                        `${[...ALLOWED_PROTECTED_DIMENSIONS].sort().join(', ')}`,
                });
            }
        }
    }

    // `owner` without a named dimension is the frozen-over-classification shape
    // the contract warns about: it reserves every future transition, including
    // the ones that only strengthen the decision, and records no reason.
    if (policy === 'owner' && (dims === undefined || dims === '')) {
        findings.push({
            file: rel,
            level: 'warn',
            message:
                '`reopen_policy: owner` without `protected_dimensions` — name the reserved ' +
                'interest, or the reservation cannot be checked against a proposed transition',
        });
    }
}

const ALLOWED_STATUS = new Set([
    'accepted',
    'proposed',
    'superseded',
    'rejected',
    'deprecated',
    'draft',
]);

export interface AdrFinding {
    file: string;
    level: 'error' | 'warn';
    message: string;
}

/**
 * Read the leading `---` block.
 *
 * Delegates to the shared reader (`_lib/adr_frontmatter.ts`) rather than
 * carrying a fourth copy: the nested `provenance` / `evidence` axes cannot be
 * read by the scalar-only parser this function used to be, and a corpus
 * equivalence test holds the shared reader to this one's exact scalar output
 * for every ADR in the tree. Re-exported because the test suite imports it.
 */
export function parse_frontmatter(text: string): Record<string, string> | null {
    return readAdrFrontmatterScalars(text);
}

/** A trigger must name a condition. A bare cadence is the failure mode. */
export function trigger_is_meaningful(value: string): boolean {
    const v = value.trim();
    if (v.length < 20) return false;
    // "annually" / "every 6 months" / a bare date is a calendar, not a condition.
    if (/^(annually|yearly|quarterly|monthly|every\s+\d+\s+\w+|\d{4}-\d{2}-\d{2})\.?$/i.test(v)) {
        return false;
    }
    return true;
}

/** Every frontmatter finding for one ADR file. Pure — no I/O, no enumeration. */
export function check_one(rel: string, text: string): AdrFinding[] {
    const findings: AdrFinding[] = [];
    const fm = parse_frontmatter(text);

    if (fm === null) {
        findings.push({ file: rel, level: 'error', message: 'no YAML frontmatter block' });
        return findings;
    }
    for (const req of REQUIRED) {
        if (!fm[req]) findings.push({ file: rel, level: 'error', message: `missing \`${req}\`` });
    }
    if (fm['status'] && !ALLOWED_STATUS.has(fm['status'])) {
        findings.push({
            file: rel,
            level: 'error',
            message: `status \`${fm['status']}\` is not one of: ${[...ALLOWED_STATUS].sort().join(', ')}`,
        });
    }

    const date = fm['date'] ?? '';
    const grandfathered = date !== '' && date < REVIEW_TRIGGER_SINCE;
    const trigger = fm['review_trigger'];

    if (!trigger) {
        findings.push({
            file: rel,
            level: grandfathered ? 'warn' : 'error',
            message: grandfathered
                ? `no \`review_trigger\` (grandfathered — dated ${date}, before ${REVIEW_TRIGGER_SINCE})`
                : `missing \`review_trigger\` — name the CONDITION that would reopen this decision`,
        });
    } else if (!trigger_is_meaningful(trigger)) {
        findings.push({
            file: rel,
            level: grandfathered ? 'warn' : 'error',
            message: `\`review_trigger\` is a cadence, not a condition: "${trigger}". A calendar review is ignored; an event fires.`,
        });
    }
    check_reopen_authority(rel, fm, findings);
    check_amendment_shape(rel, fm, findings);
    const parsed = readAdrFrontmatter(text);
    if (parsed !== null) check_descriptive_axes(rel, parsed, findings);
    return findings;
}

/**
 * The permanence vocabulary, checked on the `decision` slug and on the value of
 * any frontmatter key.
 *
 * ADR-208 is why this is a frontmatter check and not only a prose one: its
 * `decision:` slug is literally `dist-agent-src-keep-forever`, so the
 * permanence claim is in the metadata a tool reads, not only in the body a
 * human reads.
 */
const PERMANENCE_RE = /\b(forever|permanently|permanent|never revisit|never reconsider|settled forever)\b/i;

/** `terminal`, `none` and their kin are permanence wearing a field name. */
const INVALID_TRIGGER_VALUES = new Set(['terminal', 'none', 'n/a', 'na', '-', '—', 'never']);

/**
 * Validate `provenance`, `evidence`, `authority_basis` and the trigger's
 * transitional vocabulary.
 *
 * Staged on purpose (`adr-layout § Provenance and evidence`): a NEW record must
 * carry the axes, an existing one may not. 88 of the 147 accepted records
 * carry no `review_trigger` at all, so a same-day hard requirement would have
 * made the tree invalid on the day this landed and forced the schema and the
 * backfill into one unreviewable change. What is rejected at every stage is a
 * value that asserts permanence — `terminal` is not a migration state, it is
 * the thing the staging exists to avoid becoming permanent.
 *
 * Everything here is shape validation. Nothing in this function grants an
 * agent authority over anything, and `authority_basis` is checked precisely so
 * it cannot be used to route around the owner.
 */
export function check_descriptive_axes(
    rel: string,
    fm: AdrFrontmatter,
    findings: AdrFinding[],
): AdrFinding[] {
    const status = fm.scalars['status'] ?? '';
    const historical = status === 'superseded' || status === 'rejected' || status === 'deprecated';

    // --- review_trigger vocabulary: invalid values are invalid at every stage.
    const trigger = (fm.scalars['review_trigger'] ?? '').trim();
    if (trigger !== '' && !historical) {
        if (INVALID_TRIGGER_VALUES.has(trigger.toLowerCase())) {
            findings.push({
                file: rel,
                level: 'error',
                message: `\`review_trigger: ${trigger}\` is permanence under a field name. Every accepted decision has a conceivable reopening condition — write a narrow one, or \`unclassified\` while the migration runs.`,
            });
        } else if (trigger.toLowerCase() !== 'unclassified' && PERMANENCE_RE.test(trigger)) {
            findings.push({
                file: rel,
                level: 'error',
                message: `\`review_trigger\` asserts permanence ("${trigger.slice(0, 60)}…"). A trigger names the condition under which the decision stops holding.`,
            });
        }
    }

    // --- provenance
    const provenance = provenanceOf(fm);
    if (fm.scalars['provenance'] !== undefined && provenance === null) {
        findings.push({
            file: rel,
            level: 'error',
            message: '`provenance` must be a map with a `kind:` key, not a scalar',
        });
    }
    if (provenance !== null) {
        if (provenance.kind === null) {
            findings.push({ file: rel, level: 'error', message: '`provenance` is present but carries no `kind`' });
        } else if (!(PROVENANCE_KINDS as readonly string[]).includes(provenance.kind)) {
            findings.push({
                file: rel,
                level: 'error',
                message: `provenance.kind \`${provenance.kind}\` is not one of: ${PROVENANCE_KINDS.join(', ')}. A council is \`agentic\` with \`agentic_mode: council\` — it is not its own kind.`,
            });
        }
        if (
            provenance.agenticMode !== null &&
            !(AGENTIC_MODES as readonly string[]).includes(provenance.agenticMode)
        ) {
            findings.push({
                file: rel,
                level: 'error',
                message: `provenance.agentic_mode \`${provenance.agenticMode}\` is not one of: ${AGENTIC_MODES.join(', ')}`,
            });
        }
    }

    // --- evidence
    const evidence = evidenceOf(fm);
    if (fm.scalars['evidence'] !== undefined && evidence === null) {
        findings.push({
            file: rel,
            level: 'error',
            message: '`evidence` must be a map with a `strength:` key, not a scalar',
        });
    }
    if (evidence !== null) {
        if (evidence.strength === null) {
            findings.push({ file: rel, level: 'error', message: '`evidence` is present but carries no `strength`' });
        } else if (!(EVIDENCE_STRENGTHS as readonly string[]).includes(evidence.strength)) {
            findings.push({
                file: rel,
                level: 'error',
                message: `evidence.strength \`${evidence.strength}\` is not one of: ${EVIDENCE_STRENGTHS.join(', ')}`,
            });
        }
        // `discovery` is required on E0 and only on E0. A bare E0 cannot
        // distinguish "no evidence exists" from "nobody looked", and the
        // second reading is the cheap way to manufacture a reopenable lock.
        if (evidence.strength === 'E0' && evidence.discovery === null) {
            findings.push({
                file: rel,
                level: 'error',
                message: '`evidence.strength: E0` requires `discovery: complete | incomplete` — an unsearched absence is not an established one',
            });
        }
        if (
            evidence.discovery !== null &&
            !(DISCOVERY_STATES as readonly string[]).includes(evidence.discovery)
        ) {
            findings.push({
                file: rel,
                level: 'error',
                message: `evidence.discovery \`${evidence.discovery}\` is not one of: ${DISCOVERY_STATES.join(', ')}`,
            });
        }
        // A grade above E1 asserts a source. Saying so without naming one is
        // the evidence-theater failure the contract names.
        if (
            evidence.strength !== null &&
            ['E2', 'E3', 'E4'].includes(evidence.strength) &&
            evidence.basis.length === 0
        ) {
            findings.push({
                file: rel,
                level: 'error',
                message: `evidence.strength \`${evidence.strength}\` cites no \`basis\`. A grade above E1 asserts a source; name it or grade it lower.`,
            });
        }
    }

    // --- authority_basis
    const basis = fm.scalars['authority_basis'];
    if (basis !== undefined && !(AUTHORITY_BASES as readonly string[]).includes(basis)) {
        findings.push({
            file: rel,
            level: 'error',
            message: `authority_basis \`${basis}\` is not one of: ${AUTHORITY_BASES.join(', ')}`,
        });
    }
    // `owner_intent` is the honest form for a purpose decision, and it pairs
    // with E0 by design — the authority comes from owning the purpose, not
    // from pretending the preference is empirical.
    if (basis === 'owner_intent' && evidence !== null && evidence.strength !== null) {
        if (['E2', 'E3', 'E4'].includes(evidence.strength) && evidence.basis.length === 0) {
            findings.push({
                file: rel,
                level: 'error',
                message: 'an `owner_intent` record claims an empirical grade with no basis — record it as `E0` + `owner_intent` instead of dressing intent as measurement',
            });
        }
    }

    return findings;
}

/** `ADR-035`, `035`, `35` → `35`. Returns null when nothing resolves. */
export function adr_number(raw: string): string | null {
    const m = /(\d{1,4})/.exec(raw.trim());
    return m?.[1] === undefined ? null : String(Number(m[1]));
}

/**
 * Validate `amends:` / `amended_by:` shape. The reciprocal half is checked in
 * `check_amendment_links` (it needs the whole corpus); this one only rejects a
 * value that is neither the em-dash placeholder nor an ADR reference, so a
 * typo'd link is caught before it becomes an invisible one-sided amendment.
 */
export function check_amendment_shape(
    rel: string,
    fm: Record<string, string>,
    findings: AdrFinding[],
): void {
    for (const key of ['amends', 'amended_by'] as const) {
        const v = fm[key];
        if (v === undefined || v === '' || v === '—') continue;
        for (const part of v.split(',')) {
            if (adr_number(part) === null) {
                findings.push({
                    file: rel,
                    level: 'error',
                    message: `\`${key}\` value \`${part.trim()}\` names no ADR number`,
                });
            }
        }
    }
}

/**
 * Corpus-level check: every `amends:` has its reciprocal `amended_by:` and vice
 * versa. This is the half the `supersedes:` / `superseded_by:` pair never had —
 * and its absence is exactly how ADR-035 kept asserting a rejection ADR-232 had
 * reopened. A one-sided link is invisible from the side that is stale, which is
 * the side a reader lands on first.
 */
export function check_amendment_links(
    files: { rel: string; fm: Record<string, string> }[],
): AdrFinding[] {
    const findings: AdrFinding[] = [];
    const byNumber = new Map<string, { rel: string; fm: Record<string, string> }>();
    for (const f of files) {
        const n = f.fm['adr'] === undefined ? null : adr_number(f.fm['adr']);
        if (n !== null) byNumber.set(n, f);
    }

    const reciprocal = { amends: 'amended_by', amended_by: 'amends' } as const;
    for (const f of files) {
        for (const key of ['amends', 'amended_by'] as const) {
            const v = f.fm[key];
            if (v === undefined || v === '' || v === '—') continue;
            const self = f.fm['adr'] === undefined ? null : adr_number(f.fm['adr']);
            for (const part of v.split(',')) {
                const target = adr_number(part);
                if (target === null) continue;
                const other = byNumber.get(target);
                if (other === undefined) {
                    findings.push({
                        file: f.rel,
                        level: 'error',
                        message: `\`${key}: ${part.trim()}\` points at an ADR that does not exist`,
                    });
                    continue;
                }
                const back = other.fm[reciprocal[key]] ?? '';
                const names_self =
                    self !== null &&
                    back
                        .split(',')
                        .map((s) => adr_number(s))
                        .includes(self);
                if (!names_self) {
                    findings.push({
                        file: f.rel,
                        level: 'error',
                        message:
                            `\`${key}: ${part.trim()}\` is one-sided — ${other.rel} carries no ` +
                            `reciprocal \`${reciprocal[key]}\`. A one-sided amendment link is ` +
                            `invisible from the stale side.`,
                    });
                }
            }
        }
    }
    return findings;
}

/**
 * Check every ADR in `dir`, optionally recording per-file completeness.
 *
 * The candidate set is every `*.md` in the directory, not the `ADR-*.md` subset:
 * the name filter used to be a bare `continue`, so a decision record saved as
 * `adr-131-foo.md` (lower case) or `131-foo.md` left the corpus without a trace
 * and the gate still printed a green line over the files it did read. It is now
 * an out-of-scope outcome with a reason, and it prints.
 *
 * A `warn`-level finding resolves as `complete`: warnings are allowed by this
 * gate's exit-code contract, so `fail` is reserved for what actually reds it.
 */
export function check(dir: string = ADR_DIR, ledger?: GateLedger): AdrFinding[] {
    const findings: AdrFinding[] = [];
    if (!fs.existsSync(dir)) return findings;

    const candidates = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
    ledger?.plan(candidates);

    // Collected for the corpus-level reciprocal-amendment check below, which
    // cannot be decided from one file.
    const corpus: { rel: string; fm: Record<string, string> }[] = [];

    for (const name of candidates) {
        if (!/^ADR-.*\.md$/.test(name)) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        const rel = path.relative(REPO_ROOT, path.join(dir, name));
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        const parsed = parse_frontmatter(text);
        if (parsed !== null) corpus.push({ rel, fm: parsed });
        const own = check_one(rel, text);
        findings.push(...own);

        const errors = own.filter((f) => f.level === 'error').length;
        if (errors > 0) {
            ledger?.fail(name, `${String(errors)} frontmatter error(s)`);
        } else {
            ledger?.complete(name);
        }
    }
    findings.push(...check_amendment_links(corpus));
    return findings;
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const ledger = new GateLedger('check_adr_frontmatter');
    const findings = check(ADR_DIR, ledger);
    // Finalized here, printed later by `report()` (which re-finalizes — the call
    // is pure): the denominator is needed for the scope assertion below, which
    // runs before any output. It is the ledger's own per-file accounting — the
    // ADRs that actually reached a checked outcome — where it used to be a SECOND
    // `readdirSync` of the same directory, independent of the loop that did the
    // work, so the printed count could not disagree with the scan even when the
    // scan had skipped files.
    const tally = ledger.finalize();
    const total = tally.completed + tally.failed;

    // `check()` returns findings, never a count, so a moved `docs/decisions/`
    // yields an empty list — reported as "0 ADR(s) · 0 error(s)" and green.
    // Exit 1 is the violation code; 2 stays reserved for usage/env errors.
    try {
        assertScanned({
            gate: 'check_adr_frontmatter',
            scanned: total,
            units: 'ADR file(s)',
            roots: ['docs/decisions'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (as_json) {
        // The tally rides in the payload rather than on stdout: `ledger.report()`
        // would print beside the JSON and break every parser of this mode.
        process.stdout.write(JSON.stringify({ findings, ledger: tally }, null, 2) + '\n');
        return 0;
    }

    const errors = findings.filter((f) => f.level === 'error');
    const warns = findings.filter((f) => f.level === 'warn');

    process.stdout.write(
        `ADR frontmatter: ${total} ADR(s) · ${errors.length} error(s) · ` +
            `${warns.length} grandfathered without a revisit condition\n`,
    );
    ledger.report();
    for (const e of errors) process.stderr.write(`    ❌ ${e.file}: ${e.message}\n`);

    if (errors.length > 0) {
        process.stderr.write(
            `\n❌  check_adr_frontmatter: ${errors.length} error(s). ` +
                `ADRs dated ${REVIEW_TRIGGER_SINCE} or later must name a \`review_trigger\`.\n`,
        );
        return 1;
    }
    process.stdout.write('✅  check_adr_frontmatter: no errors\n');
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main(process.argv.slice(2)));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main(process.argv.slice(2)));
        }
    }
}
