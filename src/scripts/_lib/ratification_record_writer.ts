/**
 * ratification_record_writer — render a ratification record from a council
 * session record and the committed prompt it answered, instead of letting the
 * author type the header.
 *
 * WHAT THE OUTPUT DOES NOT CLAIM, first. The session record is a file the
 * caller hands in, and council output is gitignored and pruned, so nothing here
 * — and nothing on a runner — can establish that a council produced it. A
 * record from this writer is therefore exactly as trustworthy as a typed one
 * about WHETHER a review happened, and its body says so in those words. It
 * claims no reviewer identity the session cannot show: `reviewed_by` is the
 * fixed spelling of a kind of reviewer, never a statement that the writer
 * verified one.
 *
 * WHAT IT DOES ADD, which a typed record lacks:
 *
 *   - the header is derived from each seat's stance line by the review's own
 *     `seatConclusion` and the canonical `renderRatificationHeader`, so it
 *     cannot say more than the seats said;
 *   - the record is bound to a committed prompt package: the session must name
 *     the prompt as its artefact, the prompt must be a committed regular file
 *     under {@link PROMPT_DIR} at the revision the subject is read at,
 *     and the prompt must name the exact `subject` the record carries — so a
 *     record cannot answer for content its prompt never showed;
 *   - every seat's reply is kept verbatim in the body, so a later reader checks
 *     the header against the text instead of trusting it. Replies are not split
 *     into per-question answers: numbering in a reply is not a reliable key,
 *     and a parse that guesses is worse than the text it guessed from;
 *   - it reads its own output back through the canonical reader and throws
 *     rather than return a record that reader refuses on structure.
 *
 * `subject` is passed IN: the writer never decides which files are covered.
 */

import {
    SEAT_NO_FINAL_VERDICT,
    SEAT_PROVIDER_RE,
    deriveRatificationHeader,
    readRatification,
    renderRatificationHeader,
    SUBJECT_RE,
    type SeatVerdict,
} from './ratification_artifact.js';
import { assertContained, fileAtRevision } from './ratification_subject.js';
import { seatConclusion } from '../ai_council/modification_review.js';

/** The fixed spelling of the reviewer kind; the seats are in `providers` and `seats:`. */
export const REVIEWER_SPELLING = 'ai-council';

/** Where committed prompt packages live. */
export const PROMPT_DIR = 'agents/evidence/council';

export class RatificationWriteRefused extends Error {}

export interface RecordInput {
    /** The parsed JSON `council_cli run --output` wrote. */
    session: unknown;
    /** Repository root and the RESOLVED commit the subject was read at. */
    root: string;
    commit: string;
    /** The digest the record must answer for, computed by the caller's digest function. */
    subject: string;
    proposed_by: string;
    implemented_by: string;
    /** `merge` or an ISO-8601 instant. */
    effective_after?: string;
    /** One or two sentences: what was reviewed. */
    summary: string;
}

/** One seat: its provider id, its derived verdict, its reply as given. */
export interface SessionSeat {
    provider: string;
    verdict: SeatVerdict;
    reply: string;
}

function refuse(message: string): never {
    throw new RatificationWriteRefused(message);
}

/**
 * The seats of a session record, refusing every shape it cannot read as one.
 *
 * A seat whose reply errored, is empty or carries no stance line in the
 * review's vocabulary is kept as `no-final-verdict`: dropping it would make it
 * indistinguishable from a seat that was never asked. Built in a `Map`, so a
 * provider named `__proto__` is a key like any other — and refused anyway by
 * the provider-id grammar.
 */
export function seatsFromSession(session: unknown): SessionSeat[] {
    if (session === null || typeof session !== 'object' || Array.isArray(session)) {
        refuse('the session record is not a JSON object');
    }
    const responses = (session as { responses?: unknown }).responses;
    if (!Array.isArray(responses) || responses.length === 0) {
        refuse('the session record has no non-empty `responses` array');
    }
    const seen = new Map<string, SessionSeat>();
    for (const raw of responses as unknown[]) {
        if (raw === null || typeof raw !== 'object') refuse('a response is not an object');
        const r = raw as { provider?: unknown; text?: unknown; error?: unknown };
        if (typeof r.provider !== 'string' || !SEAT_PROVIDER_RE.test(r.provider)) {
            refuse(`a response names no valid provider id: ${JSON.stringify(r.provider)}`);
        }
        if (seen.has(r.provider)) refuse(`provider \`${r.provider}\` answers twice`);
        const reply = typeof r.text === 'string' && (r.error === null || r.error === undefined) ? r.text : '';
        const label = reply === '' ? null : seatConclusion(reply);
        seen.set(r.provider, { provider: r.provider, verdict: label ?? SEAT_NO_FINAL_VERDICT, reply });
    }
    return [...seen.values()];
}

/**
 * Refuse unless the session answered a committed prompt that names `subject`.
 * Returns the prompt's repository-relative path.
 */
export function boundPrompt(input: RecordInput): string {
    if (!SUBJECT_RE.test(input.subject)) refuse('`subject` is not a 64-hex digest');
    const artefact = (input.session as { artefact?: unknown }).artefact;
    if (typeof artefact !== 'string' || artefact.trim() === '') {
        refuse('the session record names no `artefact` — it is not bound to any prompt');
    }
    const rel = artefact.trim().replace(/\\/g, '/');
    if (!rel.startsWith(`${PROMPT_DIR}/`) || !rel.endsWith('.md')) {
        refuse(`the session's artefact \`${rel}\` is not a committed prompt under \`${PROMPT_DIR}/\``);
    }
    assertContained(rel);
    const bytes = fileAtRevision(input.root, input.commit, rel);
    if (bytes === null) refuse(`the prompt \`${rel}\` is not a committed regular file at ${input.commit}`);
    if (!bytes.toString('utf8').includes(input.subject)) {
        refuse(`the prompt \`${rel}\` does not name the subject \`${input.subject}\` — it did not show this content`);
    }
    return rel;
}

function oneLine(field: string, value: string): string {
    if (value.trim() === '' || /[\r\n]/u.test(value)) refuse(`\`${field}\` must be one non-empty line`);
    return value.trim();
}

/** The longest run of backticks in `s`, so a fence around it cannot be closed from inside. */
function fenceFor(s: string): string {
    const longest = Math.max(2, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));
    return '`'.repeat(longest + 1);
}

/**
 * Render the record. Throws {@link RatificationWriteRefused} on any provenance
 * failure, and when the result does not read back as structurally valid for
 * `subject`. A quorum-short record IS returned — the owner's escalation needs
 * it — and fails the gate's diversity rule as it should.
 */
export function renderRecord(input: RecordInput, requiredProviders: number): string {
    if (!Number.isInteger(requiredProviders) || requiredProviders < 1) {
        refuse('`requiredProviders` must be a positive integer');
    }
    const prompt = boundPrompt(input);
    const seats = seatsFromSession(input.session);
    const proposed = oneLine('proposed_by', input.proposed_by);
    const implemented = oneLine('implemented_by', input.implemented_by);
    const effective = oneLine('effective_after', input.effective_after ?? 'merge');
    const verdicts = new Map<string, SeatVerdict>(seats.map((s) => [s.provider, s.verdict]));
    const { providers, verdict } = deriveRatificationHeader(verdicts);
    if (providers.length === 0) {
        // The record format requires at least one provider, so a review in
        // which no seat concluded has no record; the run escalates without one.
        refuse('no seat closed on a stance line — there is no verdict to record');
    }

    const lines = [
        '---',
        `proposed_by: ${proposed}`,
        `implemented_by: ${implemented}`,
        `reviewed_by: ${REVIEWER_SPELLING}`,
        `subject: ${input.subject}`,
        renderRatificationHeader(verdicts),
        `effective_after: ${effective}`,
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
        '# Modification review',
        '',
        input.summary.trim(),
        '',
        `Verdict \`${verdict}\`, derived from each seat's stance line; the prompt every seat ` +
            `answered is \`${prompt}\`, committed at \`${input.commit}\` and naming this record's subject.`,
        '',
        'What this record does not establish: that a council produced the session it was rendered ' +
            'from. That file is the caller’s and council output is not kept, so on that point this ' +
            'record is exactly as trustworthy as a typed one. What it does establish is that the ' +
            'header says no more than the replies below, and that the prompt showed this content.',
        '',
        '## Each seat, verbatim',
        '',
    ];
    for (const s of seats) {
        lines.push(`### ${s.provider} — \`${s.verdict}\``, '');
        if (s.reply === '') {
            lines.push('_(no reply)_', '');
            continue;
        }
        const fence = fenceFor(s.reply);
        lines.push(`${fence}text`, s.reply.replace(/\s+$/u, ''), fence, '');
    }
    const text = `${lines.join('\n')}`.replace(/\n+$/u, '\n');

    const reading = readRatification(text, requiredProviders, input.subject);
    const structural = reading.problems.filter(
        (p) => p.code !== 'diversity-required' && p.code !== 'diversity-unverifiable',
    );
    if (structural.length > 0) {
        refuse(
            `the rendered record does not read back as valid: ${structural
                .map((p) => `${p.code} (${p.message})`)
                .join('; ')}`,
        );
    }
    return text;
}
