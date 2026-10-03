#!/usr/bin/env tsx
/**
 * Rule-inject — the delivery twin of `skill-route`, with the opposite payload
 * policy (`road-to-trigger-delivered-rule-bodies` Phase 1).
 *
 * BODIES, NEVER POINTERS — and the difference from its twin is deliberate
 * rather than incidental. `skill_route_hook.ts:14` ships "POINTERS, NEVER
 * BODIES" on this same slot, and it is right to: a skill is a thing the agent
 * *invokes*, so naming it is enough. A rule is a thing the agent must already
 * be *under*, and the only datum anyone has on pointer-shaped rule delivery is
 * the 36.2 %-against-48 % run at `docs/CLAIMS.md:188-189`. Whatever that
 * instrument's flaws — and ADR-202 closed it — it points one way.
 *
 * SHIPPED ON FOR CLAUDE CODE SINCE ADR-267 — the delivery-default record, and
 * the citation is corrected here (2026-09-13) from ADR-265, which decides
 * something else entirely: whether the iron-law reserve is activated, answered
 * no, with the verifier kept inside the change. Nothing in it ships a
 * projection mode. ADR-267 `delivery-default-for-claude-code` is the record
 * that turns this concern on for this host, and it is the one whose
 * `review_trigger` fires if a rule stops arriving. Previously corrected
 * 2026-09-08 (R2 finding
 * 4), because this paragraph read "DEFAULT OFF, AND OFF MEANS ZERO BYTES …
 * under every shipped default it emits nothing … there is no measured emission
 * to register yet" and all four clauses became false in the same change that
 * edited the paragraph below it. The shipped template carries
 * `lean_projection.mode: delivery` with `hosts: [claude-code]`
 * (`src/config/agent-settings.template.yml`), `gateOpen` returns true on that
 * pair, and the emission IS measured: p50 6,674 B, p90 16,188 B, max 20,406 B
 * over 318 gate-open fires on the frozen corpus, which is the distribution the
 * `user_prompt_submit` slot raise in `src/config/hook-token-budget.json` is
 * derived from.
 *
 * OFF STILL MEANS ZERO BYTES, and that half is unchanged: the concern returns
 * before reading the router unless the resolved (mode, hosts) pair actually
 * thins THIS host — see `gateOpen`, which checks both, because the projector
 * does. On any other host, and on a `lean_projection.mode: eager-all` rollback,
 * it emits nothing.
 *
 * THE INSTALL DECLARES THE SCOPE, THE PACKAGE SUPPLIES THE TEXT (step 1.3).
 * A rule is delivered only when the host's own rule directories carry a file
 * for it — `~/.claude/rules/` and `<project>/.claude/rules/`, as a union,
 * because the host loads both. The router is the PACKAGE's list of what could
 * route and is a larger set: 13 router tier rules are maintainer-only by
 * `workspaces`, and before this filter a consumer could receive a body for a
 * rule their install never carried. The two halves cannot be one read — under
 * `delivery` the installed files are thin stubs by construction, so they can say
 * WHICH rules are in scope and never WHAT they say. Where no host rule directory
 * exists at all, nothing declares a scope and no filter applies; see
 * `rule_layer_overlap.hostRuleLayerIds` for why that is not the empty set.
 *
 * THE HOST FORM, BY THE PROJECTOR'S OWN PARSER (step 1.4). Delivered text is
 * `rule_law_section.ruleBody` of the file: frontmatter and HTML comments
 * removed. Both are bytes the model cannot act on — the frontmatter is the
 * routing surface the router has already read, and the comments are authoring
 * scaffolding no host renders. `project_thin_rules.ts` calls the same function
 * for the same reason, so "what a stub carries" and "what a delivery carries"
 * cannot drift into two spellings. A file with nothing left after the strip is
 * not delivered: an empty `<rule>` element is framing with no content in it.
 *
 * ONE STRING THE HOST DOES NOT REPLACE, AND A MANIFEST (step 1.5). Claude Code
 * substitutes an `additionalContext` over 10,000 CHARACTERS with a path and a
 * 2,000-character preview, so an oversized delivery does not arrive truncated —
 * it does not arrive. {@link COMPOSED_CHARS} bounds the whole rule-produced
 * string at 8,000, and `compose` fills it in the order D1 fixes: the law of
 * every matched high-consequence rule, then the highest-priority full body that
 * fits, then further bodies, then the law of everything still unsent, then the
 * manifest. Nothing is ever cut mid-obligation — a rule whose law alone does not
 * fit is REPORTED, because half a law reads like a whole one.
 *
 * AND EVERY MATCH IS IN THE MANIFEST, labelled `full`, `law`, `omitted_budget`
 * or `source_unavailable`. A pointer is never labelled delivered. This is where
 * `selectForInjection`'s `dropped` list is finally read: before it, a body the
 * byte cap discarded left no trace, so a consumer could not tell a rule that did
 * not match from one that matched and was thrown away.
 *
 * ONE MATCHER, SHARED WITH THE OFFLINE MODEL. Everything about selection,
 * ordering, capping and body loading comes from `_lib/rule_injection.ts`, which
 * `model_rule_injection.ts` also imports. Step 0.5 states the reason in as many
 * words: an experiment whose offline pricing and runtime delivery use different
 * matchers measures nothing.
 *
 * ONCE PER SESSION PER RULE, RE-ARMED AND RESTORED ON COMPACTION. A rule's body
 * is injected the first time one of its triggers fires and not again, because
 * the model already has it. Compaction is exactly the event that makes that
 * false, so `pre_compact` empties the seen-set — the same pin-lost shape
 * `language-mirror` uses.
 *
 * STATE LIVES UNDER THE USER-GLOBAL ROOT, KEYED BY PROJECT (step 1.7). It used
 * to be `<workspace>/agents/runtime/state/rule-inject/`, so every consumer
 * session left dispatcher bookkeeping as untracked files inside someone else's
 * repository. The seen-set is state about a SESSION, not about the project.
 * The delivered-row ledger beside it is deliberately NOT moved — see
 * {@link statePath} for the join that depends on where it is.
 *
 * WHAT IS RE-DELIVERED AFTER A COMPACTION, EXACTLY
 * (road-to-delivery-for-every-host 2.4, amended by step 1.6 — stated because a
 * rule lost at a compaction boundary used to be lost for the rest of the
 * session, and "re-armed" alone does not say what a reader may rely on):
 *
 *   · `pre_compact` empties the WHOLE seen-set for that session, not the rules
 *     matched on the compacted turn. There is no per-rule bookkeeping to be
 *     partially wrong about. Since 1.6 it also hands those ids to `pending`
 *     rather than deleting them — see {@link armRestore}.
 *   · Nothing is delivered BY the compaction itself. The slot emits zero bytes
 *     and exits allow; re-arming is silent. It cannot deliver: the host is about
 *     to discard the context it would emit into.
 *   · `session_start` with `source: compact` sends the LAW section of every
 *     rule in that pending set, under the same 8,000-character budget, once.
 *     That is the half this paragraph used to end at: a rule whose trigger does
 *     not recur is no longer unrestored. A rule with no law section is reported
 *     in the manifest rather than having its whole body sent in its place.
 *   · A rule's BODY still returns on the next turn whose trigger matches it.
 *     The restore does not re-arm the de-duplication and does not replace
 *     trigger-driven delivery; it covers the gap between the two.
 *   · The seen-set is per session, so a compaction in one session re-arms and
 *     restores only that session.
 *
 * Held by fixtures in `tests/scripts/rule_inject_hook.test.ts` under "once per
 * session per rule" and "re-deliver after a compact", and — for the BINDING
 * rather than the function — by the dispatcher column in
 * `rule_inject_foreign_matrix.test.ts`, because a suite that only calls `main()`
 * stays green over a slot the dispatcher never routes to this concern.
 *
 * NEVER BLOCKS. Every failure path returns 0: unreadable stdin, malformed JSON,
 * missing router, unreadable body, unwritable state. The one non-zero exit is
 * the host's advisory context channel (exit 2 + `decision: "warn"`), the same
 * channel `ui-route-nudge` and `code-graph-context` already use on `pre_tool_use`
 * with `severity: advisory` — a warn there is an injection, not a deny.
 *
 * HOST BOUNDARY, STATED RATHER THAN IMPLIED. `user_prompt_submit` and
 * `pre_tool_use` are bound on a subset of hosts, and only `claude` honours a
 * deny at all. On a host where neither slot is bound this concern cannot run,
 * which is the whole reason the flip step 2.4 gates on is Claude-only. Run
 * `agent-config hooks:status` for the host you are actually on.
 *
 * SUBAGENTS ARE OUT OF REACH, MEASURED. Neither slot fires inside a spawned
 * child session and the `subagent_start` payload carries no prompt field — see
 * `agents/evidence/investigations/subagent-start-payload-probe.md` (2026-08-23,
 * claude 2.1.241, three verdicts). Delivery is therefore orchestrator-only, and
 * no third binding is added.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hookSectionEnabled } from '../_lib/hook_settings.js';
import * as user_global_paths from '../_lib/user_global_paths.js';
import { deliversBodies, resolveLeanProjection } from '../_lib/lean_projection_mode.js';
import { enforcement_class_from_frontmatter } from '../_lib/obligation_frequency.js';
import {
    appendDelivered,
    stamp,
    type DeliveredRow,
    type WriterInput,
} from '../_lib/obligations.js';
import {
    allTierRules,
    bytesOf,
    loadRuleBody,
    loadRouter,
    matchTierRules,
    ruleSources,
    selectForInjection,
    type SelectionResult,
    type TierRuleMatch,
} from '../_lib/rule_injection.js';
import { readConsequenceClass } from '../_lib/rule_consequence_class.js';
import { lawText, ruleBody } from '../_lib/rule_law_section.js';
import { hostRuleLayerIds } from '../_lib/rule_layer_overlap.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';

/**
 * Per-prompt injection ceiling, in UTF-8 BYTES.
 *
 * DERIVED, NOT PICKED: `model_rule_injection --corpus tests/eval/routing-matrix`
 * measured the matched-body-token distribution over the frozen labelled corpus
 * at p50 1,728 / p90 4,804 / p99 8,248 / max 12,957 exact-BPE tokens, and step
 * 1.1 specifies "the p90 from 0.4, rounded to 500" — 4,804 rounds up to 5,000.
 *
 * BYTES rather than tokens, and the unit change is the point rather than a
 * detail. `_lib/token_count.ts` resolves `js-tiktoken` at module load, so a
 * token-capped concern drags a tokenizer into EVERY hook dispatch on every
 * slot, for a concern that is default-OFF and emits nothing. Measured: 202 ms
 * -> 196 ms on the `pre_tool_use` p95 when the concern is unbound entirely, and
 * the CI latency gate went red on the branch that introduced it while passing
 * on main. So the runtime cap is stated in the unit
 * `hook-token-budget.json` already enforces — 5,000 tok at the ~4 bytes/token
 * this corpus measures was 20,480 B, and that WAS this concern's registered
 * row until 2026-09-08. It matched the concern row and not the slot row; see
 * the correction below.
 *
 * LOWERED 20480 -> 16384 on 2026-09-08 (R2 finding 3), and the paragraphs above
 * are kept because they record how the retired number was derived. The defect
 * was that the derivation above and the one behind the
 * `user_prompt_submit` slot row were TWO STATISTICS IN TWO UNITS: this cap was
 * the p90 of the matched-body TOKEN distribution, converted at ~4 B/tok; the
 * slot row is the p90 gate-open FIRE SIZE in bytes, which is the activation
 * charge owner ruling E2 specifies. They disagreed by 25 %, in the direction
 * that licensed ONE concern to emit more than the whole slot — carrying 12
 * other concerns — is registered for. Reconciled downward onto the slot row,
 * because that is the owner-specified charge; the cost is measured and recorded
 * in `hook-token-budget.json`'s own `rule-inject_reason` (33 -> 45 fires
 * truncated, 63 -> 88 bodies withheld over 330 corpus fires).
 *
 * WHAT THIS CAP DOES, precisely: `selectForInjection` drops whole bodies to
 * stay under it, so a fire is TRUNCATED and never over-emitted. It is the only
 * number that acts on a single fire — the per-slot sums are an authoring-time
 * control read by `bench_hook_injection`, and the runtime dispatcher enforces
 * only `per_turn_aggregate_bytes.ceiling_bytes`.
 *
 * Re-run that command if the corpus or the bodies move; a cap copied from a
 * stale measurement is worse than no cap, because it looks derived. The
 * tripwire in `tests/scripts/rule_inject_hook.test.ts` holds this equal to the
 * registered concern row and at or below the slot sum, so the two units cannot
 * drift apart again unnoticed.
 */
export const CAP_BYTES = 16384;

/** Tools whose input names a file this concern can match path triggers against. */
export const FILE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'Read', 'MultiEdit']);

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v !== '') return v;
    }
    return null;
}

/** Workspace root the envelope points at, falling back to the process cwd. */
export function workspaceRoot(env: JsonObject): string {
    return str(env, 'workspace', 'cwd', 'project_dir') ?? process.cwd();
}

// ── seen-set state ───────────────────────────────────────────────────────

export interface SeenState {
    /** Ids already delivered in this session. */
    rules: string[];
    /**
     * Ids the compaction boundary took away, waiting for the restore slot.
     *
     * IDS, NEVER TEXT. The restore re-reads each rule's law from the corpus; a
     * seen-set that cached bodies would be a second copy of the rule layer
     * living in a consumer's state directory, going stale on every upgrade.
     */
    pending?: string[];
}

/**
 * A stable, readable, collision-free directory name for one project root.
 *
 * The basename alone collides — a developer with `~/work/api` and
 * `~/clients/api` would share a seen-set and silently lose deliveries in both.
 * The digest alone is unreadable, and this directory is one a human opens when
 * a delivery looks wrong. Both, so neither problem is the one you get.
 */
function projectKey(root: string): string {
    const abs = path.resolve(root);
    const name = (path.basename(abs) || 'root').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
    return `${name}-${createHash('sha256').update(abs, 'utf-8').digest('hex').slice(0, 12)}`;
}

/**
 * Where this session's seen-set lives (step 1.7).
 *
 * UNDER THE USER-GLOBAL ROOT, KEYED BY PROJECT. It used to be written to
 * `<workspace>/agents/runtime/state/rule-inject/`, so every consumer session
 * left dispatcher bookkeeping inside someone else's repository — untracked
 * files in their `git status`, in a directory their `.gitignore` says nothing
 * about unless this package's managed block was installed. The seen-set is
 * state ABOUT a session, not about the project, and the project is the one
 * place it has no business being.
 *
 * THE DELIVERED-ROW LEDGER IS DELIBERATELY NOT MOVED WITH IT.
 * `recordDelivered` writes through `_lib/obligations.ts`, which resolves under
 * the project root, and `road-to-a-stop-that-holds` Phase 3 reads those rows
 * and joins them on the session id. Moving the ledger would be a second,
 * larger change with a live consumer; moving only the seen-set leaves that join
 * untouched by construction, because the two were never keyed on each other.
 *
 * `EVENT4U_CONFIG_HOME` and `$HOME` resolve the root, so a test points it
 * somewhere disposable instead of writing into the developer's own state.
 *
 * ONE COST, STATED: an upgrade mid-session orphans the old file and the seen-set
 * reads empty, which re-injects each matched rule once more. Session state is
 * per session and cheap to rebuild; a migration step for it would be more code
 * than the duplicate it prevents.
 */
export function statePath(root: string, session: string): string {
    const safe = session.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'unknown';
    return path.join(
        user_global_paths.write_target(path.join('state', 'rule-inject', projectKey(root))),
        `${safe}.json`,
    );
}

function readState(root: string, session: string): SeenState {
    try {
        const raw = fs.readFileSync(statePath(root, session), 'utf-8');
        const parsed = JSON.parse(raw) as SeenState;
        return {
            rules: Array.isArray(parsed.rules) ? parsed.rules.map(String) : [],
            pending: Array.isArray(parsed.pending) ? parsed.pending.map(String) : [],
        };
    } catch {
        return { rules: [], pending: [] }; // fresh session, or a file nothing can parse
    }
}

export function readSeen(root: string, session: string): Set<string> {
    return new Set(readState(root, session).rules);
}

function writeState(root: string, session: string, state: SeenState): void {
    const p = statePath(root, session);
    try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(`${p}.tmp`, `${JSON.stringify(state)}\n`, 'utf-8');
        fs.renameSync(`${p}.tmp`, p);
    } catch {
        /* unwritable state must never fail a turn — worst case a re-injection */
    }
}

export function writeSeen(root: string, session: string, seen: Set<string>): void {
    const prev = readState(root, session);
    writeState(root, session, { rules: [...seen].sort(), pending: prev.pending ?? [] });
}

/**
 * Hand the seen-set to the restore slot instead of deleting it (step 1.6).
 *
 * `pre_compact` used to `rm` this file, which re-armed delivery correctly and
 * threw away the one thing the restore needs. The de-duplication is still
 * cleared — `rules` goes empty, so a rule whose trigger fires again gets its
 * BODY back exactly as before — and the ids move to `pending`, where
 * `session_start` with `source: compact` reads them and sends each rule's LAW.
 *
 * That is the half the header used to end at: a rule whose trigger does not
 * recur was not restored at all, and a rule lost at a compaction boundary is
 * lost for the rest of the session.
 */
export function armRestore(root: string, session: string): void {
    const prev = readState(root, session);
    const pending = [...new Set([...prev.rules, ...(prev.pending ?? [])])].sort();
    if (pending.length === 0) {
        try {
            fs.rmSync(statePath(root, session), { force: true });
        } catch {
            /* ignore */
        }
        return;
    }
    writeState(root, session, { rules: [], pending });
}

/** Read the pending set and clear it — a restore that fires twice is a duplicate. */
export function takePending(root: string, session: string): Set<string> {
    const prev = readState(root, session);
    const pending = prev.pending ?? [];
    if (pending.length > 0) writeState(root, session, { rules: prev.rules, pending: [] });
    return new Set(pending);
}

/** The user's prompt, across the shapes the hosts use. */
export function extractPrompt(payload: JsonObject): string {
    return str(payload, 'prompt', 'user_prompt', 'userPrompt', 'message', 'text') ?? '';
}

/** The file path a file-touching tool call names, or `null`. */
export function extractFilePath(payload: JsonObject): string | null {
    const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    if (!isObject(ti)) return null;
    return str(ti, 'file_path', 'path', 'filePath', 'notebook_path');
}

/**
 * Per-fire ceiling on the whole rule-produced string, in CHARACTERS (D2).
 *
 * CHARACTERS, because that is the unit the host's own threshold is in. Claude
 * Code replaces an `additionalContext` longer than 10,000 CHARACTERS with a
 * path and a 2,000-character preview, so a delivery over that line is not
 * truncated — it is substituted, and the obligation text never arrives at all.
 *
 * WHICH STRING IT BOUNDS, stated because the two readings give different
 * margins and D2's own wording did not separate them. This number bounds the
 * RULE-PRODUCED string: the `<rule>` elements and the manifest, which is what
 * this concern emits. The host's 10,000 applies to the `additionalContext` it
 * assembles, and the other concerns on this slot measured 1,272 characters of
 * non-rule text. So the margin is 2,000 if the host measures this concern's
 * payload alone, and **728** if it measures the assembled string — the
 * conservative reading, and still a margin. 8,000 is safe under both; which
 * reading is right has not been established here and the smaller number is the
 * one to plan against.
 *
 * IT BOUNDS THE WHOLE STRING, framing and manifest included, because that is
 * what the host measures. {@link CAP_BYTES} above bounds something else — the
 * SELECTION, shared byte-for-byte with the offline model — and both still
 * apply: selection drops whole bodies to stay under the byte cap, then
 * composition drops or demotes to stay under this one.
 *
 * THE TWO CANNOT BREACH EACH OTHER AT ANY RATIO THIS CORPUS PRODUCES, and the
 * ratio is measured rather than assumed: over the 121 projected rule files the
 * mean is 1.0088 bytes per character and the per-file maximum is 1.0346
 * (`no-decorative-emojis-in-git-surfaces.md`), so 8,000 characters is at most
 * 8,277 bytes against a registered 16,384. A composed string would have to
 * average 2.05 bytes per character to reach the byte row, which no Markdown
 * rule corpus produces. `per_concern_caps_chars` in
 * `src/config/hook-token-budget.json` registers this number in its own unit
 * rather than converting it into the bytes map, and a fixture pins both.
 */
export const COMPOSED_CHARS = 8000;

/**
 * What a matched rule actually got, as the manifest labels it.
 *
 * `full` and `law` mean text arrived. `omitted_budget` and `source_unavailable`
 * mean it did not, and both are a POINTER — an id the model can ask for. A
 * pointer is never labelled delivered; that distinction is the whole reason the
 * manifest has four values instead of a present/absent flag.
 */
export type DeliveryForm = 'full' | 'law' | 'omitted_budget' | 'source_unavailable';

export interface Injection {
    /** Ids whose TEXT was emitted — what the ledger records. */
    rules: string[];
    bytes: number;
    body: string;
    /** Every matched rule with the form it got, in router order. */
    manifest: Array<[string, DeliveryForm]>;
}

/**
 * Record what this fire delivered, so something can later ask whether the turn
 * discharged it.
 *
 * The write happens HERE and not in a later slot because this is the only
 * place that knows the answer. By the time a turn ends, the selection that
 * produced these ids is gone — the router would have to be re-run against a
 * prompt nobody kept, which is a different computation that could disagree.
 *
 * EMITTER RECORD, NEVER A COMPLIANCE ONE. A row says a body was emitted into
 * this slot. It does not say the model read it, and the ledger's own header
 * carries the council lock that forbids reading it that way.
 *
 * Best-effort by construction: every failure path inside `appendDelivered`
 * returns rather than throws, and this wrapper adds one more guard so a
 * ledger problem can never turn a successful injection into a failed hook.
 * A missed reading is cheaper than a refused turn, and this concern has no
 * refusal to offer anyway.
 */
export function recordDelivered(root: string, session: string, ruleIds: string[]): number {
    try {
        const now = stamp();
        const rows: WriterInput<DeliveredRow>[] = ruleIds.map((id) => {
            const body = loadRuleBody(root, id);
            return {
                rule: id,
                // A rule with no projected body declares nothing this can read,
                // which is `none` — the same answer as a body declaring none.
                cls: body === null ? 'none' : enforcement_class_from_frontmatter(body),
                at: now,
            };
        });
        return appendDelivered(root, session, rows);
    } catch {
        return 0;
    }
}

/**
 * Ids of the high-consequence rule class, empty when the config is unreachable.
 *
 * The class is `road-to-rule-laws-that-can-stand`'s, read from the file that
 * roadmap's step 2.1 produced — never re-derived here. An unreachable config
 * degrades to "no rule is high-consequence", which costs those rules their
 * guaranteed slot in the order and never costs anyone a delivery.
 */
function highConsequenceIds(root: string): Set<string> {
    for (const r of [root, ruleSources(root).pkg]) {
        if (r === null) continue;
        try {
            return new Set(Object.keys(readConsequenceClass(r).members));
        } catch {
            continue;
        }
    }
    return new Set();
}

/** The manifest block, which is part of the budgeted string rather than beside it. */
function manifestText(rows: Array<[string, DeliveryForm]>): string {
    return `<rule-manifest>\n${rows.map(([id, f]) => `${id}=${f}`).join('\n')}\n</rule-manifest>`;
}

/**
 * Compose one fire under {@link COMPOSED_CHARS}, in the order D1 fixes.
 *
 * THE ORDER IS A DECISION, not an implementation detail. D1:
 *
 *   1. the law of every matched HIGH-CONSEQUENCE rule,
 *   2. then the highest-priority full body that fits,
 *   3. then further full bodies,
 *   4. then the law of everything still unsent,
 *   5. then the manifest.
 *
 * Phase 1 first because a high-consequence rule's law arriving is worth more
 * than a lower-consequence rule's whole body, and a budget that filled in
 * priority order alone would spend itself before reaching it.
 *
 * NOTHING IS EVER TRUNCATED. A rule whose law alone does not fit is REPORTED —
 * `omitted_budget` in the manifest — because half an obligation reads like a
 * whole one and is the more dangerous output. The manifest's space is reserved
 * BEFORE any text is admitted, using the longest label for every matched id, so
 * the report can never be the thing that pushes the string over.
 *
 * `sel.dropped` is read here, and that is the point of the step as much as the
 * budget is: before this, a body dropped by the byte cap left no trace at all,
 * so a consumer could not tell a rule that did not match from one that matched
 * and was silently discarded.
 */
function compose(
    root: string,
    sel: SelectionResult,
    hi: Set<string>,
    lawOnly = false,
): Injection | null {
    const form = new Map<string, DeliveryForm>();
    const full = new Map<string, string>();
    for (const m of sel.dropped) {
        form.set(m.id, (sel.bodyBytes.get(m.id) ?? 0) === 0 ? 'source_unavailable' : 'omitted_budget');
    }
    for (const m of sel.selected) {
        const raw = loadRuleBody(root, m.id);
        // STEP 1.4 — the host form, by the parser the thin projector uses.
        // `ruleBody` strips frontmatter and HTML comments: the first is the
        // routing surface the router already read, the second is authoring
        // scaffolding no host renders to a model. A file with nothing left after
        // the strip carries no obligation — an empty `<rule>` element is framing
        // with no content inside it.
        const body = raw === null ? '' : ruleBody(raw);
        if (body === '') {
            form.set(m.id, 'source_unavailable');
            continue;
        }
        form.set(m.id, 'omitted_budget');
        full.set(m.id, body);
    }

    const all = [...sel.selected, ...sel.dropped].sort((a, b) => a.order - b.order);
    const tiers = new Map(all.map((m) => [m.id, m.tier]));
    let left =
        COMPOSED_CHARS - manifestText(all.map((m) => [m.id, 'source_unavailable'])).length - 2;
    const parts: string[] = [];
    const ids: string[] = [];
    let bytesLeft = CAP_BYTES;
    const add = (id: string, kind: 'full' | 'law', text: string): boolean => {
        const part = `<rule id="${id}" tier="${tiers.get(id) ?? ''}" form="${kind}">\n${text}\n</rule>`;
        const cost = part.length + (parts.length === 0 ? 0 : 2);
        // BOTH UNITS, INDEPENDENTLY. The measured 1.0346 bytes-per-character
        // maximum over today's corpus says the character budget binds first, and
        // a measurement over one corpus is evidence rather than an invariant: an
        // 8,000-character payload of 4-byte code points is 32,000 bytes. Safety
        // that rests on a ratio stops being safety the day the corpus changes,
        // so the registered byte row is enforced here too and the ratio is what
        // makes the second check almost never bind rather than what makes it
        // unnecessary.
        const costBytes = bytesOf(part) + (parts.length === 0 ? 0 : 2);
        if (cost > left || costBytes > bytesLeft) return false;
        bytesLeft -= costBytes;
        left -= cost;
        parts.push(part);
        ids.push(id);
        form.set(id, kind);
        return true;
    };

    const ranked = [...sel.selected].sort((a, b) => b.score - a.score || a.order - b.order);
    for (const m of ranked) {
        const body = full.get(m.id);
        if (body === undefined || !hi.has(m.id)) continue;
        const law = lawText(body);
        // A class member with no law section cannot be served by phase 1. It is
        // left to compete for a full body below rather than reported, which is
        // `no_stub`'s own answer to the same state.
        if (law !== null) add(m.id, 'law', law);
    }
    for (const m of lawOnly ? [] : ranked) {
        const body = full.get(m.id);
        if (body === undefined || form.get(m.id) !== 'omitted_budget') continue;
        add(m.id, 'full', body);
    }
    for (const m of ranked) {
        const body = full.get(m.id);
        if (body === undefined || form.get(m.id) !== 'omitted_budget') continue;
        const law = lawText(body);
        if (law !== null) add(m.id, 'law', law);
    }

    const rows: Array<[string, DeliveryForm]> = all.map((m) => [
        m.id,
        form.get(m.id) ?? 'source_unavailable',
    ]);
    parts.push(manifestText(rows));
    const body = parts.join('\n\n');
    return { rules: ids, bytes: bytesOf(body), body, manifest: rows };
}

/**
 * Build the post-compaction restore, or `null` for silence (step 1.6).
 *
 * LAWS, NOT BODIES, and the asymmetry with a normal fire is the point. A
 * compaction removed text the model was already under; re-sending every body
 * would re-spend the whole budget on rules whose obligations the session may
 * never touch again. The law is the part that cannot be inferred from the rest,
 * so it is what the budget buys back. Everything that does not fit is reported
 * in the same manifest as any other fire.
 *
 * The router supplies each id's tier and declaration order, because the
 * seen-set deliberately carries neither — see {@link SeenState.pending}.
 */
function restore(root: string, ids: Set<string>): Injection | null {
    if (ids.size === 0) return null;
    let router;
    try {
        router = loadRouter(root);
    } catch {
        return null;
    }
    const selected: TierRuleMatch[] = [];
    let order = 0;
    for (const r of allTierRules(router)) {
        if (ids.has(r.id)) selected.push({ id: r.id, tier: r.tier, score: 0, order });
        order += 1;
    }
    if (selected.length === 0) return null;
    return compose(
        root,
        { selected, dropped: [], bytes: 0, bodyBytes: new Map() },
        new Set(selected.map((m) => m.id)),
        true,
    );
}

/**
 * Build the injection for one event, or `null` for silence.
 *
 * `prompt` drives keyword / phrase / command triggers; `openFiles` drives
 * `path_prefix` / `file_pattern`. On the tool slot the prompt is deliberately
 * empty, so a file event can only ever fire a path trigger — a tool call is not
 * a restatement of the user's request and must not re-fire keyword rules.
 */
export function buildInjection(
    root: string,
    prompt: string,
    openFiles: string[] | null,
    command: string | null,
    seen: Set<string>,
): Injection | null {
    let router;
    try {
        router = loadRouter(root);
    } catch {
        return null; // no router — nothing to deliver, and never a failure
    }
    // STEP 1.3 — the install declares the scope, the package supplies the text.
    //
    // The router is the PACKAGE's list of every rule that could route. What a
    // given consumer is actually under is what their install wrote into the
    // host's rule directories, and the two are not the same set: 13 router tier
    // rules are maintainer-only by `workspaces`, and before this filter a
    // consumer could receive a body for a rule their install never carried.
    //
    // The two halves cannot be one read, and that is the reason this is a
    // filter rather than a different body source. In `delivery` mode the
    // installed files are thin stubs by construction, so the installed layer can
    // say WHICH rules are in scope and never WHAT they say; the body still comes
    // from the package corpus `ruleSources` resolves.
    //
    // `null` means no host rule layer exists to declare a scope — see
    // `hostRuleLayerIds`. No filter then, because scoping to an empty set would
    // re-create the silence step 1.1 repaired.
    const scope = hostRuleLayerIds(root);
    const matches = matchTierRules(router, prompt, openFiles, command).filter(
        (m) => !seen.has(m.id) && (scope === null || scope.has(m.id)),
    );
    if (matches.length === 0) return null;
    const sel = selectForInjection(root, matches, CAP_BYTES);
    return compose(root, sel, highConsequenceIds(root));
}

// ── main ─────────────────────────────────────────────────────────────────

/**
 * The one host this concern is bound on.
 *
 * The manifest binds `rule-inject` under `claude` alone, so the host axis
 * `gateOpen` has to consult is a constant here rather than something read off
 * the envelope — the envelope carries no host id, and inventing one from the
 * process environment would be a guess where the manifest is a fact.
 */
export const DELIVERY_HOST = 'claude-code';

/**
 * Whether the settings gate applies.
 *
 * BOTH AXES, because the projector reads both. Until 2026-09-08 this keyed on
 * `lean_projection.mode` alone while `condense` gates stub-writing on
 * `thinsHost(mode, hosts, host)` (R2 finding 5). The two disagreed in exactly
 * the states the host axis exists for: `mode: delivery` with a `hosts:` list
 * that does not resolve to `claude-code` — the documented "thin no host"
 * state, which a fully typo'd list also produces — left this host with a
 * FULL-BODIED tree while the hook kept injecting on a match, so every matched
 * rule was delivered twice. `hosts: [cursor]` was the same defect with a
 * second half: cursor received stubs with no bound slot to deliver them back.
 *
 * `deliversBodies` is checked separately from the host list rather than via
 * `thinsHost`, which is true for `thin` as well: `thin` writes the same stubs
 * and binds NO delivery concern, so it must never open this gate.
 *
 * An explicit `hooks.rule_inject` opt-in still opens it — that is an operator
 * asking for the concern by name, independent of the projection mode. A DIRECT
 * CLI invocation is a probe by definition — an operator piping an envelope into
 * this file is asking to see what it would deliver — so there the gate defaults
 * to open. `AGENT_CONFIG_REPLAY` re-imposes it, which is what keeps
 * `bench_hook_injection` measuring the configured tree rather than the probe.
 */
export function gateOpen(root: string, cliEntry: boolean, packageRoot?: string | null): boolean {
    // ONE resolver since step 1.2 — the full cascade (template base, canonical
    // `agents/settings/`, project root, user-global), not the legacy root file
    // this concern used to read alone. `packageRoot` is where the template is
    // found; inside the bundle nothing else can locate it.
    const { mode, hosts } = resolveLeanProjection({
        projectRoot: root,
        packageRoot: packageRoot ?? null,
    });
    if (deliversBodies(mode) && hosts.hosts.includes(DELIVERY_HOST)) return true;
    if (hookSectionEnabled(root, 'rule_inject')) return true;
    return cliEntry && process.env['AGENT_CONFIG_REPLAY'] !== '1';
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let eventOverride: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--event') {
            i += 1;
            eventOverride = argv[i] ?? null;
        }
    }

    let env: JsonObject = {};
    try {
        const raw = readHookStdin();
        const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : {};
        env = isObject(parsed) ? parsed : {};
    } catch {
        return EXIT_ALLOW; // malformed envelope — never block
    }

    const root = workspaceRoot(env);
    const payload = isObject(env['payload']) ? (env['payload'] as JsonObject) : env;
    const slot = eventOverride ?? str(env, 'event') ?? 'user_prompt_submit';
    const session = str(env, 'session_id', 'sessionId') ?? str(payload, 'session_id', 'sessionId') ?? 'unknown';

    if (slot === 'pre_compact') {
        armRestore(root, session);
        return EXIT_ALLOW; // re-arm is silent; the restore happens on the next slot
    }
    if (slot === 'session_start') {
        // ONLY on `source: compact`. `startup`, `resume`, `clear` and `fork`
        // either begin a session that never had a seen-set or hand back a
        // transcript the host already restored; emitting there would be a
        // duplicate, and on `fork` a duplicate belonging to a session that is
        // still alive. An unknown source emits nothing rather than guessing —
        // the same stance `handoff-context`'s `sourceGate` takes.
        if ((str(payload, 'source') ?? str(env, 'source')) !== 'compact') return EXIT_ALLOW;
        if (!gateOpen(root, _isCliEntry(), ruleSources(root).pkg)) return EXIT_ALLOW;
        // Taken, not read: a restore that fires twice on one boundary is a
        // duplicate delivery, and the second one costs the budget again.
        const restored = restore(root, takePending(root, session));
        if (restored === null) return EXIT_ALLOW;
        recordDelivered(root, session, restored.rules);
        return emit(restored, slot);
    }
    if (slot !== 'user_prompt_submit' && slot !== 'pre_tool_use') return EXIT_ALLOW;

    // Resolved ONCE, before the gate. The gate needs the package root to find
    // the settings template and the delivery needs it to find the corpus;
    // reading the environment and probing the filesystem twice for the same
    // answer is a cost every hook dispatch on every slot would pay.
    const src = ruleSources(root);
    if (!gateOpen(root, _isCliEntry(), src.pkg)) return EXIT_ALLOW;

    let prompt = '';
    let openFiles: string[] | null = null;
    let command: string | null = null;
    if (slot === 'user_prompt_submit') {
        prompt = extractPrompt(payload);
        if (prompt === '') return EXIT_ALLOW;
        const m = /^\s*(\/[A-Za-z0-9:_-]+)/.exec(prompt);
        command = m ? (m[1] as string) : null;
    } else {
        const tool = str(payload, 'tool_name', 'toolName', 'tool');
        if (tool === null || !FILE_TOOLS.has(tool)) return EXIT_ALLOW;
        const fp = extractFilePath(payload);
        if (fp === null) return EXIT_ALLOW;
        openFiles = [fp];
    }

    // Fail CLOSED and SAY SO. An empty delivery is indistinguishable from "no
    // rule matched", which is the exact silence this concern shipped with; one
    // line on stderr — which the dispatcher captures — is what makes a broken
    // install diagnosable from outside this file. Still allow: a carrier that
    // cannot find its corpus must not fail a turn.
    if (src.gap !== null) {
        // Fail CLOSED and SAY SO, through the channel the dispatcher actually
        // surfaces. Writing to stderr looks right and is not: `_run_concern_inproc`
        // captures a concern's stderr and `dispatch_hook` re-emits it only at
        // rc >= 3 (a crash), so a concern exiting allow is silent by
        // construction — which is the exact failure this diagnostic exists to
        // end, reproduced one layer up. Found by the 1.8 matrix against the
        // built bundle; no in-process fixture could have seen it.
        //
        // WHERE IT ACTUALLY LANDS, measured against the built bundle rather
        // than assumed: on Claude Code `emitFor` translates an advisory warn on
        // this slot into `hookSpecificOutput.additionalContext` at exit 0, so
        // this line reaches the MODEL, not the operator's terminal. That is the
        // host's translation and not a choice available here — `reason` alone
        // has no terminal-facing path on this slot.
        //
        // It is the right place anyway: the agent is what the user is talking
        // to, so an agent told its rule corpus is missing can say so. The cost
        // is one short line per turn for as long as the install stays broken,
        // which is bounded and deliberate. Bounding it further — once per
        // session, via the seen-set — needs a state write this concern cannot
        // currently afford (`src/config/hook-bundle-budget.json` left 30 bytes
        // of headroom at this commit), and is recorded in the roadmap rather
        // than silently skipped.
        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: src.gap })}\n`);
        return EXIT_WARN;
    }

    const seen = readSeen(root, session);
    const injection = buildInjection(root, prompt, openFiles, command, seen);
    if (injection === null) return EXIT_ALLOW; // silence is the default

    for (const id of injection.rules) seen.add(id);
    writeSeen(root, session, seen);
    recordDelivered(root, session, injection.rules);

    return emit(injection, slot);
}

/** The one place a delivery reaches the host, shared by the fire and the restore. */
function emit(injection: Injection, slot: string): number {
    process.stdout.write(
        `${JSON.stringify({
            decision: 'warn',
            reason: `rule-inject: ${injection.rules.length}/${injection.manifest.length} matched rule(s) sent on ${slot} (${injection.body.length} chars)`,
            additional_context: injection.body,
        })}\n`,
    );
    return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
