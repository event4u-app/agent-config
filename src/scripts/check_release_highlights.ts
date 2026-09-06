/**
 * Highlight plausibility gate (release-truth Phase 2).
 *
 * The recorded failure: the curated release head said `_none_` twice while
 * false — 9.13.0 shipped behavior changes, a removed public trigger type, a
 * security fix, and honest nulls; the head claimed none of it. Same at
 * 9.14.0.
 *
 * This gate derives GENERATED evidence categories from the release span
 * (security-tagged commits, behavior/default changes from conventional
 * commit types + rule/schema diffs, honest-null markers, removed public
 * surface) and FAILS when a populated generated category meets a `_none_`
 * curated field. It blocks the contradiction only — a human still writes the
 * prose, and a filled field is never judged for quality.
 *
 * The classifier lives in `_lib/release_highlights.ts` and is shared with the
 * generator, which now pre-fills each substantiated label instead of writing
 * `_none_` everywhere. That removes the guaranteed first-run red (9.17.0,
 * 9.18.0) without blunting this gate: a machine-written `_none_` was never the
 * failure it was built for — a HUMAN writing one was (9.13.0, 9.14.0), and that
 * still fails here.
 *
 * ## REVERSED 2026-09-01 — an unrewritten derived line now BLOCKS
 *
 * This header used to end the paragraph above with *"An unrewritten derived
 * line warns; it never blocks."* That is no longer the behavior, and the
 * sentence is replaced rather than deleted so the reversal is legible.
 *
 * **The premise was never wrong; the conclusion drawn from it was.** A derived
 * line does carry true evidence — the deriving reason plus citing SHAs — so it
 * is not false-if-shipped. What the advisory conclusion assumed is that
 * "unpolished-if-unedited" would in fact get edited. Measured at `b50b27281`,
 * it did not: `_auto-derived, rewrite before merge:_` shipped in FIVE
 * consecutive released sections — 14.9.0 (4 lines), 14.10.0 (2), 14.11.0 (4),
 * 14.12.0 (4), 14.13.0 (4), eighteen lines in total. A warning that has been
 * ignored eighteen times is not a warning; it is a comment.
 *
 * **Instructing authority:** the maintainer, in the closing instruction of the
 * 2026-09-a inbox round, requiring that the release-placeholder defect be taken
 * into a roadmap and fixed. Carried into
 * `agents/roadmaps/archive/road-to-publication-integrity-hard-fail.md` § Phase 1, which
 * is the record of this change.
 *
 * **What did NOT change.** The read stays scoped to the section under release
 * (`extract_changelog_section` below), so the eighteen historical lines cannot
 * red a future release; a filled field is still never judged for prose quality;
 * and the `_none_` contradiction check is untouched.
 *
 * Derivation is deliberately conservative (documented per-label below):
 * a false red makes every release annoying; a miss only returns the head to
 * the pre-gate state. Adjudication of derived evidence stays human.
 *
 * Usage:
 *   check_release_highlights --version X.Y.Z [--from <ref>] [--to <ref>]
 *       [--changelog <path>]
 *
 * `--from` defaults to the latest reachable release tag before `--to`
 * (default HEAD). Exit codes: 0 plausible · 1 refusal (an unrewritten
 * auto-derived head line, or a `_none_` contradiction) · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    DERIVED_MARKER,
    HEAD_LABELS,
    HEAD_NONE,
    type SpanCommit,
    collect_span_commits,
    derive_categories,
    parse_git_log,
    mix_response_blockers,
    previous_promise,
    previous_release_tag,
    promise_readback_blockers,
    stale_draft_labels,
} from './_lib/release_highlights.js';
import { loadTaxonomy, measureRange } from './measure_release_mix.js';
import {
    CURATED_HEAD_INSTRUCTION,
    PROMISE_READBACK_MARKER,
    extract_changelog_section,
    previous_changelog_version,
} from './_lib/release_material.js';
import { assertScanned, assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Labels and derivation live in `_lib/release_highlights.ts` — ONE definition
// shared with the generator that pre-fills the head. They used to be duplicated
// here to keep the checker independent of the release pipeline, and that
// independence is what produced the defect this gate now guards against from
// the other side: the generator wrote `_none_` into every field while this
// checker rejected exactly that, so every release PR was red on its first run.
// Sharing the classifier does not blunt the gate — it still blocks the failure
// it was built for, a human editing a substantiated line back to `_none_`.
export {
    HEAD_LABELS,
    HEAD_NONE,
    derive_categories,
    parse_git_log as _parse_git_log,
    type SpanCommit,
};

/**
 * Parse the curated head from a changelog section body. Returns null when
 * the section carries no `### Release highlights` head (pre-9.9.0 entries).
 */
export function parse_curated_head(sectionBody: string): Record<string, string> | null {
    if (!sectionBody.includes('### Release highlights')) {
        return null;
    }
    const out: Record<string, string> = {};
    for (const label of HEAD_LABELS) {
        const re = new RegExp(
            `^-\\s+\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}:\\*\\*\\s*(.*)$`,
            'm',
        );
        const m = re.exec(sectionBody);
        if (m) {
            out[label] = m[1]!.trim();
        }
    }
    return Object.keys(out).length > 0 ? out : null;
}

export interface Contradiction {
    label: string;
    evidence: string[];
}

/**
 * A populated generated category meeting a `_none_` curated field is a
 * contradiction. Filled fields and underived labels never fail.
 */
export function highlight_contradictions(
    curated: Readonly<Record<string, string>>,
    derived: Readonly<Record<string, readonly string[]>>,
): Contradiction[] {
    const out: Contradiction[] = [];
    for (const label of HEAD_LABELS) {
        const curatedValue = (curated[label] ?? '').trim();
        const ev = derived[label] ?? [];
        if (curatedValue === HEAD_NONE && ev.length > 0) {
            out.push({ label, evidence: [...ev] });
        }
    }
    return out;
}

/**
 * Exported so the advisory-vs-blocking decision is a fixture, not a claim.
 *
 * CORRECTED 2026-09-01 with the reversal. This comment used to say that
 * `stale_draft_labels` firing while the exit code stays 0 is the behavior the
 * cadence blocker adjudicates. That is no longer what happens — the branch at
 * the call site returns 1 — and the sentence is replaced rather than deleted
 * because it was the load-bearing claim on the other side.
 *
 * What it got RIGHT is worth keeping: the decision was a one-line diff with a
 * test that notices, and the reversal proved it. The two fixtures that pinned
 * the advisory branch were updated in place, not deleted, so the change of
 * contract reads off the diff.
 */
export function main(argv: readonly string[]): number {
    let version: string | null = null;
    let from: string | null = null;
    let to = 'HEAD';
    let changelogPath = path.join(REPO_ROOT, 'CHANGELOG.md');
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--version') version = argv[++i] ?? null;
        else if (a === '--from') from = argv[++i] ?? null;
        else if (a === '--to') to = argv[++i] ?? to;
        else if (a === '--changelog') changelogPath = argv[++i] ?? changelogPath;
        else {
            process.stderr.write(`unknown argument: ${a}\n`);
            return 2;
        }
    }
    if (!version) {
        process.stderr.write('--version X.Y.Z is required\n');
        return 2;
    }
    if (!from) {
        from = previous_release_tag(to, REPO_ROOT);
        if (!from) {
            process.stderr.write(
                `no release tag reachable before ${to} — pass --from explicitly\n`,
            );
            return 2;
        }
    }
    // The changelog is the curated half of the comparison and it is read
    // unconditionally below; a moved or renamed file would otherwise surface as
    // an ENOENT stack trace rather than a gate verdict. Exit 2 is this gate's
    // could-not-run code (same as a missing section); 1 means a contradiction.
    try {
        assertWatchlistResolves({
            gate: 'check_release_highlights',
            candidates: [path.relative(REPO_ROOT, path.resolve(changelogPath))],
            repoRoot: REPO_ROOT,
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    const changelogText = fs.readFileSync(changelogPath, 'utf-8');
    const section = extract_changelog_section(changelogText, version);
    if (!section) {
        process.stderr.write(`CHANGELOG carries no section for ${version}\n`);
        return 2;
    }
    // A LEAKED AUTHORING INSTRUCTION REFUSES THE RELEASE (roadmap § 2.2).
    //
    // A different mechanism from the marker check below: that one catches an
    // unpolished claim, this one catches a reminder to the releaser that was
    // never meant to be release content at all. `CHANGELOG.md` is the bare
    // entry in `package.json` `files`, so a comment surviving here is
    // published to npm — it did, twice, before Option A stopped the writer
    // emitting it.
    //
    // SAME SCOPE as the marker check, and for the same reason: `section` is
    // the ONE section `extract_changelog_section` cut for `--version`. A
    // historical section carrying the identical comment is not read here and
    // does not block this release. Detection is the named sentinel, never a
    // shape match over comment prose.
    if (section.body.includes(CURATED_HEAD_INSTRUCTION)) {
        process.stderr.write(
            `❌  the ${version} section still carries the generator's authoring instruction ` +
                `(\`${CURATED_HEAD_INSTRUCTION}\`).\n` +
                '    It is a reminder to the releaser, not release content, and CHANGELOG.md ' +
                'is published to npm.\n' +
                `    Delete that comment line from the ${version} section. Only that section is ` +
                'read; historical\n' +
                '    sections carrying the same comment are out of scope and do not block this ' +
                'release.\n',
        );
        return 1;
    }
    // Hoisted above the curated-head branches on purpose. It used to sit inside
    // `contradictions.length === 0`, so CI reached it only for a section that
    // HAS a head, carries no unrewritten draft and contradicts nothing — while
    // the local guards call the same predicate unconditionally. A section
    // without a curated head was therefore refused locally and waved through by
    // CI: one predicate, two different gatekeepers, which is the drift this
    // change exists to remove.
    const mix = check_governance_mix_response(section.body, from, to, version);
    if (mix !== 0) {
        return mix;
    }

    const readback = check_previous_promise_readback(changelogText, section.body, version);
    if (readback !== 0) {
        return readback;
    }

    const curated = parse_curated_head(section.body);
    if (!curated) {
        process.stdout.write(`ℹ️  no curated head in the ${version} section — nothing to check\n`);
        return 0;
    }
    let span: SpanCommit[];
    try {
        span = collect_span_commits(from, to, REPO_ROOT);
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
    }
    // Every derived category comes from this span, so an empty one makes the
    // contradiction check pass over nothing.
    assertScanned({
        gate: 'check_release_highlights',
        scanned: span.length,
        units: 'span commit(s)',
        roots: [`git log ${from}..${to}`],
        allowEmpty:
            'EMPTY_VALID: git already answered for the range — a from..to it could not read ' +
            'throws in collect_span_commits above and exits 2, so reaching here with zero ' +
            'commits means git read the range successfully and it is genuinely empty. ' +
            '"Empty span with _none_ everywhere is green" is a pre-registered fixture of this ' +
            'gate, not a scope failure: with no commits there is no evidence a curated `_none_` ' +
            'could contradict. Deleting the scan root is not the same state — that is the ' +
            'throwing branch, not this one.',
    });
    // A generator-derived line that nobody rewrote REFUSES the release.
    //
    // REVERSED 2026-09-01. This block used to warn and return the exit code to
    // the `_none_` check alone, on the reasoning that a derived line is true
    // and merely unpolished. The reasoning still holds and the conclusion does
    // not: the warning was emitted and ignored through five consecutive
    // released sections. See this file's header for the full record and the
    // instructing authority.
    //
    // SCOPE, and it is the load-bearing half (roadmap § 1.3): `curated` comes
    // from `parse_curated_head(section.body)` above, and `section` is the ONE
    // section `extract_changelog_section` cut for `--version`. No read here
    // reaches another section, another era file, or `docs/archive/`. That is
    // what keeps eighteen historical marker lines from turning this into a
    // permanent red on every future release.
    const derived = derive_categories(span);
    const drafts = stale_draft_labels(curated);
    if (drafts.length > 0) {
        process.stderr.write(
            `❌  unrewritten auto-derived head line(s) in the ${version} section: ` +
                `${drafts.join(', ')}\n` +
                `    Each still carries \`${DERIVED_MARKER}\` — the generator's draft, not a ` +
                'curated claim.\n' +
                `    Rewrite those line(s) in the ${version} section of the changelog. Only that ` +
                'section is read;\n' +
                '    historical sections carrying the same marker are out of scope and do not ' +
                'block this release.\n',
        );
        // The evidence, not just the verdict. The draft line cites SHAs and a
        // deriving reason; what a releaser needs in order to write the real
        // claim is the SUBJECT behind each SHA, and looking eleven of them up
        // by hand is the friction that made this refusal cheaper to ignore
        // than to satisfy across five releases. The `_none_` branch below has
        // printed its evidence since it was built; this one now matches it.
        for (const label of drafts) {
            const hits = derived[label] ?? [];
            if (hits.length === 0) {
                continue;
            }
            process.stderr.write(`    - **${label}:** derived from\n`);
            for (const e of hits) {
                process.stderr.write(`        ${e}\n`);
            }
        }
        return 1;
    }
    const contradictions = highlight_contradictions(curated, derived);
    if (contradictions.length === 0) {
        process.stdout.write(`✅  curated head plausible for ${version} (span ${from}..${to})\n`);
        return 0;
    }
    process.stderr.write(
        `❌  curated head contradicts the release span for ${version} (${from}..${to}):\n`,
    );
    for (const c of contradictions) {
        process.stderr.write(`    - **${c.label}:** is \`_none_\` but the span carries:\n`);
        for (const e of c.evidence) {
            process.stderr.write(`        ${e}\n`);
        }
    }
    process.stderr.write(
        '    Fill the curated head in CHANGELOG.md (a human writes the prose) or adjudicate ' +
            'the evidence in the PR — the gate only blocks the `_none_` contradiction.\n',
    );
    return 1;
}

/**
 * The governance-versus-product response, checked for PRESENCE, never for the
 * ratio (ADR-253).
 *
 * `measure_release_mix` publishes a level. This is the one place that level has
 * a consequence, and the consequence is deliberately about completeness of the
 * written answer: when governance-only commits strictly outnumber consumer-only
 * commits over the release span, the section under release must carry a written
 * response naming either the next cycle's consumer work or a maintainer
 * justification. No number is enforced, and no number can be — both council
 * seats refused a threshold on fewer than two readings, and a gate with no
 * threshold that blocks on the ratio is a smuggled threshold.
 *
 * The response lives OUTSIDE the curated head, as its own `> **Governance
 * mix:**` line, so it does not consume the head's ten-line cap and does not
 * become a sixth label every historical section would suddenly lack.
 *
 * Scope matches every other check here: only the section under release is read.
 *
 * A measurement failure DEGRADES to a printed warning rather than to a refusal.
 * This is a governance signal, not a correctness or security control, and a
 * shallow clone or a missing tag on the release path would otherwise turn an
 * unrelated environment fact into a blocked release.
 */
export function check_governance_mix_response(
    body: string,
    from: string,
    to: string,
    version: string,
): number {
    let reading;
    try {
        reading = measureRange(from, to, loadTaxonomy(), version, REPO_ROOT);
    } catch (err) {
        process.stdout.write(
            `⚠️   governance mix not measured for ${version}: ${(err as Error).message}\n`,
        );
        return 0;
    }
    const o = reading.response_obligation;
    const level = `governance-only ${o.governance_only} vs consumer-only ${o.consumer_only} (taxonomy ${reading.taxonomy_version})`;
    if (!o.triggered) {
        process.stdout.write(`✅  governance mix for ${version}: ${level} — no response owed\n`);
        return 0;
    }
    // ONE predicate, shared with `guard_release_branch_push` — see
    // `mix_response_blockers`. This side prints and exits; the local side dies
    // before anything leaves the machine. Neither owns the rule.
    const blockers = mix_response_blockers(body, version, `\`release/${version}\``, {
        triggered: true,
        level,
    });
    if (blockers.length === 0) {
        process.stdout.write(`✅  governance mix for ${version}: ${level} — response present\n`);
        return 0;
    }
    process.stderr.write(
        `❌  the ${version} section owes a governance-versus-product response: ${level}.\n` +
            blockers.map((b) => `    - ${b}\n`).join('') +
            '    Governance-only commits outnumber consumer-only commits over the release span, so\n' +
            '    the section carries a written response naming either the next cycle\'s consumer work\n' +
            '    or a maintainer justification (docs/contracts/CHANGELOG-conventions.md § Governance-\n' +
            '    versus-product response; the decline this replaces is ADR-253).\n' +
            '    Only that section is read; historical sections are out of scope. No ratio is\n' +
            '    enforced — this blocks a MISSING answer, never a particular number.\n' +
            '    Reproduce locally, before any push:\n' +
            `        ./scripts-run src/scripts/check_release_highlights --version ${version}\n`,
    );
    return 1;
}

/**
 * The previous release's promise, read back at the next release.
 *
 * `_lib/release_material.ts` generates `Next cycle ships …` and, until this
 * check existed, nothing ever asked what became of it: 14.18.0 promised the MCP
 * bridge repair, and no gate in the tree would have noticed the same promise
 * being reprinted in 14.19.0 and 14.20.0. A commitment nothing reads back is
 * free to restate, and one that is free to restate is not a commitment.
 *
 * Only the section under release is read, and only the previous section's
 * governance-response block — the same scope every other check here uses, so a
 * historical section cannot red a future release.
 *
 * The check is about ANSWERING, never about having kept the promise. A gate
 * that refused an unkept promise would price honesty above silence and teach
 * the next author to promise nothing.
 */
export function check_previous_promise_readback(
    changelogText: string,
    body: string,
    version: string,
): number {
    const previousVersion = previous_changelog_version(changelogText, version);
    if (previousVersion === null) {
        process.stdout.write(`✅  no previous CHANGELOG section before ${version} — no promise to read back\n`);
        return 0;
    }
    const promise = previous_promise(changelogText, previousVersion);
    if (promise === null) {
        process.stdout.write(
            `✅  the ${previousVersion} section made no next-cycle promise — nothing owed by ${version}\n`,
        );
        return 0;
    }
    const blockers = promise_readback_blockers(
        body,
        version,
        previousVersion,
        promise,
        `\`release/${version}\``,
    );
    if (blockers.length === 0) {
        process.stdout.write(`✅  ${version} answers the ${previousVersion} next-cycle promise\n`);
        return 0;
    }
    process.stderr.write(
        `❌  the ${version} section owes an answer to the ${previousVersion} next-cycle promise.\n` +
            blockers.map((b) => `    - ${b}\n`).join('') +
            `    The ${previousVersion} promise reads:\n` +
            promise
                .split('\n')
                .map((l) => `        ${l}\n`)
                .join('') +
            `    Answering it is one blockquote line under the curated head, e.g.\n` +
            `        > ${PROMISE_READBACK_MARKER} the <promise> did not ship; <what happened>.\n` +
            '    Shipped, did not ship, or withdrawn with a reason — the check refuses a MISSING\n' +
            '    answer, never a particular outcome. An unkept promise answered honestly passes.\n' +
            '    Reproduce locally, before any push:\n' +
            `        ./scripts-run src/scripts/check_release_highlights --version ${version}\n`,
    );
    return 1;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    process.exit(main(process.argv.slice(2)));
}
