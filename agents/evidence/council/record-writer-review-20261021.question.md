<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     the modification review of step 3.4 (the record writer), round 1, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Modification review — the ratification record is rendered from the run (step 3.4)

Step 3.4 of `road-to-self-modification-that-a-council-must-pass`: "The record is written from the run, not typed." It adds `src/scripts/_lib/ratification_record_writer.ts` (the writer), `src/scripts/ratification_record.ts` (its CLI) and one test file, plus one contract paragraph. The diff of the three code files is below in full; the contract paragraph is quoted after it. Neither file is on the ratification gate's watch list today (step 4.1 is open); the change is reviewed because the contract reserves changes to "the modules that … write the record" (§ When the user decides, condition 4). The digest the review is bound to, over the writer and the CLI at commit `58ad62177`, is `f7398d1e746d999bf440d56bbe8503ad5be65566ee65f12ebdb7a162525b9f8f`.

**Prior attempt, and the list it left (2026-10-17, refused twice):** (1) the old writer branded any object carrying a `responses` array as an `ai-council` record, so a fabricated session read as more trustworthy than a typed one; (2) its answer parser keyed numbered preamble as answers; (3) a `requiredProviders` of zero or below made an empty council pass, and a `__proto__` seat name was mishandled. The list said: the writer only behind a session record bound to the reviewed revision and the committed prompt package, or it must not brand its output as a council's; the parser keys only what it can tell.

**What this attempt does about each:**

- **Branding.** The writer still writes `reviewed_by: ai-council` (the record format's fixed spelling of the reviewer kind), but every record it renders says in its body: "What this record does not establish: that a council produced the session it was rendered from … on that point this record is exactly as trustworthy as a typed one." It claims no reviewer identity it cannot show.
- **Provenance binding.** It refuses unless the session's `artefact` names a prompt under `agents/evidence/council/`, that prompt is a committed regular file at the commit the subject is read at (read from Git objects, path-contained), and the prompt contains the exact `subject` the record carries. So a record cannot answer for content its prompt never showed. The session file itself remains unauthenticated, and the contract says so.
- **No answer parser.** Replies are not split into per-question answers. Each seat's reply is kept verbatim in a fenced block whose fence is longer than any backtick run inside it, so a reply cannot close its block or forge frontmatter; a test feeds a reply carrying `---`/`verdict: ratified` lines and a fence.
- **Seats.** Each seat's verdict is read from its stance line by the review's existing `seatConclusion`; an errored, empty or stance-less reply is kept as `no-final-verdict`, never dropped. Provider ids must match the record grammar (so `__proto__` and spaced names are refused), duplicates are refused, seats are held in a `Map`. A review where no seat concluded is refused with a message, because the record format requires at least one provider.
- **Threshold.** `requiredProviders` must be a positive integer (0, negative, fractional, NaN, Infinity refused).
- **Round trip.** The rendered text is read back through the canonical reader with the subject; any structural problem other than diversity throws. A quorum-short record IS returned — the owner's escalation needs it — and fails the gate's diversity rule.
- **CLI.** `ratification_record` computes the subject itself: the gate's `expectedSubjectFor` by default, or with `--declared` the digest over every listed file that `proposal:check` binds a package proposal's review to (step 6.1 on this branch). Exit 0 prints the record, 1 refuses, 2 is usage. Three CLI tests.

Answer, for this change: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with file:line, the failure scenario and a severity. Close your reply with EXACTLY this line, and nothing after it:

STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no

where `<label>` is one of `ratified`, `confirmed-non-expanding`, `refused`.

The contract paragraph added (`docs/contracts/ratification-artifact.md`, after § `seats:`):

> `./scripts-run src/scripts/ratification_record --session <council-json> --files <f> … --proposed-by … --implemented-by … --summary …` renders the whole record from the run instead (`_lib/ratification_record_writer.ts`). Each seat's verdict is read from its stance line, never typed; the session must name as its artefact a prompt committed under `agents/evidence/council/` at the revision the subject is read at, and that prompt must contain the exact `subject`; every reply is kept verbatim in the body; and the output is read back through the reader before it is printed. It does not change what is established above: the session file is the caller's, so the record is exactly as trustworthy as a typed one about whether a council produced it, and it says so in its own body.

```diff
diff --git a/src/scripts/_lib/ratification_record_writer.ts b/src/scripts/_lib/ratification_record_writer.ts
new file mode 100644
index 000000000..35eb2bda2
--- /dev/null
+++ b/src/scripts/_lib/ratification_record_writer.ts
@@ -0,0 +1,221 @@
+/**
+ * ratification_record_writer — render a ratification record from a council
+ * session record and the committed prompt it answered, instead of letting the
+ * author type the header.
+ *
+ * WHAT THE OUTPUT DOES NOT CLAIM, first. The session record is a file the
+ * caller hands in, and council output is gitignored and pruned, so nothing here
+ * — and nothing on a runner — can establish that a council produced it. A
+ * record from this writer is therefore exactly as trustworthy as a typed one
+ * about WHETHER a review happened, and its body says so in those words. It
+ * claims no reviewer identity the session cannot show: `reviewed_by` is the
+ * fixed spelling of a kind of reviewer, never a statement that the writer
+ * verified one.
+ *
+ * WHAT IT DOES ADD, which a typed record lacks:
+ *
+ *   - the header is derived from each seat's stance line by the review's own
+ *     `seatConclusion` and the canonical `renderRatificationHeader`, so it
+ *     cannot say more than the seats said;
+ *   - the record is bound to a committed prompt package: the session must name
+ *     the prompt as its artefact, the prompt must be a committed regular file
+ *     under {@link PROMPT_DIR} at the revision the subject is read at,
+ *     and the prompt must name the exact `subject` the record carries — so a
+ *     record cannot answer for content its prompt never showed;
+ *   - every seat's reply is kept verbatim in the body, so a later reader checks
+ *     the header against the text instead of trusting it. Replies are not split
+ *     into per-question answers: numbering in a reply is not a reliable key,
+ *     and a parse that guesses is worse than the text it guessed from;
+ *   - it reads its own output back through the canonical reader and throws
+ *     rather than return a record that reader refuses on structure.
+ *
+ * `subject` is passed IN: the writer never decides which files are covered.
+ */
+
+import {
+    SEAT_NO_FINAL_VERDICT,
+    SEAT_PROVIDER_RE,
+    deriveRatificationHeader,
+    readRatification,
+    renderRatificationHeader,
+    SUBJECT_RE,
+    type SeatVerdict,
+} from './ratification_artifact.js';
+import { assertContained, fileAtRevision } from './ratification_subject.js';
+import { seatConclusion } from '../ai_council/modification_review.js';
+
+/** The fixed spelling of the reviewer kind; the seats are in `providers` and `seats:`. */
+export const REVIEWER_SPELLING = 'ai-council';
+
+/** Where committed prompt packages live. */
+export const PROMPT_DIR = 'agents/evidence/council';
+
+export class RatificationWriteRefused extends Error {}
+
+export interface RecordInput {
+    /** The parsed JSON `council_cli run --output` wrote. */
+    session: unknown;
+    /** Repository root and the RESOLVED commit the subject was read at. */
+    root: string;
+    commit: string;
+    /** The digest the record must answer for, computed by the caller's digest function. */
+    subject: string;
+    proposed_by: string;
+    implemented_by: string;
+    /** `merge` or an ISO-8601 instant. */
+    effective_after?: string;
+    /** One or two sentences: what was reviewed. */
+    summary: string;
+}
+
+/** One seat: its provider id, its derived verdict, its reply as given. */
+export interface SessionSeat {
+    provider: string;
+    verdict: SeatVerdict;
+    reply: string;
+}
+
+function refuse(message: string): never {
+    throw new RatificationWriteRefused(message);
+}
+
+/**
+ * The seats of a session record, refusing every shape it cannot read as one.
+ *
+ * A seat whose reply errored, is empty or carries no stance line in the
+ * review's vocabulary is kept as `no-final-verdict`: dropping it would make it
+ * indistinguishable from a seat that was never asked. Built in a `Map`, so a
+ * provider named `__proto__` is a key like any other — and refused anyway by
+ * the provider-id grammar.
+ */
+export function seatsFromSession(session: unknown): SessionSeat[] {
+    if (session === null || typeof session !== 'object' || Array.isArray(session)) {
+        refuse('the session record is not a JSON object');
+    }
+    const responses = (session as { responses?: unknown }).responses;
+    if (!Array.isArray(responses) || responses.length === 0) {
+        refuse('the session record has no non-empty `responses` array');
+    }
+    const seen = new Map<string, SessionSeat>();
+    for (const raw of responses as unknown[]) {
+        if (raw === null || typeof raw !== 'object') refuse('a response is not an object');
+        const r = raw as { provider?: unknown; text?: unknown; error?: unknown };
+        if (typeof r.provider !== 'string' || !SEAT_PROVIDER_RE.test(r.provider)) {
+            refuse(`a response names no valid provider id: ${JSON.stringify(r.provider)}`);
+        }
+        if (seen.has(r.provider)) refuse(`provider \`${r.provider}\` answers twice`);
+        const reply = typeof r.text === 'string' && (r.error === null || r.error === undefined) ? r.text : '';
+        const label = reply === '' ? null : seatConclusion(reply);
+        seen.set(r.provider, { provider: r.provider, verdict: label ?? SEAT_NO_FINAL_VERDICT, reply });
+    }
+    return [...seen.values()];
+}
+
+/**
+ * Refuse unless the session answered a committed prompt that names `subject`.
+ * Returns the prompt's repository-relative path.
+ */
+export function boundPrompt(input: RecordInput): string {
+    if (!SUBJECT_RE.test(input.subject)) refuse('`subject` is not a 64-hex digest');
+    const artefact = (input.session as { artefact?: unknown }).artefact;
+    if (typeof artefact !== 'string' || artefact.trim() === '') {
+        refuse('the session record names no `artefact` — it is not bound to any prompt');
+    }
+    const rel = artefact.trim().replace(/\\/g, '/');
+    if (!rel.startsWith(`${PROMPT_DIR}/`) || !rel.endsWith('.md')) {
+        refuse(`the session's artefact \`${rel}\` is not a committed prompt under \`${PROMPT_DIR}/\``);
+    }
+    assertContained(rel);
+    const bytes = fileAtRevision(input.root, input.commit, rel);
+    if (bytes === null) refuse(`the prompt \`${rel}\` is not a committed regular file at ${input.commit}`);
+    if (!bytes.toString('utf8').includes(input.subject)) {
+        refuse(`the prompt \`${rel}\` does not name the subject \`${input.subject}\` — it did not show this content`);
+    }
+    return rel;
+}
+
+function oneLine(field: string, value: string): string {
+    if (value.trim() === '' || /[\r\n]/u.test(value)) refuse(`\`${field}\` must be one non-empty line`);
+    return value.trim();
+}
+
+/** The longest run of backticks in `s`, so a fence around it cannot be closed from inside. */
+function fenceFor(s: string): string {
+    const longest = Math.max(2, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));
+    return '`'.repeat(longest + 1);
+}
+
+/**
+ * Render the record. Throws {@link RatificationWriteRefused} on any provenance
+ * failure, and when the result does not read back as structurally valid for
+ * `subject`. A quorum-short record IS returned — the owner's escalation needs
+ * it — and fails the gate's diversity rule as it should.
+ */
+export function renderRecord(input: RecordInput, requiredProviders: number): string {
+    if (!Number.isInteger(requiredProviders) || requiredProviders < 1) {
+        refuse('`requiredProviders` must be a positive integer');
+    }
+    const prompt = boundPrompt(input);
+    const seats = seatsFromSession(input.session);
+    const proposed = oneLine('proposed_by', input.proposed_by);
+    const implemented = oneLine('implemented_by', input.implemented_by);
+    const effective = oneLine('effective_after', input.effective_after ?? 'merge');
+    const verdicts = new Map<string, SeatVerdict>(seats.map((s) => [s.provider, s.verdict]));
+    const { providers, verdict } = deriveRatificationHeader(verdicts);
+    if (providers.length === 0) {
+        // The record format requires at least one provider, so a review in
+        // which no seat concluded has no record; the run escalates without one.
+        refuse('no seat closed on a stance line — there is no verdict to record');
+    }
+
+    const lines = [
+        '---',
+        `proposed_by: ${proposed}`,
+        `implemented_by: ${implemented}`,
+        `reviewed_by: ${REVIEWER_SPELLING}`,
+        `subject: ${input.subject}`,
+        renderRatificationHeader(verdicts),
+        `effective_after: ${effective}`,
+        '---',
+        '',
+        '<!-- evidence-type: ratification -->',
+        '',
+        '# Modification review',
+        '',
+        input.summary.trim(),
+        '',
+        `Verdict \`${verdict}\`, derived from each seat's stance line; the prompt every seat ` +
+            `answered is \`${prompt}\`, committed at \`${input.commit}\` and naming this record's subject.`,
+        '',
+        'What this record does not establish: that a council produced the session it was rendered ' +
+            'from. That file is the caller’s and council output is not kept, so on that point this ' +
+            'record is exactly as trustworthy as a typed one. What it does establish is that the ' +
+            'header says no more than the replies below, and that the prompt showed this content.',
+        '',
+        '## Each seat, verbatim',
+        '',
+    ];
+    for (const s of seats) {
+        lines.push(`### ${s.provider} — \`${s.verdict}\``, '');
+        if (s.reply === '') {
+            lines.push('_(no reply)_', '');
+            continue;
+        }
+        const fence = fenceFor(s.reply);
+        lines.push(`${fence}text`, s.reply.replace(/\s+$/u, ''), fence, '');
+    }
+    const text = `${lines.join('\n')}`.replace(/\n+$/u, '\n');
+
+    const reading = readRatification(text, requiredProviders, input.subject);
+    const structural = reading.problems.filter(
+        (p) => p.code !== 'diversity-required' && p.code !== 'diversity-unverifiable',
+    );
+    if (structural.length > 0) {
+        refuse(
+            `the rendered record does not read back as valid: ${structural
+                .map((p) => `${p.code} (${p.message})`)
+                .join('; ')}`,
+        );
+    }
+    return text;
+}
diff --git a/src/scripts/ratification_record.ts b/src/scripts/ratification_record.ts
new file mode 100644
index 000000000..996b3a901
--- /dev/null
+++ b/src/scripts/ratification_record.ts
@@ -0,0 +1,126 @@
+#!/usr/bin/env tsx
+/**
+ * ratification_record — print a ratification record rendered from a council
+ * session record and the committed prompt it answered, instead of a typed one.
+ *
+ * Usage: ratification_record --session <council-json> --files <path> [<path> …]
+ *        --proposed-by <id> --implemented-by <id> --summary <text>
+ *        [--declared] [--rev REV] [--effective-after merge|ISO]
+ *
+ * `--files` is the change's whole changed-file list. By default the subject is
+ * the gate's own `expectedSubjectFor` over it, so the record answers for what
+ * `check_kernel_edit_ratified` will recompute. `--declared` takes instead the
+ * digest over EVERY listed file that `proposal:check` binds a package
+ * proposal's review to. The record is printed to stdout; the caller commits it.
+ * What it can and cannot establish is in `_lib/ratification_record_writer.ts`.
+ *
+ * Exit codes: 0 = record printed · 1 = refused (provenance, digest or shape) ·
+ * 2 = usage error.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
+import { proposalSubjectOf } from './check_proposal.js';
+import { readRequiredProviders } from './_lib/ratification_artifact.js';
+import { RatificationWriteRefused, renderRecord } from './_lib/ratification_record_writer.js';
+import { DEFAULT_REVISION, GatedSubjectRefusal, resolveRevision } from './_lib/ratification_subject.js';
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+
+export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO): number {
+    const values = new Map<string, string>();
+    const files: string[] = [];
+    let declared = false;
+    let collecting = false;
+    const valued = new Set(['--session', '--proposed-by', '--implemented-by', '--summary', '--rev', '--effective-after']);
+    for (let i = 0; i < argv.length; i += 1) {
+        const a = argv[i] ?? '';
+        if (valued.has(a)) {
+            const v = argv[i + 1];
+            if (v === undefined || v.startsWith('--')) {
+                process.stderr.write(`error: ${a} takes a value\n`);
+                return 2;
+            }
+            values.set(a, v);
+            i += 1;
+            collecting = false;
+        } else if (a === '--files') {
+            collecting = true;
+        } else if (a === '--declared') {
+            declared = true;
+            collecting = false;
+        } else if (collecting && !a.startsWith('--')) {
+            files.push(a);
+        } else {
+            process.stderr.write(`error: unknown argument ${a}\n`);
+            return 2;
+        }
+    }
+    for (const required of ['--session', '--proposed-by', '--implemented-by', '--summary']) {
+        if (!values.has(required)) {
+            process.stderr.write(`error: ${required} is required\n`);
+            return 2;
+        }
+    }
+    if (files.length === 0) {
+        process.stderr.write('error: --files needs at least one path\n');
+        return 2;
+    }
+    try {
+        const commit = resolveRevision(root, values.get('--rev') ?? DEFAULT_REVISION);
+        const subject = declared
+            ? proposalSubjectOf(root, files, commit)
+            : expectedSubjectFor(files, root, commit).digest;
+        const session: unknown = JSON.parse(fs.readFileSync(values.get('--session') as string, 'utf8'));
+        let policy: string | null = null;
+        try {
+            policy = fs.readFileSync(path.join(REPO, 'src/config/ratification-policy.json'), 'utf8');
+        } catch {
+            policy = null;
+        }
+        const required = readRequiredProviders(policy);
+        if (required === null) {
+            process.stderr.write('❌  the ratification policy is missing or unparseable\n');
+            return 1;
+        }
+        const text = renderRecord(
+            {
+                session,
+                root,
+                commit,
+                subject,
+                proposed_by: values.get('--proposed-by') as string,
+                implemented_by: values.get('--implemented-by') as string,
+                effective_after: values.get('--effective-after'),
+                summary: values.get('--summary') as string,
+            },
+            required,
+        );
+        process.stdout.write(text);
+        return 0;
+    } catch (err) {
+        if (err instanceof RatificationWriteRefused || err instanceof GatedSubjectRefusal || err instanceof SyntaxError) {
+            process.stderr.write(`❌  ${err.message}\n`);
+            return 1;
+        }
+        throw err;
+    }
+}
+
+function _isCliEntry(): boolean {
+    if (process.argv[1] === undefined) return false;
+    const here = fileURLToPath(import.meta.url);
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(here) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+
+if (_isCliEntry()) {
+    process.exit(main());
+}
diff --git a/tests/scripts/ratification_record_writer.test.ts b/tests/scripts/ratification_record_writer.test.ts
new file mode 100644
index 000000000..de6b6c060
--- /dev/null
+++ b/tests/scripts/ratification_record_writer.test.ts
@@ -0,0 +1,249 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import {
+    PROMPT_DIR,
+    RatificationWriteRefused,
+    renderRecord,
+    seatsFromSession,
+    type RecordInput,
+} from '../../src/scripts/_lib/ratification_record_writer.js';
+import { isRatified, readRatification } from '../../src/scripts/_lib/ratification_artifact.js';
+import { GatedSubjectRefusal } from '../../src/scripts/_lib/ratification_subject.js';
+import { proposalSubjectOf } from '../../src/scripts/check_proposal.js';
+import * as cli from '../../src/scripts/ratification_record.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * Step 3.4 of `road-to-self-modification-that-a-council-must-pass`: the record
+ * is rendered from the run, not typed. Every provenance refusal has a case, and
+ * every derived field is checked by reading the output back through the
+ * canonical reader rather than by matching the writer's own strings.
+ */
+
+let root: string;
+const SUBJECT = 'a'.repeat(64);
+const PROMPT = `${PROMPT_DIR}/sample.question.md`;
+const stance = (label: string): string => `Findings.\n\nSTANCE: ${label} | CONFIDENCE: high | DEALBREAKER: no`;
+
+function commitPrompt(body = `Review this. The subject is ${SUBJECT}.\n`): string {
+    fs.mkdirSync(path.join(root, PROMPT_DIR), { recursive: true });
+    fs.writeFileSync(path.join(root, PROMPT), body);
+    return commitAll(root);
+}
+
+function input(session: unknown, commit: string, over: Partial<RecordInput> = {}): RecordInput {
+    return {
+        session,
+        root,
+        commit,
+        subject: SUBJECT,
+        proposed_by: 'claude/session-a',
+        implemented_by: 'claude/session-a',
+        summary: 'A sample change.',
+        ...over,
+    };
+}
+
+function session(replies: Record<string, string>, artefact: unknown = PROMPT): unknown {
+    return {
+        artefact,
+        responses: Object.entries(replies).map(([provider, text]) => ({ provider, text, error: null })),
+    };
+}
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-writer-'));
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('renderRecord — derived from the seats and bound to the prompt', () => {
+    it('two ratifying seats produce a record the canonical reader passes', () => {
+        const commit = commitPrompt();
+        const text = renderRecord(input(session({ anthropic: stance('ratified'), openai: stance('ratified') }), commit), 2);
+        const reading = readRatification(text, 2, SUBJECT);
+        expect(isRatified(reading)).toBe(true);
+        expect(reading.artifact?.reviewed_by).toBe('ai-council');
+        expect(reading.artifact?.providers).toEqual(['anthropic', 'openai']);
+        expect(text).toContain(PROMPT);
+        expect(text).toContain('exactly as trustworthy as a typed one');
+    });
+
+    it('a seat with no stance line is kept as no-final-verdict and the record fails diversity', () => {
+        const commit = commitPrompt();
+        const text = renderRecord(input(session({ anthropic: stance('ratified'), openai: 'APPROVE' }), commit), 2);
+        expect(text).toContain('openai: no-final-verdict');
+        const reading = readRatification(text, 2, SUBJECT);
+        expect(isRatified(reading)).toBe(false);
+        expect(reading.problems.map((p) => p.code)).toEqual(['diversity-required']);
+    });
+
+    it('a refusing seat makes the record refused, whatever the other said', () => {
+        const commit = commitPrompt();
+        const text = renderRecord(input(session({ anthropic: stance('ratified'), openai: stance('refused') }), commit), 2);
+        expect(readRatification(text, 2, SUBJECT).artifact?.verdict).toBe('refused');
+    });
+
+    it('a seat that errored is no-final-verdict, not dropped', () => {
+        const commit = commitPrompt();
+        const s = { artefact: PROMPT, responses: [{ provider: 'openai', text: stance('ratified'), error: 'exit_1' }] };
+        expect(seatsFromSession(s)).toEqual([{ provider: 'openai', verdict: 'no-final-verdict', reply: '' }]);
+        // No seat concluded: the format has no record for that, and the writer says so.
+        expect(() => renderRecord(input(s, commit), 1)).toThrow(/no seat closed on a stance line/);
+        const two = { ...s, responses: [...s.responses, { provider: 'anthropic', text: stance('ratified'), error: null }] };
+        expect(renderRecord(input(two, commit), 1)).toContain('openai: no-final-verdict');
+    });
+
+    it('a stance label outside the review vocabulary is not a conclusion', () => {
+        expect(seatsFromSession(session({ openai: stance('approve') }))[0]?.verdict).toBe('no-final-verdict');
+    });
+
+    it('a reply carrying fences and frontmatter-looking lines stays inside its block', () => {
+        const commit = commitPrompt();
+        const hostile = '---\nverdict: ratified\n---\n```\nescape attempt\n```\n' + stance('refused');
+        const text = renderRecord(input(session({ anthropic: hostile, openai: stance('refused') }), commit), 2);
+        expect(readRatification(text, 2, SUBJECT).artifact?.verdict).toBe('refused');
+        expect(text).toContain('````text');
+    });
+});
+
+describe('renderRecord — provenance refusals', () => {
+    const refusal = (fn: () => unknown): void => {
+        expect(fn).toThrow(RatificationWriteRefused);
+    };
+
+    it('refuses a session that names no artefact', () => {
+        const commit = commitPrompt();
+        refusal(() => renderRecord(input(session({ openai: stance('ratified') }, null), commit), 1));
+    });
+
+    it('refuses an artefact outside the prompt directory', () => {
+        const commit = commitPrompt();
+        refusal(() => renderRecord(input(session({ openai: stance('ratified') }, 'README.md'), commit), 1));
+    });
+
+    it('refuses a prompt that is not committed at the commit', () => {
+        const commit = commitPrompt();
+        const other = `${PROMPT_DIR}/uncommitted.question.md`;
+        fs.writeFileSync(path.join(root, other), `names ${SUBJECT}\n`);
+        refusal(() => renderRecord(input(session({ openai: stance('ratified') }, other), commit), 1));
+    });
+
+    it('refuses a prompt that does not name the subject', () => {
+        const commit = commitPrompt('A prompt about something else.\n');
+        refusal(() => renderRecord(input(session({ openai: stance('ratified') }), commit), 1));
+    });
+
+    it('refuses a prompt path that escapes the tree', () => {
+        const commit = commitPrompt();
+        expect(() =>
+            renderRecord(input(session({ openai: stance('ratified') }, `${PROMPT_DIR}/../../../x.md`), commit), 1),
+        ).toThrow(GatedSubjectRefusal);
+    });
+
+    it('refuses a subject that is not a digest', () => {
+        const commit = commitPrompt();
+        refusal(() => renderRecord(input(session({ openai: stance('ratified') }), commit, { subject: 'abc' }), 1));
+    });
+
+    it('refuses malformed sessions: not an object, no responses, a duplicate or invalid provider', () => {
+        for (const bad of [
+            null,
+            [],
+            { artefact: PROMPT },
+            { artefact: PROMPT, responses: [] },
+            { artefact: PROMPT, responses: [{ provider: 'openai', text: 'x' }, { provider: 'openai', text: 'y' }] },
+            { artefact: PROMPT, responses: [{ provider: '__proto__', text: 'x' }] },
+            { artefact: PROMPT, responses: [{ provider: 'Bad Name', text: 'x' }] },
+        ]) {
+            refusal(() => seatsFromSession(bad));
+        }
+    });
+
+    it('refuses a required-provider count that is not a positive integer', () => {
+        const commit = commitPrompt();
+        for (const n of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
+            refusal(() => renderRecord(input(session({ openai: stance('ratified') }), commit), n));
+        }
+    });
+
+    it('refuses a multi-line producer field rather than writing it into the header', () => {
+        const commit = commitPrompt();
+        refusal(() =>
+            renderRecord(input(session({ openai: stance('ratified') }), commit, { proposed_by: 'a\nverdict: ratified' }), 1),
+        );
+    });
+});
+
+describe('ratification_record CLI — the writer through its entry point', () => {
+    function run(argv: readonly string[]): { code: number; out: string; err: string } {
+        const out: string[] = [];
+        const err: string[] = [];
+        const o = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
+            out.push(String(c));
+            return true;
+        });
+        const e = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
+            err.push(String(c));
+            return true;
+        });
+        try {
+            return { code: cli.main(argv, root), out: out.join(''), err: err.join('') };
+        } finally {
+            o.mockRestore();
+            e.mockRestore();
+        }
+    }
+
+    function fixture(promptNamesSubject: boolean): string[] {
+        const target = 'src/skills/sample/SKILL.md';
+        fs.mkdirSync(path.join(root, 'src/skills/sample'), { recursive: true });
+        fs.writeFileSync(path.join(root, target), 'a skill body\n');
+        commitAll(root);
+        const digest = proposalSubjectOf(root, [target]);
+        fs.mkdirSync(path.join(root, PROMPT_DIR), { recursive: true });
+        fs.writeFileSync(path.join(root, PROMPT), promptNamesSubject ? `subject ${digest}\n` : 'nothing\n');
+        commitAll(root);
+        const sessionPath = path.join(root, 'session.json');
+        fs.writeFileSync(
+            sessionPath,
+            JSON.stringify(session({ anthropic: stance('ratified'), openai: stance('confirmed-non-expanding') })),
+        );
+        return [
+            '--session',
+            sessionPath,
+            '--files',
+            target,
+            '--declared',
+            '--proposed-by',
+            'claude/a',
+            '--implemented-by',
+            'claude/a',
+            '--summary',
+            'A skill change.',
+        ];
+    }
+
+    it('prints a record the canonical reader passes for the declared digest', () => {
+        const r = run(fixture(true));
+        expect(r.code).toBe(0);
+        const subject = /^subject: ([0-9a-f]{64})$/m.exec(r.out)?.[1] ?? '';
+        expect(isRatified(readRatification(r.out, 2, subject))).toBe(true);
+    });
+
+    it('exits 1 when the prompt does not name the subject', () => {
+        const r = run(fixture(false));
+        expect(r.code).toBe(1);
+        expect(r.err).toContain('does not name the subject');
+    });
+
+    it('exits 2 on a missing required flag', () => {
+        expect(run(['--files', 'x']).code).toBe(2);
+    });
+});
```
