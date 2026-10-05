#!/usr/bin/env tsx
/**
 * PreToolUse guard: one question per structured-ask call.
 *
 * road-to-asked-not-parked 5.1. `ask-when-uncertain`'s Iron Law is one
 * question per turn, and `user-interaction` § question pacing narrows what
 * "one" means: one decision point, answerable with one reply. A host's native
 * question picker makes it cheap to violate that — a payload can carry N
 * questions in one call, and the user then answers a form instead of a
 * question.
 *
 * DENY, NEVER TRUNCATE. Silently keeping the first question and dropping the
 * rest would hide exactly the decisions the user was owed; the deny message
 * names the count so the caller can split the ask instead of guessing what
 * happened.
 *
 * WHAT IT SEES, honestly. `_lib/structured_ask.ts` carries ONE observed
 * per-host tool — `claude`'s `AskUserQuestion`, 48 calls across versions
 * 2.1.252 to 2.1.284 between 2026-09-01 and 2026-10-02.
 *
 * THIS GUARD DOES NOT USE THAT ROW, and the distinction matters enough to say
 * rather than leave to a reader. `verdict()` calls `isStructuredAskTool(tool)`
 * with no host id, so the shape branch is unreachable from here and the name
 * SHAPE pattern decides on every host, `claude` included — filtered by the
 * manifest's per-concern `tools:` key to the same candidate names. Threading a
 * host id through would NARROW what this guard matches on the one host where a
 * picker is known to exist (`ask_user_question` would stop matching), which is
 * a behaviour change and not a header repair, so it is deliberately not made
 * here.
 *
 * This header carried the opposite claim until 2026-10-05 — that no host's
 * delivered surface had been observed carrying a picker — and it was wrong in
 * a specific, instructive way rather than merely stale. Its measurement base
 * was one `false` row taken from a SUBAGENT leg, whose surface carries no
 * picker because a subagent has no user to ask. The step from "this leg has
 * none" to "no host has been observed with one" is the substitution the
 * observation protocol exists to refuse, and the registry comment now records
 * which leg each reading came from for that reason. The old wording is
 * described rather than quoted, because 1.1's drift check is a grep and a grep
 * cannot tell a refuted quotation from a live assertion.
 *
 * The other eight hosts in `docs/enforcement-by-host.md` still have no row at
 * all — never looked, not measured — so nothing here is a claim about them.
 *
 * WHAT THE OBSERVATION DOES NOT CHANGE: the deny threshold. One question per
 * call is `ask-when-uncertain`'s Iron Law, not a host limit, and all 47
 * parsed calls already carried exactly one. The guard has had nothing to deny
 * and that is the expected reading, not evidence it is inert.
 *
 * ENFORCEMENT REACH, also honestly. `fail_closed: false` and the exit-1 deny
 * are only a deny where the host both binds `pre_tool_use` AND honours the
 * dispatcher's verdict. `hook-architecture-v1.md` § Which hosts carry
 * pre_tool_use is the table; `agent-config hooks:status` answers it for the
 * host actually running. This file claims no more than that.
 *
 * A payload whose shape is not recognised at all (`countStructuredAskQuestions`
 * returns -1) is ALLOWED. A guard that blocks what it cannot parse would turn
 * an unknown picker shape into a wedged session, and the failure it guards
 * against — too many questions — is a shape defect, not a safety one.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block (the call carries more than one question)
 */
import { fileURLToPath, pathToFileURL } from 'node:url';

import { countStructuredAskQuestions, isStructuredAskTool } from '../_lib/structured_ask.js';
import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

type JsonObject = Record<string, unknown>;

function _isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface AskCall {
    readonly tool: string;
    readonly questions: number;
}

/** Read (tool name, question count) off a PreToolUse envelope. */
export function extractAskCall(envelope: JsonObject): AskCall {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ??
        payload['toolName'] ??
        payload['tool'] ??
        envelope['tool_name'] ??
        envelope['tool'];
    const tool = typeof nameVal === 'string' ? nameVal : '';
    const ti = _isObject(payload['tool_input'])
        ? payload['tool_input']
        : _isObject(envelope['tool_input'])
          ? envelope['tool_input']
          : null;
    return { tool, questions: ti === null ? -1 : countStructuredAskQuestions(ti) };
}

/** The verdict, separated from I/O so the fixtures exercise the decision itself. */
export function verdict(call: AskCall): { block: boolean; reason: string } {
    if (call.tool === '' || !isStructuredAskTool(call.tool)) {
        return { block: false, reason: 'not a structured-ask call' };
    }
    if (call.questions < 0) {
        return { block: false, reason: 'payload shape not recognised — allowed, never guessed' };
    }
    if (call.questions <= 1) {
        return { block: false, reason: 'one question' };
    }
    return {
        block: true,
        reason:
            `${call.tool} carries ${String(call.questions)} questions in one call. ` +
            'One decision per ask: put the first question, wait for the answer, then ' +
            'the next. The call is denied rather than truncated — dropping the extra ' +
            'questions would hide the decisions the user is owed.',
    };
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    for (const a of args) {
        if (a === '--self-test') {
            return selfTest();
        }
    }
    const raw = readHookStdin();
    if (!raw.trim()) {
        return 0;
    }
    let envelope: JsonObject;
    try {
        const parsed: unknown = JSON.parse(raw);
        envelope = _isObject(parsed) ? parsed : {};
    } catch {
        return 0;
    }
    const v = verdict(extractAskCall(envelope));
    if (v.block) {
        process.stderr.write(`one-question-per-ask: BLOCKED — ${v.reason}\n`);
        return 1;
    }
    return 0;
}

export function selfTest(): number {
    const cases: Array<[string, JsonObject, boolean]> = [
        [
            'two questions in one call is denied',
            { tool_name: 'AskUserQuestion', tool_input: { questions: [{}, {}] } },
            true,
        ],
        [
            'four questions is denied',
            { tool_name: 'AskUserQuestion', tool_input: { questions: [{}, {}, {}, {}] } },
            true,
        ],
        [
            'one question passes',
            { tool_name: 'AskUserQuestion', tool_input: { questions: [{}] } },
            false,
        ],
        [
            'a single-question field passes',
            { tool_name: 'ask_user_question', tool_input: { question: 'which one?' } },
            false,
        ],
        [
            'an empty ask passes — malformed, but not this guard\'s failure',
            { tool_name: 'AskUserQuestion', tool_input: { questions: [] } },
            false,
        ],
        [
            'an unrecognised payload shape passes rather than wedging the session',
            { tool_name: 'AskUserQuestion', tool_input: { something: 'else' } },
            false,
        ],
        ['an ordinary tool is never seen', { tool_name: 'Bash', tool_input: { command: 'ls' } }, false],
        [
            'a Write with two questions in its body is not an ask call',
            { tool_name: 'Write', tool_input: { questions: [{}, {}] } },
            false,
        ],
        ['an empty envelope passes', {}, false],
    ];
    let failed = 0;
    for (const [name, envelope, want] of cases) {
        const got = verdict(extractAskCall(envelope)).block;
        const ok = got === want;
        process.stdout.write(
            `${ok ? '✅' : '❌'}  ${name} — block=${String(got)}` +
                (ok ? '\n' : ` (wanted ${String(want)})\n`),
        );
        if (!ok) failed += 1;
    }
    const positives = cases.filter((c) => c[2]).length;
    if (positives < 2) {
        process.stderr.write(
            '❌  one_question_per_ask --self-test: fewer than 2 deny cases — a guard never ' +
                'seen refuse has unknown sensitivity.\n',
        );
        return 1;
    }
    process.stdout.write(
        `\none_question_per_ask --self-test: ${String(cases.length - failed)}/${String(cases.length)} ` +
            `case(s) behaved (${String(positives)} deny, ${String(cases.length - positives)} allow)\n`,
    );
    return failed > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}

export { _HERE };
