#!/usr/bin/env tsx
/**
 * Gate R2 reviewer dispatcher — deterministic assembler for the fresh-subagent
 * completion review (docs/contracts/plan-review-gates.md §5, verdict #18).
 *
 * The Phase-1 reviewer is a FRESH subagent without the implementation
 * context; its input is never assembled by the implementing agent. This
 * script IS that deterministic dispatcher: it computes the branch diff,
 * extracts the roadmap's Acceptance Criteria block, hashes every input,
 * writes the reviewer input package (`<out-dir>/<slug>.review-input/`) and
 * the findings-artifact skeleton (`<out-dir>/<slug>.findings.md`) carrying
 * the verifiable context manifest. It calls NO LLM itself — the host agent
 * dispatches a fresh subagent (/judge:on-diff machinery) at the package.
 *
 * Modes:
 *   dispatch (default) — assemble package + skeleton.
 *   --verify <findings-file> — re-derive the manifest hashes from the
 *     CURRENT repo state and compare against the recorded inputs.
 *   --verify-current — compute the current review scope, SELECT the artefacts
 *     relevant to it (contract §2.6), and `--verify` each. The selection lives
 *     here rather than in a caller's shell loop on purpose: `agents/evidence/
 *     reviews/` is tracked and accumulates (§2.6), so "verify every
 *     `*.findings.md`" mismatches every foreign artefact by construction and
 *     would red the next gated PR — directory-wide poisoning. Selecting by
 *     grepping the header for `HEAD` is equally wrong (§2.0 proves it matches
 *     nothing), so the only correct selector re-derives the scope hash, which
 *     is exactly what this mode does.
 *
 * This is a dispatcher, not a gate — it emits no `scanned:` line and is not
 * registered in gate-coverage.yml.
 *
 * It also OWNS the review-scope hash (contract §2.1): the single definition of
 * what a completion review is bound to. `check_completion_review` imports it
 * rather than restating it — a divergence between the two would silently
 * re-break the gate.
 *
 * Exit codes: 0 = ok / manifest verified, 1 = policy violation (empty diff,
 * refuse-overwrite, missing manifest, manifest mismatch), 2 = internal error
 * (bad ref, unreadable file, crash).
 */

import { independenceFields } from './_lib/review_independence.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `--verify-current` reuses the validator's §2.6 relevance notion instead of
// restating it (a restated copy is what re-breaks these gates — see the
// single-definition rule for the scope hash below). The resulting import cycle
// (validator → dispatcher for the scope hash, dispatcher → validator for
// relevance) is safe: neither module calls the other at module-evaluation
// time, and each CLI entry guard only fires for its own argv[1].
import { isAcceptanceCriteriaHeading } from './_lib/ac_heading.js';
import { gitEnv } from './_lib/git_env.js';
import { loadDenyPatterns, redactSourceShape, redactSourceTokens, writeRedacted } from './_lib/source_redact.js';
import { completionReviewDisabled } from './_lib/planning_settings.js';
import { artifactRelevance } from './check_completion_review.js';

export interface ManifestInputs {
    diffSha: string; // provenance only — never compared
    scopeHash: string;
    roadmap: string; // path, or 'none'
    roadmapHash: string; // sha256, or 'none'
    acHash: string; // sha256, or 'none'
    dispatched: string; // ISO YYYY-MM-DDTHH:MM:SSZ
}

export interface ExpectedHashes {
    scope_hash: string;
    roadmap_hash: string;
    ac_hash: string;
}

export interface ParsedManifest {
    diff_sha: string;
    scope_hash: string;
    roadmap: string;
    roadmap_hash: string;
    ac_hash: string;
    dispatched: string;
}

export function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Review scope — the single source of the R2 binding (contract §2.1)
// ---------------------------------------------------------------------------

/**
 * The review artefacts are excluded from the reviewed scope on purpose.
 *
 * A completion review is bound to the CONTENT it reviewed, never to a commit:
 * §2.5 requires the findings artifact to be committed, and CI only ever sees
 * committed state — so a head-sha binding is unsatisfiable by construction
 * (committing the artifact moves HEAD past the recorded sha, and on
 * `pull_request` the checkout is a synthetic merge commit whose sha no
 * dispatcher could have recorded). Excluding `agents/evidence/reviews` means
 * writing, editing, or committing the findings artifact cannot change the
 * scope hash, and `base...HEAD` yields the same net diff on a branch head and
 * on a merge commit of that branch.
 *
 * `agents/evidence/metrics` is excluded for the SAME reason, not as tidiness:
 * contract §7 mandates appending the R2 outcome event (`r2_review` /
 * `r2_honest_null` / `r2_skip`) to the tracked
 * `agents/evidence/metrics/gate-metrics.jsonl`. Committing that mandated event
 * would otherwise change the scope hash and turn the very artifact that just
 * recorded the review into a `stale-review` block — the self-invalidation class
 * §2.0 exists to eliminate, re-entering through a sibling path. Any future
 * gate-owned evidence path that the gate itself writes belongs in this list.
 */
export const REVIEW_SCOPE_EXCLUDES: readonly string[] = [
    ':(exclude,top)agents/evidence/reviews',
    ':(exclude,top)agents/evidence/metrics',
];

/**
 * Config overrides for a byte-stable diff — the knobs no diff FLAG can pin.
 *
 * `core.quotePath=false` un-quotes non-ASCII pathnames (`"a/w\303\251ird"` →
 * `a/wéird`), changing the bytes of every header line that names such a file.
 * `true` is git's default, so this restores the default rather than choosing a
 * new one.
 *
 * `core.attributesFile=/dev/null` drops the per-USER attributes file. That is a
 * different layer from `--no-textconv`, which only suppresses a `textconv`
 * filter: a `-diff` (or `binary`) attribute replaces the entire patch body with
 * `Binary files a/x and b/x differ`. One developer carrying a global `*.ts -diff`
 * entry would otherwise record a different scope hash for identical content — a
 * cross-machine `manifest mismatch (stale review)` that no content change
 * explains.
 *
 * RESIDUAL, named rather than papered over: this pins the USER layer only.
 * A **tracked** `.gitattributes` is part of the reviewed content and therefore
 * identical on every checkout, so it is not a cross-machine variable at all.
 * `$GIT_DIR/info/attributes` IS one — per-clone, untracked, and with no
 * command-line override — so it stays un-neutralised; likewise the system-wide
 * `etc/gitattributes`, which only the `GIT_ATTR_NOSYSTEM` environment variable
 * disables. Both are accepted residuals, not gaps this list silently covers.
 *
 * `diff.orderFile` reorders the per-file sections of the output; the documented
 * canceller is the `-O/dev/null` flag (see {@link REVIEW_SCOPE_DIFF_FLAGS}),
 * which is why it is not listed here.
 */
export const REVIEW_SCOPE_GIT_CONFIG: readonly string[] = [
    '-c',
    'core.quotePath=true',
    '-c',
    'core.attributesFile=/dev/null',
];

/**
 * The pinned patch-output flag set (contract §2.0).
 *
 * The scope hash is THE cross-machine binding: a local dispatch records it and
 * CI re-derives it (§5). Anything that changes the diff BYTES for identical
 * content therefore produces a blocking `manifest mismatch (stale review)` that
 * no content change explains — so every output-shaping git config knob is
 * neutralised here, explicitly, at its git default:
 *
 *   `--no-ext-diff`          ← `diff.external`
 *   `--no-textconv`          ← `diff.<driver>.textconv` attributes
 *   `--no-color`             ← `color.diff` / `color.ui`, and with it
 *                              `diff.wsErrorHighlight` / `diff.colorMoved`,
 *                              which only alter coloured output
 *   `--diff-algorithm=myers` ← `diff.algorithm`
 *   `--indent-heuristic`     ← `diff.indentHeuristic`
 *   `--unified=3`            ← `diff.context`
 *   `--inter-hunk-context=0` ← `diff.interHunkContext`
 *   `--src-prefix=a/`,
 *   `--dst-prefix=b/`        ← `diff.noprefix`, `diff.mnemonicPrefix`
 *   `--no-relative`          ← `diff.relative` (+ the caller's cwd)
 *   `--full-index`,
 *   `--abbrev=40`            ← `core.abbrev` / `diff.abbrev`: `--full-index`
 *                              pins the `index <old>..<new>` line, `--abbrev`
 *                              pins any other abbreviated oid git may print
 *   `--submodule=short`      ← `diff.submodule`
 *   `--ignore-submodules=none` ← `diff.ignoreSubmodules`
 *   `-O/dev/null`            ← `diff.orderFile` (documented canceller)
 *
 * `--no-renames` (← `diff.renames` / `diff.renameLimit` / `diff.copies`) is the
 * deliberate choice over a pinned `--find-renames=<n>`: rename detection is a
 * similarity HEURISTIC whose result also depends on `diff.renameLimit` and on
 * how many files the diff touches, so even a pinned threshold can flip a rename
 * into an add/delete pair as a branch grows. With renames off the hash depends
 * on content alone.
 *
 * This list is normative (contract §2.0): dropping a flag silently changes every
 * scope hash the suite has ever recorded.
 */
export const REVIEW_SCOPE_DIFF_FLAGS: readonly string[] = [
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '--diff-algorithm=myers',
    '--indent-heuristic',
    '--unified=3',
    '--inter-hunk-context=0',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--no-relative',
    '--no-renames',
    '--full-index',
    '--abbrev=40',
    '--submodule=short',
    '--ignore-submodules=none',
    '-O/dev/null',
];

/**
 * The pinned `--name-only` flag set. The changed-file list is config-sensitive
 * too — `diff.renames` decides whether a rename shows one path or two,
 * `diff.orderFile` decides the order, `diff.relative` the prefix — and that list
 * feeds the §2.4 code-path classification, so it is pinned for the same reason.
 */
export const REVIEW_SCOPE_NAME_ONLY_FLAGS: readonly string[] = [
    '--name-only',
    '--no-ext-diff',
    '--no-color',
    '--no-relative',
    '--no-renames',
    '-O/dev/null',
];

/**
 * `git diff` argv for the review scope (patch body), config-pinned.
 *
 * `head` defaults to `HEAD` — the only value the dispatcher and the validator
 * ever pass, since both bind the scope being dispatched *now*. It is a
 * parameter so that an out-of-band measurement can re-derive the scope at a
 * HISTORICAL revision through this same definition instead of assembling a
 * second `git diff` argv beside it: a private copy would drift from the
 * normative flag list above the first time a flag changes, and then report a
 * hash no gate would ever produce.
 */
export function reviewScopeDiffArgs(base: string, head = 'HEAD'): string[] {
    return [
        ...REVIEW_SCOPE_GIT_CONFIG,
        'diff',
        ...REVIEW_SCOPE_DIFF_FLAGS,
        `${base}...${head}`,
        '--',
        ':/',
        ...REVIEW_SCOPE_EXCLUDES,
    ];
}

/** `git diff --name-only` argv for the review scope (changed-file list), config-pinned. */
export function reviewScopeNameOnlyArgs(base: string, head = 'HEAD'): string[] {
    return [
        ...REVIEW_SCOPE_GIT_CONFIG,
        'diff',
        ...REVIEW_SCOPE_NAME_ONLY_FLAGS,
        `${base}...${head}`,
        '--',
        ':/',
        ...REVIEW_SCOPE_EXCLUDES,
    ];
}

/**
 * The artefact directory MUST live under an excluded path (§2.0).
 *
 * The exclusion list is static while the artefact location is a CLI parameter
 * (`--out-dir` / `--artifact-dir`). A directory outside the exclusions puts the
 * findings artifact back inside the reviewed scope, so committing it — which
 * §2.5 requires — invalidates the review it records. That failure is silent, so
 * it is refused loudly here instead: a policy violation, not a warning.
 *
 * Returns an error message, or `null` when the directory is safe.
 */
export function scopeExclusionViolation(artifactDirRel: string): string | null {
    const norm = artifactDirRel.split(path.sep).join('/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (path.isAbsolute(norm)) {
        return (
            `❌  --out-dir / --artifact-dir must be repo-relative, got absolute '${artifactDirRel}'.\n` +
            '    The review scope excludes repo-relative pathspecs only (contract §2.0).\n'
        );
    }
    const roots = REVIEW_SCOPE_EXCLUDES.map((s) => s.replace(/^:\(exclude,top\)/, ''));
    const covered = roots.some((r) => norm === r || norm.startsWith(`${r}/`));
    if (covered) {
        return null;
    }
    return (
        `❌  artefact directory '${artifactDirRel}' is not excluded from the review scope.\n` +
        `    Committing a findings artifact there would change the scope hash and invalidate\n` +
        `    the review it records (contract §2.0). Excluded roots: ${roots.join(', ')}.\n`
    );
}

/** A review scope with no reviewable content — the only state `scope none` covers. */
export function isEmptyScope(scopeDiffText: string): boolean {
    return scopeDiffText.trim() === '';
}

export type GitRunner = (args: readonly string[]) => string;

export interface ReviewScope {
    /** The review-scope diff body handed to the reviewer. */
    diffText: string;
    /** sha256 of `diffText` — the token the review binds to. */
    hash: string;
    /** Nothing reviewable in scope — the only state a `scope none` skip covers. */
    empty: boolean;
}

/**
 * Resolve the review scope in ONE git call. Both the dispatcher and the
 * validator go through this function, injecting their own git wrapper (they
 * differ only in error handling), so the definition of "what a review is bound
 * to" exists exactly once.
 */
export function computeReviewScope(runGit: GitRunner, base: string): ReviewScope {
    const diffText = runGit(reviewScopeDiffArgs(base));
    return { diffText, hash: sha256(diffText), empty: isEmptyScope(diffText) };
}

/**
 * Staleness verdict for a findings artefact already sitting at the dispatch
 * target, decided by the ONE review-scope hash both dispatcher and validator
 * bind to — never by a second definition of "same review".
 *
 *   - `current` — its manifest claims the scope being dispatched now. This is
 *     the live review; overwriting it would destroy the record of the review
 *     that is still in force, so the refusal stands.
 *   - `stale` — it claims a DIFFERENT scope. The fixes moved the scope past it,
 *     which is exactly the §2.7 re-bind case, and it must not be mistaken for
 *     the current review.
 *   - `unreadable` — no parseable manifest. Treated like `current`: refusing is
 *     the conservative branch when the artefact cannot be identified, since the
 *     alternative is renaming a file whose contents nobody established.
 */
export type ArtefactStaleness = 'current' | 'stale' | 'unreadable';

export function artefactStaleness(text: string, currentScopeHash: string): ArtefactStaleness {
    const manifest = parseManifest(text);
    if (manifest === null) {
        return 'unreadable';
    }
    return manifest.scope_hash === currentScopeHash ? 'current' : 'stale';
}

/**
 * The refusal text for a leftover artefact at the dispatch target, naming which
 * of the contract's two paths applies instead of offering only `--force`.
 *
 * **Why this is a message and NOT an automatic rename.** Renaming a stale
 * artefact aside looks like the obvious fix and contract §2.7 forbids it: a fix
 * pass changes the review scope, so an artefact bound to the previous scope is
 * the NORMAL in-place re-bind case, and "renaming instead of re-binding here
 * would leave the shipping content with no review at all → `missing-artifact`".
 * The archival rename is a separate, later step, it has a prescribed name
 * (`<slug>.round<N>-review.md`), and it is gated on every finding already being
 * terminal (`check_review_dispositions`, which recognises an archived record by
 * `-review.md`). An invented quarantine name would have slipped past that gate
 * too, creating an archive path with no terminal check on it.
 *
 * So the dispatcher classifies and explains; the operator performs whichever
 * contract-conform step actually applies.
 */
export function leftoverArtefactRefusal(
    findingsPathRel: string,
    verdict: ArtefactStaleness,
    staleScopeHash: string,
    currentScopeHash: string,
): string {
    const head = `❌  Refusing to overwrite existing findings artifact: ${findingsPathRel}\n`;
    if (verdict === 'unreadable') {
        return (
            head +
            '    Its manifest is unreadable, so it cannot be identified as superseded.\n' +
            '    Inspect it before doing anything: --force OVERWRITES, and an unidentified\n' +
            '    artefact may be the only record of a review that happened.\n'
        );
    }
    if (verdict === 'current') {
        return (
            head +
            `    It already binds the scope being dispatched now (${currentScopeHash.slice(0, 12)}),\n` +
            '    so it is the LIVE review of this content. Re-dispatching would discard it.\n'
        );
    }
    return (
        head +
        `    It binds scope ${staleScopeHash.slice(0, 12)}; this dispatch binds ${currentScopeHash.slice(0, 12)},\n` +
        '    so the reviewed content moved under it. That is the normal re-bind case, and\n' +
        '    contract §2.7 gives it two paths — neither of which is a fresh skeleton:\n' +
        '      1. RE-BIND IN PLACE (the usual one): edit this artefact — new `scope:`, rows\n' +
        '         flipped to terminal — and re-commit it. §2.5 expects exactly that.\n' +
        '      2. ARCHIVE the closed round: rename it to `<slug>.round<N>-review.md` ONCE every\n' +
        '         finding is terminal, which `check_review_dispositions` enforces. Then dispatch.\n' +
        '    --force writes a fresh skeleton OVER this file and destroys the record.\n'
    );
}

/** Manifest comment block — exactly the contract §5 shape. */
export function deriveManifest(inputs: ManifestInputs): string {
    return [
        '<!-- context-manifest: v1',
        'inputs:',
        `  diff_sha: ${inputs.diffSha}`,
        `  scope_hash: ${inputs.scopeHash}`,
        `  roadmap: ${inputs.roadmap}`,
        `  roadmap_hash: ${inputs.roadmapHash}`,
        `  ac_hash: ${inputs.acHash}`,
        'excluded: [session-history, agents/runtime, implementation-context]',
        'tools: [git-diff-branch-scoped, file-read-branch-paths]',
        `dispatched: ${inputs.dispatched}`,
        '-->',
    ].join('\n');
}

/**
 * Pure hash derivation — CI re-derivation imports this to verify a submitted
 * artifact's manifest. `null` roadmap/AC text means "not provided" → 'none'.
 * `scopeDiffText` is the REVIEW-SCOPE diff body (see {@link reviewScopeDiffArgs}),
 * never the raw `base...HEAD` diff — the raw diff includes the findings artifact
 * itself and is therefore unverifiable once that artifact is committed.
 */
export function expectedHashes(args: {
    scopeDiffText: string;
    roadmapText?: string | null;
    acText?: string | null;
}): ExpectedHashes {
    return {
        scope_hash: sha256(args.scopeDiffText),
        roadmap_hash: args.roadmapText == null ? 'none' : sha256(args.roadmapText),
        // ONE predicate, shared with the prompt builder. An empty extraction
        // used to hash to e3b0c44298fc…b855 — the SHA-256 of the empty string,
        // which looks like a real hash in the manifest and re-derives
        // identically on `--verify-current`, so the gate confirmed a criteria
        // set that was never there. `'none'` is the value that already means
        // "no input" for `roadmap_hash`; an absent AC block gets the same word.
        ac_hash: hasAcceptanceCriteria(args.acText) ? sha256(args.acText as string) : 'none',
    };
}

/**
 * Does an extraction carry acceptance criteria?
 *
 * The single predicate behind BOTH the manifest's `ac_hash` and the reviewer
 * prompt's roadmap line. It exists because the first version of this fix encoded
 * the same question twice — truthiness in {@link expectedHashes}, an explicit
 * `!== null && !== ''` at the call site — and the two agreed only for as long as
 * `''` stayed the sole reachable falsy value. Refining one alone (this `.trim()`,
 * for instance) would then have made the manifest record a hash while the prompt
 * told the reviewer there were no criteria: the same two-places-disagree failure
 * this module was being repaired for, one level up. Caught by the R2 review of
 * that very fix.
 *
 * Whitespace-only counts as absent. The inline collector can emit blank lines
 * between a criterion and its loose-list continuation, so a result that is
 * structurally non-empty and semantically empty is reachable.
 */
export function hasAcceptanceCriteria(acText: string | null | undefined): boolean {
    return typeof acText === 'string' && acText.trim() !== '';
}

/**
 * Extract a roadmap's acceptance criteria in either form the tree uses.
 *
 * Two forms, because roadmap authors write both and the reviewer needs whichever
 * one is present:
 *
 * 1. A `## Acceptance Criteria` section — from that heading (inclusive) to the
 *    next `## ` heading or EOF.
 * 2. Inline `- **AC-n:**` bullets, declared per phase with no section heading —
 *    collected with their indented continuation lines.
 *
 * Neither form → empty string, and every caller must treat that as "no criteria"
 * rather than as an extracted-and-empty block: see {@link expectedHashes} and the
 * prompt's roadmap line.
 *
 * The heading form is tried first and wins outright when found. Measured
 * 2026-08-18 over the 44 active roadmaps: 21 heading-only, 7 inline-only, 0
 * carrying both, 16 carrying neither — so the two forms do not currently
 * co-occur and a precedence rule is a guard against a future file rather than a
 * choice between live populations.
 *
 * WHY THE INLINE FORM WAS MISSING, stated because this is the second instance of
 * the same defect class in this one function. The first was case sensitivity
 * (`## Acceptance criteria` extracted nothing, found by the zcs-close R2 review
 * 2026-08-09). The second is this: an inline-only roadmap yielded `''`, nothing
 * downstream noticed, and the reviewer was handed a 0-byte
 * `acceptance-criteria.md` under a prompt that said the criteria had been
 * extracted. The R2 reviewer is the independent check on AC conformance, so
 * blinding it while the artefact reads as though it checked is the
 * gate-that-scans-nothing-exits-green shape one layer up.
 */
export function extractAcceptanceCriteria(roadmapText: string): string {
    const lines = roadmapText.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        // Case-insensitive and NOT end-anchored — both of those were live misses
        // here (case: zcs-close R2 review 2026-08-09; the `(per phase, …)` qualifier:
        // measured 2026-08-18). The predicate now lives in `_lib/ac_heading`, which
        // records all three instances of the defect and why it is shared.
        if (isAcceptanceCriteriaHeading(lines[i] as string)) {
            start = i;
            break;
        }
    }
    if (start !== -1) {
        let end = lines.length;
        for (let i = start + 1; i < lines.length; i++) {
            if (/^## /.test(lines[i] as string)) {
                end = i;
                break;
            }
        }
        return lines.slice(start, end).join('\n');
    }
    return extractInlineAcceptanceCriteria(lines);
}

/**
 * An inline criterion bullet, at any indent and with either bullet marker.
 *
 * Indent-tolerant so a nested criterion is emitted as its own row rather than
 * folded into its parent as a continuation line — folding made the extraction
 * shape, and therefore `ac_hash`, a function of indentation depth. Neither the
 * `*` marker nor a nested criterion occurs in the tree today (measured
 * 2026-08-18 across all 44 active roadmaps: zero of each), so this is a guard
 * against a future file, not a fix for a live population.
 */
const AC_BULLET_RE = /^\s*[-*]\s+\*\*AC-/;

/**
 * Collect inline `- **AC-n:**` bullets and their continuation lines.
 *
 * A continuation line is indented and non-blank. Bullets are emitted in file
 * order and separated by nothing but their own newline: each one is
 * self-labelling (`AC-0`, `AC-1`, …), so a synthetic section heading would be
 * text this function invented rather than text the roadmap declared.
 *
 * Two stopping rules, and the second is the subtle one:
 *
 * - another criterion bullet ends the current one, at any indent — see
 *   {@link AC_BULLET_RE};
 * - a blank line ends it ONLY when the next non-blank line is not an indented
 *   continuation. Markdown loose lists separate a bullet from its second
 *   paragraph with exactly that blank line, so breaking on the blank
 *   unconditionally truncated the criterion and emitted a PARTIAL extraction —
 *   which then hashed to a real value and read as complete. That is the
 *   looks-like-success shape this whole function exists to remove, relocated
 *   from "empty but claimed" to "half but claimed"; caught by the R2 review of
 *   the first version. No roadmap uses a loose continuation today (measured
 *   2026-08-18: zero across all 44), so this is latent-defect removal.
 */
function extractInlineAcceptanceCriteria(lines: readonly string[]): string {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (!AC_BULLET_RE.test(lines[i] as string)) continue;
        out.push(lines[i] as string);
        let j = i + 1;
        while (j < lines.length) {
            const line = lines[j] as string;
            // A sibling or nested criterion owns itself; hand it back to the
            // outer loop rather than absorbing it.
            if (AC_BULLET_RE.test(line)) break;
            if (/^\s+\S/.test(line)) {
                out.push(line);
                j++;
                continue;
            }
            if (line.trim() !== '') break;
            // Blank: look past the run of blanks for an indented continuation.
            let k = j;
            while (k < lines.length && (lines[k] as string).trim() === '') k++;
            const resumes =
                k < lines.length &&
                /^\s+\S/.test(lines[k] as string) &&
                !AC_BULLET_RE.test(lines[k] as string);
            if (!resumes) break;
            for (let b = j; b < k; b++) out.push(lines[b] as string);
            j = k;
        }
        // Resume the outer scan AT the line that stopped the walk, so a
        // criterion bullet that ended this one is still matched.
        i = j - 1;
    }
    return out.join('\n');
}

/**
 * Parse the context-manifest comment block out of a findings artifact.
 *
 * Line separators are `\r?\n`, not `\n`: the artifact parser in
 * `check_completion_review` already splits that way, and a CRLF working-tree
 * copy (a `core.autocrlf` checkout, an editor that normalises on save) would
 * otherwise yield `null` → a blocking `missing-manifest` violation and exit 1 in
 * `--verify` / `--verify-current`, caused purely by line endings. The captures
 * exclude `\r` for the same reason — a trailing carriage return inside a hash
 * would make every re-derivation mismatch.
 */
export function parseManifest(text: string): ParsedManifest | null {
    const nl = '\\r?\\n';
    const re = new RegExp(
        [
            '<!-- context-manifest: v1',
            'inputs:',
            '  diff_sha: ([^\\r\\n]+)',
            '  scope_hash: ([^\\r\\n]+)',
            '  roadmap: ([^\\r\\n]+)',
            '  roadmap_hash: ([^\\r\\n]+)',
            '  ac_hash: ([^\\r\\n]+)',
            'excluded: \\[session-history, agents/runtime, implementation-context\\]',
            'tools: \\[git-diff-branch-scoped, file-read-branch-paths\\]',
            'dispatched: ([^\\r\\n]+)',
            '-->',
        ].join(nl),
    );
    const m = re.exec(text);
    if (!m) return null;
    return {
        diff_sha: m[1] as string,
        scope_hash: m[2] as string,
        roadmap: m[3] as string,
        roadmap_hash: m[4] as string,
        ac_hash: m[5] as string,
        dispatched: m[6] as string,
    };
}

export function sanitizeSlug(raw: string): string {
    const s = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'review';
}

function git(repo: string, ...args: string[]): string {
    return execFileSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        // cwd decides, never an inherited GIT_DIR (hook environments).
        env: gitEnv(),
    });
}

/**
 * CI-provided head-branch names, most specific first. `GITHUB_HEAD_REF` is set
 * only on `pull_request` and IS the head branch; `GITHUB_REF_NAME` covers
 * `push`.
 */
const CI_BRANCH_ENV_KEYS = ['GITHUB_HEAD_REF', 'GITHUB_REF_NAME'] as const;

/**
 * Branch-derived artifact slug. Shared with `check_completion_review`, which
 * uses it to decide whether a leftover artifact in the reviews directory is
 * THIS branch's (and may therefore produce violations) or a foreign one.
 *
 * Resolution order is **git first, CI environment as the fallback** — see the
 * reason inline below. The env fallback exists because on a `pull_request`
 * checkout `HEAD` is a detached synthetic merge commit: `rev-parse --abbrev-ref
 * HEAD` yields `HEAD`, the slug would degrade to `detached-<sha>`, and no
 * artefact could ever be "own" — inverting contract §2.6 on the layer the
 * contract calls authoritative (an own malformed artefact would report
 * `missing-artifact` instead of the root-cause `bad-marker`, and `stale-review`
 * would never fire in CI). A `HEAD` / `detached-*` env value carries no branch
 * identity either and is ignored.
 */
export function deriveSlug(runGit: GitRunner, env: NodeJS.ProcessEnv = process.env): string {
    // GIT FIRST — the env vars are a detached-HEAD fallback, not an override.
    // They describe the WORKFLOW's branch, which is only the right answer when
    // the inspected repo IS the workflow checkout. With an explicit `--repo`
    // pointing elsewhere (every unit test, and any cross-repo invocation) an
    // env-first order returns the outer branch's slug for a foreign repo, so the
    // dispatcher writes one slug and every later lookup asks for another. Git,
    // run against the inspected repo, cannot be wrong about that repo.
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch !== '' && branch !== 'HEAD') {
        return sanitizeSlug(branch);
    }
    // Detached HEAD — the case the CI vars exist for (`actions/checkout` leaves
    // a detached HEAD on `pull_request`, where `--abbrev-ref` yields `HEAD`).
    for (const key of CI_BRANCH_ENV_KEYS) {
        const value = (env[key] ?? '').trim();
        if (value !== '' && value !== 'HEAD' && !/^detached-/i.test(value)) {
            return sanitizeSlug(value);
        }
    }
    const short = runGit(['rev-parse', '--short', 'HEAD']).trim();
    return sanitizeSlug(`detached-${short}`);
}

function deriveSlugFromBranch(repo: string): string {
    return deriveSlug((a) => git(repo, ...a));
}

/** ISO timestamp at seconds precision (YYYY-MM-DDTHH:MM:SSZ). */
function isoSeconds(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The return-envelope POINTER — one line-shaped field, delivered on the
 * dominant dispatch path.
 *
 * ## Why a pointer and not the contract
 *
 * 240 chars is not a round number: it is `MAX_RESPONSE_LINE_CHARS`
 * (`_lib/subagent_response.ts`), so the pointer is one line-shaped field by the
 * contract's own measure. Inlining the shape would put a fourth copy of it in
 * the tree, and a fourth copy is how the contract came to have three
 * inconsistent states.
 *
 * ## Why THIS dispatcher
 *
 * `road-to-subagent-envelope-adoption` step 1.1 says the dominant path, "and it
 * does not fan out to both". The dominant path is **not answerable from the
 * ledger** — 1,725 of 1,845 post-split stops carry a null `agent_type`, which is
 * the 8 % start↔stop join rate recorded elsewhere, so no stop can be attributed
 * to a dispatcher. Decided on invocation surface instead: this file is wired
 * into `/create-pr` and read by three gates (`check_completion_review`,
 * `lint_evidence_artifacts`, `probe_review_binding_drift`), while
 * `team_dispatch` sits behind an ai_team host flag and one `/team delegate`
 * command. It is also the leg with ZERO prior contract hits, so the dominant
 * path and the absent one are the same file.
 *
 * ## What it does not change
 *
 * The findings table stays the artefact — the gates read the file, not the
 * envelope. Per the four-boundary separation in the response contract, this
 * touches the DELIVERY boundary only: what the final message is. It adds no
 * lifecycle status and does not alter the body schema.
 */
export const RETURN_ENVELOPE_POINTER =
    'Final message = the return envelope and nothing else: ' +
    '{summary, handoff, confidence, findings, risks}. Shape + the ' +
    'write-to-disk-first rule: contexts/execution/subagent-response-contract.md. ' +
    'The findings table stays a file.';

function reviewerPrompt(args: {
    slug: string;
    headSha: string;
    scopeHash: string;
    roadmapGiven: boolean;
    acGiven: boolean;
    changedFiles: readonly string[];
}): string {
    // Three states, not two. Branching on `roadmapGiven` alone told the reviewer
    // "Acceptance Criteria extracted" whenever a roadmap was supplied — including
    // when the extraction returned nothing and the file beside it was 0 bytes. A
    // reviewer told the criteria are in a file it finds empty has no way to tell
    // an extraction failure from a roadmap that genuinely declares none, so it
    // cannot report the gap.
    //
    // The empty branch reports the EXTRACTION, never the roadmap. Its first
    // version said "it declares NO acceptance criteria" — a claim the extractor
    // cannot establish, since an unrecognised shape produces the identical empty
    // result. That turned a silent failure into an affirmative false statement
    // handed to the one independent check on AC conformance, which is strictly
    // worse: silence invites a look, a false assertion forecloses it. Caught by
    // the R2 review of the first version, and it was not hypothetical — the
    // trailing-text heading it names was live in two roadmaps.
    const roadmapLine = !args.roadmapGiven
        ? '- roadmap under review: none (`acceptance-criteria.md` is empty)'
        : args.acGiven
          ? '- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)'
          : '- roadmap under review: `roadmap.md` — NO acceptance criteria could be EXTRACTED from it, in either recognised form (an `## Acceptance criteria` heading, or inline `- **AC-n:**` bullets), so `acceptance-criteria.md` is empty. Two different things produce that result and the dispatcher cannot tell them apart: the roadmap declares none, or it declares them in a shape the extractor does not recognise. Open `roadmap.md`, decide which, and report a finding if the criteria are there.';
    return [
        `# R2 completion review — ${args.slug}`,
        '',
        'You are a FRESH reviewer subagent. You have no implementation context and',
        'you must not acquire any (blind-review pattern, plan-review-gates.md §5).',
        '',
        '## Review mode',
        '',
        'Senior-engineer review of the branch diff. Search grid — hunt for:',
        '',
        '- errors',
        '- inconsistent logic',
        '- inefficiencies',
        '- bug-producing patterns',
        '',
        '## Rules',
        '',
        '- Review only — write no code, fix nothing.',
        '- Tool allowlist (contract §5): branch-scoped `git diff` + reads of',
        '  branch-touched files only; no `git log` beyond the branch, no repo-wide',
        '  grep, no reads of `agents/runtime/` or session artifacts.',
        '',
        '## Inputs',
        '',
        `- diff: \`diff.patch\` — the review scope (branch head ${args.headSha}, review`,
        `  artefacts excluded), scope hash \`${args.scopeHash}\``,
        roadmapLine,
        '',
        'Changed files:',
        '',
        ...args.changedFiles.map((f) => `- ${f}`),
        '',
        '## Output format (contract §2.2)',
        '',
        `Fill the findings table in \`${args.slug}.findings.md\`:`,
        '',
        '```markdown',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '| 1 | critical | src/x.ts:42 | ... | open | |',
        '```',
        '',
        '- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending',
        '  by severity (ties keep authoring order).',
        '- Initial status of every finding: `open`.',
        '- A row is LIVE wherever it appears — a code fence around it changes',
        '  nothing. If you quote the template as an illustration, its Status cell',
        '  must be exactly `example`, or the gate reads it as a real finding.',
        '- 0 findings → replace the table with exactly this honest-null line',
        '  (contract §2.3):',
        '',
        '```markdown',
        `**Honest-null:** 0 findings, scope ${args.scopeHash}, reviewed <YYYY-MM-DD>`,
        '```',
        '',
        '## Return channel',
        '',
        RETURN_ENVELOPE_POINTER,
        '',
    ].join('\n');
}

/**
 * The findings skeleton, carrying `prompt_hash`.
 *
 * The contract's most dangerous residual is the PROMPT channel (§ 5): the
 * dispatcher fixes the reviewer's inputs but not the instructions wrapped around
 * them, so "a hash-verified artefact is not evidence of an unbiased review" — its
 * recorded case zero is an honest-null whose prompt stated prior rounds were
 * clean, where a later unsteered round on the identical scope found seven
 * defects.
 *
 * Writing the hash of the prompt THIS dispatcher built makes the channel
 * attributable: the artefact now records which prompt produced it, so a review
 * run against a different prompt is distinguishable from one run against the
 * dispatcher's.
 *
 * `--verify` / `--verify-current` do NOT re-derive it. {@link runVerify}
 * re-derives `scope_hash`, `roadmap_hash` and `ac_hash` only — it re-computes
 * the review's INPUTS from the current repo state, and the prompt is not one of
 * them (it is not reconstructible from the repo; it is an artefact this
 * dispatcher wrote). An earlier revision of this comment claimed otherwise for
 * roughly a year, which is how the field came to be written, parsed, and
 * compared to nothing.
 *
 * What compares it is `check_review_prompt_binding`, against the prompt package
 * this dispatcher commits beside the artefact (`<slug>.review-input/prompt.md`,
 * written below) — a different check with a different scope: corpus-wide rather
 * than current-branch, because a committed prompt and its recorded hash are both
 * immutable.
 *
 * It does not CLOSE the residual and is not sold as doing so: the same host that
 * authors a steered prompt could hash the steered text. The gain is an
 * attributable record where there was none, which is what turns the audit trail
 * (§ 2.7, round records are never edited in place) into something a contradicting
 * later round can be checked against.
 */
function findingsSkeleton(args: {
    slug: string;
    headSha: string;
    scopeHash: string;
    reviewedDate: string;
    manifest: string;
    promptHash: string;
}): string {
    return [
        `# Findings: ${args.slug}`,
        `<!-- completion-review: v1 | reviewed: ${args.reviewedDate} | scope: ${args.scopeHash} | diff: ${args.headSha} | reviewer: r2-fresh-subagent-${args.slug} | prompt_hash: ${args.promptHash} -->`,
        // SECOND PRODUCER of the independence record — step 2.2 of
        // road-to-review-independence. Until this line, `self_review_gate.ts` was the
        // only producer, which is why `check_review_schema` reported `scanned: 1`: a
        // schema gate with one producer checks that one producer agrees with itself.
        //
        // The values are derived, never chosen. `single-member` because this dispatch
        // has exactly one reviewer; `fresh` because a fresh subagent is what this file
        // dispatches and is the property the whole artifact exists to carry (the
        // `reviewer:` field above already says so in prose). Both axes go in, and the
        // derived pair follows: single-member + fresh is `provisional` / `single-pass`.
        //
        // Recording `provisional` on a fresh reviewer is not a downgrade — it is the
        // honest reading. One reviewer is one reviewer, however uncontaminated; the
        // family axis is what `accepted` needs and one member cannot supply it.
        `<!-- ${JSON.stringify({ 'review-independence': independenceFields([`r2-fresh-subagent-${args.slug}`], 'fresh') })} -->`,
        // Set at CREATION, never inferred later: an inferred type reads filename
        // and location, which are exactly the signals that already fail to
        // distinguish an input from a binding. This artifact binds a scope from
        // its first byte, so `current-binding` is what it IS — an empty table is
        // a RESULT, and a reviewer returning zero findings flips the type to
        // `honest-null` in the same edit that replaces the table.
        `<!-- evidence-type: v1 | type: current-binding | declared: ${args.reviewedDate} -->`,
        '',
        args.manifest,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->',
        '',
    ].join('\n');
}

interface Args {
    base: string;
    roadmap: string | null;
    slug: string | null;
    outDir: string;
    repo: string;
    printPrompt: boolean;
    format: 'text' | 'json';
    force: boolean;
    now: string | null;
    verify: string | null;
    verifyCurrent: boolean;
    /** `--verify-current` scan root; falls back to `--out-dir`. */
    artifactDir: string | null;
}

function parse_args(argv: readonly string[]): Args {
    const args: Args = {
        base: 'origin/main',
        roadmap: null,
        slug: null,
        outDir: 'agents/evidence/reviews',
        repo: '.',
        printPrompt: false,
        format: 'text',
        force: false,
        now: null,
        verify: null,
        verifyCurrent: false,
        artifactDir: null,
    };
    const takeValue = (flag: string, v: string | undefined): string => {
        if (v === undefined) {
            process.stderr.write(`dispatch_r2_reviewer: error: argument ${flag}: expected a value\n`);
            process.exit(2);
        }
        return v;
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--base') {
            args.base = takeValue(arg, argv[++i]);
        } else if (arg === '--roadmap') {
            args.roadmap = takeValue(arg, argv[++i]);
        } else if (arg === '--slug') {
            args.slug = takeValue(arg, argv[++i]);
        } else if (arg === '--out-dir') {
            args.outDir = takeValue(arg, argv[++i]);
        } else if (arg === '--repo') {
            args.repo = takeValue(arg, argv[++i]);
        } else if (arg === '--now') {
            args.now = takeValue(arg, argv[++i]);
        } else if (arg === '--verify') {
            args.verify = takeValue(arg, argv[++i]);
        } else if (arg === '--verify-current') {
            args.verifyCurrent = true;
        } else if (arg === '--artifact-dir') {
            args.artifactDir = takeValue(arg, argv[++i]);
        } else if (arg === '--print-prompt') {
            args.printPrompt = true;
        } else if (arg === '--force') {
            args.force = true;
        } else if (arg === '--format') {
            const v = takeValue(arg, argv[++i]);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `dispatch_r2_reviewer: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            args.format = v;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: dispatch_r2_reviewer [-h] [--base REF] [--roadmap PATH] [--slug SLUG]\n' +
                    '                            [--out-dir PATH] [--repo PATH] [--print-prompt]\n' +
                    '                            [--format {text,json}] [--force] [--now ISO]\n' +
                    '                            [--verify FINDINGS_FILE]\n' +
                    '                            [--verify-current [--artifact-dir DIR]]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(`dispatch_r2_reviewer: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
        i++;
    }
    return args;
}

function resolveNow(nowArg: string | null): Date {
    if (nowArg === null) return new Date();
    const d = new Date(nowArg);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`--now: invalid ISO timestamp '${nowArg}'`);
    }
    return d;
}

/**
 * Verify one artefact's manifest against the CURRENT repo state.
 *
 * `scopeDiffText` is an optional PRE-COMPUTED review-scope body. The scope is
 * one `git diff` over the whole branch — ~0.5 MB on a branch this size — and it
 * is identical for every artefact in a single pass, so `--verify-current`
 * computes it once and hands it down instead of paying for it per artefact.
 * Omitted (the single-artefact `--verify` path) it is computed here.
 */
function runVerify(args: Args, findingsPath: string = args.verify as string, scopeDiffText?: string): number {
    if (completionReviewDisabled(args.repo)) {
        process.stdout.write('⚠️  planning.completion_review=false — R2 manifest verification skipped (settings escape hatch)\n');
        return 0;
    }
    if (!fs.existsSync(findingsPath)) {
        process.stderr.write(`❌  Internal error: findings file not found: ${findingsPath}\n`);
        return 2;
    }
    const manifest = parseManifest(fs.readFileSync(findingsPath, 'utf-8'));
    if (manifest === null) {
        // POLICY, not internal error (contract §5): a manifest is mandatory —
        // "verification, not self-attestation". Exiting 2 here would let every
        // caller warn-and-allow, so omitting the manifest would bypass the
        // whole verification layer.
        process.stderr.write(
            `❌  Policy violation: no context-manifest block found in ${findingsPath} — ` +
                'the §5 manifest is mandatory; a findings artifact without one is unverifiable.\n',
        );
        return 1;
    }

    const scopeText = scopeDiffText ?? computeReviewScope((a) => git(args.repo, ...a), args.base).diffText;
    let roadmapText: string | null = null;
    let acText: string | null = null;
    let roadmapMissing = false;
    if (manifest.roadmap !== 'none') {
        const roadmapPath = path.resolve(args.repo, manifest.roadmap);
        if (fs.existsSync(roadmapPath)) {
            roadmapText = fs.readFileSync(roadmapPath, 'utf-8');
            acText = extractAcceptanceCriteria(roadmapText);
        } else {
            roadmapMissing = true;
        }
    }
    const expected = expectedHashes({ scopeDiffText: scopeText, roadmapText, acText });

    const diverged: string[] = [];
    const check = (name: string, recorded: string, actual: string): void => {
        if (recorded !== actual) {
            diverged.push(name);
            process.stderr.write(`  ${name}: recorded ${recorded} ≠ current ${actual}\n`);
        }
    };
    // `diff_sha` is provenance only and is NEVER compared: committing the
    // artifact (§2.5) and CI's synthetic merge-commit checkout both move HEAD
    // off the recorded sha. Content is what binds.
    check('scope_hash', manifest.scope_hash, expected.scope_hash);
    if (roadmapMissing) {
        diverged.push('roadmap_hash');
        process.stderr.write(`  roadmap_hash: recorded ${manifest.roadmap_hash} but roadmap file ${manifest.roadmap} is missing\n`);
    } else {
        check('roadmap_hash', manifest.roadmap_hash, expected.roadmap_hash);
        check('ac_hash', manifest.ac_hash, expected.ac_hash);
    }

    if (diverged.length) {
        process.stderr.write(`❌  manifest mismatch (stale review): ${diverged.join(', ')} diverged\n`);
        return 1;
    }
    process.stdout.write('✅ manifest verified\n');
    return 0;
}

/**
 * `--verify-current`: re-derive the manifest of every artefact RELEVANT to the
 * current review scope.
 *
 * Selection is the whole point of the mode (see the header note). Three
 * deliberate behaviours:
 *
 *   - **Foreign artefacts are never verified.** `agents/evidence/reviews/` is
 *     tracked and accumulates (§2.6), and every past branch's artefact records
 *     a different `scope_hash`, so a verify-everything loop reds by
 *     construction and can only be un-stuck by editing an unrelated branch's
 *     artefact.
 *   - **No relevant artefact → exit 0.** Whether an artefact is *required* is
 *     `check_completion_review`'s question (it reports `missing-artifact` /
 *     `dead-scan-scope`); a re-derivation step has nothing to re-derive and
 *     must not double-report it.
 *   - **A bare §2.4 skip declaration is not verified.** It carries no reviewer
 *     dispatch and per §5 needs no manifest, so running the manifest check on
 *     it would report a policy violation the contract explicitly excludes.
 */
function runVerifyCurrent(args: Args): number {
    if (completionReviewDisabled(args.repo)) {
        process.stdout.write('⚠️  planning.completion_review=false — R2 manifest re-derivation skipped (settings escape hatch)\n');
        return 0;
    }
    const artifactDirRel = args.artifactDir ?? args.outDir;
    const excludeViolation = scopeExclusionViolation(artifactDirRel);
    if (excludeViolation !== null) {
        process.stderr.write(excludeViolation);
        return 1;
    }
    const dirAbs = path.resolve(args.repo, artifactDirRel);
    const scope = computeReviewScope((a) => git(args.repo, ...a), args.base);

    let names: string[] = [];
    try {
        names = fs
            .readdirSync(dirAbs)
            .filter((n) => n.endsWith('.findings.md'))
            .sort();
    } catch {
        // Absent root — a repo with no review corpus yet. Coverage (including a
        // MOVED root) is check_completion_review's dead-scope assertion, not
        // this step's; re-deriving nothing is exit 0.
        names = [];
    }

    const selected: string[] = [];
    for (const name of names) {
        const abs = path.join(dirAbs, name);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch (exc) {
            process.stderr.write(
                `❌  Internal error: unreadable artefact ${abs}: ${exc instanceof Error ? exc.message : String(exc)}\n`,
            );
            return 2;
        }
        const rel = artifactRelevance(text, scope.hash, scope.empty);
        if (rel.relevant && rel.carriesReview) {
            selected.push(abs);
        }
    }

    if (selected.length === 0) {
        process.stdout.write(
            `✅ no review-bearing artefact claims the current review scope ${scope.hash} — nothing to re-derive.\n`,
        );
        return 0;
    }

    let mismatched = 0;
    for (const abs of selected) {
        process.stdout.write(`— ${path.relative(path.resolve(args.repo), abs)}\n`);
        // The scope is already in hand — re-deriving it per artefact would run
        // the same whole-branch `git diff` again for an identical result.
        const rc = runVerify(args, abs, scope.diffText);
        if (rc === 2) {
            return 2;
        }
        if (rc !== 0) {
            mismatched += 1;
        }
    }
    if (mismatched > 0) {
        process.stderr.write(
            `❌  ${mismatched} of ${selected.length} relevant artefact(s) failed manifest re-derivation\n`,
        );
        return 1;
    }
    process.stdout.write(`✅ ${selected.length} relevant artefact(s) verified against the current scope\n`);
    return 0;
}

function runDispatch(args: Args): number {
    const now = resolveNow(args.now);
    const dispatched = isoSeconds(now);
    const reviewedDate = dispatched.slice(0, 10);

    const headSha = git(args.repo, 'rev-parse', 'HEAD').trim();
    const scope = computeReviewScope((a) => git(args.repo, ...a), args.base);
    const scopeDiffText = scope.diffText;
    if (scope.empty) {
        process.stderr.write(`❌  Empty diff (${args.base}...HEAD) — nothing to review.\n`);
        return 1;
    }
    const changedFiles = git(args.repo, ...reviewScopeNameOnlyArgs(args.base))
        .split('\n')
        .filter((l) => l.trim() !== '');

    const slug = args.slug !== null ? sanitizeSlug(args.slug) : deriveSlugFromBranch(args.repo);

    let roadmapText: string | null = null;
    let acText: string | null = null;
    if (args.roadmap !== null) {
        roadmapText = fs.readFileSync(path.resolve(args.repo, args.roadmap), 'utf-8');
        acText = extractAcceptanceCriteria(roadmapText);
    }
    const hashes = expectedHashes({ scopeDiffText, roadmapText, acText });

    const outDirViolation = scopeExclusionViolation(args.outDir);
    if (outDirViolation !== null) {
        process.stderr.write(outDirViolation);
        return 1;
    }

    const outDirAbs = path.resolve(args.repo, args.outDir);
    const inputDirAbs = path.join(outDirAbs, `${slug}.review-input`);
    const findingsAbs = path.join(outDirAbs, `${slug}.findings.md`);
    // A leftover artefact at the target is one of three very different things and
    // the pre-existing refusal could not tell them apart: it said "use --force"
    // for all of them, and `--force` overwrites — so the only escape it offered
    // destroys the record of a review that happened. Classify by the ONE
    // review-scope hash both dispatcher and validator bind to, and name the
    // contract-conform step for what was actually found.
    if (fs.existsSync(findingsAbs) && !args.force) {
        let existingText: string | null = null;
        try {
            existingText = fs.readFileSync(findingsAbs, 'utf-8');
        } catch {
            existingText = null;
        }
        const verdict: ArtefactStaleness =
            existingText === null ? 'unreadable' : artefactStaleness(existingText, hashes.scope_hash);
        const staleHash =
            existingText === null ? '' : (parseManifest(existingText)?.scope_hash ?? '');
        process.stderr.write(
            leftoverArtefactRefusal(
                path.relative(args.repo, findingsAbs),
                verdict,
                staleHash,
                hashes.scope_hash,
            ),
        );
        return 1;
    }

    const promptText = reviewerPrompt({
        slug,
        headSha,
        scopeHash: hashes.scope_hash,
        roadmapGiven: roadmapText !== null,
        acGiven: hasAcceptanceCriteria(acText),
        changedFiles,
    });
    const manifest = deriveManifest({
        diffSha: headSha,
        scopeHash: hashes.scope_hash,
        roadmap: args.roadmap ?? 'none',
        roadmapHash: hashes.roadmap_hash,
        acHash: hashes.ac_hash,
        dispatched,
    });
    // Phase 3.4 of road-to-source-silence: redact deny-set hits AT WRITE TIME.
    // This package's confidentiality gate carried a blanket `skip_paths`
    // exemption over `*.review-input/diff.patch`, which did not stop the leak —
    // it stopped the gate from seeing it. The generator is the only writer of
    // these files, so it is the only place the content can be fixed instead of
    // exempted. Redaction is line-local: hunks, paths and context are
    // untouched, so the evidence chain a reviewer reads stays intact.
    //
    // ORDERING IS LOAD-BEARING. `prompt_hash` must re-derive from the bytes on
    // disk (`check_review_prompt_binding` re-hashes `prompt.md`), so the prompt
    // is redacted BEFORE it is hashed. Hashing the pre-redaction text and
    // writing the post-redaction text would make every new artefact fail its
    // own binding gate.
    const denyPatterns = loadDenyPatterns();
    let redactions = 0;
    const promptTokens = redactSourceTokens(promptText, denyPatterns);
    // Shape redaction runs on the prompt too, and BEFORE the hash below, for the
    // same reason the deny pass does: `check_review_prompt_binding` re-derives
    // prompt_hash from prompt.md on disk, so hashing anything other than the
    // exact bytes written would make every new artefact fail its own binding.
    const promptRedacted = redactSourceShape(promptTokens.text);
    redactions += promptTokens.count + promptRedacted.count;

    const skeleton = findingsSkeleton({
        slug,
        headSha,
        scopeHash: hashes.scope_hash,
        reviewedDate,
        manifest,
        promptHash: sha256(promptRedacted.text),
    });

    fs.mkdirSync(inputDirAbs, { recursive: true });

    redactions += writeRedacted(path.join(inputDirAbs, 'diff.patch'), scopeDiffText, denyPatterns);
    if (roadmapText !== null) {
        // The snapshot lands under agents/evidence/, which check_references
        // walks, while the live roadmap layer is deliberately excluded from
        // that gate — so a roadmap that legitimately quotes a nonexistent
        // path (e.g. documenting a hallucinated council citation) would red
        // CI through its own review snapshot. The header exemption keeps the
        // snapshot verbatim below the marker; roadmap_hash binds the LIVE
        // file and is unaffected. Found by the zcs-close CI run, 2026-08-09.
        const snapshotHeader =
            '<!-- check-refs: skip -->\n' +
            '<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->\n';
        redactions += writeRedacted(
            path.join(inputDirAbs, 'roadmap.md'),
            snapshotHeader + roadmapText,
            denyPatterns,
        );
    }
    redactions += writeRedacted(
        path.join(inputDirAbs, 'acceptance-criteria.md'),
        acText ?? '',
        denyPatterns,
    );
    fs.writeFileSync(path.join(inputDirAbs, 'prompt.md'), promptRedacted.text, 'utf-8');
    if (redactions > 0) {
        // Never redact silently: a changed artefact nobody was told about is
        // the failure mode this whole programme is about.
        process.stderr.write(
            `dispatch_r2_reviewer: redacted ${redactions} source-confidentiality hit(s) ` +
                `from the review-input snapshot (marker: [REDACTED:src-conf]).\n`,
        );
    }
    fs.writeFileSync(findingsAbs, skeleton, 'utf-8');

    const inputDirRel = path.join(args.outDir, `${slug}.review-input`);
    const findingsRel = path.join(args.outDir, `${slug}.findings.md`);
    const files = {
        input_dir: inputDirRel,
        diff: path.join(inputDirRel, 'diff.patch'),
        roadmap: roadmapText !== null ? path.join(inputDirRel, 'roadmap.md') : null,
        acceptance_criteria: path.join(inputDirRel, 'acceptance-criteria.md'),
        prompt: path.join(inputDirRel, 'prompt.md'),
        findings: findingsRel,
    };

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify({ slug, head_sha: headSha, hashes, files }, null, 2) + '\n');
    } else if (args.printPrompt) {
        process.stdout.write(promptText);
        process.stdout.write('\n---\n');
        process.stdout.write(`input package: ${inputDirRel}\n`);
        process.stdout.write(`findings skeleton: ${findingsRel}\n`);
    } else {
        process.stdout.write(
            `✅  R2 reviewer package prepared for '${slug}' (head ${headSha}, scope ${hashes.scope_hash}).\n`,
        );
        process.stdout.write(`  input package:     ${inputDirRel}\n`);
        process.stdout.write(`  findings skeleton: ${findingsRel}\n`);
        process.stdout.write('  Dispatch a FRESH subagent at the input package (never the implementing session).\n');
    }
    return 0;
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.verifyCurrent) {
        return runVerifyCurrent(args);
    }
    if (args.verify !== null) {
        return runVerify(args);
    }
    return runDispatch(args);
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked invocation (installed projection, macOS /var → /private/var)
    // makes the raw URLs differ; compare realpaths so the guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(2);
    }
}
