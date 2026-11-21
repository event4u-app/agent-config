<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 25

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `.github/workflows/consistency.yml` (one step's name and comment), the dispatcher `src/scripts/hooks/dispatch_hook.ts`, new dispatcher modules `src/scripts/hooks/concern_env.ts` and `src/scripts/hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. The ratification gate itself is unchanged and the budget file stays on its watched set. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: e2ff87c27670ee065ae775cde3ac275acac9d85e6e8e32f6c9fc89572ed3b8a2

(The gate's digest over those five files at commit `51be46502b`. The branch was merged with `main`; the merge base is now `811cea61d6`, and every diff below is against it.)

Rounds 4–24 (`agents/evidence/council/hook-system-pays-ratification-r4…r24-20261120.question.md`, committed) carry the description and the earlier points. Both round-24 replies are committed verbatim beside them (`…-r24-20261120.anthropic.md`, `…-r24-20261120.openai.md`). This round shows the whole change to the five gated files again.

## What changed in the gated files since round 24

One edit, in `feedback_policy.ts`: `LatestRun` is now a `type` alias instead of an `interface`, so it is assignable to the JSON/record shapes the dispatcher passes it into. The full typecheck (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.scripts.json`) failed on that assignment before the edit and passes after it. No behaviour changed.

## Round 24 points, and what the tree shows for each

1. **The size relaxation and the retirement of per-chunk ceilings: does owner directive D1 cover both? (one seat refused on this; the other ratified.)** The directive is `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`. Its D1 reads, verbatim: "**D1 — the byte ceiling stops being a ratchet.** One overall ceiling with real headroom; `shrink_only`, the `raise_log` obligation and the per-chunk and chunk-group ceilings end; the parser check stays and is generalised." Its "What it does not direct" section reads: "It does not lower a fail-closed guard, does not reverse the council decision against a resident dispatcher (`hook-latency-budget.json`), and does not change which concerns are on by default." Whether an owner directive is a sufficient basis under ADR-268 § 4 is a question this round asks you to answer, not one the author settles.
2. **`_write_feedback` lost a caller-side `try/catch` when it switched to `update_json_under_lock()` — can an exception escape after the decision is computed? (one seat.)** `update_json_under_lock` (`src/scripts/hooks/state_io.ts`) returns `"failed"` from every path that can throw: replay mode, `mkdirSync`, lock acquisition, a falsy lock, and an outer `try { … } catch { return "failed"; } finally { release(held); }` around the read, the mutator and the publish. The excerpt is below. Whether `release(held)` itself can throw is not shown here.
3. **Conditions one seat attached to its ratification.** (a) A monitoring note for when the backstop trips: `max_bytes_note` in the budget file says "when it does, look at what grew before moving the number". (b) Test coverage for the environment recovery: the test names of `tests/scripts/hooks/concern_env.test.ts` and `tests/scripts/hooks/feedback_policy.test.ts` are listed below. (c) The `update_json_under_lock` return contract: the type is `LockedUpdateResult`, and the function returns only `"written"`, `"skipped"` or `"failed"` (excerpt below). (d) The composition checker enforces the allowlist: an excerpt of `check_hook_bundle_composition.ts` is below. It is not a gated file.
4. **One seat counted the retired limits as 28 chunk ceilings; the other counted 18 ceilings and 28 raise-log entries.** The retired file is kept in git at `2eef08c00b`.

A same-provider reviewer independently checked the deleted test file `tests/scripts/hook_bundle_raise_log.test.ts` (`agents/evidence/reviews/hook-bundle-raise-log-test-removal.findings.md`). It found one behaviour removed without a decision: "a chunk defined twice is a finding". That check is now a test in `tests/scripts/hook_bundle_composition.test.ts`. The test was red with a duplicated chunk row and is green on the real file.

## What to answer

1. Are the round-24 points closed by what is shown? Where not, what is missing?
2. Over the whole change to the five gated files, does anything weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand authority?
3. Does the budget change need a basis beyond D1 under ADR-268 § 4? If it does, name it.

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.

## `update_json_under_lock`, from `src/scripts/hooks/state_io.ts` (not gated, unchanged)

````ts
export function update_json_under_lock<T>(
  target: string,
  mutate: (loaded: Partial<T>) => T | null,
  options: { indent?: number; blocking?: boolean } = {},
): LockedUpdateResult {
  if (is_replay_mode()) return "failed";
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return "failed";
  }
  // FILE-keyed, not directory-keyed — see `_target_lock_path` for the measured
  // reason and for why `_atomic_write_text` deliberately keeps the shared one.
  let held: Held | false | null;
  try {
    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true });
  } catch {
    return "failed";
  }
  // FAIL CLOSED, unlike `_atomic_write_text`. A read-modify-write without
  // exclusion is the lost-update this function exists to prevent, so a held
  // lock is reported rather than worked around. Reported as `failed` and not as
  // a fourth `busy` state on purpose: every fail-closed caller takes the same
  // action on both (stay silent), and a state nobody branches on goes stale.
  // `false` (no guard can be created or listed) fails closed the same way.
  if (!held) return "failed";
  try {
    let loaded: Partial<T> = {};
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      const decoded: unknown = JSON.parse(raw);
      if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        loaded = decoded as Partial<T>;
      }
    } catch {
      // Absent, unreadable, or malformed — the mutator decides what an empty
      // state means. Never a reason to abandon the write.
    }
    const next = mutate(loaded);
    if (next === null) return "skipped"; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, _py_json_dumps(next, options.indent ?? 2) + "\n");
    return "written";
  } catch {
    return "failed";
  } finally {
    release(held);
  }
}
````

## Composition checker, from `src/scripts/check_hook_bundle_composition.ts` (not gated)

````ts
/** Read the committed budget. Throws rather than defaulting — a guessed ceiling bounds nothing. */
export function readBudget(root: string): Budget {
    const raw = JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')) as Record<string, unknown>;
    const maxBytes = raw['max_bytes'];
    const allowed = raw['allowed_packages'];
    if (typeof maxBytes !== 'number' || !Number.isInteger(maxBytes) || maxBytes <= 0) {
        throw new Error(`${BUDGET_REL}: max_bytes must be a positive integer, got ${JSON.stringify(maxBytes)}`);
    }
    if (!Array.isArray(allowed) || !allowed.every((p) => typeof p === 'string' && p !== '')) {
        throw new Error(`${BUDGET_REL}: allowed_packages must be a list of package names, got ${JSON.stringify(allowed)}`);
    }
    return { maxBytes, allowedPackages: allowed as string[] };
}

/** Findings, one line each. Empty means within budget. */
export function verdict(a: Analysis, budget: Budget): string[] {
    const findings: string[] = [];
    const unlisted = unlistedPackages(a, budget);
    if (unlisted.length > 0) {
        const detail = unlisted.map((p) => `${p} (${String(a.packageBytes.get(p) ?? 0)} B)`).join(', ');
        findings.push(
            `npm package(s) in the bundle that ${BUDGET_REL} does not list: ${detail}. Every dispatch loads ` +
                'them. Use a package the bundle already carries, load it lazily outside the bundle, or add it to ' +
                '`allowed_packages` as a reviewed dependency decision.',
        );
    }
    if (a.duplicated.length > 0) {
        findings.push(
            `package(s) bundled from more than one copy on disk: ${a.duplicated.join(', ')}. Every dispatch parses ` +
                'both. Dedupe the dependency so one copy is bundled.',
        );
    }
    if (a.bytes > budget.maxBytes) {
        findings.push(
            `bundle is ${String(a.bytes)} bytes, backstop is ${String(budget.maxBytes)} ` +
                `(over by ${String(a.bytes - budget.maxBytes)}). Look at what grew before moving max_bytes in ${BUDGET_REL}.`,
        );
    }
    return findings;
}

    // …
    }
    const fixture = parsed.values.metafile;

    let budget: Budget;
    let json: string;
    try {
        budget = readBudget(root);
        json = fixture === undefined ? buildMetafile(root) : fs.readFileSync(fixture, 'utf-8');
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 2;
    }

    let analysis: Analysis;
    try {
        analysis = analyzeMetafile(json, { requireEntry: fixture === undefined });
    } catch (e) {
        process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
        return 1;
    }

    const findings = verdict(analysis, budget);
    const chunkSizes = new Map<string, number>();
    if (fixture === undefined) {
        try {
            for (const c of HOOK_CHUNKS) chunkSizes.set(c.entry, buildChunkBytes(root, c.entry));
        } catch (e) {
            process.stderr.write(`check_hook_bundle_composition: ${String(e instanceof Error ? e.message : e)}\n`);
            return 2;
        }
    }
    // Reported on BOTH paths, red included: a census that goes quiet exactly
    // when the gate fires is the shape `reportScanned` exists to prevent.
    reportScanned({
        gate: 'check_hook_bundle_composition',
        scanned: analysis.modules,
        units: 'bundled module(s)',
        roots: [LIVE_REL],
    });

    const packages = [...analysis.packageBytes].map(([p, b]) => `${p} ${String(b)} B`).join(', ');
    if (findings.length === 0) {
        process.stdout.write(
            `✅  hook bundle: ${String(analysis.bytes)} B / ${String(budget.maxBytes)} B backstop, ` +
                `packages [${packages}], ${String(analysis.modules)} modules\n`,
        );
        for (const [entry, bytes] of chunkSizes) process.stdout.write(`    chunk ${entry}: ${String(bytes)} B (reported, not gated)\n`);
        return 0;
    }
    process.stderr.write('❌  hook bundle composition is out of budget\n');
    for (const f of findings) process.stderr.write(`    - ${f}\n`);
    process.stderr.write(`    Budget: ${BUDGET_REL}\n`);
    return 1;
}
````

## Test names

````text
hardens once: injection vectors are gone inside the scope and back after it
a variable one concern sets, changes or deletes does not reach the next concern
outside a scope, a concern still runs hardened and restores what it found
a dispatch that throws inside the scope still restores, and the next dispatch opens a real scope
an inherited name on the hardened copy does not keep a variable alive
a re-entrant dispatch is a scope of its own: inner concerns and their children never see the outer concern's changes
a concern never starts on a drifted environment: entry repairs what a failed or skipped reset left
a failed reset marks the scope, and the next entry refuses to start a concern it cannot repair
when the rollback fails too, the original error propagates and the rollback failure is reported
a failed closing restore makes the dispatch refuse, without masking an error already in flight
a failed close during an error in flight is recovered by the next dispatch in the same process
when the owed restore still cannot be made, the next scope refuses to open
a half-applied open whose rollback fails owes the baseline: the next open refuses until it can recover it
a concern spawned after a failed reset gets the hardened baseline, not the drift it left
a nested close that fails during unwind, followed by an outer close that restores, leaves no stale mark
recoverConcernEnv pays an owed restore on its own, throws while it cannot, and is a no-op when nothing is owed
the dispatcher pays an owed restore before anything else, so no early return bypasses it
a scope whose hardening fails half-way rolls back what it applied and throws
outside a scope, a spawned concern gets the hardened copy of the live environment
a release that outlives its scope does nothing
reporting a cleanup failure never throws, even when stderr does
closing twice, or out of order, never leaves a scope behind
a plain allow is quiet
a warn, a block, a crash resolved to allow, a non-allow decision or a reason keep their file
two warnings published in reverse completion order leave the later-completed one
compares instants, and lets the write through when either timestamp is unreadable
reverse-order publishes leave the later-completed warning on disk
in order: the later dispatch replaces the row
reverse publication: an older run publishing after a newer one does not overwrite it
carries the outcome, so a row answers what happened last after the history rotated
orders by the concern's own completion, not by the dispatch's
keeps other concerns' rows and drops malformed ones, including rows of concerns this dispatch did not run
orders by instant first
at an equal instant, by invocation id; an id beats none; a full tie is 0
keepNewerOutcome and withLatestRuns break an equal-instant tie the same way
a concern named __proto__ is an ordinary row and survives serialization
````

## `src/config/hook-bundle-budget.json`, full (it replaces a 400-line schema-1 file)

````json
{
    "_comment": "Package allowlist and one wide backstop for the self-hosted hook bundle (dist/hooks/dispatch.js). Read by src/scripts/check_hook_bundle_composition.ts, which builds the bundle from source with --metafile. WHY: every concern is inlined into one bundle that every hook event loads, so a DEPENDENCY added for one concern is paid by all of them on every dispatch. The incident this exists for was a second YAML parser (95,846 bytes) that reached a release unseen. A new npm package in the bundle is now a red check with one line to add here, reviewed like any dependency. Own-code growth is what features are; it is not gated per byte.",
    "schema_version": 2,
    "registered_at": "2026-10-01",
    "owner": "maintainer",
    "review_by": "2027-10-01",
    "allowed_packages": ["yaml"],
    "allowed_packages_note": "The npm packages allowed to contribute bytes to the bundle. Adding one is a reviewed dependency decision, not a ceiling raise. A second YAML reader is refused by the same rule: only `yaml` is listed.",
    "max_bytes": 1915000,
    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md. This file stays on the ratification gate's watched set for now: whether it leaves it (owner directive D2) or only expansions stay watched (council 2026-11-20) is an open owner decision in agents/roadmaps/later/road-to-a-hook-system-with-isolated-guards.md.",
    "what_this_does_not_bound": "Latency: src/config/hook-latency-budget.json owns the wall-clock axis, and a module loaded at runtime outside the bundle is caught by tests/scripts/hook_load_set.test.ts, not here. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
}
````

## `src/scripts/hooks/concern_env.ts`, full (new file)

````ts
/**
 * concern_env — the hardened environment in-process concerns run under, built
 * ONCE per dispatch instead of once per concern.
 *
 * In-process concerns may spawn their own children (git, dashboard regen), which
 * inherit `process.env`, so they run under the same hardened copy the spawn path
 * applies (`hardenedSpawnEnv`). The dispatcher used to copy the environment,
 * rebuild the hardened copy, delete and reassign, then restore — per concern.
 * Measured 0.2 ms per concern at 40 variables and up to 2 ms at 235, with 15 to
 * 20 concerns on a tool event (road-to-a-hook-system-that-pays-for-what-it-does
 * 2.3).
 *
 * Now: the dispatch opens one scope before its concern loop (saved environment
 * plus hardened copy, applied once) and closes it after. Each concern leaves
 * through {@link enterConcernEnv}'s release, which compares the environment
 * against the hardened copy and resets it only when the concern changed it —
 * so a variable one concern sets never reaches the next, which is the isolation
 * the per-concern rebuild bought.
 *
 * Outside an open scope (a direct call, a test) `enterConcernEnv` falls back to
 * the old per-concern save, harden and restore, so no caller depends on the
 * scope existing.
 */
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';

interface Scope {
    readonly prev: NodeJS.ProcessEnv;
    readonly hardened: NodeJS.ProcessEnv;
    /** Set when a reset between concerns failed; the next concern must not start until it is repaired. */
    needsRepair: boolean;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Set when a scope's closing restore failed; read and cleared by {@link assertConcernEnvRestored}. */
let restoreFailed: string | null = null;

/**
 * The environment still owed to the process. Invariant: non-null iff a restore
 * is owed and has not been replayed. Set by a failed closing restore and by a
 * failed rollback of a half-applied scope open; cleared by a successful replay
 * at the next open, or by a successful close (a full replace supersedes it).
 * Kept apart from {@link restoreFailed}: that one is this dispatch's verdict and
 * may be skipped when an error is already in flight; this one outlives the
 * dispatch (within the process — a new process starts from its own clean
 * environment), so the next scope in the same process recovers it before any
 * concern runs, and refuses to open when it cannot.
 */
let pendingRestore: NodeJS.ProcessEnv | null = null;

/**
 * Throws when the last scope close could not restore the environment, then
 * clears the mark. Called AFTER the `finally` that closes the scope, so it runs
 * only when no dispatch error is already in flight (that one propagates
 * unchanged): a dispatch whose environment could not be put back gives no
 * verdict, and the host command refuses the call.
 */
export function assertConcernEnvRestored(): void {
    const failed = restoreFailed;
    restoreFailed = null;
    if (failed !== null) throw new Error(`concern environment not restored: ${failed}`);
}

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!Object.hasOwn(target, k)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (!Object.hasOwn(target, k) || process.env[k] !== target[k]) return true;
    }
    return false;
}

/** Report on stderr without ever throwing: a cleanup path must not replace the dispatch's outcome. */
export function reportQuietly(what: string, err: unknown): void {
    try {
        process.stderr.write(`concern_env: ${what}: ${err instanceof Error ? err.message : String(err)}\n`);
    } catch {
        /* nothing left to report through */
    }
}

/**
 * Pay a restore an earlier dispatch in this process still owes, before the next
 * one reads anything — including on paths that return before a scope opens.
 * Throws when it cannot; the dispatch then gives no verdict and is refused.
 * A no-op when nothing is owed, which is every fresh process.
 */
export function recoverConcernEnv(): void {
    if (pendingRestore === null) return;
    replaceEnv(pendingRestore);
    pendingRestore = null;
    restoreFailed = null;
}

/**
 * Open a dispatch scope. Returns the close function, which puts back the
 * environment as it was when the scope opened and never throws (a failed
 * restore is reported, so a `finally` that calls it cannot replace the
 * dispatch's own outcome). The caller closes it in a `finally`, so a dispatch
 * that throws still restores and leaves no scope open.
 *
 * The hardened copy a scope applies is derived from the ENCLOSING scope's
 * hardened copy when there is one, never from the live environment: a
 * synchronous re-entry into dispatch from inside a concern must not hand that
 * concern's changes to the inner concerns. The live environment is still saved,
 * so the outer concern gets its own environment back when the inner dispatch
 * returns.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    // A previous close could not put its environment back: recover it first, or throw.
    recoverConcernEnv();
    const prev = { ...process.env };
    const enclosing = stack[stack.length - 1];
    const hardened =
        enclosing === undefined
            ? hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot })
            : { ...enclosing.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
    const scope: Scope = { prev, hardened, needsRepair: false };
    try {
        replaceEnv(hardened);
    } catch (err) {
        // A half-applied hardening must not outlive a scope the caller never got.
        try {
            replaceEnv(prev);
        } catch (rollbackErr) {
            // Still dirty: owe `prev` to the next scope, and keep the setup error as the one thrown.
            pendingRestore = prev;
            reportQuietly('environment rollback failed', rollbackErr);
        }
        throw err;
    }
    stack.push(scope);
    let closed = false;
    return () => {
        if (closed) return;
        closed = true;
        const at = stack.lastIndexOf(scope);
        // Already ended by an enclosing scope's close: that close restored an
        // older environment, which this one must not overwrite.
        if (at < 0) return;
        stack.splice(at);
        try {
            replaceEnv(scope.prev);
            // A full replace supersedes whatever a nested close failed to restore:
            // the environment is restored now, so neither mark may outlive it.
            pendingRestore = null;
            restoreFailed = null;
        } catch (err) {
            pendingRestore = scope.prev;
            restoreFailed = err instanceof Error ? err.message : String(err);
            reportQuietly('environment restore failed', err);
        }
    };
}

/**
 * The environment a concern spawned as its own process gets. Inside a scope it
 * is a copy of the scope's hardened baseline — never the live environment, which
 * an earlier in-process concern may have left drifted if its reset failed — so a
 * child never inherits another concern's changes, repaired or not. Outside a
 * scope, the hardened copy of the live environment, as before.
 */
export function concernSpawnEnv(packageRoot: string): NodeJS.ProcessEnv {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot });
    return { ...scope.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
}

/**
 * Enter the environment for one concern; call the returned function when it has
 * run. The release resets only while its scope is still the innermost one: a
 * release that outlives its scope (the scope already closed) does nothing, so it
 * can never put an older hardened copy over the current scope.
 *
 * A reset that fails marks the scope; the next concern's entry repairs it first
 * and THROWS if it cannot, so no concern ever starts on an environment that is
 * not its hardened baseline. The throw escapes the dispatch, whose host command
 * turns a missing verdict into a refusal — fail-closed, for a case that needs
 * `process.env` assignment itself to fail twice.
 */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return openConcernEnvScope(packageRoot);
    if (scope.needsRepair || drifted(scope.hardened)) {
        replaceEnv(scope.hardened);
        scope.needsRepair = false;
    }
    return () => {
        if (stack[stack.length - 1] !== scope) return;
        try {
            if (drifted(scope.hardened)) replaceEnv(scope.hardened);
        } catch (err) {
            scope.needsRepair = true;
            reportQuietly('environment reset failed', err);
        }
    };
}
````

## `src/scripts/hooks/feedback_policy.ts`, full (new file)

````ts
/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now, so a
 * `<concern>.json` means "this concern's latest NON-QUIET outcome", not its latest
 * outcome — except when the dispatch's summary write failed: then a quiet allow
 * is written too, so the file never shows an older block as the latest outcome
 * that no summary contradicts. Nothing deletes it: a delete would race a newer write from a parallel
 * dispatch in the same session. A write goes through the per-file lock and keeps
 * whichever outcome COMPLETED later ({@link keepNewerOutcome}), so two warnings
 * published in reverse completion order cannot leave the older one standing.
 * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
 * recorded time, so a later quiet run still reads as the latest.
 */
import { EXIT_ALLOW } from './exit_codes.js';

/** An entry that allowed, was not resolved from a crash, and gave no reason. */
export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
    return (
        entry['exit_code'] === EXIT_ALLOW &&
        entry['raw_exit_code'] === EXIT_ALLOW &&
        entry['decision'] === 'allow' &&
        (entry['reason'] ?? null) === null
    );
}


/**
 * The locked write's mutator: the incoming entry, unless the file already holds
 * an outcome that completed later (then `null`, a deliberate no-write).
 * Instants, not strings; an unreadable timestamp on either side lets the
 * incoming entry through, as the unconditional write did before. Equal instants
 * (millisecond resolution) are ordered by {@link compareRuns}, the same order
 * `hooks_doctor` reads with; a full tie lets the incoming entry through.
 */
export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
    if (Number.isNaN(held) || Number.isNaN(incoming)) return entry;
    return compareRuns(held, loaded['invocation'], incoming, entry['invocation']) > 0 ? null : entry;
}

/**
 * The one order every reader and writer of these records uses, so they never
 * disagree on which run is the latest: by completion instant, then — at an
 * equal instant, where no real order exists — by `invocation` id as a string,
 * an id beating none. Positive when run A is later. Equal instants with equal
 * (or both absent) ids compare 0. Used by {@link keepNewerOutcome},
 * {@link withLatestRuns} and `hooks_doctor`.
 */
export function compareRuns(atA: number, invocationA: unknown, atB: number, invocationB: unknown): number {
    if (atA !== atB) return atA > atB ? 1 : -1;
    const a = typeof invocationA === 'string' ? invocationA : null;
    const b = typeof invocationB === 'string' ? invocationB : null;
    if (a === b) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    return a > b ? 1 : -1;
}

// A type alias, not an interface: it must stay assignable to JSON and record shapes.
export type LatestRun = {
    readonly invocation: string;
    readonly completed_at: string | null;
    /** The run's outcome, so the row still answers "what happened last" after the history rotated it out. */
    readonly exit_code: number | null;
    readonly decision: string | null;
};

/**
 * The summary's `latest` map (one row per concern, outside the capped history:
 * id, completion time and outcome) with this dispatch's runs folded in. Each row keeps whichever run COMPLETED
 * later, by the concern's own `completed_at` and {@link keepNewerOutcome}'s rule,
 * so a dispatch that publishes after a newer one cannot overwrite its row.
 */
export function withLatestRuns(
    held: unknown,
    entries: readonly Readonly<Record<string, unknown>>[],
    invocation: string,
): Record<string, LatestRun> {
    // No prototype: a concern named `__proto__` is an ordinary key here.
    const out = Object.create(null) as Record<string, LatestRun>;
    if (held !== null && typeof held === 'object' && !Array.isArray(held)) {
        for (const [k, v] of Object.entries(held as Record<string, unknown>)) {
            if (isLatestRun(v)) {
                const r = v as { exit_code?: unknown; decision?: unknown };
                out[k] = {
                    invocation: v.invocation,
                    completed_at: v.completed_at,
                    exit_code: typeof r.exit_code === 'number' ? r.exit_code : null,
                    decision: typeof r.decision === 'string' ? r.decision : null,
                };
            }
        }
    }
    for (const e of entries) {
        const name = String(e['concern']);
        const run: LatestRun = {
            invocation,
            completed_at: typeof e['completed_at'] === 'string' ? e['completed_at'] : null,
            exit_code: typeof e['exit_code'] === 'number' ? e['exit_code'] : null,
            decision: typeof e['decision'] === 'string' ? e['decision'] : null,
        };
        const prior = out[name];
        out[name] = prior === undefined ? run : (keepNewerOutcome(prior, run) ?? prior);
    }
    return out;
}

/**
 * A `latest` row that honours the contract: a string id and a readable
 * completion instant. The writer keeps only such rows, and `hooks_doctor` reads
 * only such rows, so the two never disagree on which row counts.
 */
export function isLatestRun(v: unknown): v is LatestRun & { completed_at: string } {
    if (v === null || typeof v !== 'object') return false;
    const r = v as { invocation?: unknown; completed_at?: unknown };
    return typeof r.invocation === 'string' && typeof r.completed_at === 'string' && !Number.isNaN(Date.parse(r.completed_at));
}
````

## `dispatch_hook.ts` and `consistency.yml`, diff against `811cea61d6`

````diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index db12c9d2ac..623c340e1d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -249,14 +249,13 @@ jobs:
       - name: Verify the host table's format column names only emitted paths
         run: ./scripts-run src/scripts/check_host_format_column --quiet
 
-      # One YAML reader in the hook bundle, and a byte ceiling on it. Unlike its
-      # two siblings (`check_hook_bundle_freshness` / `_content`) this one is NOT
-      # local-only: it builds its own bundle from source with `--metafile`
-      # instead of reading the untracked `dist/hooks/dispatch.js`, so what it
-      # bounds is a property of the commit rather than of one machine. That is
-      # the whole reason it can fail a pull request, which is where the second
-      # YAML parser it exists to catch would have been caught.
-      - name: Verify the hook bundle carries one YAML reader and stays under its byte ceiling
+      # Only allowlisted npm packages in the hook bundle, and a wide byte
+      # backstop. Unlike its two siblings (`check_hook_bundle_freshness` /
+      # `_content`) this one is NOT local-only: it builds its own bundle from
+      # source with `--metafile`, so what it bounds is a property of the commit
+      # rather than of one machine. That is why it can fail a pull request,
+      # which is where the second YAML parser it exists to catch belongs.
+      - name: Verify the hook bundle carries only allowlisted packages and stays under its backstop
         run: ./scripts-run src/scripts/check_hook_bundle_composition
 
       - name: Verify README size, word and time-to-first-command budgets
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 16ac1faf33..f190f57be1 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -38,9 +38,7 @@ import { runBundleIntegrityGate } from "./bundle_integrity.js";
 import { writeConcernTimings, type ConcernTimingSample } from "./concern_timings.js";
 import { tableFingerprint } from "./table_fingerprint.js";
 
-import { hardenedSpawnEnv } from "../_lib/spawn_env.js";
 import {
-  atomic_write_json,
   feedback_dir,
   is_replay_mode,
   update_json_under_lock,
@@ -73,6 +71,8 @@ import { _fallback_yaml } from './fallback_yaml.js';
 import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
+import { assertConcernEnvRestored, concernSpawnEnv, enterConcernEnv, openConcernEnvScope, recoverConcernEnv } from './concern_env.js';
+import { isQuietAllow, keepNewerOutcome, withLatestRuns } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -621,10 +621,10 @@ function _run_concern_inproc(
   const prevStderrWrite = process.stderr.write;
   const prevArgv = process.argv;
   const prevCwd = process.cwd();
-  const prevEnv = { ...process.env };
 
   const started = performance.now();
   let rc = 0;
+  const leaveEnv = enterConcernEnv(REPO_ROOT); // first: if it throws, nothing below is installed yet
   setHookStdinOverride(_compactJsonDumps(envelope));
   process.stdout.write = makeCapture((s) => {
     out += s;
@@ -634,13 +634,7 @@ function _run_concern_inproc(
   });
   try {
     process.argv = [prevArgv[0] as string, scriptAbs, ...argsList];
-    // Same env-hardening the spawn path applied — concerns may spawn their
-    // own children (dashboard regen, git), which inherit process.env.
-    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
-    for (const k of Object.keys(process.env)) {
-      if (!(k in hardened)) delete process.env[k];
-    }
-    Object.assign(process.env, hardened);
+    // Hardened once per dispatch, reset only if this concern changed it: concern_env.ts.
     if (workspace !== prevCwd && _isDir(workspace)) {
       process.chdir(workspace);
     }
@@ -661,10 +655,7 @@ function _run_concern_inproc(
     process.stdout.write = prevStdoutWrite;
     process.stderr.write = prevStderrWrite;
     process.argv = prevArgv;
-    for (const k of Object.keys(process.env)) {
-      if (!(k in prevEnv)) delete process.env[k];
-    }
-    Object.assign(process.env, prevEnv);
+    leaveEnv();
     try {
       if (process.cwd() !== prevCwd) process.chdir(prevCwd);
     } catch {
@@ -717,7 +708,8 @@ function _run_concern(concern: ConcernDef, envelope: JsonObject): RunResult {
   // Consumer-runtime concern dispatch: scrub code-execution-injection env
   // vectors (loader / git-config / NODE_OPTIONS / …) before spawning each
   // concern, then set the package-root marker as an explicit override.
-  const concern_env = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
+  // Inside a dispatch scope: its hardened baseline, never the live (possibly drifted) environment.
+  const concern_env = concernSpawnEnv(REPO_ROOT);
 
   const started = performance.now();
   const { command, args: spawnArgs } = _resolve_tsx_invocation(script, cmd.slice(1));
@@ -821,24 +813,18 @@ function _write_feedback(
     process.stderr.write(`dispatch_hook: feedback dir unavailable: ${msg}\n`);
     return;
   }
-  for (const entry of entries) {
-    const target = path.join(fb_dir, `${entry["concern"]}.json`);
-    try {
-      atomic_write_json(target, entry);
-    } catch (exc) {
-      const msg = exc instanceof Error ? exc.message : String(exc);
-      process.stderr.write(
-        `dispatch_hook: feedback write failed for ${entry["concern"]}: ${msg}\n`,
-      );
-    }
-  }
+  // pid + monotonic clock: unique per dispatch; per-concern files carry it too (doctor ties).
+  const invocation = `${String(process.pid)}-${process.hrtime.bigint().toString()}`;
+  let summaryWritten = false;
   const SUMMARY_KEYS = new Set([
     "concern",
     "exit_code",
+    "raw_exit_code",
     "severity",
     "decision",
     "reason",
     "duration_ms",
+    "completed_at", // the concern's own clock, so the doctor can rank a history row on it
     "payload_bodies",
     "payload_stubs",
   ]);
@@ -884,26 +870,33 @@ function _write_feedback(
     // 200 rollups per session dir, and capping THAT needs a directory scan on
     // the hot path. A capped list needs one locked read-modify-write, which is
     // the same primitive `rule-trips.json` now uses for the same reason.
-    //
-    // `invocation` is pid + monotonic clock: unique per dispatch without a
-    // shared counter, and ordered within one process.
-    const invocation = `${String(process.pid)}-${process.hrtime.bigint().toString()}`;
-    update_json_under_lock<JsonObject>(path.join(fb_dir, "summary.json"), (loaded) => {
+    summaryWritten = update_json_under_lock<JsonObject>(path.join(fb_dir, "summary.json"), (loaded) => {
       const priorRaw = (loaded as JsonObject)["invocations"];
       const prior = Array.isArray(priorRaw) ? priorRaw : [];
       const next = [...prior, { invocation, ...summary }];
+      // Each concern's latest run, outside the cap, keep-newer: eviction never resurrects an older outcome.
+      const latest = withLatestRuns(loaded["latest"], entries, invocation);
       return {
         schema_version: 2,
         session_id,
+        latest,
         // Newest last, oldest dropped — the same rotation direction
         // `dispatch-issues.jsonl` uses, so a reader learns one convention.
         invocations: next.slice(Math.max(0, next.length - SUMMARY_INVOCATION_CAP)),
       };
-    });
+    }) === "written"; // it reports a failure; it does not throw one
+    if (!summaryWritten) process.stderr.write("dispatch_hook: summary write failed\n");
   } catch (exc) {
     const msg = exc instanceof Error ? exc.message : String(exc);
     process.stderr.write(`dispatch_hook: summary write failed: ${msg}\n`);
   }
+  // Quiet allows skip their own file only if the summary carrying them was written (feedback_policy.ts).
+  for (const entry of entries) {
+    if (summaryWritten && isQuietAllow(entry)) continue;
+    const target = path.join(fb_dir, `${entry["concern"]}.json`);
+    const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
+    if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
+  }
 }
 
 /**
@@ -1063,6 +1056,7 @@ function _parse_args(argv: string[]): Args {
 }
 
 export function main(argv?: string[]): number {
+  recoverConcernEnv(); // first: an owed restore is paid before anything below reads the environment
   const args = _parse_args(argv ?? process.argv.slice(2));
 
   // Honour --project-dir: chdir so workspace_root (envelope) and every
@@ -1297,110 +1291,116 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
     egress.placeholder,
   );
-  for (const [concern, keep_classes] of keep_by_concern) {
-    if (!_concern_matches_tool(concern, tool_name)) {
-      continue;
-    }
-    const concern_envelope = applyPayloadFields(concern, shapes.shapeFor(keep_classes, egressViewFor(concern)));
-    const stubs_served = shapes.stubsFor(keep_classes);
-    // What was actually SERVED, not what was declared. Recording the
-    // declaration made the record wrong in both directions on a body-less
-    // event: a blocking `stop` concern read "input,result" for bodies it can
-    // never receive, and an advisory one read "none" while the full envelope
-    // went to it untouched.
-    const served_classes = shapes.servedBy(keep_classes);
-    const concern_started = _now_iso();
-    const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
-      _run_concern(concern, concern_envelope);
-    timing_samples.push({ concern: String(concern["name"]), duration_us: duration_ms * 1000 });
-    let rc = rawRcResult;
-    const raw_rc = rc;
-    if (rc >= 3) {
-      // Resolved by DECLARED SEVERITY, no longer by `fail_closed:`. Every
-      // crash path has already written an `execution_failed` row, so a refusal
-      // here is traceable to a named failure. See `_resolve_execution_failure`.
-      rc = _resolve_execution_failure(concern, refusal_retry);
-      if (stderr_text) {
-        process.stderr.write(stderr_text);
+  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
+  try {
+    for (const [concern, keep_classes] of keep_by_concern) {
+      if (!_concern_matches_tool(concern, tool_name)) {
+        continue;
       }
-      // The escape, printed only where a denial can repeat — `stop` is bounded
-      // by the one-retry clause above. Reasoning: `noVerdictRefusalNotice`.
-      if (rc === EXIT_BLOCK && !refusal_retry) {
-        process.stderr.write(noVerdictRefusalNotice(String(concern["name"])));
+      const concern_envelope = applyPayloadFields(concern, shapes.shapeFor(keep_classes, egressViewFor(concern)));
+      const stubs_served = shapes.stubsFor(keep_classes);
+      // What was actually SERVED, not what was declared. Recording the
+      // declaration made the record wrong in both directions on a body-less
+      // event: a blocking `stop` concern read "input,result" for bodies it can
+      // never receive, and an advisory one read "none" while the full envelope
+      // went to it untouched.
+      const served_classes = shapes.servedBy(keep_classes);
+      const concern_started = _now_iso();
+      const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
+        _run_concern(concern, concern_envelope);
+      timing_samples.push({ concern: String(concern["name"]), duration_us: duration_ms * 1000 });
+      let rc = rawRcResult;
+      const raw_rc = rc;
+      if (rc >= 3) {
+        // Resolved by DECLARED SEVERITY, no longer by `fail_closed:`. Every
+        // crash path has already written an `execution_failed` row, so a refusal
+        // here is traceable to a named failure. See `_resolve_execution_failure`.
+        rc = _resolve_execution_failure(concern, refusal_retry);
+        if (stderr_text) {
+          process.stderr.write(stderr_text);
+        }
+        // The escape, printed only where a denial can repeat — `stop` is bounded
+        // by the one-retry clause above. Reasoning: `noVerdictRefusalNotice`.
+        if (rc === EXIT_BLOCK && !refusal_retry) {
+          process.stderr.write(noVerdictRefusalNotice(String(concern["name"])));
+        }
       }
+      // P0.2 severity ceiling: an advisory concern can never block, on any host.
+      // This covers BOTH the concern emitting EXIT_BLOCK directly and the
+      // fail_closed promotion above turning a crash into a block.
+      if (rc === EXIT_BLOCK && _is_advisory(concern)) {
+        process.stderr.write(
+          `dispatch_hook: concern '${String(concern["name"])}' is declared ` +
+            `severity: advisory but returned BLOCK — downgraded to warn.\n`,
+        );
+        rc = EXIT_WARN;
+      }
+      rcs.push(rc);
+      const reply = _parse_concern_stdout(stdout_text);
+      permission_verdicts.push(_concern_permission_verdict(rc, reply, concern["effect"]));
+      // A concern states its reason either as JSON {"reason": …} on stdout
+      // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
+      // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
+      // layer can surface the REAL message instead of a generic label; before
+      // this, a rc=1 block discarded the concern's stderr entirely.
+      const stated =
+        typeof reply["reason"] === "string" && (reply["reason"] as string).trim()
+          ? (reply["reason"] as string).trim()
+          : stderr_text.trim();
+      // `additional_context` — the longer, model-facing half of a concern's
+      // reply. The contract has promised since v1 that it is forwarded and
+      // "concatenated with \n\n separators"
+      // (docs/contracts/hook-architecture-v1.md § reply shape), but nothing here
+      // ever read the key: `reason` is capped at ~200 chars by convention and is
+      // written for a human reading stderr, so every concern that put its
+      // actionable instruction in `additional_context` delivered it nowhere.
+      // Found 2026-08-06 by tracing why the language-mirror pin reached the model
+      // on no path; `pr_url_reminder` had the same silent gap, and its own header
+      // calls `additional_context` "what surfaces back to the model".
+      const extra =
+        typeof reply["additional_context"] === "string" &&
+        (reply["additional_context"] as string).trim()
+          ? (reply["additional_context"] as string).trim()
+          : "";
+      const message = [stated, extra].filter(Boolean).join("\n\n");
+      if (message) {
+        concern_messages.push({ rc, text: attributeRefusal(String(concern["name"]), rc === EXIT_BLOCK, injected(message)), def: concern });
+      }
+      if (
+        args.event === "session_start" &&
+        rc === EXIT_ALLOW &&
+        typeof reply["context"] === "string" &&
+        (reply["context"] as string).trim()
+      ) {
+        context_blocks.push(injected((reply["context"] as string).trim()));
+      }
+      collectUserNotice(notices, concern, reply, injected);
+      feedback_entries.push({
+        concern: String(concern["name"]),
+        exit_code: rc,
+        raw_exit_code: raw_rc,
+        severity: _severity_for(rc),
+        decision: (reply["decision"] || _severity_for(rc)) as JsonValue,
+        reason: (reply["reason"] ?? null) as JsonValue,
+        duration_ms: Math.floor(duration_ms),
+        started_at: concern_started,
+        completed_at: _now_iso(),
+        fail_closed: Boolean(concern["fail_closed"]),
+        // Step 2.1's counter — an EXPOSURE denominator, not a detector, and the
+        // review was right to refuse the stronger reading: these numbers are a
+        // function of the declaration and the payload shape, so they say how
+        // often a concern ran without a body, never whether it wanted one. The
+        // detector for the wanting-one case is the source-derived check in
+        // `lint_hook_manifest`, at authoring time, where it is decidable.
+        // A sorted class list and an integer — nothing that can hold a body.
+        payload_bodies: served_classes.join(",") || "none",
+        payload_stubs: stubs_served,
+      });
     }
-    // P0.2 severity ceiling: an advisory concern can never block, on any host.
-    // This covers BOTH the concern emitting EXIT_BLOCK directly and the
-    // fail_closed promotion above turning a crash into a block.
-    if (rc === EXIT_BLOCK && _is_advisory(concern)) {
-      process.stderr.write(
-        `dispatch_hook: concern '${String(concern["name"])}' is declared ` +
-          `severity: advisory but returned BLOCK — downgraded to warn.\n`,
-      );
-      rc = EXIT_WARN;
-    }
-    rcs.push(rc);
-    const reply = _parse_concern_stdout(stdout_text);
-    permission_verdicts.push(_concern_permission_verdict(rc, reply, concern["effect"]));
-    // A concern states its reason either as JSON {"reason": …} on stdout
-    // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
-    // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
-    // layer can surface the REAL message instead of a generic label; before
-    // this, a rc=1 block discarded the concern's stderr entirely.
-    const stated =
-      typeof reply["reason"] === "string" && (reply["reason"] as string).trim()
-        ? (reply["reason"] as string).trim()
-        : stderr_text.trim();
-    // `additional_context` — the longer, model-facing half of a concern's
-    // reply. The contract has promised since v1 that it is forwarded and
-    // "concatenated with \n\n separators"
-    // (docs/contracts/hook-architecture-v1.md § reply shape), but nothing here
-    // ever read the key: `reason` is capped at ~200 chars by convention and is
-    // written for a human reading stderr, so every concern that put its
-    // actionable instruction in `additional_context` delivered it nowhere.
-    // Found 2026-08-06 by tracing why the language-mirror pin reached the model
-    // on no path; `pr_url_reminder` had the same silent gap, and its own header
-    // calls `additional_context` "what surfaces back to the model".
-    const extra =
-      typeof reply["additional_context"] === "string" &&
-      (reply["additional_context"] as string).trim()
-        ? (reply["additional_context"] as string).trim()
-        : "";
-    const message = [stated, extra].filter(Boolean).join("\n\n");
-    if (message) {
-      concern_messages.push({ rc, text: attributeRefusal(String(concern["name"]), rc === EXIT_BLOCK, injected(message)), def: concern });
-    }
-    if (
-      args.event === "session_start" &&
-      rc === EXIT_ALLOW &&
-      typeof reply["context"] === "string" &&
-      (reply["context"] as string).trim()
-    ) {
-      context_blocks.push(injected((reply["context"] as string).trim()));
-    }
-    collectUserNotice(notices, concern, reply, injected);
-    feedback_entries.push({
-      concern: String(concern["name"]),
-      exit_code: rc,
-      raw_exit_code: raw_rc,
-      severity: _severity_for(rc),
-      decision: (reply["decision"] || _severity_for(rc)) as JsonValue,
-      reason: (reply["reason"] ?? null) as JsonValue,
-      duration_ms: Math.floor(duration_ms),
-      started_at: concern_started,
-      completed_at: _now_iso(),
-      fail_closed: Boolean(concern["fail_closed"]),
-      // Step 2.1's counter — an EXPOSURE denominator, not a detector, and the
-      // review was right to refuse the stronger reading: these numbers are a
-      // function of the declaration and the payload shape, so they say how
-      // often a concern ran without a body, never whether it wanted one. The
-      // detector for the wanting-one case is the source-derived check in
-      // `lint_hook_manifest`, at authoring time, where it is decidable.
-      // A sorted class list and an integer — nothing that can hold a body.
-      payload_bodies: served_classes.join(",") || "none",
-      payload_stubs: stubs_served,
-    });
+  } finally {
+    closeConcernEnv();
   }
+  assertConcernEnvRestored(); // a failed restore refuses rather than allowing on a dirty process
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
````
