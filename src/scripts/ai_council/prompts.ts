/**
 * Neutrality system prompts for the council.
 *
 * Ported from the retired Python `src/scripts/ai_council/prompts.py` (ADR-200 —
 * Python→TS migration, Phase 1). Council members must NOT see the host
 * agent's reasoning, internal state, or framing language. Each prompt asks
 * for an independent critique on the artefact's own merits.
 *
 * Anti-patterns guarded against in tests (test_prompts.py):
 * - No leak of host-agent identity ("Augment", "Claude Code", etc.).
 * - No "the agent thinks X" framing.
 * - No instructions that bias toward agreement.
 *
 * Parity notes:
 * - The Python module's string constants are triple-quoted literals run
 *   through `.strip()` (or `.rstrip()` for one). Each constant below is the
 *   byte-exact post-strip value — the `_dedent`/`.strip()` step is folded in
 *   at authoring time so the runtime value matches `str.strip()` output.
 * - `"\n".join` / `"\n\n".join` mirror Python `str.join`.
 * - `str.splitlines()` is mirrored by `_splitlines` (drops the trailing
 *   empty element a final newline would produce; full universal-newline set).
 * - `sorted(...)` for error messages mirrors Python `sorted()` (code-point
 *   ascending) via `[...].sort()` on ASCII keys.
 */
import type { ProjectContext } from './project_context.js';

// Python: NEUTRALITY_PREAMBLE = """\...""".strip()
export const NEUTRALITY_PREAMBLE = `You are an independent reviewer. You have NOT seen any prior reasoning,
agent output, or commentary on the artefact below. Critique it on its
own merits. Disagree if warranted. Cite specific lines or sections.
Do not assume the artefact is correct just because it was sent to you.`;

// Host-agent identity strings that must never leak into a council member's
// view. Lines containing any of these (case-insensitive substring) are
// dropped before assembly. See `ai-council` skill § Neutrality.
export const HOST_AGENT_IDENTITY_PATTERNS = [
    'augment',
    'claude code',
    'cursor agent',
    'cursor ide',
    'cline',
    'windsurf',
    'copilot agent',
] as const;

// Per-mode addenda — appended after the preamble.

export const PROMPT_MODE = `The artefact is a free-form question or proposal from a developer.
Respond with:
1. Your honest assessment (agree / disagree / mixed).
2. The single strongest argument for your position.
3. The single strongest counter-argument the developer should consider.
4. Concrete next steps if you agree, or concrete alternatives if you disagree.`;

export const ROADMAP_MODE = `The artefact is a proposed implementation roadmap. Critique it as if
you were a senior engineer asked to greenlight it. Focus on:
1. Hidden coupling between phases that the roadmap glosses over.
2. Steps that are too coarse to verify ("implement X" vs "X with Y test").
3. Missing rollback or kill-switch criteria.
4. Sequencing risks — does step N really not block step N+1?
5. Open questions disguised as decisions, or vice versa.`;

export const DIFF_MODE = `The artefact is a code diff. Review it for:
1. Correctness — bugs, off-by-one, null-safety, type drift.
2. Security — injection, secrets, unsafe deserialization, authZ gaps.
3. Test coverage — uncovered branches, missing regression tests.
4. Maintainability — surprise dependencies, naming drift, dead code.
End with: APPROVE / REQUEST_CHANGES / REJECT and one sentence why.`;

export const FILES_MODE = `The artefact is a set of source files for an architectural review.
Map out:
1. The boundaries you see (modules, layers, trust zones).
2. The strongest design decision present.
3. The weakest design decision present.
4. The single change that would most reduce future maintenance cost.`;

// Specialised modes — used by /council-pr, /council-design,
// /council-optimize. Selected via `mode_override=` in `/council` so the
// base modes (`prompt`, `roadmap`, `diff`, `files`) keep their v2 byte
// shape for back-compat with existing callers.

export const PR_MODE = `The artefact is a code diff from a pull request. Review with both a
correctness lens AND a shipping-risk lens:
1. Correctness — bugs, off-by-one, null-safety, type drift.
2. Security — injection, secrets, unsafe deserialization, authZ gaps.
3. Test coverage — uncovered branches, missing regression tests.
4. Shipping risk — does this PR mix concerns that should be split?
   Is the blast radius bigger than the title implies?
5. Reviewer fatigue — is anything in the diff that a tired reviewer
   would rubber-stamp but should not?
6. Reuse & object-oriented shape — does the diff reinvent a component
   or abstraction the codebase likely already provides (should compose
   / reuse instead), and where it adds structure, is the OO shape
   (encapsulation, composition over inheritance) justified by
   complexity it removes rather than speculative abstraction? Judge in
   the codebase's own paradigm — do not push classes onto functional /
   pipeline code; smallest-change still wins over OO advocacy.
End with: APPROVE / REQUEST_CHANGES / REJECT, one sentence why, and
the single highest-leverage change the PR author should make before
merge.`;

export const DESIGN_MODE = `The artefact is a design document, ADR, or architecture proposal.
Critique it as if you were greenlighting it as a senior engineer.
Focus on:
1. Trust boundaries and module coupling the design glosses over.
2. Rollback / kill-switch criteria the design omits.
3. Sequencing risk — does step N really not block step N+1?
4. Open questions disguised as decisions, or decisions disguised as
   open questions.
5. The single architectural call you would push back on the hardest,
   and what evidence would change your mind.`;

export const OPTIMIZE_MODE = `The artefact is an optimization target — code, a query, a profile,
or an existing optimization report. Produce ranked, evidence-based
suggestions for the metric stated in the user's original ask. You
MUST:
1. Rank suggestions by expected impact on the stated metric, not by
   effort or cleverness.
2. Cite the evidence (line, query plan, profile entry) for every
   suggestion. No hand-wave "this is probably slow".
3. State at least one suggestion you explicitly REJECT as
   low-leverage, so the user does not over-engineer.
4. Mark at least one suggestion \`evidence: speculative\` (requires
   measurement before committing) against at least one marked
   \`evidence: confirmed\` (already supported by the artefact). Use the
   same three-term scale as every other lens — \`confirmed\` |
   \`inferred\` | \`speculative\` — never a lens-local synonym.`;

export const ANALYSIS_MODE = `The artefact is a local analysis output (from a project analyzer,
audit script, or codebase scan). Critique the **analysis itself**, not
the underlying codebase. You MUST:
1. Flag findings that are restated under different headings —
   deduplicate aggressively. The downstream consumer wants a unique
   Top-N, not a long list with overlap.
2. Score the evidence quality of each finding: confirmed (the
   analysis cites file:line / metric), inferred (plausible from
   stated context), or speculative (no citation, vibes-only).
   Speculative findings must be called out by name.
3. Identify findings that are roadmap-ready (concrete enough to land
   as a phase step) vs ones that need a discovery loop first.
4. Propose 3–5 follow-up actions ranked by leverage — what the next
   roadmap should attack first. Cite the supporting finding(s) by id
   or heading.
End with: a Top-N consensus list (one bullet per finding the
analysis surfaces) plus a single sentence on the strongest blind
spot the analysis itself has.`;

export const DEBATE_MODE = `The artefact is the topic of a structured multi-round debate. You are
one of several independent reviewers. Round-specific instructions:
1. Round 1 — state your strongest, most defensible position on the
   topic. Argue from evidence and first principles. Do not hedge.
2. Round 2+ — read the anonymised positions from the previous round.
   Identify the SINGLE strongest opposing position and write a
   rebuttal addressed at its strongest steel-manned form. Your task
   is to find the load-bearing flaw the opposing reviewer missed —
   do NOT search for common ground.
End each round with: a one-line position summary and the single
piece of evidence that would change your mind.`;

/**
 * Mandatory closing-line contract appended to the FINAL round when
 * `ai_council.stance_tally` is enabled (Phase 1). Peers backing the same option
 * MUST reuse the same label so the deterministic tally can canonicalise it;
 * `abstain` is allowed. Parsed by `stance_tally.parse_stance_line` — the tally
 * never infers a stance from the surrounding prose, so an omitted or malformed
 * line becomes a repair-marker, not a guess.
 */
export const STANCE_LINE_CONTRACT = `Close your reply with EXACTLY this line, and nothing after it:
STANCE: <option-label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no
Reuse the SAME <option-label> as any peer backing the same option (match their wording); use \`abstain\` only if you genuinely cannot choose. CONFIDENCE is your certainty in the pick; DEALBREAKER is \`yes\` only if you would block on the alternative.`;

/**
 * Anti-conformity directive appended to round-2+ debate prompts when
 * `ai_council.debate_gates` is enabled (road-to-opt-council-deliberation
 * Phase 3). Counters the round-over-round convergence-to-consensus drift the
 * `rounds:N` path otherwise invites. Byte-identical across the api / cli /
 * manual transports (it becomes part of the shared `user_prompt`, which every
 * client's `ask()` receives verbatim), so no per-transport special-casing.
 */
export const ANTI_CONFORMITY_DIRECTIVE = `Anti-conformity rule for this round: defend a position you still believe is correct. Change your position ONLY when a specific, named flaw in it has been identified — and you must name that flaw explicitly to justify the change. Do not soften or converge merely because other reviewers disagree; agreement without a named reason is conformity, not reasoning.`;

const _MODE_TABLE: Record<string, string> = {
    prompt: PROMPT_MODE,
    roadmap: ROADMAP_MODE,
    diff: DIFF_MODE,
    files: FILES_MODE,
    pr: PR_MODE,
    design: DESIGN_MODE,
    optimize: OPTIMIZE_MODE,
    analysis: ANALYSIS_MODE,
    debate: DEBATE_MODE,
};

// ── Consensus-scoring prompts (Phase 4 / F3) ──────────────────────────
//
// Two-step extraction + scoring round used by the analysis lens. The
// extraction pass asks each member to surface its own top findings in
// a strict JSON shape; the scoring pass asks each member to rate
// anonymised findings produced by the *other* members.
//
// Iron Law of Neutrality applies to both: the extraction prompt never
// names other reviewers, and the scoring prompt strips the source
// author by using `Finding-A` / `Finding-B` labels (see
// `consensus.anonymize_findings`).

export const FINDING_EXTRACTION_PROMPT = `You have just produced an analysis. Re-emit your top findings as a
strict JSON array suitable for downstream tooling. Each item MUST
have:

    {"id": "<short-slug>", "text": "<one-sentence finding>"}

Rules:
- 3-7 findings, ordered by importance (most important first).
- \`id\` is a 1-3 word kebab-case slug, unique within your array.
- \`text\` is a single sentence, no markdown, no reviewer self-reference.
- Wrap the array in a \`\`\`json\`\`\` fenced block. No commentary outside it.`;

/**
 * Phase 1B — inline findings contract, analysis lens only.
 *
 * Appended to the FINAL deliberation round so a member emits its own findings
 * in the SAME response as its analysis, in the schema
 * `FINDING_EXTRACTION_PROMPT` already defines. When the block parses, the
 * separate extraction call at `run_consensus_scoring`'s pass 1 is not issued.
 *
 * Deliberately a RESTATEMENT of the existing schema and not a second schema:
 * `parse_findings_outcome` is the only reader, so two shapes here would be two
 * answers to "what is a finding". The rules below are the extraction prompt's
 * rules with the framing changed from "re-emit" to "append", because the member
 * has not finished writing when it reads this.
 *
 * Appended exactly like `STANCE_LINE_CONTRACT` (`orchestrator.ts` final-round
 * suffix) — off by default, and off means the prompt is byte-identical.
 */
export const INLINE_FINDINGS_CONTRACT = `After your analysis, and only after it, append your top findings as a
strict JSON array so downstream tooling can read them without asking
you again. Each item MUST have:

    {"id": "<short-slug>", "text": "<one-sentence finding>"}

Rules:
- 3-7 findings, ordered by importance (most important first).
- \`id\` is a 1-3 word kebab-case slug, unique within your array.
- \`text\` is a single sentence, no markdown, no reviewer self-reference.
- Wrap the array in a \`\`\`json\`\`\` fenced block, at the END of your reply,
  below the prose. No commentary between the prose and it.
- If you were also asked to close with a stance line, that line comes AFTER
  this block and is the true last line. These two instructions do not compete:
  prose, then the findings block, then the stance line.
- An empty array \`[]\` is a valid answer meaning you found nothing.
- The prose analysis above it is still the primary deliverable — the block
  summarises it, it does not replace it.`;

export const FINDING_SCORING_PROMPT = `Below are findings from other independent reviewers, presented with
neutral labels (Finding-A, Finding-B, …). Score each one on its
merits. You MUST emit a strict JSON array, one entry per finding,
in this shape:

    {"finding_id": "Finding-A", "score": 1-10, "agree": true|false,
     "reason": "<one-sentence justification>"}

Rules:
- \`score\` is an integer 1 (weak / irrelevant) to 10 (load-bearing /
  must-address).
- \`agree=true\` means you would surface this same finding yourself;
  \`agree=false\` means you think it is wrong, overstated, or off-topic.
- \`reason\` is a single sentence, no markdown.
- Wrap the array in a \`\`\`json\`\`\` fenced block. No commentary outside it.

You may not see your own findings in the list — that is by design.`;

// ── Synthesis templates (Phase 3 / F2) ────────────────────────────────
//
// Lens-aware synthesis prompts. Each entry maps a lens key onto the
// block the host agent should produce when summarising member responses.
// R4 Q4 split: decision lenses get a Karpathy-structured template;
// creative lenses (design / optimize) stay open-ended prose (empty
// string → renderer falls back to the bare "Convergence / Divergence"
// slot). Input modes (prompt / roadmap / diff / files) map onto the
// `default` decision template via `synthesis_template()`.

export const DEFAULT_SYNTHESIS = `Summarise the council using the structured shape below. Be terse,
cite reviewers by label, and refuse to invent agreement that is not
in the responses.

### Agreement
Points that two or more reviewers converged on, each as a single line.

### Clashes
Points where reviewers disagreed. State both sides with a one-line
reviewer-label citation per side.

### Blind spots
Items that none of the reviewers raised but that the artefact's
context suggests are load-bearing. Maximum three. Mark each as
\`needs-verification\` when the host agent inferred it rather than
read it directly from a response.

### Recommendation
A single sentence: which course the host agent should advise the
user to take, grounded in the strongest converged point.

### Kill criteria
Observable conditions that would falsify this recommendation without
re-convening the council. Each entry names a threshold or a specific
event — never a vague "if it goes wrong". Omit only if genuinely none
exist, and say so explicitly.

### Concrete next step
Exactly one artefact-producing action the user can take in their
current turn.`;

export const PR_SYNTHESIS = `Summarise the council with the PR-review shape below.

### Consensus
Findings where two or more reviewers agreed, each one a single line.

### Conflicts
Findings where reviewers disagreed. State both sides with reviewer
labels; do not pick a winner here — that lives in the recommendation.

### Must-fix before merge
Items at least one reviewer marked \`REQUEST_CHANGES\` or \`REJECT\`
and the host agent confirms are load-bearing. Maximum five.

### Recommendation
APPROVE / REQUEST_CHANGES / REJECT and a single sentence justifying
the verdict, anchored on the strongest consensus or must-fix line.

### Kill criteria
Observable conditions that would falsify this verdict without re-convening
the council (a failing check, a missing test, a regression signal). Each
entry names a threshold or a specific event. Omit only if genuinely none
exist, and say so.

### Concrete next step
Exactly one artefact-producing action the author can take in their current
turn.`;

export const ANALYSIS_SYNTHESIS = `Summarise the council with the analysis-lens shape below.

### Top-10 by consensus
Findings ranked by how many reviewers surfaced them. Format each
line as: \`N. <finding> — cited by <reviewer labels> · evidence:
confirmed | inferred | speculative · roadmap-ready: yes | needs-discovery\`.
Stop at ten or when only single-reviewer items remain, whichever
comes first.

### Supporting
Findings that one reviewer raised and at least one other treated as
plausible but did not independently surface. One line each, same
metadata shape as Top-10.

### Outliers
Single-reviewer findings the others did not engage with. Keep them
— they are signal for a future deeper analysis pass — and give each
the SAME metadata shape as Top-10, including its \`evidence:\` term.
The heading is the corroboration statement: everything under it was
raised by one reviewer and engaged with by none. Do not invent a
separate certainty word for that; \`evidence:\` measures how well a
finding is supported, and being alone in raising it is a different
property the section already carries.

### Kill criteria
Observable conditions that would falsify the analysis's leading finding
without re-convening the council. Each entry names a threshold or event.
Omit only if genuinely none exist, and say so.

### Concrete next step
Exactly one artefact-producing action the user can take in their current
turn.`;

// Creative lenses — free-form prose synthesis, then the two required
// verdict-discipline sections. The body stays open-ended (the host agent
// writes the Convergence / Divergence prose on its own merits); only the
// falsifiable close is mandated, so every lens carries Kill criteria +
// Concrete next step (road-to-opt-council-deliberation Phase 0).
export const CREATIVE_SYNTHESIS = `Write a free-form convergence / divergence
synthesis of the council in prose — no fixed section shape for the body.
Then close with exactly these two sections:

### Kill criteria
Observable conditions that would falsify the direction you converged on,
without re-convening the council. Each entry names a threshold or event.
Omit only if genuinely none exist, and say so.

### Concrete next step
Exactly one artefact-producing action the user can take in their current
turn.`;

const _SYNTHESIS_TABLE: Record<string, string> = {
    default: DEFAULT_SYNTHESIS,
    pr: PR_SYNTHESIS,
    analysis: ANALYSIS_SYNTHESIS,
    design: CREATIVE_SYNTHESIS,
    optimize: CREATIVE_SYNTHESIS,
};

// Input modes inherit the `default` decision template. Lens overrides
// (`pr`/`design`/`optimize`/`analysis`) pick their own row.
const _INPUT_MODE_TO_SYNTHESIS_KEY: Record<string, string> = {
    prompt: 'default',
    roadmap: 'default',
    diff: 'default',
    files: 'default',
};

/** Mirror Python `key in dict` (own-enumerable string key present). */
function _hasKey(table: Record<string, string>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(table, key);
}

/** Mirror Python `sorted(set(a) | set(b))` — ascending code-point order, deduped. */
function _sortedUnion(a: string[], b: string[]): string[] {
    const set = new Set<string>([...a, ...b]);
    return Array.from(set).sort();
}

/** Mirror Python `repr()` for a string scalar (single-quoted). */
function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Mirror Python `repr()` for `None`. */
function _pyRepr(value: string | null): string {
    return value === null ? 'None' : _pyReprStr(value);
}

/** Mirror Python `str.splitlines()` — universal newline set, no trailing empty. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Python splitlines() boundaries: LF CR CRLF VT FF FS GS RS NEL LS PS.
    const parts = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/u);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Mirror Python `str.strip()` — strip whitespace both ends. */
function _pyStrip(s: string): string {
    return s.trim();
}

export function synthesis_template(mode: string | null): string {
    if (mode === null) {
        return _SYNTHESIS_TABLE['default'] as string;
    }
    if (_hasKey(_SYNTHESIS_TABLE, mode)) {
        return _SYNTHESIS_TABLE[mode] as string;
    }
    if (_hasKey(_INPUT_MODE_TO_SYNTHESIS_KEY, mode)) {
        const key = _INPUT_MODE_TO_SYNTHESIS_KEY[mode] as string;
        return _SYNTHESIS_TABLE[key] as string;
    }
    const expected = _sortedUnion(
        Object.keys(_SYNTHESIS_TABLE),
        Object.keys(_INPUT_MODE_TO_SYNTHESIS_KEY),
    );
    throw new Error(
        `Unknown synthesis mode ${_pyRepr(mode)}. ` +
            `Expected one of: [${expected.map((m) => _pyReprStr(m)).join(', ')}]`,
    );
}

export function all_synthesis_modes(): string[] {
    return Object.keys(_SYNTHESIS_TABLE).sort();
}

/**
 * Raised when a completed synthesis is missing a required verdict-discipline
 * section (Kill criteria / Concrete next step) or carries it empty. Named so
 * the render step fails loudly rather than emitting an unfalsifiable verdict.
 * Mirrors the `CouncilConfigError` named-error precedent in `config.ts`.
 */
export class SynthesisRenderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SynthesisRenderError';
    }
}

/** The two sections every lens synthesis must close with (Phase 0). */
export const REQUIRED_SYNTHESIS_SECTIONS = ['Kill criteria', 'Concrete next step'] as const;

/**
 * Validate a **completed** synthesis (the host- or chairman-authored text that
 * fills the Convergence / Divergence slot) — not the template prompt. Every
 * lens must close with a non-empty `### Kill criteria` and `### Concrete next
 * step`; a missing or placeholder-empty section throws `SynthesisRenderError`
 * naming the first offender. Safe to call on decision and creative lenses
 * alike, since both now require the two sections.
 *
 * **Not wired onto the emit path, deliberately.** This docstring used to claim
 * it was "called on the synthesis-emit path"; measured, the function had zero
 * production call sites and only the test imported it. Wiring it
 * unconditionally into `render()` is not available either: with no chairman the
 * rendered body is the literal `*to be summarised by the host agent*`, which
 * carries neither section, so every templated render would throw (verified —
 * the probe raises `missing the required "### Kill criteria" section`). A
 * caller that HAS a completed synthesis calls this; the templated default path
 * has nothing to validate. The tally check below is the half that could be
 * wired, because it is conditional on a verdict line the template never emits.
 */
export function assert_synthesis_sections(text: string): void {
    const lines = text.split('\n');
    const isHeading = (l: string): boolean => /^#{2,4}\s/.test(l);
    for (const section of REQUIRED_SYNTHESIS_SECTIONS) {
        const headingRe = new RegExp(`^#{2,4}\\s+${section}\\s*$`, 'i');
        const idx = lines.findIndex((l) => headingRe.test(l));
        if (idx === -1) {
            throw new SynthesisRenderError(
                `synthesis is missing the required "### ${section}" section`,
            );
        }
        let body = '';
        for (let i = idx + 1; i < lines.length; i++) {
            if (isHeading(lines[i] as string)) break;
            body += lines[i];
        }
        if (body.trim().length === 0) {
            throw new SynthesisRenderError(
                `synthesis "### ${section}" section is empty (placeholder)`,
            );
        }
    }
}

/** The reserved verdict label a synthesis uses when the tally did not converge. */
export const SPLIT_VERDICT_LABEL = 'split';

// Mirrors `_STANCE_RE`'s shape discipline: an explicit, single-field closing
// line, never read out of surrounding prose.
//
// **Case-SENSITIVE, deliberately.** The `i` flag was here and was wrong: the
// pattern is line-anchored, so `Verdict: option A is the stronger choice` —
// ordinary chairman prose opening a line — parsed as a machine-readable verdict
// carrying the whole sentence as its label. That is precisely the prose
// inference the paragraph above forbids, arriving through the regex instead of
// through a fallback. `VERDICT_LINE_CONTRACT` asks for the literal uppercase
// token, so requiring it costs a compliant author nothing and closes the class.
const _VERDICT_RE = /^\s*VERDICT:\s*(.+?)\s*$/gm;

/**
 * Mandatory closing-line contract for a synthesis rendered alongside a stance
 * tally. The synthesis states its verdict as a machine-readable label rather
 * than leaving it to be mined out of the recommendation prose — the same
 * discipline `STANCE_LINE_CONTRACT` imposes on members.
 */
export const VERDICT_LINE_CONTRACT = `Close the synthesis with EXACTLY this line, and nothing after it:
VERDICT: <option-label>
Use the SAME <option-label> the Vote Tally cleared. Use \`${SPLIT_VERDICT_LABEL}\` when no option cleared the threshold — an honest split is a verdict, and claiming a winner the tally did not record is a render error.`;

/**
 * Parse the synthesis verdict line. Returns the LAST match (the final,
 * most-authoritative one) or `null` when no well-formed line exists.
 *
 * `null` is a repair marker, never a guess: this function does not fall back to
 * reading agreement out of the prose. That is the invariant `stance_tally`
 * states for members ("the tally never infers a stance from the surrounding
 * prose") and the one `check_finding_dispositions` states for the release
 * ledger ("a comment is mutable and unaudited; it is transport, not a record").
 */
export function parse_verdict_line(text: string): { label: string; display: string } | null {
    _VERDICT_RE.lastIndex = 0;
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = _VERDICT_RE.exec(text)) !== null) {
        last = m;
    }
    if (last === null) {
        return null;
    }
    const raw = (last[1] ?? '').trim();
    if (raw.length === 0) {
        return null;
    }
    // An angle-bracketed label is the CONTRACT's own placeholder, not a verdict.
    // This matters on the templated path: with no chairman the rendered body IS
    // `VERDICT_LINE_CONTRACT`'s template text, so a parser without this guard
    // would read `<option-label>` as a claimed winner and throw on every
    // un-summarised render. Same treatment `assert_synthesis_sections` gives a
    // placeholder-empty section.
    if (/^<.*>$/.test(raw)) {
        return null;
    }
    return { label: raw.toLowerCase(), display: raw };
}

/**
 * Validate a completed synthesis against the stance tally it was rendered
 * beside: a verdict naming a winner the tally did not clear throws
 * `SynthesisRenderError`, the same way a missing section does.
 *
 * The defect this closes: `assert_synthesis_sections` is a *shape* check, so a
 * synthesis could report agreement over a tally that recorded dissent and
 * nothing downstream disagreed. That is the class behind the recorded 9.14.0
 * release failure, where the head read "Security and correctness: none" over a
 * critical finding — `check_finding_dispositions.ts` is the same check on the
 * release surface.
 *
 * **An absent verdict line does not throw.** It is a repair marker under the
 * same rule as an unparseable stance: the fail-safe direction is to record that
 * the claim was not made, never to infer one from prose. That also keeps every
 * synthesis rendered before `VERDICT_LINE_CONTRACT` shipped green.
 */
export function assert_synthesis_matches_tally(text: string, tally: TallyView): void {
    const mismatch = describe_verdict_mismatch(text, tally);
    if (mismatch !== null) {
        throw new SynthesisRenderError(mismatch);
    }
}

/** The slice of a `StanceTallyResult` the verdict check reads. */
export interface TallyView {
    consensus: { label: string } | null;
    split: boolean;
    options: ReadonlyArray<{ label: string }>;
}

/**
 * The same comparison as `assert_synthesis_matches_tally`, returning the
 * mismatch as a string instead of throwing — `null` means "no contradiction".
 *
 * **Why both shapes exist.** Throwing is right for a caller holding a finished
 * synthesis it can refuse. It is wrong on the render path: `render()` throws
 * before the tally and the Convergence blocks are pushed, so a mismatch would
 * destroy the ENTIRE artifact — every member response, the peer review, the
 * quorum bookkeeping — *after* every provider call has already been paid for.
 * The module's own answer for an unverifiable claim is the `needs_repair`
 * marker `render_vote_tally` prints, not a discarded pass, and the roadmap had
 * already recorded that unconditionally wiring the sibling shape check was
 * unsafe for this same reason. So the render path surfaces the contradiction
 * where a reader will see it and keeps the artifact.
 */
export function describe_verdict_mismatch(text: string, tally: TallyView): string | null {
    const verdict = parse_verdict_line(text);
    if (verdict === null) {
        return null; // repair marker, not a guess
    }
    // The reserved sense of `split` yields to a real option that carries the
    // same label (R2 finding 8): the label vocabulary is free text mined from
    // member `STANCE:` lines, so nothing stops an option genuinely called
    // `split`, and when the tally clears it the CORRECT verdict would otherwise
    // read as a contradiction. Deciding by whether the tally actually holds
    // that option keeps one namespace without an escape syntax authors would
    // have to learn.
    const optionNamedSplit = tally.options.some(
        (o) => o.label.toLowerCase() === SPLIT_VERDICT_LABEL,
    );
    const claimsSplit = verdict.label === SPLIT_VERDICT_LABEL && !optionNamedSplit;

    if (tally.consensus === null) {
        if (claimsSplit) {
            return null;
        }
        // `split` is the tally's own word for this state; reading it here rather
        // than re-deriving "no consensus ⇒ split" keeps the message honest when
        // the tally is empty (zero options is not a split across zero options).
        const how = tally.split
            ? `split across ${tally.options.length} option(s)`
            : 'no option-level stances parsed';
        return (
            `synthesis claims "${verdict.display}" but the tally recorded no consensus ` +
            `(${how}); use \`${SPLIT_VERDICT_LABEL}\` or re-run the round`
        );
    }

    if (claimsSplit) {
        return `synthesis claims a split but the tally cleared "${tally.consensus.label}"`;
    }
    if (verdict.label !== tally.consensus.label.toLowerCase()) {
        return (
            `synthesis claims "${verdict.display}" but the tally cleared ` +
            `"${tally.consensus.label}"`
        );
    }
    return null;
}

/**
 * Drop any *whole line* containing a host-agent identity substring.
 *
 * Strategy (locked by council review, 2026-05-02): a line is dropped
 * in full as soon as any host-identity needle (Augment / Claude Code
 * / Cursor / Cline / Windsurf, etc.) appears anywhere on it. We err
 * toward false-positive — slightly less context — over false-negative
 * — a neutrality leak. Substring-only stripping was rejected because
 * it can leave dangling clauses that still hint at the host.
 */
function _strip_host_identity(text: string): string {
    if (!text) {
        return text;
    }
    const kept: string[] = [];
    for (const line of _splitlines(text)) {
        const low = line.toLowerCase();
        if (HOST_AGENT_IDENTITY_PATTERNS.some((needle) => low.includes(needle))) {
            continue;
        }
        kept.push(line);
    }
    return kept.join('\n');
}

/**
 * Neutral context-handoff for council members.
 *
 * `project=null` and/or `original_ask=""` collapses the output to
 * `NEUTRALITY_PREAMBLE` alone (back-compat with v1 callers).
 */
export function handoff_preamble(
    project: ProjectContext | null,
    original_ask: string,
): string {
    const blocks: string[] = [];

    if (project !== null && !project.is_empty()) {
        const ctx_lines: string[] = [];
        if (project.name) {
            ctx_lines.push(`Project: ${project.name}`);
        }
        if (project.stack) {
            ctx_lines.push(`Stack: ${project.stack}`);
        }
        if (project.repo_purpose) {
            ctx_lines.push(`Purpose: ${project.repo_purpose}`);
        }
        const ctx = _pyStrip(_strip_host_identity(ctx_lines.join('\n')));
        if (ctx) {
            blocks.push(ctx);
        }
    }

    const cleaned_ask = _pyStrip(_strip_host_identity(original_ask || ''));
    if (cleaned_ask) {
        const quoted = _splitlines(cleaned_ask)
            .map((ln) => `> ${ln}`)
            .join('\n');
        blocks.push(`The user originally asked:\n${quoted}`);
    }

    blocks.push(NEUTRALITY_PREAMBLE);
    return blocks.join('\n\n');
}

export interface SystemPromptOptions {
    project?: ProjectContext | null;
    original_ask?: string;
}

/**
 * Build the full system prompt for one of the four input modes.
 *
 * Raises (throws) on an unknown mode — callers must use one of
 * `prompt`, `roadmap`, `diff`, `files`.
 */
export function system_prompt_for(mode: string, opts: SystemPromptOptions = {}): string {
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    if (!_hasKey(_MODE_TABLE, mode)) {
        const expected = Object.keys(_MODE_TABLE).sort();
        throw new Error(
            `Unknown council mode ${_pyRepr(mode)}. ` +
                `Expected one of: [${expected.map((m) => _pyReprStr(m)).join(', ')}]`,
        );
    }
    const head = handoff_preamble(project, original_ask);
    return `${head}\n\n${_MODE_TABLE[mode] as string}`;
}

export function all_modes(): string[] {
    return Object.keys(_MODE_TABLE).sort();
}

export interface AdvisorSystemPromptOptions {
    project?: ProjectContext | null;
    original_ask?: string;
}

/**
 * Build the system prompt for an advisor-mode call (Phase 6).
 *
 * Layout: neutral handoff preamble (same shape every council member
 * sees, regardless of mode) + the advisor's persona body. The
 * mode-specific addendum from `_MODE_TABLE` is intentionally
 * replaced — the persona file owns the full instructional surface
 * for an advisor call.
 */
export function advisor_system_prompt(
    persona_text: string,
    opts: AdvisorSystemPromptOptions = {},
): string {
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const head = handoff_preamble(project, original_ask);
    const body = _pyStrip(persona_text || '');
    if (!body) {
        throw new Error('advisor_system_prompt: persona_text is empty.');
    }
    return `${head}\n\n${body}`;
}

/**
 * User-message body for the finding-extraction pass.
 *
 * Pairs the prior analysis text with the extraction-prompt rules so
 * the member re-emits its own findings in machine-readable form.
 */
export function build_extraction_user_prompt(original_analysis: string): string {
    const cleaned = _pyStrip(_strip_host_identity(original_analysis || ''));
    return `${FINDING_EXTRACTION_PROMPT}\n\n---\n\n${cleaned}`;
}

/**
 * User-message body for the scoring pass.
 *
 * `anonymised` maps `Finding-A`/`Finding-B`/… → finding text. Author
 * identities MUST already be stripped — this function does NOT
 * re-anonymise, it just renders.
 */
export function build_scoring_user_prompt(anonymised: Map<string, string>): string {
    const lines: string[] = [FINDING_SCORING_PROMPT, '', '---', ''];
    for (const [label, text] of anonymised) {
        lines.push(`### ${label}\n\n${text}`);
    }
    return lines.join('\n\n');
}

// ── Peer-review (Phase 5 / F1, Karpathy anonymous review) ────────────
//
// After the final deliberation round, each member sees the OTHER
// members' deliberation outputs under neutral `Response-A` / `Response-B`
// labels and produces a Karpathy-style critique: strongest response,
// weakest blind spot, what all of them missed. Provider identity is
// stripped (Iron Law of Neutrality § peer-review); advisor persona
// labels (Phase 6) are preserved by the caller via `anonymize_responses`.
//
// Reviewers never see their own response — that is by design (the
// orchestrator filters self before calling `build_peer_review_user_prompt`).

export const PEER_REVIEW_PROMPT = `Below are responses from other independent reviewers to the same
artefact you just reviewed. Each is labelled with a neutral identifier
(\`Response-A\`, \`Response-B\`, …). You do NOT know which model produced
which response. Critique them as a peer — your goal is to surface
signal the round-1 deliberation may have missed.

Respond in plain prose under exactly these four headings:

### Strongest response
Name the single response whose argument or evidence is most
load-bearing. Cite the label. One paragraph.

### Weakest blind spot
The single most important thing one specific response missed,
glossed over, or got wrong. Cite the label. One paragraph.

### What everyone missed
A point none of the responses raised but that the artefact's context
suggests is load-bearing. One paragraph. Mark as \`needs-verification\`
when you inferred it rather than read it directly from the artefact.

### Refinement
One sentence: which course the synthesizer should prefer in light of
the above, grounded in the strongest converged signal.

Rules:
- Cite labels exactly as given (\`Response-A\`, not \`A\` or \`the first one\`).
- Do not invent agreement or disagreement that is not visible in the
  responses themselves.
- You may NOT see your own response in the list — that is by design.`;

// Python: PEER_REVIEW_SYNTHESIS_ADDENDUM = """\n...""".rstrip()
// The literal begins with a leading newline (after the """\ continuation the
// first char is "\n"), then the body, then .rstrip() removes trailing ws.
export const PEER_REVIEW_SYNTHESIS_ADDENDUM = `
### Peer-Review-Surfaced Blind Spots
Items the peer-review round surfaced that the round-1 responses did
not. Cite the peer-reviewer label and the targeted response label
(\`Reviewer A on Response-B: <one-line summary>\`). Maximum three.`;

/**
 * User-message body for the peer-review pass.
 *
 * `anonymised` maps `Response-A` / `Response-B` / … → response text.
 * Provider identities MUST already be stripped by the caller (see
 * `consensus.anonymize_responses`); this function does NOT re-anonymise,
 * it just renders.
 */
export function build_peer_review_user_prompt(anonymised: Map<string, string>): string {
    const lines: string[] = [PEER_REVIEW_PROMPT, '', '---', ''];
    for (const [label, text] of anonymised) {
        lines.push(`### ${label}\n\n${text}`);
    }
    return lines.join('\n\n');
}

/**
 * Return the synthesis-template addendum used when peer-review fired.
 *
 * Appended to the lens-specific synthesis template by the renderer.
 * Creative-lens (prose) runs receive only the bare section header so
 * the host agent can write free-form synthesis underneath it.
 */
export function peer_review_synthesis_addendum(): string {
    return PEER_REVIEW_SYNTHESIS_ADDENDUM;
}
