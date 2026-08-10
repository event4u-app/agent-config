/**
 * Self-repair core — the pure half of the "the package fixes its own defects"
 * loop (road-to-self-repair Phase 1).
 *
 * Two intake paths produce the same record shape:
 *
 *   - USER-REPORTED — the user says the agent worked wrongly
 *     (`user_prompt_submit`).
 *   - SELF-DETECTED — a deterministic detector fires over the finished turn
 *     (`stop`).
 *
 * A record is a *defect against agent-config*, not against the consumer's
 * project. It carries the class, a short redacted evidence span, and an
 * occurrence count; the agent authors the actual fix, and the one outward
 * step (push + PR, or an issue when a PR is impossible) stays behind the
 * `non-destructive-by-default` Hard Floor.
 *
 * DELIBERATELY NOT HERE: an `attempt → critic → re-attempt` loop. That exact
 * mechanism was built, benchmarked and falsified under ADR-106 (capability
 * Δ = 0, McNemar p = 1.0; council verdict TERMINAL), and the same verdict
 * names the replacement lever — "refining the rules on the failure tail" —
 * which is what a defect record feeds. Detection and reporting are in scope;
 * silently re-running the turn to paper over the miss is not.
 *
 * Everything in this module is pure and clock-injected so the detectors can be
 * unit-tested without a host, a transcript, or a network.
 */
import { createHash } from 'node:crypto';

import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
import { is_kernel_rule } from './kernel_rules.js';

/** Where a record came from. */
export type DefectSource = 'user-reported' | 'self-detected';

/** The defect classes a record can carry. One class = one detector. */
export type DefectClass =
    | 'user-reported'
    | 'council-availability-claim'
    | 'language-mirror';

/**
 * Runtime mirror of `DefectClass`, in declaration order. The upstream issue
 * form's dropdown (`.github/ISSUE_TEMPLATE/self_repair_report.yml`) is pinned
 * against this list by test, so adding a detector class without extending the
 * form is a red test, not silent drift.
 */
export const DEFECT_CLASSES: readonly DefectClass[] = [
    'user-reported',
    'council-availability-claim',
    'language-mirror',
];

/** How far a record may travel outward. */
export type EgressRoute = 'pull-request' | 'issue' | 'local-only';

export interface DefectFinding {
    defect_class: DefectClass;
    source: DefectSource;
    /** Short span quoted from the offending text — sanitized at capture. */
    evidence: string;
    /** One line naming what the fix should change. */
    suggested_surface: string;
}

export interface DefectRecord extends DefectFinding {
    fingerprint: string;
    first_seen: string;
    last_seen: string;
    occurrences: number;
    status: 'open' | 'released';
    /**
     * Failed egress attempts from the most recent `release` call, sanitized at
     * write time. Local-only bookkeeping: `renderReport` never includes them,
     * so they cannot widen what leaves the machine.
     */
    release_errors?: string[];
}

/** One finished turn, as much of it as a hook can observe. */
export interface TurnSnapshot {
    /** The user's prompt for this turn. */
    prompt: string;
    /** The assistant's final reply text. */
    reply: string;
    /** Shell commands / tool names invoked during the turn. */
    toolCommands: readonly string[];
    /** The language the turn was pinned to, when the host pinned one. */
    pinnedLanguage?: 'de' | 'en' | null;
}

// ── evidence hygiene ───────────────────────────────────────────────

const MAX_EVIDENCE = 160;
const HOME_PATH_RE = /(\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s/\\]+/g;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/**
 * Capture-time hygiene: drop the two identifier classes that a quoted span
 * realistically carries, collapse whitespace, and cap the length. This is a
 * narrowing pass, never a clearance — `egressBlockedReason` is the gate.
 */
export function sanitizeEvidence(raw: string): string {
    const flat = raw
        .replace(HOME_PATH_RE, '<home>')
        .replace(EMAIL_RE, '<email>')
        .replace(/\s+/g, ' ')
        .trim();
    return flat.length <= MAX_EVIDENCE ? flat : `${flat.slice(0, MAX_EVIDENCE - 1)}…`;
}

/**
 * Publication gate. Runs the record's own text through the audited privacy
 * floor (`redact_low_impact_entry`) and returns a refusal reason, or null when
 * the record may leave the machine.
 *
 * The redactor refuses rather than rewrites — a rewritten secret is still a
 * leaked secret — so a violation downgrades the record to `local-only` instead
 * of being scrubbed into publishable shape.
 */
export function egressBlockedReason(record: DefectRecord, repoRoot?: string | null): string | null {
    const result = redact_low_impact_entry(`${record.suggested_surface}\n${record.evidence}`, {
        repoRoot: repoRoot ?? null,
    });
    if (result.ok) {
        return null;
    }
    const kinds = result.violations.map((v) => v.category).join(', ');
    return `privacy floor refused the evidence (${kinds}) — record stays local`;
}

// ── may-not-modify deny-list ───────────────────────────────────────

/**
 * Surfaces self-repair may never target with a PATCH. Detection and reporting
 * stay untouched — for a record targeting one of these, egress degrades to
 * report-only: an issue (or the local record) is still allowed, the
 * pull-request path refuses with the named reason.
 *
 * The point is structural: the loop that fixes the agent's own defects must
 * not be a channel through which the agent loosens the floors it is bound by.
 * Same posture as `block_kernel_rule_writes` (tool-call-time) and the settings
 * class-C fence (write-time), applied to the one outward vehicle this loop
 * owns. Nothing auto-applies a patch today; this keeps that true for the
 * denied surfaces even when the PR path is otherwise available.
 */
export type DeniedSurface =
    | 'kernel-rule'
    | 'safety-floor-rule'
    | 'settings-class-c'
    | 'ci-enforcement'
    | 'self-repair-policy';

export interface PatchDenial {
    surface: DeniedSurface;
    /** The token in the record that matched. */
    match: string;
}

/**
 * Characters that decorate a token but never appear inside a real path, rule
 * id, or settings key: markdown emphasis / strikethrough, autolink angle
 * brackets, table pipes. They are removed ANYWHERE in the token, not just at
 * its edges, so `src/rules/**scope-control**.md` reduces like `**…**` does.
 */
const DECORATION_RE = /[*~<>|]/g;

/**
 * Edge punctuation a sentence leaves on a token — sentence-final `.`, a `:`
 * label separator, list/reference brackets, and underscore emphasis (`_` is
 * stripped at the EDGES only: it is load-bearing inside `self_repair.ts`,
 * `hook_manifest.yaml`, and every snake_case settings key).
 */
const EDGE_TRIM_RE = /^[.:[\]_]+|[.:[\]_]+$/g;

/**
 * Word-ish / path-ish tokens of a record's text, punctuation-stripped.
 *
 * `suggested_surface` is free-text the agent writes, and this repo's prose is
 * saturated with `**bold**` file paths — so a tokenizer that only splits on
 * whitespace-and-quotes lets ordinary markdown emphasis smuggle a denied
 * surface past the scan (`**src/rules/scope-control.md**` read as ALLOWED
 * while the same path bare read as DENIED). Both the raw token and its
 * un-decorated form are emitted, and the edge trim runs AFTER the decoration
 * strip so an unwrapped `**.github/workflows/ci.yml**` cannot keep a leading
 * dot in front of the anchored `github/workflows/` match.
 */
function denyTokens(text: string): string[] {
    const out: string[] = [];
    for (const raw of text.split(/[\s,;()!?"'`]+/)) {
        if (raw.length === 0) {
            continue;
        }
        for (const candidate of new Set([raw, raw.replace(DECORATION_RE, '')])) {
            const token = candidate.replace(EDGE_TRIM_RE, '');
            if (token.length > 0) {
                out.push(token);
            }
        }
    }
    return out;
}

/** Basename stem (no `.md`) of a path-or-id token. */
function stemOf(token: string): string {
    const base = token.replace(/\\/g, '/').split('/').pop() ?? token;
    return base.replace(/\.md$/, '');
}

/** Dotted settings-key shape — `personal.autonomy`, `tokens.rich_skills`, … */
const DOTTED_KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

/**
 * The surfaces through which enforcement is actually armed or disarmed. A
 * workflow file is only ONE of them, and in this repo it is not even the usual
 * one — a new gate is registered in the taskfiles the workflow calls, and a
 * tool-call-time guard is armed in the hook manifest. Each entry, and why it
 * arms enforcement:
 *
 *   - `.github/workflows/` — the CI job definitions; deleting a step removes
 *     the gate from every PR. (The leading dot is stripped by `denyTokens`, so
 *     the match is on the segment pair, not the dotfile spelling.)
 *   - `Taskfile.yml` / `taskfiles/*.yml` — the task graph the workflows invoke
 *     (`task ci`, `task ci-fast`). A gate that is not listed here does not run,
 *     however green the workflow looks.
 *   - `src/scripts/hook_manifest.yaml` — the concern↔slot bindings. Unbinding
 *     a concern disarms a PreToolUse guard without touching the guard's code.
 *   - `src/scripts/hooks/` — the guard implementations themselves
 *     (`block_no_verify`, `block_kernel_rule_writes`, `block_config_weakening`).
 *   - `src/scripts/check_*.ts` / `src/scripts/lint_*.ts` — the gate scripts. A
 *     loosened threshold or a narrowed scan root disarms the gate in place,
 *     which is exactly the "gates that scan nothing exit green" failure.
 *
 * Deliberately NOT the whole of `src/scripts/`: that would deny nearly every
 * legitimate repair this loop exists to file.
 */
function isCiEnforcementPath(token: string): boolean {
    const t = token.replace(/\\/g, '/');
    if (/(^|\/)github\/workflows\//.test(t)) {
        return true;
    }
    if (/(^|\/)Taskfile(\.[a-z0-9_-]+)?\.ya?ml$/i.test(t)) {
        return true;
    }
    if (/(^|\/)taskfiles\//.test(t)) {
        return true;
    }
    if (/(^|\/)hook_manifest\.ya?ml$/.test(t)) {
        return true;
    }
    if (/(^|\/)scripts\/hooks\//.test(t)) {
        return true;
    }
    return /(^|\/)scripts\/(check|lint)_[a-z0-9_]+\.ts$/.test(t);
}

/**
 * Is this record's fix aimed at a denied surface? Scans the two fields that
 * name what the fix should change (`suggested_surface`) and what was observed
 * (`evidence`). A match errs toward denial on purpose — the cost of a false
 * positive is a report instead of a patch, still egress; the cost of a false
 * negative is a patch channel into a safety floor.
 *
 * The kernel set resolves from `kernel_rules.ts` — the same canonical source
 * `block_kernel_rule_writes` uses — never a copy that can drift. Settings
 * class-C keys are matched against `classCKeys` when the caller can supply
 * them (parsed from `docs/contracts/settings-classes.md`); the contract file
 * itself is denied by path regardless, so an unreadable contract narrows the
 * dynamic check without opening the fence's own definition to patching.
 */
export function patchDeniedSurface(
    record: DefectFinding,
    opts?: { classCKeys?: ReadonlySet<string> | null },
): PatchDenial | null {
    const classCKeys = opts?.classCKeys ?? null;
    for (const token of denyTokens(`${record.suggested_surface}\n${record.evidence}`)) {
        // Checked before `ci-enforcement` so a self-repair file that also lives
        // under an enforcement path (`src/scripts/hooks/self_repair_hook.ts`)
        // reports the more specific surface. Either way it is denied.
        if (/self[-_]repair/i.test(token)) {
            return { surface: 'self-repair-policy', match: token };
        }
        if (isCiEnforcementPath(token)) {
            return { surface: 'ci-enforcement', match: token };
        }
        if (token.includes('settings-classes.md')) {
            return { surface: 'settings-class-c', match: token };
        }
        if (is_kernel_rule(token)) {
            return { surface: 'kernel-rule', match: token };
        }
        if (stemOf(token).endsWith('-safety-floor')) {
            return { surface: 'safety-floor-rule', match: token };
        }
        if (classCKeys !== null && DOTTED_KEY_RE.test(token)) {
            // Exact key first, then every classified ancestor down to the root
            // segment — a class-C key whose value is a MAP has children that
            // never appear under the key's own name.
            const parts = token.split('.');
            for (let end = parts.length; end > 0; end--) {
                if (classCKeys.has(parts.slice(0, end).join('.'))) {
                    return { surface: 'settings-class-c', match: token };
                }
            }
        }
    }
    return null;
}

/** The named refusal the patch/PR path reports. Null = patch path allowed. */
export function patchDeniedReason(
    record: DefectFinding,
    opts?: { classCKeys?: ReadonlySet<string> | null },
): string | null {
    const denial = patchDeniedSurface(record, opts);
    if (denial === null) {
        return null;
    }
    return (
        `self-repair may not patch a ${denial.surface} surface (matched: ${denial.match}) — ` +
        'the pull-request path is refused; the record egresses report-only (issue / local record)'
    );
}

// ── detectors ──────────────────────────────────────────────────────

// An agent-directed complaint, not a complaint about the code. Deliberately
// narrow: a spurious record becomes a spurious PR, so precision beats recall.
const COMPLAINT_PATTERNS: readonly RegExp[] = [
    // No \b before the alternation: JS \b is ASCII-only, so a leading umlaut
    // ("übersehen") never sits on a word boundary — the corpus gate's
    // near-miss class caught that as a dead alternation branch.
    /\bdu hast\b[^.!?]{0,60}(nicht|falsch|vergessen|ignoriert|übersehen)\b/i,
    /\bdu (ignorierst|übersiehst)\b/i,
    /\b(das|es) (war|ist) (aber )?falsch\b/i,
    /\bhat nicht (richtig|korrekt) (gearbeitet|funktioniert)\b/i,
    /\bnicht richtig gearbeitet\b/i,
    /\byou (didn'?t|did not|failed to|ignored|forgot)\b/i,
    /\bthat'?s (wrong|not right|incorrect)\b/i,
    /\byou (worked|did (it|that)) (wrong|incorrectly)\b/i,
];

// Phrasings that MATCH a complaint pattern but are not complaints — a curious
// question or a reassurance. Scoped to the matched span (± a small margin),
// never the whole prompt: a pleasantry in one clause must not mute a genuine
// complaint in another (R2 finding #2). These feed the must-not-fire class of
// the detector corpus gate.
const COMPLAINT_EXONERATIONS: readonly RegExp[] = [
    /\bdu hast nicht zufällig\b/i,
    /\bhast du nicht zufällig\b/i,
    /\byou didn'?t (need|have) to\b/i,
    /\bit'?s fine\b/i,
    /\b(kein problem|passt schon|alles gut)\b/i,
    // Explicit absolution INSIDE the complaint span, which is why it has to be
    // its own entry rather than relying on a neighbouring pleasantry: in
    // "das ist fine, du hast nichts falsch gemacht" the matched span is
    // `du hast nichts falsch`, and the `it's fine` above sits outside the
    // ± EXONERATION_MARGIN window — correctly, since that margin exists to stop
    // a pleasantry in one clause muting a complaint in another. `nichts falsch`
    // is not a neighbouring pleasantry: it is the negation of the complaint
    // itself. Caught by the detector-corpus gate, which flagged this exact
    // string as a must-not-fire fixture that fired (PR #1231).
    /\bnichts falsch\b/i,
    /\bkein fehler\b/i,
];

/** How far (chars) an exoneration may sit from the complaint span it excuses. */
const EXONERATION_MARGIN = 12;

function spanExonerated(prompt: string, start: number, end: number): boolean {
    for (const ex of COMPLAINT_EXONERATIONS) {
        const g = new RegExp(ex.source, ex.flags.includes('g') ? ex.flags : `${ex.flags}g`);
        let m: RegExpExecArray | null;
        while ((m = g.exec(prompt)) !== null) {
            const s = m.index;
            const e = m.index + m[0].length;
            if (e >= start - EXONERATION_MARGIN && s <= end + EXONERATION_MARGIN) {
                return true;
            }
        }
    }
    return false;
}

/** Intake path 1 — the user says the agent worked wrongly. */
export function detectUserReport(prompt: string): DefectFinding | null {
    for (const re of COMPLAINT_PATTERNS) {
        const m = re.exec(prompt);
        if (m !== null && !spanExonerated(prompt, m.index, m.index + m[0].length)) {
            return {
                defect_class: 'user-reported',
                source: 'user-reported',
                evidence: sanitizeEvidence(m[0]),
                suggested_surface:
                    'Analyse the turn the user is objecting to and name the rule, skill, or ' +
                    'gate whose absence allowed it.',
            };
        }
    }
    return null;
}

// The #1218 defect, now with a runtime detector: the claim is only a defect
// when the resolver was never consulted — running the probe and reporting its
// answer is correct behaviour.
const COUNCIL_CLAIM_RE =
    /\b(kein|keine|no)\b[^.!?\n]{0,40}\bcouncil\b[^.!?\n]{0,60}\b(konfiguriert|verfügbar|configured|available|infra)\b/i;
const COUNCIL_PROBE_RE =
    /council[:_](status|estimate|run|cli)|council_cli|AI_COUNCIL_CONFIG/i;

/** Detector 1 — "council not configured" asserted without asking the resolver. */
export function detectCouncilClaim(turn: TurnSnapshot): DefectFinding | null {
    const m = COUNCIL_CLAIM_RE.exec(turn.reply);
    if (m === null) {
        return null;
    }
    if (turn.toolCommands.some((c) => COUNCIL_PROBE_RE.test(c))) {
        return null;
    }
    return {
        defect_class: 'council-availability-claim',
        source: 'self-detected',
        evidence: sanitizeEvidence(m[0]),
        suggested_surface:
            'Council availability was asserted without running the resolver — see the ' +
            'council-availability rule; report why its Iron Law did not reach the decision.',
    };
}

// Conservative language check: the Iron Law is about the FIRST token, so only
// the opening is inspected, and only a one-sided margin fires. A heuristic that
// fires on a mixed-language paragraph would manufacture defects.
const DE_MARKERS =
    /\b(der|die|das|und|ich|nicht|ist|ein|eine|für|mit|auf|dass|wird|sind|hat|kann|noch|schon|aber|oder|wenn|habe|beim|vom)\b/gi;
const EN_MARKERS =
    /\b(the|and|is|are|you|not|for|with|that|this|have|has|can|will|but|or|if|from|there|were)\b/gi;
const OPENING_CHARS = 240;

function countMatches(text: string, re: RegExp): number {
    return (text.match(re) ?? []).length;
}

/** Strip the spans whose language says nothing about the reply's own prose. */
function proseOpening(reply: string): string {
    return reply
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .trim()
        .slice(0, OPENING_CHARS);
}

/** Detector 2 — the reply opens in the language the turn was NOT pinned to. */
export function detectLanguageMirror(turn: TurnSnapshot): DefectFinding | null {
    const pinned = turn.pinnedLanguage ?? null;
    if (pinned === null) {
        return null;
    }
    const opening = proseOpening(turn.reply);
    if (opening.length < 40) {
        return null;
    }
    const de = countMatches(opening, DE_MARKERS) + (/[äöüßÄÖÜ]/.test(opening) ? 2 : 0);
    const en = countMatches(opening, EN_MARKERS);
    const wrong = pinned === 'de' ? en : de;
    const right = pinned === 'de' ? de : en;
    // One-sided margin: the wrong language is clearly present and the pinned
    // one is entirely absent from the opening.
    if (wrong < 3 || right > 0) {
        return null;
    }
    return {
        defect_class: 'language-mirror',
        source: 'self-detected',
        evidence: sanitizeEvidence(opening.slice(0, 120)),
        suggested_surface:
            `Reply opened in the language the turn was not pinned to (pinned: ${pinned}) — ` +
            'report which surface carried the pin and why it did not bind.',
    };
}

/** One registered detector — the unit the corpus gate enumerates. */
export interface RegisteredDetector {
    defect_class: DefectClass;
    source: DefectSource;
    detect: (turn: TurnSnapshot) => DefectFinding | null;
}

/**
 * The detector registry — the single list both `runDetectors` and the corpus
 * gate (`tests/scripts/self_repair_detector_corpus.test.ts`) iterate. A
 * detector added here without its three fixture classes (fire /
 * near-miss-fire / must-not-fire) is a red test, not a silently untested
 * code path.
 */
export const DETECTOR_REGISTRY: readonly RegisteredDetector[] = [
    {
        defect_class: 'user-reported',
        source: 'user-reported',
        detect: (turn) => detectUserReport(turn.prompt),
    },
    { defect_class: 'council-availability-claim', source: 'self-detected', detect: detectCouncilClaim },
    { defect_class: 'language-mirror', source: 'self-detected', detect: detectLanguageMirror },
];

/** Run every self-detected detector over a finished turn. */
export function runDetectors(turn: TurnSnapshot): DefectFinding[] {
    const out: DefectFinding[] = [];
    for (const d of DETECTOR_REGISTRY) {
        if (d.source !== 'self-detected') {
            continue;
        }
        const f = d.detect(turn);
        if (f !== null) {
            out.push(f);
        }
    }
    return out;
}

// ── record identity ────────────────────────────────────────────────

/**
 * Fingerprint = class + shape of the evidence, never its incidentals. Digits,
 * quoted spans and punctuation are normalized away so the same defect seen
 * with a different name or count folds into one record instead of flooding
 * the queue with near-duplicates.
 */
export function fingerprint(defect_class: DefectClass, evidence: string): string {
    const shape = evidence
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/[`"'‚'„"»«]/g, '')
        .replace(/[^a-zà-ÿ#\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return createHash('sha256').update(`${defect_class}|${shape}`).digest('hex').slice(0, 16);
}

/** Fold a finding into an existing record, or open a new one. */
export function mergeRecord(
    existing: DefectRecord | null,
    finding: DefectFinding,
    now: string,
): DefectRecord {
    const fp = fingerprint(finding.defect_class, finding.evidence);
    if (existing !== null && existing.fingerprint === fp) {
        return {
            ...existing,
            last_seen: now,
            occurrences: existing.occurrences + 1,
            // A record the user re-reports after a release is open again.
            status: 'open',
        };
    }
    return {
        ...finding,
        fingerprint: fp,
        first_seen: now,
        last_seen: now,
        occurrences: 1,
        status: 'open',
    };
}

// ── egress ─────────────────────────────────────────────────────────

export interface EgressCapability {
    /** An agent-config source checkout the fix can be authored in. */
    hasAgentConfigCheckout: boolean;
    /** `gh` is installed AND authenticated. */
    ghAuthenticated: boolean;
    /**
     * The authenticated user has push permission on the UPSTREAM repo — a
     * pre-flight probe of actual rights (`gh api repos/<repo>` →
     * `.permissions.push`), never an inference from `git remote` existing.
     * A consumer who cloned the public repo has a remote and no write access;
     * the old heuristic classified exactly that machine as push-capable.
     */
    canPushUpstream: boolean;
    /** The upstream repo allows forking and the user is authenticated. */
    canFork: boolean;
}

/** Where a pull-request route pushes its branch. */
export type PushVia = 'upstream' | 'fork';

export interface EgressChoice {
    route: EgressRoute;
    /** Set only when `route === 'pull-request'`. */
    pushVia: PushVia | null;
}

/**
 * Route selection, exactly as specified: a pull request when the fix can be
 * authored and pushed (directly, or via fork → cross-repo PR), an issue when
 * it cannot, and a local record when nothing can leave the machine.
 */
export function chooseEgress(cap: EgressCapability): EgressChoice {
    if (cap.hasAgentConfigCheckout && cap.ghAuthenticated && cap.canPushUpstream) {
        return { route: 'pull-request', pushVia: 'upstream' };
    }
    if (cap.hasAgentConfigCheckout && cap.ghAuthenticated && cap.canFork) {
        return { route: 'pull-request', pushVia: 'fork' };
    }
    if (cap.ghAuthenticated) {
        return { route: 'issue', pushVia: null };
    }
    return { route: 'local-only', pushVia: null };
}

/** The PR / issue body. Deterministic — same record, same bytes. */
export function renderReport(record: DefectRecord, route: EgressRoute): string {
    const seen =
        record.occurrences === 1
            ? `once (${record.first_seen})`
            : `${record.occurrences}× (${record.first_seen} → ${record.last_seen})`;
    const intake =
        record.source === 'user-reported'
            ? 'A user stated the agent worked wrongly.'
            : 'A deterministic detector fired at turn end; no user complaint was needed.';
    return [
        `## Self-repair report — \`${record.defect_class}\``,
        '',
        intake,
        '',
        `- **Fingerprint:** \`${record.fingerprint}\``,
        `- **Seen:** ${seen}`,
        `- **Route:** ${route}`,
        '',
        '### Evidence',
        '',
        '> ' + record.evidence,
        '',
        '### What the fix should address',
        '',
        record.suggested_surface,
        '',
        '---',
        '',
        'Filed by the agent-config self-repair loop. The evidence span is capture-time',
        'sanitized and was cleared by the privacy floor before this report left the',
        'machine. No project paths, prompts, or file contents are included by',
        'construction — the record type has no field that can carry them.',
    ].join('\n');
}

/** The structured fields the upstream intake form collects. */
export interface ParsedReport {
    defect_class: string;
    fingerprint: string;
    occurrences: number;
    evidence: string;
    suggested_surface: string;
}

/**
 * Inverse of `renderReport` for the structured fields — the round-trip that
 * pins the rendered body to the upstream issue form: every field the form
 * collects is recoverable from a rendered report, so a `release` body and a
 * manually-filed form carry the same clustering keys (fingerprint above all).
 */
export function parseReport(body: string): ParsedReport | null {
    const cls = /^## Self-repair report — `([^`]+)`$/m.exec(body)?.[1];
    const fp = /^- \*\*Fingerprint:\*\* `([^`]+)`$/m.exec(body)?.[1];
    const seen = /^- \*\*Seen:\*\* (.+)$/m.exec(body)?.[1];
    const evidence = /^### Evidence\n\n> (.*)$/m.exec(body)?.[1];
    const surface = /### What the fix should address\n\n([\s\S]*?)\n\n---/.exec(body)?.[1];
    if (!cls || !fp || !seen || evidence === undefined || !surface) {
        return null;
    }
    const occurrences = seen.startsWith('once') ? 1 : Number(/^(\d+)×/.exec(seen)?.[1] ?? Number.NaN);
    if (!Number.isFinite(occurrences)) {
        return null;
    }
    return {
        defect_class: cls,
        fingerprint: fp,
        occurrences,
        evidence,
        suggested_surface: surface.trim(),
    };
}
