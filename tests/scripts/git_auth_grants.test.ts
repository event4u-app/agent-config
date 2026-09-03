// Tests for the standing, target-bound merge grants (ADR-252).
//
// The distinction every fixture here defends: `authorized` records that the
// user NAMED an operation on this turn and is spent when the turn ends; a grant
// records that the user named the operation AND the exact pull requests it may
// touch, and survives later turns because the objects are frozen rather than
// the clock being widened.
//
// The measured defect these close: a neutral follow-up ("weiter", "fix the CI")
// replaced the whole ledger and silently erased a merge authorization given two
// turns earlier, so a multi-PR run the user had explicitly ordered became
// unexecutable without re-typing the order every 30 minutes. The two recorded
// responses to that pressure were both hand-widenings of the guard's clock
// (2026-08-21, 2026-08-30).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeGrantTarget,
  extractMergeTargets,
  foldGrants,
  isRevocation,
  ledgerFileFor,
  readGrants,
  run as ledgerRun,
  type MergeGrant,
} from "../../src/scripts/git_authorization_hook.js";
import {
  grantCovers,
  mergeTargetOf,
  run as gateRun,
} from "../../src/scripts/hooks/block_unauthorized_git.js";
import { EXIT_BLOCK as DISPATCHER_BLOCK } from "../../src/scripts/hooks/dispatch_hook.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "git-grants-"));
});

function submit(prompt: string, session = "s1"): void {
  ledgerRun(
    JSON.stringify({ event: "user_prompt_submit", session_id: session, payload: { prompt } }),
    { consumer_root: tmp },
  );
}

function grants(session = "s1"): MergeGrant[] {
  return readGrants(tmp, session);
}

function targetsOf(session = "s1"): number[] {
  return grants(session).flatMap((g) => g.targets);
}

describe("extractMergeTargets — only an identified object freezes a target", () => {
  it("reads the shapes a human actually types", () => {
    expect(extractMergeTargets("merge #1499")).toEqual([1499]);
    expect(extractMergeTargets("merge PR 1499")).toEqual([1499]);
    expect(extractMergeTargets("merge pr-1499")).toEqual([1499]);
    expect(extractMergeTargets("merge pull request #1499")).toEqual([1499]);
  });

  it("collects a whole batch from one sentence, deduped and ordered", () => {
    expect(extractMergeTargets("merge #1499, #1488 und #1480, dann #1488 nochmal")).toEqual([
      1480, 1488, 1499,
    ]);
  });

  it("does NOT read a bare number in prose as a target", () => {
    // This is the line between lexical and object specificity. "the 3 branches"
    // names a quantity, not an object, and a grant over PR #3 would be an
    // invented target the user never uttered.
    expect(extractMergeTargets("merge the 3 branches")).toEqual([]);
    expect(extractMergeTargets("merge alle PRs")).toEqual([]);
    expect(extractMergeTargets("merge everything that is green")).toEqual([]);
  });
});

describe("isRevocation — withdrawal must be cheaper to say than authorization", () => {
  it("catches the bare stop words", () => {
    for (const p of ["stop", "stopp", "halt", "abbrechen", "cancel", "warte", "hold the merge"]) {
      expect(isRevocation(p), p).toBe(true);
    }
  });

  it("catches a negated merge in either language", () => {
    expect(isRevocation("nicht mergen")).toBe(true);
    expect(isRevocation("don't merge that after all")).toBe(true);
    expect(isRevocation("never merge this one")).toBe(true);
  });

  it("does not fire on ordinary work", () => {
    for (const p of ["merge #12", "fixe die ci", "schau dir den diff an", "weiter"]) {
      expect(isRevocation(p), p).toBe(false);
    }
  });
});

describe("foldGrants — what survives a turn and what does not", () => {
  const at = new Date("2026-09-03T10:00:00Z");

  it("mints one grant over the numbers the sentence named", () => {
    const out = foldGrants([], "merge #10 und #11", ["pr-merge"], "s1", at);
    expect(out).toHaveLength(1);
    expect(out[0]?.targets).toEqual([10, 11]);
    expect(out[0]?.consumed).toEqual([]);
    expect(out[0]?.op).toBe("pr-merge");
  });

  it("mints NOTHING for a cardinality word with no numbers", () => {
    // "all" is a valid instruction only once its universe is frozen, and the
    // prompt-submit hook cannot enumerate open PRs. Minting here would hand out
    // a clockless capability over pull requests that do not exist yet.
    expect(foldGrants([], "merge alle offenen PRs", ["pr-merge"], "s1", at)).toEqual([]);
  });

  it("mints nothing when the prompt never authorized a merge at all", () => {
    expect(foldGrants([], "schau dir #10 an", [], "s1", at)).toEqual([]);
  });

  it("carries an existing grant through a neutral follow-up", () => {
    const first = foldGrants([], "merge #10", ["pr-merge"], "s1", at);
    const second = foldGrants(first, "weiter", [], "s1", at);
    expect(second.flatMap((g) => g.targets)).toEqual([10]);
  });

  it("drops every grant on a revocation, even one that also names a merge", () => {
    const first = foldGrants([], "merge #10 und #11", ["pr-merge"], "s1", at);
    expect(foldGrants(first, "stop, doch nicht mergen", ["pr-merge"], "s1", at)).toEqual([]);
    // Revocation wins inside a single prompt that says both things.
    expect(foldGrants(first, "merge #12 aber stopp bei Konflikten", ["pr-merge"], "s1", at)).toEqual(
      [],
    );
  });

  it("does not re-mint a target an existing grant already covers", () => {
    const first = foldGrants([], "merge #10", ["pr-merge"], "s1", at);
    const second = foldGrants(first, "merge #10 und #11", ["pr-merge"], "s1", at);
    expect(second).toHaveLength(2);
    expect(second.flatMap((g) => g.targets).sort((a, b) => a - b)).toEqual([10, 11]);
  });

  it("retires a grant once every target is spent", () => {
    const spent: MergeGrant[] = [
      {
        id: "x",
        op: "pr-merge",
        targets: [10],
        consumed: [10],
        granted_at: at.toISOString(),
        evidence: "merge #10",
      },
    ];
    expect(foldGrants(spent, "weiter", [], "s1", at)).toEqual([]);
  });
});

describe("the ledger write path", () => {
  it("keeps `authorized` one-shot while grants persist — the whole asymmetry", () => {
    submit("merge #1499 und #1488");
    expect(targetsOf()).toEqual([1488, 1499]);

    submit("fixe die ci");
    // The turn-scoped half is spent exactly as `commit-policy` requires…
    const raw = JSON.parse(
      fs.readFileSync(path.join(tmp, ledgerFileFor("s1")), "utf8"),
    ) as { authorized: string[] };
    expect(raw.authorized).not.toContain("pr-merge");
    // …and the object-bound half is still standing.
    expect(targetsOf()).toEqual([1488, 1499]);
  });

  it("a publish authorization mints no grant and stays turn-scoped", () => {
    // A version number does not identify the bytes that will be published, so
    // no prompt can freeze that effect. `publish` therefore never holds a grant
    // and keeps the guard's clock, whatever the user typed.
    submit("mach den npm publish von 4.2.0");
    expect(grants()).toEqual([]);
  });

  it("a revoking turn clears standing grants", () => {
    submit("merge #1499");
    expect(targetsOf()).toEqual([1499]);
    submit("stopp, warte noch");
    expect(grants()).toEqual([]);
  });

  it("does not hand another session's grant to this one", () => {
    submit("merge #1499", "sessionA");
    expect(readGrants(tmp, "sessionA").flatMap((g) => g.targets)).toEqual([1499]);
    expect(readGrants(tmp, "sessionB")).toEqual([]);
  });

  it("a machine wake neither mints nor erases a grant", () => {
    submit("merge #1499");
    ledgerRun(
      JSON.stringify({
        event: "user_prompt_submit",
        session_id: "s1",
        payload: { prompt: "<task-notification>background job finished</task-notification>" },
      }),
      { consumer_root: tmp },
    );
    expect(targetsOf()).toEqual([1499]);
  });

  it("reads a pre-ADR-252 ledger as holding no grants rather than throwing", () => {
    fs.mkdirSync(path.dirname(path.join(tmp, ledgerFileFor("s1"))), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, ledgerFileFor("s1")),
      JSON.stringify({
        session_id: "s1",
        detected_at: new Date().toISOString(),
        authorized: ["pr-merge"],
        evidence: {},
        prompt_chars: 12,
      }),
    );
    expect(readGrants(tmp, "s1")).toEqual([]);
  });
});

describe("consumeGrantTarget — single use, per target", () => {
  it("spends one target and leaves its siblings whole", () => {
    submit("merge #10, #11 und #12");
    consumeGrantTarget(tmp, "s1", 11);
    const g = grants()[0];
    expect(g?.consumed).toEqual([11]);
    expect(g?.targets).toEqual([10, 11, 12]);
  });

  it("is idempotent — a replayed merge does not double-spend", () => {
    submit("merge #10");
    consumeGrantTarget(tmp, "s1", 10);
    consumeGrantTarget(tmp, "s1", 10);
    expect(grants()[0]?.consumed).toEqual([10]);
  });

  it("ignores a target no grant covers", () => {
    submit("merge #10");
    consumeGrantTarget(tmp, "s1", 999);
    expect(grants()[0]?.consumed).toEqual([]);
  });
});

describe("mergeTargetOf — which pull request the command acts on", () => {
  it("reads the number out of the gh forms", () => {
    expect(mergeTargetOf("gh pr merge 1499 --squash")).toBe(1499);
    expect(mergeTargetOf("gh pr merge --squash --delete-branch 1499")).toBe(1499);
    expect(mergeTargetOf("gh api -X PUT repos/o/r/pulls/1499/merge")).toBe(1499);
  });

  it("returns null when the command names no pull request", () => {
    // `gh pr merge` on the current branch identifies no object in its text, so
    // it can never consume a grant minted for a named one.
    expect(mergeTargetOf("gh pr merge --squash")).toBeNull();
    expect(mergeTargetOf("git push origin main")).toBeNull();
  });
});

describe("grantCovers — the matching rule, in isolation", () => {
  const grant: MergeGrant = {
    id: "g1",
    op: "pr-merge",
    targets: [10, 11],
    consumed: [11],
    granted_at: "2026-09-03T10:00:00Z",
    evidence: "merge #10 und #11",
  };

  it("covers an unspent named target", () => {
    expect(grantCovers([grant], "pr-merge", 10)).toBe(grant);
  });

  it("does not cover a spent one", () => {
    expect(grantCovers([grant], "pr-merge", 11)).toBeNull();
  });

  it("does not cover a target the user never named", () => {
    expect(grantCovers([grant], "pr-merge", 12)).toBeNull();
  });

  it("does not cover an unnamed target", () => {
    expect(grantCovers([grant], "pr-merge", null)).toBeNull();
  });

  it("covers no operation other than pr-merge", () => {
    // The guard rests on this: a grant can never be the thing that lets a
    // publish, a tag push or a release through.
    for (const op of ["publish", "tag", "release", "pr-merge-auto"] as const) {
      expect(grantCovers([grant], op, 10), op).toBeNull();
    }
  });
});

describe("end to end — the guard, through the real hook entry points", () => {
  // The clock is what this whole change is about, so the fixtures move it
  // rather than talking about it. 30 minutes is `LEDGER_MAX_AGE_MS`.
  const THREE_HOURS = 3 * 60 * 60 * 1000;

  function ageLedgerBy(ms: number, session = "s1"): void {
    const file = path.join(tmp, ledgerFileFor(session));
    const l = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    l["detected_at"] = new Date(Date.now() - ms).toISOString();
    fs.writeFileSync(file, JSON.stringify(l));
  }

  function preTool(command: string, session = "s1"): number {
    return gateRun(
      JSON.stringify({
        event: "pre_tool_use",
        session_id: session,
        payload: { tool_name: "Bash", tool_input: { command } },
      }),
      { consumer_root: tmp },
    );
  }

  it("the defect this change exists to fix: a named merge survives three hours", () => {
    submit("merge #1499 und #1488");
    ageLedgerBy(THREE_HOURS);
    // Before ADR-252 both of these were refused — the ledger was discarded
    // wholesale at 30 minutes, and the only recorded responses to that were two
    // hand-widenings of the constant.
    expect(preTool("gh pr merge 1499 --squash --delete-branch")).toBe(0);
    expect(preTool("gh pr merge 1488 --squash")).toBe(0);
  });

  it("a PR the user never named is still refused, at any age", () => {
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("gh pr merge 1500 --squash")).toBe(DISPATCHER_BLOCK);
  });

  it("single use — the same merge twice is refused the second time", () => {
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("gh pr merge 1499 --squash")).toBe(0);
    expect(preTool("gh pr merge 1499 --squash")).toBe(DISPATCHER_BLOCK);
  });

  it("a neutral follow-up does not erase the grant", () => {
    submit("merge #1499");
    submit("fixe erst die ci");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("gh pr merge 1499 --squash")).toBe(0);
  });

  it("a revocation does erase it, immediately", () => {
    submit("merge #1499");
    submit("stopp, doch nicht");
    expect(preTool("gh pr merge 1499 --squash")).toBe(DISPATCHER_BLOCK);
  });

  it("an unnamed merge falls back to the clock and is refused when stale", () => {
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    // `gh pr merge` with no number identifies no object, so the grant cannot
    // speak for it and the expired turn-scoped half governs.
    expect(preTool("gh pr merge --squash")).toBe(DISPATCHER_BLOCK);
  });

  it("no grant ever reaches publish, tag or release", () => {
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("npm publish")).toBe(DISPATCHER_BLOCK);
    expect(preTool("git push origin --tags")).toBe(DISPATCHER_BLOCK);
    expect(preTool("gh release create v1.0.0")).toBe(DISPATCHER_BLOCK);
  });

  it("another session's grant does not authorize this one", () => {
    submit("merge #1499", "sessionA");
    expect(preTool("gh pr merge 1499 --squash", "sessionB")).toBe(DISPATCHER_BLOCK);
  });

  it("the REST spelling of the same merge is covered too", () => {
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("gh api -X PUT repos/o/r/pulls/1499/merge")).toBe(0);
  });

  it("auto-merge is never covered, even for a named and granted PR", () => {
    // Enabling auto-merge hands execution to a future state nobody is watching,
    // so it is its own op and holds no grants.
    submit("merge #1499");
    ageLedgerBy(THREE_HOURS);
    expect(preTool("gh pr merge 1499 --auto --squash")).toBe(DISPATCHER_BLOCK);
  });
});
