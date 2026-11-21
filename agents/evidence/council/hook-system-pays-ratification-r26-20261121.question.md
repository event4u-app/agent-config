<!-- evidence-type: analysis -->
<!-- check-refs: skip -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 26

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: `.github/workflows/consistency.yml` (one step's name and comment), the dispatcher `src/scripts/hooks/dispatch_hook.ts`, new dispatcher modules `src/scripts/hooks/concern_env.ts` and `src/scripts/hooks/feedback_policy.ts`, and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: e2ff87c27670ee065ae775cde3ac275acac9d85e6e8e32f6c9fc89572ed3b8a2

(The gate's digest over those five files. It is the same subject as round 25: the gated files have not changed since. Round 25's prompt, `agents/evidence/council/hook-system-pays-ratification-r25-20261121.question.md`, carries the five files in full and the diff against the merge base `811cea61d6`; both round-25 replies are committed verbatim beside it.)

This round answers the points round 25 raised. It adds evidence: code outside the gated files, a new test, and the operative text of ADR-268 § 4. It does not change a gated file.

## Round 25 points

1. **One seat refused, as a dealbreaker:** the per-concern feedback write in `_write_feedback` lost its caller-side `try/catch` when it moved to `update_json_under_lock()`. The seat argued that `release(held)` in that function's `finally` could throw, and so could `is_replay_mode()` and `path.resolve()` before the first catch. It said the excerpt left the no-throw claim unproven, and that an escaping exception after `_reduce(rcs)` could stop the verdict from being delivered. The code it did not see is shown below, together with a new test.
2. **The same seat asked for ADR-268 § 4's operative clause.** It is quoted below. The seat agreed in round 25 that owner directive D1 covers both budget relaxations: the higher aggregate ceiling and the retirement of the per-chunk and chunk-group ceilings.
3. **The same seat asked whether a nested `main()` runs pre-loop setup on the outer concern's live environment.** Between `recoverConcernEnv()` (the first statement of `main`) and `openConcernEnvScope()`, the one environment read is `resolveSessionRole(process.env)`. That line is byte-identical on the merge base `811cea61d6`; this change neither adds nor moves it. Before this change, too, per-concern hardening began only inside the concern loop.
4. **The other seat ratified, and recommended two things:** add `src/scripts/check_hook_bundle_composition.ts` to the ratification gate's watched set, and write a fuller investigation protocol for when the backstop trips. Neither is done in this change. The budget file's `max_bytes_note` carries one line ("when it does, look at what grew before moving the number"). Changing the gate's watched set is an edit to the gate itself, which this change does not make. Both are recorded as follow-ups.

## What to answer

1. Does the evidence below close point 1? If it does not, which call on the per-concern feedback path can still throw?
2. With ADR-268 § 4's text below, is the budget change within what the change may do, given owner directive D1? If not, what basis is missing?
3. Over the whole change to the five gated files (round 25's prompt), does anything weaken a fail-closed guard, an exit-code contract, child-process hardening, or isolation between concerns, or expand authority?

Close your reply with exactly one line in this form, and nothing after it:

`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

Use `ratified` if the change is acceptable as shown. Use `confirmed-non-expanding` if it neither weakens a guard nor expands authority. Use `refused` if it is not acceptable, and give the reason in the text above the line.

## ADR-268 § 4, verbatim (`docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`)

````markdown
### § 4 — Governance may be self-amended, never self-ratified

ADR-255 § 4's four refusals are superseded. Kernel rules, governance hooks and authority
schemas may be edited inside an authorised mission. An **authority-expanding** edit is inert
until a ratification artifact exists.

```
AN AGENT MAY MODIFY ITS CONSTITUTION. IT MAY NOT RATIFY ITS OWN INCREASE IN POWER.
THE PARTY GAINING THE AUTHORITY IS NEVER THE PARTY RECORDING THE RATIFICATION.
PROVIDER DIVERSITY IS REQUIRED WHERE TWO PROVIDERS ARE CONFIGURED.
```

The ratification ladder is: an independent session or agent → the AI council, CLI-first → a
different provider → the owner, reached only on non-convergence, on unavailable diversity for
a critical expansion, or on an owner-reserved dimension. The tool-call deny
(`block_kernel_rule_writes.ts`) is replaced by a CI gate reading the artifact — one mechanism,
not two, because a deny the executing run must bypass is the shape ADR-262 retired. The
24-hour soak of `contexts/authority/kernel-rule-edits.md` is retired in favour of the
artifact: a fixed window measures elapsed time, not control quality.

````

## The per-concern feedback write, from `_write_feedback` in `dispatch_hook.ts` (gated, unchanged since round 25)

````ts
  // Quiet allows skip their own file only if the summary carrying them was written (feedback_policy.ts).
  for (const entry of entries) {
    if (summaryWritten && isQuietAllow(entry)) continue;
    const target = path.join(fb_dir, `${entry["concern"]}.json`);
    const written = update_json_under_lock<FeedbackEntry>(target, (loaded) => keepNewerOutcome(loaded, { ...entry, invocation }));
    if (written === "failed") process.stderr.write(`dispatch_hook: feedback write failed for ${entry["concern"]}\n`);
  }
}
````

The call sequence in `main`: `closeConcernEnv()` in a `finally` → `assertConcernEnvRestored()` → `const final_rc = _reduce(rcs)` → `writeConcernTimings(…)` → `_write_feedback(…)` → `_record_rule_trips(…)` → host emission.

## `is_replay_mode` and `update_json_under_lock`, from `src/scripts/hooks/state_io.ts` (not gated, unchanged)

````ts
export function is_replay_mode(): boolean {
  return (process.env[REPLAY_ENV_VAR] ?? "").trim() === "1";
}

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

`_target_lock_path(targetPath)` is evaluated inside the `try` around `_acquire_lock`. `path.resolve` and `path.dirname` on a string do not throw.

## `companion`, `execute` and `release`, from `src/scripts/_lib/generation_lock.ts` (not gated, unchanged)

````ts
export function companion(lockPath: string, g: number): string {
    return g === 0 ? lockPath : `${lockPath}.${String(g)}`;
}

export function execute([op, f]: Step, now: () => number = Date.now): StepResult {
    try {
        if (op === 'list') {
            const own = path.basename(f);
            return fs
                .readdirSync(path.dirname(f))
                .map((n) => (n === own ? 0 : /^\.[1-9]\d{0,14}$/.test(n.slice(own.length)) && n.startsWith(own) ? Number(n.slice(own.length + 1)) : -1))
                .filter((g) => g >= 0)
                .sort((a, b) => a - b);
        }
        if (op === 'age') {
            const m = fs.statSync(f).mtimeMs;
            return m === 0 ? Infinity : now() - m;
        }
        if (op === 'remove') return void fs.rmSync(f, { recursive: true, force: true });
        if (op === 'expire') return void fs.utimesSync(f, 0, 0);
        if (op === 'mkdir') fs.mkdirSync(f);
        else fs.closeSync(fs.openSync(f, 'wx', 0o600));
        return true;
    } catch (err) {
        if (op === 'age') return null;
        if (op === 'remove' || op === 'expire') return undefined;
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
    }
}

export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
````

## New test, `tests/scripts/hooks/feedback_write_no_throw.test.ts`, full

Run as shipped: 4 passed. Run with the `expire` branch removed from `execute`'s catch (`if (op === 'remove') return undefined;`): the two `expire`/`release` tests fail and the other two pass. The source was then restored.

````ts
// The dispatcher writes feedback AFTER it has computed its verdict, with no
// caller-side catch around the per-concern write. That is safe only while the
// write path reports failure instead of throwing, so these pin it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { execute, release, type Held } from '../../../src/scripts/_lib/generation_lock.js';
import { update_json_under_lock } from '../../../src/scripts/hooks/state_io.js';

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-no-throw-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('the feedback write path reports, it does not throw', () => {
    it('expire on a guard that is gone returns undefined instead of throwing', () => {
        const missing = path.join(dir, 'never-created.lock.held');
        expect(() => execute(['expire', missing])).not.toThrow();
        expect(execute(['expire', missing])).toBeUndefined();
    });

    it('release of a lock whose guard vanished does not throw', () => {
        for (const generation of [0, 3]) {
            const held: Held = { lockPath: path.join(dir, `gone-${String(generation)}.lock.held`), generation };
            expect(() => release(held)).not.toThrow();
        }
    });

    it('a mutator that throws is reported as failed, and the lock is released', () => {
        const target = path.join(dir, 'concern.json');
        const boom = (): never => {
            throw new Error('mutator failed');
        };
        expect(update_json_under_lock(target, boom)).toBe('failed');
        // Released: a second writer gets the lock and writes.
        expect(update_json_under_lock(target, () => ({ ok: true }))).toBe('written');
        expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({ ok: true });
    });

    it('an unwritable target directory is reported as failed', () => {
        const blocker = path.join(dir, 'a-file');
        fs.writeFileSync(blocker, '');
        expect(update_json_under_lock(path.join(blocker, 'sub', 'concern.json'), () => ({ ok: true }))).toBe('failed');
    });
});
````
