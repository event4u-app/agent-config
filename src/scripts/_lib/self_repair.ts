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

/** Where a record came from. */
export type DefectSource = 'user-reported' | 'self-detected';

/** The defect classes a record can carry. One class = one detector. */
export type DefectClass =
    | 'user-reported'
    | 'council-availability-claim'
    | 'language-mirror';

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

// ── detectors ──────────────────────────────────────────────────────

// An agent-directed complaint, not a complaint about the code. Deliberately
// narrow: a spurious record becomes a spurious PR, so precision beats recall.
const COMPLAINT_PATTERNS: readonly RegExp[] = [
    /\bdu hast\b[^.!?]{0,60}\b(nicht|falsch|vergessen|ignoriert|übersehen)\b/i,
    /\bdu (ignorierst|übersiehst)\b/i,
    /\b(das|es) (war|ist) (aber )?falsch\b/i,
    /\bhat nicht (richtig|korrekt) (gearbeitet|funktioniert)\b/i,
    /\bnicht richtig gearbeitet\b/i,
    /\byou (didn'?t|did not|failed to|ignored|forgot)\b/i,
    /\bthat'?s (wrong|not right|incorrect)\b/i,
    /\byou (worked|did (it|that)) (wrong|incorrectly)\b/i,
];

/** Intake path 1 — the user says the agent worked wrongly. */
export function detectUserReport(prompt: string): DefectFinding | null {
    for (const re of COMPLAINT_PATTERNS) {
        const m = re.exec(prompt);
        if (m !== null) {
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

/** Run every self-detected detector over a finished turn. */
export function runDetectors(turn: TurnSnapshot): DefectFinding[] {
    const out: DefectFinding[] = [];
    for (const d of [detectCouncilClaim, detectLanguageMirror]) {
        const f = d(turn);
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
    /** The checkout can push a branch to the remote. */
    canPush: boolean;
}

/**
 * Route selection, exactly as specified: a pull request when the fix can be
 * authored and pushed, an issue when it cannot, and a local record when
 * nothing can leave the machine.
 */
export function chooseEgressRoute(cap: EgressCapability): EgressRoute {
    if (cap.hasAgentConfigCheckout && cap.ghAuthenticated && cap.canPush) {
        return 'pull-request';
    }
    if (cap.ghAuthenticated) {
        return 'issue';
    }
    return 'local-only';
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
