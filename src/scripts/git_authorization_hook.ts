#!/usr/bin/env node
/**
 * Git-authorization ledger — `user_prompt_submit` concern.
 *
 * Records which git operations the user's OWN WORDS authorize this turn, so
 * `hooks/block_unauthorized_git.ts` can check an operation against a fact
 * instead of against the model's recollection of the conversation.
 *
 * WHY — the measured defect (30-session conformance audit, 2026-08-06):
 *
 *   - A full release chain (prod-trunk merge, tag push, GitHub release, npm
 *     publish) executed after the agent itself wrote "das ist ein Hard-Floor-
 *     Schritt, dafür brauche ich Dein explizites Go" and never received one —
 *     the user's next turn was a pasted `git push … rejected` stack trace,
 *     which was read as implicit continuation.
 *   - Two complete PRs opened on turns carrying no git authorization at all.
 *   - Force-push over a bot's commits off a bare "fixe auch diese 4 pr's".
 *   - Twice the constraint was named in writing and contradicted minutes later.
 *
 * `commit-policy` and `scope-control` already forbid all of this in prose, and
 * the prose was in context every time. The ledger is the missing fact, not a
 * new obligation.
 *
 * State: `agents/state/git-authorization.json`
 *   { "session_id": str, "detected_at": iso8601, "authorized": [op, …],
 *     "evidence": { op: "phrase" }, "prompt_chars": int }
 *
 * Each user turn REPLACES `authorized` — that is the point. `commit-policy`'s
 * "one-shot authorization is not a standing license" says an authorization is
 * spent on the operation it named; carrying it forward is the exact inference
 * the rule forbids, so a new prompt with no authorization phrase yields an
 * empty `authorized` list rather than an inherited one.
 *
 * **`grants` are the one exception, and they are narrower, not broader**
 * (ADR-252, 2026-09-03). A bare operation name says *the user wants a merge*;
 * a grant says *the user wants THESE pull requests merged*, with the numbers
 * frozen from the user's own sentence at mint time and each spent on first use.
 * Because the objects are fixed, elapsed time is no longer what protects the
 * user — target identity is — so a grant survives later turns and carries no
 * clock, while everything without frozen objects keeps both the replacement
 * rule above and the guard's 30-minute freshness bound.
 *
 * The measured defect this fixes: a neutral follow-up ("weiter", "fix the CI")
 * replaced the whole ledger and silently erased a merge authorization the user
 * had given two turns earlier, so a multi-PR run the user explicitly ordered
 * became unexecutable without re-typing the order every 30 minutes. Two
 * hand-widenings of the guard's clock (2026-08-21, 2026-08-30) are what that
 * pressure produced instead.
 *
 * Never blocks. Exit 0 always. The blocking half lives in the pre_tool_use
 * concern, which is where the operation is actually observable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { humanTypedThisTurn as _humanTypedThisTurn } from "./_lib/machine_wake.js";

import { atomic_write_json } from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";

const EXIT_ALLOW = 0;

/**
 * Legacy single-file ledger path — one file for the whole project root.
 *
 * Kept for direct invocations and for reading a ledger written by an older
 * build, NOT as the write target when a session id is known. See
 * `ledgerFileFor` for why one shared file was the defect.
 */
export const STATE_FILE = path.join("agents", "state", "git-authorization.json");

/** Per-session ledger directory. */
export const STATE_DIR = path.join("agents", "state", "git-authorization");

/** Per-session pending-refusal directory. */
export const PENDING_DIR = path.join("agents", "state", "git-authorization-pending");

/**
 * A session id reduced to a safe path component.
 *
 * The id reaches this from the host's envelope, so it is untrusted input on a
 * path — `..` or a separator in it would place the ledger outside the state
 * directory. Anything outside the allowed set collapses to `_`.
 */
export function sessionSlug(session_id: string): string {
    return session_id.replace(/[^A-Za-z0-9._-]/gu, "_").slice(0, 80);
}

/**
 * Where THIS session's ledger lives.
 *
 * MEASURED DEFECT (2026-08-18, during the 14.0.0 release): the ledger was a
 * single file per project root, so every prompt from every concurrent session
 * in the repo overwrote it. A second session typed an 11-character prompt
 * between the user's `merge den pr` and the guard's read; the guard found a
 * foreign session id, discarded the ledger as another conversation's consent,
 * and refused. The refusal then said "no authorization in this turn's prompt",
 * which was false and unfalsifiable from the message alone — the authorization
 * had existed and been clobbered. Three consecutive refusals, and the user
 * re-authorized each time.
 *
 * This repo runs dozens of worktrees against one root, so the race is not an
 * edge case there; it is the normal condition. Scoping the file by session is
 * what makes "this turn's prompt" mean this conversation's turn.
 */
export function ledgerFileFor(session_id: string): string {
    if (!session_id) {
        return STATE_FILE;
    }
    return path.join(STATE_DIR, `${sessionSlug(session_id)}.json`);
}

/** Where THIS session's refused-operation record lives. */
export function pendingFileFor(session_id: string): string {
    if (!session_id) {
        return PENDING_FILE;
    }
    return path.join(PENDING_DIR, `${sessionSlug(session_id)}.json`);
}

/**
 * One refused irreversible operation, waiting for the answer to the question
 * the guard just told the agent to ask.
 *
 * WHY THIS FILE EXISTS — the measured deadlock (2026-08-18, 14.0.0 release):
 * `user-interaction` requires a decision to be handed to the user as a
 * NUMBERED-OPTIONS block, and the answer to one is a bare `1`. The classifier
 * below reads the prompt in isolation, and `1` carries no operation, so the
 * user's consent was real, visible, and unrecordable. The release deadlocked
 * for three turns: the guard refused, the agent asked as instructed, the user
 * answered, and the next attempt refused identically. Two mechanisms this repo
 * mandates were structurally incompatible on exactly the irreversible subset.
 *
 * The fix is deliberately the narrowest thing that resolves it. Widening the
 * prose list with bare affirmatives was rejected: `ja` would then authorize
 * `npm publish` on any turn, which is reach, not severity. Instead the guard
 * records WHICH op it refused, and only that one op can be confirmed, once, by
 * the immediately following prompt. Everything the user is consenting to has
 * already been named to them in the refusal they just read.
 */
export const PENDING_FILE = path.join("agents", "state", "git-authorization-pending.json");

/** A refused operation carried to exactly one following prompt. */
export interface PendingRefusal {
    op: GitOp;
    session_id: string;
    refused_at: string;
}

/**
 * The window in which a refusal is still the thing the user is answering.
 *
 * Short on purpose: this is "the user read the refusal and replied", not "the
 * user said yes to something at some point today". A stale record expires into
 * the same not-authorized state the guard starts from.
 */
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The operations the ledger can authorize. */
export type GitOp =
  | "commit"
  | "push"
  | "branch"
  | "pr-create"
  | "pr-merge"
  /**
   * Enabling auto-merge. Its OWN op, not a plain merge and not nothing.
   *
   * Irreversible in the same sense a merge is: it commits the outcome to a
   * condition the agent does not control, and the merge then happens with
   * nobody in the loop. Before this split, `gh pr merge --auto` classified
   * identically to a plain merge (the pattern is `\bgh\s+pr\s+merge\b`, and
   * `--auto` is invisible to it), and the GraphQL mutation classified as
   * NOTHING — `ghApiWrite()` needs a REST path and a write method, and
   * `gh api graphql -f query='mutation{enablePullRequestAutoMerge...}'` has
   * neither.
   */
  | "pr-merge-auto"
  | "tag"
  | "release"
  | "publish"
  // ── Added 2026-09-03. Measured gap, not a speculative widening: of 25
  // borderline-destructive operations probed against `commandOp`, 17 classified
  // as NOTHING — the guard was sharp on five spellings and silent on the rest,
  // including three that are strictly worse than the ones it caught (deleting
  // branch protection, approving a review that releases an armed auto-merge,
  // and unpublishing a package every lockfile already resolved).
  //
  // Each entry below is an operation the `non-destructive-by-default` Hard
  // Floor already declares never-autonomous in prose. Naming them here makes an
  // existing prohibition mechanical; it does not create a new one.
  /** `npm unpublish` — the "undo" that breaks every lockfile resolving it. */
  | "unpublish"
  /** `npm deprecate` — no code changes, and every install in the world warns. */
  | "deprecate"
  /** Replacing or removing a published release asset consumers checksummed. */
  | "release-asset"
  /** Removing a branch protection rule or ruleset — deletes the guard itself. */
  | "protection"
  /** Disabling a workflow — no data lost, and the gate below it is gone. */
  | "workflow-toggle"
  /** Archiving, deleting or re-visibility-ing a repository. */
  | "repo-lifecycle"
  /** Approving a review — no code moves, and a required-review gate opens. */
  | "review-approve"
  /** Force-push — discards commits that arrived after your last fetch. */
  | "force-push"
  /** `git worktree remove --force` — destroys work a parallel session holds. */
  | "worktree-remove"
  /** `git clean -x` — takes `.env` and local certificates with the scratch. */
  | "clean-ignored"
  /** Moving an existing tag locally; the push that publishes it is `tag`. */
  | "tag-force"
  /** Rebase — local until pushed, then a history rewrite for everyone. */
  | "rebase"
  /** `git reset --hard` — uncommitted work does not reach the reflog. */
  | "reset-hard"
  /** `git clean` without `-x` — untracked only, ignored files survive. */
  | "clean"
  /** Dropping or clearing a stash. */
  | "stash-drop"
  /** Deleting a branch, locally or on the remote. */
  | "branch-delete"
  /** Closing a pull request or an issue. */
  | "close";

export const ALL_OPS: readonly GitOp[] = [
  "commit",
  "push",
  "branch",
  "pr-create",
  "pr-merge",
  "pr-merge-auto",
  "tag",
  "release",
  "publish",
  "unpublish",
  "deprecate",
  "release-asset",
  "protection",
  "workflow-toggle",
  "repo-lifecycle",
  "review-approve",
  "force-push",
  "worktree-remove",
  "clean-ignored",
  "tag-force",
  "rebase",
  "reset-hard",
  "clean",
  "stash-drop",
  "branch-delete",
  "close",
];

/**
 * Prose phrases, German and English, that authorize an operation.
 *
 * Deliberately a keyword list rather than an LLM judge: the classifier runs on
 * every prompt and must be cheap, deterministic and reviewable. A miss costs a
 * warn (or, on the irreversible subset, one confirmation); an LLM judge would
 * cost latency on every turn and be unauditable.
 */
const PHRASES: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "commit", re: /\b(commit(e|et|te|ten)?|committe|einchecken)\b/i },
  { op: "push", re: /\b(push(e|en|t)?|hochladen|hochschieben|raufschieben)\b/i },
  // A CREATION VERB IS REQUIRED, as for `pr-create` above and for the same
  // reason. The bare noun could not tell an authorization from a mention, and
  // the mention is the dangerous half: "den branch nicht löschen" names the
  // object precisely in order to forbid acting on it, yet authorized branch
  // creation — the negation trails a bare-noun match, so neither the
  // look-behind nor the span check in `negatedBefore` can reach it. Widened
  // 2026-09-03 alongside the destructive-coverage work that measured it.
  {
    op: "branch",
    re: /\b(erstell(e|en)?|mach(e|en)?|leg(e|en)?\s+an|anleg(e|en)?|(er|be)?(ö|oe)ffne|open|create|new|neuer?|starte?|checkout|wechsl?e|switch)\b[^.\n]{0,30}\b(branch|feature-branch|zweig)\b|\b(branch|feature-branch|zweig)\b[^.\n]{0,25}\b(erstellen|anlegen|aufmachen|(ö|oe)ffnen|starten)\b/i,
  },
  // A creation verb is required — "schau dir den PR an" is not "open a PR".
  {
    op: "pr-create",
    re: /\b(erstell(e|en)?|mach(e|en)?|leg(e|en)?\s+an|(er)?(ö|oe)ffne|open|create|raise|aufmachen)\b[^.\n]{0,30}\b(pr|pull[- ]request)\b|\b(pr|pull[- ]request)\b[^.\n]{0,20}\b(erstellen|aufmachen|anlegen|(er)?(ö|oe)ffnen)\b/i,
  },
  // `merge` as an ACTION, never as the noun in "merge conflict" / "merge commit",
  // and never under a NEGATION.
  //
  // The negation half closes a measured defect: probed directly against
  // `classifyAuthorization`, "nicht mergen", "don't merge this" and
  // "never auto-merge" each returned ["pr-merge"] — a prompt saying DO NOT
  // MERGE authorized a merge. The noun-sense lookahead was never a negator.
  //
  // The lookBEHIND is line-scoped by `[^.!?\n]` on purpose, the same scoping
  // `turn_end_gate_hook.ts` uses for its own negation exclusion (`:330`) and
  // its negated-claim window (`:490-493`). A sentence boundary ends a
  // negation's reach: "Do not push. Merge PR #12." is two instructions, and a
  // guard that let the first suppress the second would silently stop
  // authorizing merges the user DID order — the failure mode that is worse
  // than the defect, because nothing happens and nothing says why.
  //
  // Reusing that vocabulary rather than inventing a third is deliberate: two
  // negation vocabularies in one tree drift, and the drift is invisible until
  // a prompt lands in the gap between them.
  {
    op: "pr-merge",
    re: /(?<!\b(nicht|nichts|kein(e|en|em|er|es)?|niemals|nie|no|not|dont|don't|never|without|ohne)\b[^.!?\n]{0,30})\b(merge|merg(e|en|st|t)|zusammenf(ü|ue)hren|reinmergen)\b(?!\s*[- ]?(conflict|konflikt|commit|base|queue|state|status))/i,
  },
  // A tag is an ACTION here — bare "Tag" is the German word for day, and
  // "Version" is an ordinary noun. Both authorized a BLOCK op before this.
  { op: "tag", re: /\b(tagge(n|st)?|tag\s+(setzen|anlegen|erstellen)|git\s+tag|--tags|--follow-tags)\b/i },
  // "die release notes sind falsch" is a noun phrase, not an authorization.
  {
    op: "release",
    re: /\b(releasen?|ver(ö|oe)ffentlich(e|en))\b(?!\s*[- ]?(notes?|branch|candidate|pr\b|datum|date|zweig))/i,
  },
  { op: "publish", re: /\b(publish(e|en)?|publiziere[n]?)\b/i },

  // ── Authorization vocabulary for the ops added 2026-09-03.
  //
  // NON-NEGOTIABLE, and the reason it ships in the same change as the new BLOCK
  // ops: a blocked operation with no phrase that authorizes it is a dead end.
  // The guard refuses, the user says "doch, mach das", the classifier records
  // nothing, and the refusal repeats forever. Every op the guard can block must
  // have a sentence that unblocks it, or the user's override is a claim rather
  // than a mechanism.
  //
  // Tight on purpose. Under-matching costs one confirmation; over-matching
  // authorizes something the user did not ask for, so each pattern demands the
  // object noun rather than a bare verb wherever the verb is ordinary German.
  //
  // `unpublish` before nothing in particular — `\bpublish\b` does not match
  // inside "unpublish" (no word boundary between `n` and `p`), so the two never
  // collide.
  // TWO SHAPES EVERY GERMAN PATTERN BELOW MUST CARRY, both learned from tests
  // that went red rather than from inspection:
  //
  //   1. THE IMPERATIVE DROPS ITS `-e`. "entfern die worktree", "archivier das
  //      repo", "deaktivier den workflow" are what people type; `entfern(e|en)`
  //      matches none of them. Every verb ending is therefore `(e|en)?`.
  //   2. WORD ORDER GOES BOTH WAYS. "archivier das repo" and "das repo
  //      archivieren" are one instruction, and a pattern anchored on the noun
  //      first sees only the second.
  //
  // The object noun stays REQUIRED in every pattern that has one. That is what
  // keeps the loosened verb endings from over-authorizing: "lösch" alone
  // authorizes nothing, "lösch den branch" authorizes a branch deletion.
  { op: "unpublish", re: /\bunpublish(e|en)?\b/i },
  {
    op: "deprecate",
    re: /\bdeprecate(d|n)?\b|\bals\s+veraltet\s+markier(e|en)?\b/i,
  },
  {
    op: "release-asset",
    re: /\brelease[-\s]?asset\b|\b(clobber|(ü|ue)berschreib(e|en)?|ersetz(e|en)?|replace|austausch(e|en)?)\b[^.\n]{0,25}\b(asset|artefakt|artifact|tarball|binary)\b|\b(asset|artefakt|artifact)\b[^.\n]{0,25}\b((ü|ue)berschreiben|ersetzen|austauschen|replace)\b/i,
  },
  // A VERB IS REQUIRED, like `tag` and `release` above and for the same reason.
  // A bare noun cannot tell an authorization from a mention, and here the
  // mention is the dangerous half: "die branch-protection nicht anfassen" names
  // the object precisely in order to forbid touching it. Measured — this was the
  // one row of the negation corpus that neither the look-behind nor the
  // span check could reach, because the negation trails a bare-noun match.
  {
    op: "protection",
    re: /\b(entfern(e|en)?|l(ö|oe)sch(e|en)?|deaktivier(e|en)?|nimm|weg|remove|delete|disable|drop|lift)\b[^.\n]{0,30}\b(branch[-\s]?protection|protection[-\s]?rule|schutzregel|ruleset)\b|\b(branch[-\s]?protection|protection[-\s]?rule|schutzregel|ruleset)\b[^.\n]{0,30}\b(entfernen|l(ö|oe)schen|deaktivieren|abschalten|remove|delete|disable|drop|lift|weg)\b/i,
  },
  {
    op: "workflow-toggle",
    re: /\bworkflow\b[^.\n]{0,25}\b(deaktivier(e|en)?|aktivier(e|en)?|disable|enable|abschalt(e|en)?|ausschalt(e|en)?)\b|\b(deaktivier(e|en)?|aktivier(e|en)?|disable|enable|abschalt(e|en)?|ausschalt(e|en)?)\b[^.\n]{0,25}\bworkflow\b/i,
  },
  {
    op: "repo-lifecycle",
    re: /\b(repo|repository)\b[^.\n]{0,30}\b(archivier(e|en)?|archive|l(ö|oe)sch(e|en)?|delete)\b|\b(archivier(e|en)?|archive|l(ö|oe)sch(e|en)?|delete)\b[^.\n]{0,25}\b(repo|repository)\b|\b(repo|repository)\b[^.\n]{0,30}\bauf\s+(privat|public|öffentlich|private)\b/i,
  },
  {
    op: "review-approve",
    re: /\b(approve|genehmig(e|en)?|freigeb(e|en)?|abnehm(e|en)?)\b[^.\n]{0,30}\b(review|pr|pull[-\s]request)\b|\b(review|pr|pull[-\s]request)\b[^.\n]{0,20}\b(approve|approven|genehmigen|freigeben)\b/i,
  },
  {
    op: "force-push",
    re: /\bforce[-\s]?push(e|en|st)?\b|--force(-with-lease)?\b|\bmit\s+gewalt\s+push(e|en)?\b/i,
  },
  {
    op: "worktree-remove",
    re: /\bworktree\b[^.\n]{0,25}\b(entfern(e|en)?|l(ö|oe)sch(e|en)?|remove|delete|weg(werfen|r(ä|ae)umen))\b|\b(entfern(e|en)?|l(ö|oe)sch(e|en)?|remove|delete)\b[^.\n]{0,25}\bworktree\b/i,
  },
  // The `-x` flag is the whole distinction: without it `git clean` spares
  // ignored files, with it `.env` and local certificates go too.
  {
    op: "clean-ignored",
    re: /\bgit\s+clean\b[^.\n]{0,20}-[A-Za-z]*x|\b(ignorierte|ignored)\b[^.\n]{0,25}\b(dateien|files)\b[^.\n]{0,25}\b(l(ö|oe)sch(e|en)?|entfern(e|en)?|remove|delete)\b/i,
  },
  {
    op: "tag-force",
    re: /\btag\b[^.\n]{0,25}\b(verschieb(e|en)?|(ü|ue)berschreib(e|en)?|umh(ä|ae)ng(e|en)?|force|move)\b|\b(verschieb(e|en)?|(ü|ue)berschreib(e|en)?)\b[^.\n]{0,20}\btag\b/i,
  },
  { op: "rebase", re: /\brebase(n|st|d)?\b/i },
  {
    op: "reset-hard",
    re: /\breset\s+--hard\b|\bhard\s+reset\b|\bhart\s+zur(ü|ue)cksetz(e|en)?\b/i,
  },
  { op: "clean", re: /\bgit\s+clean\b/i },
  {
    op: "stash-drop",
    re: /\bstash\b[^.\n]{0,25}\b(drop|clear|verwerf(e|en)?|l(ö|oe)sch(e|en)?)\b|\b(verwerf(e|en)?|l(ö|oe)sch(e|en)?|drop)\b[^.\n]{0,20}\bstash\b/i,
  },
  {
    op: "branch-delete",
    re: /\b(l(ö|oe)sch(e|en)?|entfern(e|en)?|delete|remove)\b[^.\n]{0,25}\b(branch|branches|zweig)\b|\b(branch|branches|zweig)\b[^.\n]{0,25}\b(l(ö|oe)schen|entfernen|delete|remove)\b/i,
  },
  {
    op: "close",
    re: /\b(schlie(ß|ss)(e|en)?|close)\b[^.\n]{0,30}\b(pr|pull[-\s]request|issue|ticket)\b|\b(pr|pull[-\s]request|issue|ticket)\b[^.\n]{0,20}\b(schlie(ß|ss)en|close)\b/i,
  },
  // Enabling auto-merge is its own op on the guard side, so it needs its own
  // sentence. Without one it is the dead end this block exists to prevent: the
  // plain merge phrase authorizes `pr-merge` and never `pr-merge-auto`, so the
  // refusal would have repeated forever.
  {
    op: "pr-merge-auto",
    re: /\bauto[-\s]?merge\b|\bmerge\b[^.\n]{0,20}\bautomatisch\b|\bautomatisch\b[^.\n]{0,20}\bmerg(e|en)\b/i,
  },
];

/**
 * Lines that are pasted TOOL OUTPUT rather than the user instructing.
 *
 * Round-2 adversarial review: an UNFENCED paste of a `git push … rejected`
 * trace authorized `push` through the prose matcher — i.e. the gate
 * pre-authorized the exact scenario it was built to stop. Fenced pastes were
 * already handled; prose was not.
 */
const OUTPUT_LINE =
  /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|!\s|\?\?\s|\s*\^|[-+]{3}\s|@@\s|\$\s|>\s|\d+\s+(pass|fail)|npm ERR!|Error:|Traceback|at\s+\S+:\d+)/i;

/**
 * A prompt that ASKS about an operation does not authorize it.
 *
 * `question-not-instruction` states this for the agent; the ledger needs it
 * too. "was macht npm publish eigentlich genau?" authorized a real publish
 * before this check.
 */
export function isInterrogative(prose: string): boolean {
  const t = prose.trim();
  if (!t) {
    return false;
  }
  const hasImperative =
    /\b(mach|mache|bitte|leg|lege|erstell|erstelle|f(ü|ue)hr|f(ü|ue)hre|setz|setze|starte|los|jetzt|go ahead|do it|ja[,.]?\s|ok[,.]?\s)\b/i.test(
      t,
    );
  if (hasImperative) {
    return false;
  }
  return (
    /\?\s*$/.test(t) ||
    /^(was|wie|warum|wieso|weshalb|wann|wer|welche[rs]?|wo|ist|sind|kann|kannst|k(ö|oe)nnen|soll|sollen|darf|d(ü|ue)rfen|why|what|how|when|which|who|is|are|can|could|should|does|do)\b/i.test(
      t,
    )
  );
}

/**
 * Is this prompt an ANSWER to the refusal the user was just shown?
 *
 * Accepts the two shapes a numbered-options block actually produces — a bare
 * selection (`1`, `1.`, `Option 2`) and a bare affirmative (`ja`, `ok`, `mach`,
 * `go`, `do it`) — and nothing else. The bar is that the prompt says yes and
 * says NOTHING ELSE: a turn that also carries new instructions is a new turn,
 * not an answer, and must name its operation like any other.
 *
 * That last clause is the whole safety argument, so it is enforced by length
 * rather than by good intentions. `release und fixe auch den schess bug` reads
 * as consent to a human and is correctly NOT an affirmative here — it opens new
 * work, and the op it authorizes is the one it names.
 */
export function isAffirmative(prose: string): boolean {
    const t = prose.trim().replace(/[.!]+$/u, "");
    if (!t || t.length > 24) {
        return false;
    }
    if (isInterrogative(t)) {
        return false;
    }
    return (
        /^(?:option\s*)?\d{1,2}[.)]?$/iu.test(t) ||
        /^(ja|jo|jep|yes|yep|yeah|ok|okay|okey|klar|passt|gut|los|go|go ahead|mach|mach das|mach es|leg los|do it|proceed|bitte)$/iu.test(
            t,
        )
    );
}

/** Executable commands a user may paste, mapped to the op they authorize. */
const PASTED_COMMANDS: ReadonlyArray<{ op: GitOp | null; re: RegExp }> = [
  { op: "publish", re: /\bnpm\s+publish\b/i },
  { op: "tag", re: /\bgit\s+push\s+[^\n]*--tags\b|\bgit\s+tag\s+-a\b/i },
  { op: "release", re: /\bgh\s+release\s+create\b/i },
  // ORDER IS LOAD-BEARING: the auto variants precede the plain merge, because
  // the first match wins and `gh pr merge 12 --auto` also matches the plain
  // pattern. Same rule the block-side table states for `git push --tags`.
  //
  // The DE-ESCALATING forms come first of all, and they map to no op at all:
  // `--disable-auto` and `disablePullRequestAutoMerge` turn the capability OFF.
  // Requiring merge authorization to switch auto-merge off is a live deadlock,
  // and it is why this cannot ship after the split rather than with it.
  { op: null, re: /\bgh\s+pr\s+merge\b[^\n]*--disable-auto\b|\bdisablePullRequestAutoMerge\b/i },
  { op: "pr-merge-auto", re: /\bgh\s+pr\s+merge\b[^\n]*--auto\b|\benablePullRequestAutoMerge\b/i },
  { op: "pr-merge", re: /\bgh\s+pr\s+merge\b/i },
  { op: "pr-create", re: /\bgh\s+pr\s+create\b/i },
  { op: "push", re: /\bgit\s+push\b/i },
  { op: "commit", re: /\bgit\s+commit\b/i },
  { op: "branch", re: /\bgit\s+(checkout\s+-b|switch\s+-c|branch)\b/i },
];

/**
 * Split a prompt into prose and fenced-code regions.
 *
 * The council's point: a user who PASTES an executable `git push origin main`
 * is authorizing that command; the same literal appearing inside a log line or
 * an error trace is not authorization. The discriminator used here is whether
 * the line reads as a command invocation (starts at the command, optionally
 * after a shell prompt marker) rather than being embedded in prose or in a
 * `remote:` / `error:` / `hint:` diagnostic line.
 */
export function splitFences(prompt: string): { prose: string; fences: string[] } {
  const fences: string[] = [];
  const prose = prompt.replace(/```[^\n]*\n([\s\S]*?)```/g, (_m, body: string) => {
    fences.push(body);
    return " ";
  });
  return { prose, fences };
}

/** A fenced line that is an actual command invocation, not diagnostic output. */
function _commandLines(fence: string): string[] {
  return fence
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // Drop git/npm diagnostic output — this is what "pasted an error trace" looks like.
    .filter((l) => !/^(remote:|error:|hint:|fatal:|warning:|To |!\s|\s*\^)/i.test(l))
    // Strip a leading shell prompt marker.
    .map((l) => l.replace(/^[$>#]\s*/, ""))
    // Keep only lines that START with the command.
    .filter((l) => /^(git|gh|npm|pnpm|yarn|task)\b/.test(l));
}

/**
 * A standing, target-bound, single-use capability minted from the user's own
 * words — the ADR-252 shape.
 *
 * A `GitOp` in `authorized` says *the user named this operation on this turn*
 * and is governed by the guard's freshness clock. A grant says something
 * strictly narrower: *the user named this operation AND the exact objects it
 * may act on*. Because the objects are frozen at grant time, elapsed time stops
 * being the thing that protects the user — target identity is — so a grant
 * carries no clock.
 *
 * The narrowing is what buys the clock exemption, and it is why only
 * enumerable operations can hold one. `npm publish` names a version, not the
 * bytes that will be published, so no prompt can freeze its effect; it holds no
 * grants and keeps the clock. See ADR-252 § Per-operation verdict.
 */
export type MergeGrant = {
  /** Replay-resistant id — session slug, mint time, and the frozen target set. */
  id: string;
  /** Only `pr-merge` mints grants today. The field exists so the reader of a
   *  stored ledger never has to infer the op from the grant's shape. */
  op: GitOp;
  /** PR numbers named by the human, frozen at mint time. Never a wildcard: a
   *  cardinality word with no numbers mints nothing (ADR-252 § What "all" does
   *  not buy). */
  targets: number[];
  /** Per-target single-use state. A merged target is spent and cannot be
   *  replayed, which is what makes a force-push back to a merged SHA harmless. */
  consumed: number[];
  granted_at: string;
  /** The literal human phrase, for audit. Never the enforcement key. */
  evidence: string;
};

export interface Ledger extends JsonObject {
  session_id: string;
  detected_at: string;
  authorized: GitOp[];
  evidence: { [op: string]: string };
  prompt_chars: number;
  /**
   * Standing grants, carried across the session's human turns.
   *
   * Optional so a ledger written by an older build still parses. Absent reads
   * as "no grants", which is the pre-ADR-252 behaviour exactly.
   */
  grants?: MergeGrant[];
}

/**
 * PR numbers the prompt names, as merge targets.
 *
 * Deliberately narrow. It matches a `#`-prefixed or `PR `-prefixed integer and
 * nothing else, so a bare number in prose ("merge the 3 branches") freezes no
 * target and mints no grant. Over-matching here would hand a clockless
 * capability to a sentence that never identified an object, which is the exact
 * conflation of lexical and object specificity both council seats rejected.
 */
export function extractMergeTargets(prompt: string): number[] {
  const out = new Set<number>();
  const re = /(?:#|\bpr[- ]?|\bpull[- ]request\s+#?)(\d{1,7})\b/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const n = Number.parseInt(m[1] as string, 10);
    if (Number.isSafeInteger(n) && n > 0) {
      out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * A human turn that withdraws standing merge authority.
 *
 * Revocation must be cheaper to express than authorization, so this matches a
 * bare stop word on its own as well as an explicit "don't merge". It is
 * deliberately over-inclusive in the safe direction: a false revocation costs
 * one prompt, a missed revocation costs an unwanted merge.
 */
const REVOKE_RE =
  /\b(stop|stopp|halt|abbrechen|abbruch|cancel|revoke|widerruf(en)?|zur(ü|ue)ck(nehmen|ziehen)|hold\s+(everything|on|the\s+merge)|warte|wait)\b|(?:\b(nicht|kein(e|en)?|no|not|dont|don't|never|niemals|nie)\b[^.!?\n]{0,30}\b(merg(e|en|ing)|zusammenf(ü|ue)hren)\b)/iu;

/** Does this human turn withdraw standing merge grants? */
export function isRevocation(prompt: string): boolean {
  return REVOKE_RE.test(prompt);
}

/** Mint a grant id that a replayed ledger cannot collide with. */
function _grantId(session_id: string, at: string, targets: number[]): string {
  return `${sessionSlug(session_id) || "nosession"}:${at}:${targets.join(",")}`;
}

/**
 * Fold this turn's authorization into the grants the session already holds.
 *
 * Three rules, and the order is the contract:
 *   1. A revocation drops every standing grant. It wins over anything else in
 *      the same prompt — "merge #1 but stop if it conflicts" revokes.
 *   2. An explicit `pr-merge` naming PR numbers mints one grant over those
 *      numbers.
 *   3. Everything else carries the existing grants forward untouched. This is
 *      the clause that fixes the measured defect: before ADR-252 a neutral
 *      "weiter" replaced the whole ledger and silently erased authority the
 *      user had given two turns earlier.
 *
 * Consumption is NOT done here — the guard consumes a target when it actually
 * lets the merge through, so a grant that was never acted on stays whole.
 */
export function foldGrants(
  prior: MergeGrant[],
  prompt: string,
  authorized: GitOp[],
  session_id: string,
  now: Date,
): MergeGrant[] {
  if (isRevocation(prompt)) {
    return [];
  }
  const carried = prior.filter((g) => g.consumed.length < g.targets.length);
  if (!authorized.includes("pr-merge")) {
    return carried;
  }
  const targets = extractMergeTargets(prompt);
  if (targets.length === 0) {
    return carried;
  }
  const at = now.toISOString();
  const already = new Set(carried.flatMap((g) => g.targets));
  const fresh = targets.filter((t) => !already.has(t));
  if (fresh.length === 0) {
    return carried;
  }
  return [
    ...carried,
    {
      id: _grantId(session_id, at, fresh),
      op: "pr-merge",
      targets: fresh,
      consumed: [],
      granted_at: at,
      evidence: prompt.trim().slice(0, 120),
    },
  ];
}

/**
 * Negation words that turn an instruction into its opposite.
 *
 * ONE vocabulary for the whole file, deliberately. The `pr-merge` pattern
 * already carried this list inline, and its own comment warns that "two
 * negation vocabularies in one tree drift, and the drift is invisible until a
 * prompt lands in the gap between them" — so the list moved here rather than
 * being copied fifteen times.
 */
const NEGATION_WORD =
  /\b(nicht|nichts|kein(e|en|em|er|es)?|niemals|nie|no|not|dont|don't|never|without|ohne)\b/i;

/**
 * Is the match at `index` under a negation?
 *
 * MEASURED, not anticipated. Probed on 2026-09-03 against the fifteen phrases
 * added that day: **15 of 15 leaked** — "nicht unpublishen", "den workflow nicht
 * deaktivieren", "kein force-push bitte" each authorized exactly the operation
 * the sentence forbade. The same probe showed the hole predates them, since
 * "kein force-push bitte" also authorized a plain `push` and "den branch nicht
 * löschen" also authorized `branch`. Only `pr-merge` was protected, by a
 * lookbehind written after the identical defect was found there in isolation.
 *
 * SENTENCE-SCOPED, and that bound is load-bearing rather than decorative.
 * "Do not push. Merge PR #12." is two instructions, and a negation whose reach
 * crossed the full stop would silently stop authorizing merges the user DID
 * order — a failure worse than the defect, because nothing happens and nothing
 * says why. The 30-character window inside the sentence is inherited from the
 * `pr-merge` lookbehind that this generalises.
 */
export function negatedBefore(text: string, index: number, matched = ""): boolean {
  let start = 0;
  for (const mark of [".", "!", "?", "\n"]) {
    const at = text.lastIndexOf(mark, index - 1);
    if (at + 1 > start) {
      start = at + 1;
    }
  }
  const before = text.slice(Math.max(start, index - 30), index);
  // The negation is often INSIDE the match, not before it, and German word
  // order is why: "das asset nicht ersetzen" is matched by a noun-first pattern
  // that starts at "asset", so a look-behind from the match index sees an empty
  // window. Measured — nine of the fifteen rows in the negation corpus failed
  // exactly this way after the look-behind alone was added.
  return NEGATION_WORD.test(before) || NEGATION_WORD.test(matched);
}

/** Classify which ops a prompt authorizes. Exported for direct testing. */
export function classifyAuthorization(prompt: string): {
  authorized: GitOp[];
  evidence: Record<string, string>;
} {
  const { prose, fences } = splitFences(prompt);
  const authorized = new Set<GitOp>();
  const evidence: Record<string, string> = {};

  // Drop pasted tool output from the prose before matching (C4), then refuse
  // to read a question as an instruction (C3).
  const instruction = prose
    .split("\n")
    .filter((l) => !OUTPUT_LINE.test(l))
    .join("\n");

  for (const { op, re } of isInterrogative(instruction) ? [] : PHRASES) {
    const m = re.exec(instruction);
    if (m && !negatedBefore(instruction, m.index, m[0])) {
      authorized.add(op);
      evidence[op] = `prose: "${m[0]}"`;
    }
  }

  for (const fence of fences) {
    // A fence that also carries tool OUTPUT is a transcript of something that
    // already happened, not a command the user is handing over. Pasting
    //   $ git push origin main
    //   ! [rejected] …
    // is showing a failure, and reading it as "authorized push" is exactly the
    // implicit-continuation misread this gate exists to stop.
    if (fence.split("\n").some((l) => OUTPUT_LINE.test(l))) {
      continue;
    }
    for (const line of _commandLines(fence)) {
      for (const { op, re } of PASTED_COMMANDS) {
        if (!re.test(line)) continue;
        // FIRST MATCH WINS, and the table is ordered most-specific-first. A
        // de-escalating form carries `op: null` — it matched, so no later
        // pattern may claim the line, and it authorizes nothing.
        if (op !== null) {
          authorized.add(op);
          evidence[op] = `pasted command: "${line.slice(0, 80)}"`;
        }
        break;
      }
    }
  }

  return { authorized: [...authorized], evidence };
}

/** Grants the session already holds, or `[]` for any ledger that has none. */
export function readGrants(consumer_root: string, session_id: string): MergeGrant[] {
  try {
    const raw = fs.readFileSync(path.join(consumer_root, ledgerFileFor(session_id)), "utf8");
    const decoded = JSON.parse(raw) as unknown;
    if (!_isObject(decoded) || !Array.isArray(decoded["grants"])) {
      return [];
    }
    // A grant recorded against a different session is another conversation's
    // consent, exactly as the ledger's own session check treats `authorized`.
    const owner = typeof decoded["session_id"] === "string" ? decoded["session_id"] : "";
    if (session_id && owner && owner !== session_id) {
      return [];
    }
    return (decoded["grants"] as unknown[]).flatMap((g) => {
      if (!_isObject(g)) return [];
      const op = g["op"];
      if (typeof op !== "string" || !(ALL_OPS as readonly string[]).includes(op)) return [];
      const targets = Array.isArray(g["targets"]) ? g["targets"] : [];
      const consumed = Array.isArray(g["consumed"]) ? g["consumed"] : [];
      return [
        {
          id: String(g["id"] ?? ""),
          op: op as GitOp,
          targets: targets.filter((t): t is number => typeof t === "number"),
          consumed: consumed.filter((t): t is number => typeof t === "number"),
          granted_at: String(g["granted_at"] ?? ""),
          evidence: String(g["evidence"] ?? ""),
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Mark one target spent, in place, on the session's ledger.
 *
 * Called by the guard at the moment it lets a merge through — not by the agent,
 * and not at mint time. A grant the run never reached stays whole, and a target
 * that merged can never be replayed, which is what makes a force-push back to
 * an already-merged SHA harmless.
 */
export function consumeGrantTarget(
  consumer_root: string,
  session_id: string,
  target: number,
): void {
  const file = path.join(consumer_root, ledgerFileFor(session_id));
  let decoded: unknown;
  try {
    decoded = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }
  if (!_isObject(decoded) || !Array.isArray(decoded["grants"])) {
    return;
  }
  let touched = false;
  for (const g of decoded["grants"] as unknown[]) {
    if (!_isObject(g) || !Array.isArray(g["targets"]) || !Array.isArray(g["consumed"])) {
      continue;
    }
    const targets = g["targets"] as JsonValue[];
    const consumed = g["consumed"] as JsonValue[];
    if (targets.includes(target) && !consumed.includes(target)) {
      consumed.push(target);
      touched = true;
    }
  }
  if (touched) {
    try {
      atomic_write_json(file, decoded as JsonObject);
    } catch {
      /* Observability only. A failed write leaves the target unspent, which
         re-allows one merge of a PR the user did authorize by name — it fails
         toward the user's stated intent, never toward an unauthorized target. */
    }
  }
}

/**
 * Read the refused operation, and consume it in the same breath.
 *
 * Consuming unconditionally is the single-use guarantee: the record survives
 * exactly one following prompt whether or not that prompt confirmed it, so a
 * `ja` three turns later cannot reach back to a refusal the user has long
 * stopped thinking about.
 */
export function takePending(
    consumer_root: string,
    session_id: string,
    now: number,
): PendingRefusal | null {
    const file = path.join(consumer_root, pendingFileFor(session_id));
    let raw: string;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch {
        return null;
    }
    try {
        fs.rmSync(file, { force: true });
    } catch {
        /* consumed in memory either way — a stale file expires by age below */
    }
    try {
        const decoded = JSON.parse(raw) as unknown;
        if (!_isObject(decoded)) {
            return null;
        }
        const op = decoded["op"];
        if (typeof op !== "string" || !(ALL_OPS as readonly string[]).includes(op)) {
            return null;
        }
        const recorded = typeof decoded["session_id"] === "string" ? decoded["session_id"] : "";
        // A refusal from another conversation is another conversation's question.
        if (session_id && recorded && recorded !== session_id) {
            return null;
        }
        const at = Date.parse(String(decoded["refused_at"] ?? ""));
        if (!Number.isFinite(at) || now - at > PENDING_MAX_AGE_MS) {
            return null;
        }
        return { op: op as GitOp, session_id: recorded, refused_at: String(decoded["refused_at"]) };
    } catch {
        return null;
    }
}

/**
 * Re-exported so the ledger's own tests and callers keep one import site. The
 * predicate lives in `_lib/machine_wake.ts` because the misclassification is a
 * property of the `user_prompt_submit` SLOT, not of this concern — see that
 * file for the discriminator and the captured evidence behind it.
 */
export { humanTypedThisTurn } from "./_lib/machine_wake.js";

export function run(stdin_text: string, options: { consumer_root: string }): number {
  let envelope: JsonObject = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (_isObject(decoded)) {
        envelope = decoded;
      }
    } catch {
      return EXIT_ALLOW;
    }
  }

  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;
  let prompt = "";
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      prompt = v;
      break;
    }
  }
  if (!prompt) {
    return EXIT_ALLOW;
  }

  const session = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";

  // A machine wake is not a user turn. Leave every per-turn record standing —
  // the ledger AND the pending refusal — and return before either is touched.
  // Returning early rather than branching per-record is the point: any future
  // per-turn state added to this function inherits the protection instead of
  // needing to remember it (risk 4 — the misclassification is a property of the
  // slot, not of one consumer).
  if (!_humanTypedThisTurn(prompt)) {
    return EXIT_ALLOW;
  }

  const { authorized, evidence } = classifyAuthorization(prompt);

  // The answer to the guard's own question. Read (and consume) on EVERY prompt,
  // so the record cannot outlive the turn it was raised in.
  const pending = takePending(options.consumer_root, session, Date.now());
  if (pending && !authorized.includes(pending.op) && isAffirmative(prompt)) {
    authorized.push(pending.op);
    evidence[pending.op] =
      `confirmation of the refused \`${pending.op}\` (refused ${pending.refused_at}): ` +
      `"${prompt.trim().slice(0, 40)}"`;
  }

  const now = new Date();
  const ledger: Ledger = {
    session_id: typeof envelope["session_id"] === "string" ? envelope["session_id"] : "",
    detected_at: now.toISOString(),
    authorized,
    evidence,
    prompt_chars: prompt.length,
    // Grants survive this write; `authorized` does not. That asymmetry IS the
    // decision. A bare operation name stays one-shot exactly as `commit-policy`
    // requires, and only an authorization that also froze its objects earns a
    // life longer than the turn. See ADR-252.
    grants: foldGrants(
      readGrants(options.consumer_root, session),
      prompt,
      authorized,
      session,
      now,
    ),
  };

  try {
    atomic_write_json(path.join(options.consumer_root, ledgerFileFor(session)), ledger);
  } catch {
    // Observability only — a failed write degrades the gate to "no ledger",
    // which the pre_tool_use concern treats as "not authorized" for the
    // irreversible subset and as a warn for the rest.
  }
  return EXIT_ALLOW;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let consumer_root = process.cwd();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--project-dir" && args[i + 1] !== undefined) {
      consumer_root = args[i + 1] as string;
      i += 1;
    } else if (a !== undefined && a.startsWith("--project-dir=")) {
      consumer_root = a.slice("--project-dir=".length);
    }
  }
  return run(readHookStdin(), { consumer_root });
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) {
    return false;
  }
  if (process.argv[1] === undefined) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}
