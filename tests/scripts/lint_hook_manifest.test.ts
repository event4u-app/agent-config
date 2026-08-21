// Tests for src/scripts/lint_hook_manifest.ts — real assertions over the
// linter's error/warning surface (road-to-tested-routing Phase 1; the prior
// file carried a single missing-file check, a leftover from the Python
// golden-parity layer that died in the py2ts migration).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { lint } from "../../src/scripts/lint_hook_manifest.js";
import { CONCERN_REGISTRY } from "../../src/scripts/hooks/concern_registry.js";
import { _load_yaml } from "../../src/scripts/hooks/dispatch_hook.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REAL_MANIFEST = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");

const tmpDirs: string[] = [];

function fixtureManifest(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-manifest-"));
  tmpDirs.push(dir);
  const p = path.join(dir, "hook_manifest.yaml");
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

// A minimal valid skeleton: one real concern script, plus a binding for
// every platform that has a trampoline on disk (the orphan-trampoline check
// runs against the REAL src/scripts/hooks/ dir regardless of manifest path).
const VALID = `schema_version: 1
concerns:
  session-canary:
    script: src/scripts/session_canary_hook.ts
    args: []
    fail_closed: false
platforms:
  claude:
    session_start: [session-canary]
  augment:
    session_start: [session-canary]
  cline:
    session_start: [session-canary]
  cowork:
    session_start: [session-canary]
  cursor:
    session_start: [session-canary]
  gemini:
    session_start: [session-canary]
  windsurf:
    session_start: [session-canary]
`;

// A two-concern skeleton, both bound on `claude`, used by the nudge_rank
// cases below. Two concerns are the minimum a collision needs, and both
// scripts must exist on disk because `_check_concerns` resolves them.
const TWO_CONCERNS = `schema_version: 1
concerns:
  session-canary:
    script: src/scripts/session_canary_hook.ts
    args: []
    fail_closed: false
  delegation-nudge:
    script: src/scripts/hooks/delegation_nudge_hook.ts
    args: []
    fail_closed: false
platforms:
  claude:
    session_start: [session-canary]
    user_prompt_submit: [delegation-nudge]
  augment:
    session_start: [session-canary]
  cline:
    session_start: [session-canary]
  cowork:
    session_start: [session-canary]
  cursor:
    session_start: [session-canary]
  gemini:
    session_start: [session-canary]
  windsurf:
    session_start: [session-canary]
`;

/**
 * `nudge_rank` uniqueness (road-to-wiring-truth-corrections Phase 3).
 *
 * `injection_budget._selectNudge` stated the gap itself: "a tie is a manifest
 * defect rather than a runtime one, and `lint_hook_manifest` is where it should
 * eventually be caught — that check does not exist yet". These are the cases
 * for the check that closes it.
 *
 * The failure being prevented is silent, not loud: on a tie `_selectNudge`
 * keeps the lowest rank and breaks ties on concern name, so one nudge wins
 * stably and arbitrarily forever while the other can never emit — with no
 * error anywhere.
 */
describe("lint_hook_manifest — nudge_rank uniqueness", () => {
  function withRanks(a: string, b: string): string {
    return TWO_CONCERNS.replace(
      "  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n",
      `  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n${a}`,
    ).replace(
      "  delegation-nudge:\n    script: src/scripts/hooks/delegation_nudge_hook.ts\n    args: []\n    fail_closed: false\n",
      `  delegation-nudge:\n    script: src/scripts/hooks/delegation_nudge_hook.ts\n    args: []\n    fail_closed: false\n${b}`,
    );
  }

  it("accepts absent ranks — most concerns declare none, and that stays legal", () => {
    expect(lint(fixtureManifest(TWO_CONCERNS), false)).toBe(0);
  });

  it("accepts distinct ranks", () => {
    const p = fixtureManifest(withRanks("    nudge_rank: 1\n", "    nudge_rank: 2\n"));
    expect(lint(p, false)).toBe(0);
  });

  it("rejects two concerns declaring the same rank", () => {
    const p = fixtureManifest(withRanks("    nudge_rank: 1\n", "    nudge_rank: 1\n"));
    expect(lint(p, false)).toBe(1);
  });

  it("rejects a malformed rank rather than coercing it", () => {
    // The dispatcher keeps the LOWEST rank, so a non-integer resolves to
    // "never wins" — a typo would look like a working ordering while ordering
    // nothing. Same polarity argument the `tools:` check already makes.
    for (const bad of ["    nudge_rank: first\n", "    nudge_rank: 0\n", "    nudge_rank: 1.5\n"]) {
      const p = fixtureManifest(withRanks(bad, "    nudge_rank: 2\n"));
      expect(lint(p, false), `expected rejection for ${bad.trim()}`).toBe(1);
    }
  });

  it("the real manifest declares no colliding rank", () => {
    expect(lint(REAL_MANIFEST, false)).toBe(0);
  });
});

describe("lint_hook_manifest — red fixtures", () => {
  it("returns 2 for a missing file", () => {
    expect(lint("/nonexistent/hook_manifest.yaml", false)).toBe(2);
  });

  it("returns 1 for a wrong schema_version", () => {
    const p = fixtureManifest(VALID.replace("schema_version: 1", "schema_version: 2"));
    expect(lint(p, false)).toBe(1);
  });

  it("returns 1 when a platform chain names an undeclared concern", () => {
    const p = fixtureManifest(
      VALID.replace("[session-canary]", "[session-canary, ghost-concern]"),
    );
    expect(lint(p, false)).toBe(1);
  });

  it("returns 1 when a concern's script does not exist on disk", () => {
    const p = fixtureManifest(
      VALID.replace(
        "script: src/scripts/session_canary_hook.ts",
        "script: src/scripts/no_such_hook.ts",
      ),
    );
    expect(lint(p, false)).toBe(1);
  });

  it("returns 1 for an unknown platform key", () => {
    const p = fixtureManifest(`${VALID}  emacs:\n    session_start: [session-canary]\n`);
    expect(lint(p, false)).toBe(1);
  });

  it("dead concern (declared, never bound) is a warning: 0 lax, 1 strict", () => {
    const p = fixtureManifest(
      VALID.replace(
        "platforms:",
        `  onboarding-gate:\n    script: src/scripts/onboarding_gate_hook.ts\n    args: []\n    fail_closed: false\nplatforms:`,
      ),
    );
    expect(lint(p, false)).toBe(0);
    expect(lint(p, true)).toBe(1);
  });
});

describe("lint_hook_manifest — the shipped manifest", () => {
  it("the real manifest lints clean (non-strict)", () => {
    expect(lint(REAL_MANIFEST, false)).toBe(0);
  });

  it("every concern bound to any platform chain has a CONCERN_REGISTRY entry", () => {
    const manifest = _load_yaml(REAL_MANIFEST) as {
      concerns: Record<string, { script: string }>;
      platforms: Record<string, Record<string, unknown>>;
    };
    const bound = new Set<string>();
    for (const [, events] of Object.entries(manifest.platforms)) {
      if (events === null || typeof events !== "object") continue;
      for (const [key, chain] of Object.entries(events)) {
        if (key === "fallback_only" || !Array.isArray(chain)) continue;
        for (const name of chain) bound.add(String(name));
      }
    }
    const missing = [...bound]
      .filter((name) => {
        const spec = manifest.concerns[name];
        return !spec || !(spec.script in CONCERN_REGISTRY);
      })
      .sort();
    expect(
      missing,
      `bound concerns without an in-process registry entry (would fall back to the ~1.6s tsx spawn path): ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
