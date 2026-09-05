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
  classifyAuthorization,
  consumeGrantTarget,
  isBareRefusal,
  extractMergeTargets,
  foldGrants,
  isRevocation,
  ledgerFileFor,
  readGrants,
  run as ledgerRun,
  type MergeGrant,
} from "../../src/scripts/git_authorization_hook.js";
import { mergeTargetOf } from "../../src/scripts/hooks/git_command_classifier.js";

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
    // FORWARD negation — the three shapes the pre-2026-09-04 backward window
    // already caught, kept as controls for the widening.
    expect(isRevocation("nicht mergen")).toBe(true);
    expect(isRevocation("don't merge that after all")).toBe(true);
    expect(isRevocation("never merge this one")).toBe(true);

    // TRAILING negation — the three reproduced leaks. Measured at b75d7f7cb:
    // each returned false, and `foldGrants` kept a standing grant over PR #12
    // through an unambiguous withdrawal. The first two are now read by the same
    // clause scan `classifyAuthorization` uses; the third is a bare refusal in
    // the sentence AFTER the merge, which no clause scan can reach.
    expect(isRevocation("Merge PR #12 auf keinen Fall.")).toBe(true);
    expect(isRevocation("Merge #12 under no circumstances.")).toBe(true);
    expect(isRevocation("Merge PR #12? Actually, don't.")).toBe(true);
  });

  it("drops a standing grant on each of the three trailing forms", () => {
    // The predicate is not the point — this is. Each of these kept [[12]] at
    // b75d7f7cb, which is a merge grant surviving the user withdrawing it.
    const prior = [
      {
        id: "g1",
        op: "pr-merge" as const,
        targets: [12],
        consumed: [] as number[],
        granted_at: "2026-09-04T00:00:00.000Z",
        evidence: "prior turn",
      },
    ];
    for (const p of [
      "Merge PR #12 auf keinen Fall.",
      "Merge #12 under no circumstances.",
      "Merge PR #12? Actually, don't.",
    ]) {
      expect(foldGrants(prior, p, [], "s1", new Date("2026-09-04T01:00:00Z")), p).toEqual([]);
    }
  });

  it("does not read a contrast cue as a withdrawal", () => {
    // The opposite-direction half of the same defect. At b75d7f7cb this prompt
    // returned isRevocation=true AND classifyAuthorization=["pr-merge"] — the
    // two parsers contradicting each other, so the turn authorized the merge,
    // minted no standing grant, and wiped any prior one. The corpus asserts the
    // authorization half as `contrast.en.pr-merge.please-prefix-01`; this is the
    // revocation half of the same row.
    expect(isRevocation("Please do not push, but merge PR #7.")).toBe(false);
    expect(classifyAuthorization("Please do not push, but merge PR #7.").authorized).toEqual([
      "pr-merge",
    ]);
  });

  it("a bare refusal is a clause of negation ONLY — a conversational aside is not one", () => {
    // The AI council (2026-09-04, anthropic + openai, both members) made this
    // the condition on shipping `isBareRefusal` at all: a reader that fires on
    // any negation-anywhere would revoke grants the user never connected to the
    // refusal. The discriminator is a content word in the clause.
    for (const p of [
      "Merge #12? Actually, I don't think so.",
      "Merge #12? Don't worry, I'll do it.",
      "Actually, don't worry about it.",
    ]) {
      expect(isBareRefusal(p), p).toBe(false);
      expect(isRevocation(p), p).toBe(false);
    }
    for (const p of ["Merge #12? Actually, don't.", "Merge #12. Don't.", "Merge #12? No."]) {
      expect(isBareRefusal(p), p).toBe(true);
    }
  });

  it("a clause with no tokens at all is not a refusal", () => {
    // The `tokens.length > 0` guard, pinned. `every` on an empty array is true,
    // so without the guard a prompt of pure punctuation would revoke — a vacuous
    // match, and the one way this reader could fire on nothing.
    for (const p of ["Merge #12 ... ---", "Merge #12?  ,  ;  .", "", "   "]) {
      expect(isBareRefusal(p), p).toBe(false);
    }
  });

  it("the typographic apostrophe is in the vocabulary, on BOTH paths", () => {
    // MEASURED LEAK at b75d7f7cb, found while discharging the council's
    // token-policy condition. The list was ASCII-only (`dont|don't`) while every
    // macOS, iOS, Word and Slack input substitutes U+2019 by default — so one
    // smart quote turned a prohibition into a grant on an IRREVERSIBLE op:
    //   "don't merge PR #12" -> []            (denied)
    //   "don’t merge PR #12" -> ["pr-merge"]   (AUTHORIZED)
    for (const apostrophe of ["'", "\u2019", "\u2018", "\u02bc"]) {
      const dont = `don${apostrophe}t`;
      expect(classifyAuthorization(`${dont} merge PR #12`).authorized, dont).toEqual([]);
      expect(classifyAuthorization(`${dont} push`).authorized, dont).toEqual([]);
      expect(isRevocation(`${dont} merge PR #12`), dont).toBe(true);
      expect(isBareRefusal(`Merge #12? Actually, ${dont}.`), dont).toBe(true);
    }
    // `dont` without any apostrophe stays in the vocabulary.
    expect(classifyAuthorization("dont merge PR #12").authorized).toEqual([]);
  });

  it("a negated merge naming ANOTHER PR still revokes every standing grant", () => {
    // Not a new behaviour and deliberately pinned as such: `foldGrants` has
    // always returned [] for any revocation, so a bare "stop" and this prompt
    // take the same transition. Over-revoking is the safe direction, and
    // narrowing grant selection would be a separate change with its own risk.
    const prior = [
      {
        id: "g1",
        op: "pr-merge" as const,
        targets: [12],
        consumed: [] as number[],
        granted_at: "2026-09-04T00:00:00.000Z",
        evidence: "prior turn",
      },
    ];
    expect(isRevocation("Merge #12? Actually, don't merge #13.")).toBe(true);
    expect(
      foldGrants(prior, "Merge #12? Actually, don't merge #13.", [], "s1", new Date()),
    ).toEqual([]);
  });

  it("does not fire on ordinary work", () => {
    for (const p of [
      "merge #12",
      "fixe die ci",
      "schau dir den diff an",
      "weiter",
      // A negation that is not a refusal: the clause carries content words, so
      // the bare-refusal reading must not claim it.
      "Merge PR #7, no rush.",
      "Do not push. Merge PR #12.",
    ]) {
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
