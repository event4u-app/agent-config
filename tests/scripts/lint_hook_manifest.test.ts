// Tests for src/scripts/lint_hook_manifest.ts — real assertions over the
// linter's error/warning surface (road-to-tested-routing Phase 1; the prior
// file carried a single missing-file check, a leftover from the Python
// golden-parity layer that died in the py2ts migration).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { _check_rewrite_axis, CONCERN_EFFECTS, lint } from "../../src/scripts/lint_hook_manifest.js";
import { parseHostLowering, REWRITE_CHANNELS, rewriteModeFor } from "../../src/scripts/hooks/host_lowering.js";
import { isRewriteCapability, resolveRewriteCapability } from "../../src/scripts/hooks/rewrite_capability.js";
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
    effect: context
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
    effect: context
  delegation-nudge:
    script: src/scripts/hooks/delegation_nudge_hook.ts
    args: []
    fail_closed: false
    effect: notification
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
      "  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n",
      `  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n${a}`,
    ).replace(
      "  delegation-nudge:\n    script: src/scripts/hooks/delegation_nudge_hook.ts\n    args: []\n    fail_closed: false\n    effect: notification\n",
      `  delegation-nudge:\n    script: src/scripts/hooks/delegation_nudge_hook.ts\n    args: []\n    fail_closed: false\n    effect: notification\n${b}`,
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

describe("lint_hook_manifest — re_arm validation", () => {
  function withReArm(v: string): string {
    return TWO_CONCERNS.replace(
      "  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n",
      `  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n${v}`,
    );
  }

  it("accepts an absent re_arm — almost every concern declares none", () => {
    expect(lint(fixtureManifest(TWO_CONCERNS), false)).toBe(0);
  });

  it("accepts each declared re-arm boundary", () => {
    for (const ev of ["session_start", "pre_compact"]) {
      expect(lint(fixtureManifest(withReArm(`    re_arm: ${ev}\n`)), false), ev).toBe(0);
    }
  });

  it("rejects an undeclared boundary rather than letting it read as a declaration", () => {
    // `check_prefix_stable_mutation` treats an unrecognised value as UNDECLARED
    // and fails, so an unvalidated typo would look like a real mid-session
    // mutation and send the author hunting the wrong defect.
    for (const bad of ["    re_arm: whenever\n", "    re_arm: post_tool_use\n", "    re_arm: true\n"]) {
      expect(lint(fixtureManifest(withReArm(bad)), false), bad.trim()).toBe(1);
    }
  });

  it("the real manifest declares no invalid re_arm", () => {
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
        `  onboarding-gate:\n    script: src/scripts/onboarding_gate_hook.ts\n    args: []\n    fail_closed: false\n    effect: notification\nplatforms:`,
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

describe("effect: — the census's field (Phase 2.2)", () => {
  const withConcern = (body: string): string =>
    VALID.replace(
      "  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n",
      `  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n${body}`,
    );

  /** Run the linter and return its exit code with everything it wrote. */
  function run(body: string, name = "session-canary", script?: string): { code: number; text: string } {
    const chunks: string[] = [];
    const realErr = process.stderr.write.bind(process.stderr);
    const realOut = process.stdout.write.bind(process.stdout);
    const sink = (c: unknown): boolean => {
      chunks.push(String(c));
      return true;
    };
    process.stderr.write = sink as typeof process.stderr.write;
    process.stdout.write = sink as typeof process.stdout.write;
    try {
      let manifest = withConcern(body).replaceAll("session-canary", name);
      if (script !== undefined) manifest = manifest.replace("src/scripts/session_canary_hook.ts", script);
      return { code: lint(fixtureManifest(manifest), false), text: chunks.join("") };
    } finally {
      process.stderr.write = realErr;
      process.stdout.write = realOut;
    }
  }

  it("rejects a concern with no effect at all", () => {
    const r = run("");
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.session-canary: 'effect' must be one of/);
  });

  it("rejects a value outside the closed set", () => {
    const r = run("    effect: vibes\n");
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/'effect' must be one of/);
    expect(r.text).toMatch(/"vibes"/);
  });

  it("rejects a misspelled key, which is the failure no unknown-key guard catches", () => {
    const r = run("    effects: context\n");
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/'effect' must be one of/);
  });

  it("rejects 'permission' on a concern that cannot refuse", () => {
    const r = run("    severity: advisory\n    effect: permission\n");
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/contradicts 'severity: advisory'/);
  });

  it("rejects a blocking concern that claims any other effect", () => {
    const r = run("    severity: blocking\n    effect: notification\n");
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/contradicts 'severity: blocking'/);
  });

  it("accepts a blocking concern declared as permission", () => {
    // A blocking concern must also hold an execution-view grant, which binds a
    // name to its script, so the fixture takes a granted pair.
    const r = run("    severity: blocking\n    effect: permission\n", "block-no-verify", "src/scripts/hooks/block_no_verify.ts");
    expect(r.code).toBe(0);
  });

  it("the real manifest gives every concern an effect, and every blocking one 'permission'", () => {
    const manifest = _load_yaml(REAL_MANIFEST) as {
      concerns: Record<string, { severity?: string; effect?: string }>;
    };
    const names = Object.keys(manifest.concerns);
    // 63 until `run-continuation` was withdrawn on its own pre-registered kill
    // date (road-to-what-was-built-and-never-ran Phase 4). The number is pinned
    // rather than read from the manifest on purpose: a census that counts
    // whatever it finds cannot notice a concern that silently stopped being
    // declared, which is the failure this case exists for.
    // 63 again since `block-credential-reads` (road-to-one-detector-and-the-
    // senders-we-own 1.1).
    expect(names.length).toBe(63);
    const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
    expect(missing).toStrictEqual([]);
    const mismatched = names.filter(
      (n) =>
        (manifest.concerns[n]?.severity === "blocking") !==
        (manifest.concerns[n]?.effect === "permission"),
    );
    expect(mismatched).toStrictEqual([]);
  });
});

/**
 * ADR-285: one dispatcher stage is the only rewriter. A concern that declares
 * a rewrite, or whose script names a host rewrite field, is refused, so the
 * open composition question (two concerns rewriting one input) cannot arise.
 */
describe("rewrite-concern-refused — no concern may produce a rewrite (ADR-285)", () => {
  const withConcern = (body: string, script = "src/scripts/session_canary_hook.ts"): string =>
    VALID.replace(
      "  session-canary:\n    script: src/scripts/session_canary_hook.ts\n    args: []\n    fail_closed: false\n    effect: context\n",
      `  session-canary:\n    script: ${script}\n    args: []\n    fail_closed: false\n    effect: context\n${body}`,
    );

  function run(manifest: string): { code: number; text: string } {
    const chunks: string[] = [];
    const realErr = process.stderr.write.bind(process.stderr);
    const realOut = process.stdout.write.bind(process.stdout);
    const sink = (c: unknown): boolean => {
      chunks.push(String(c));
      return true;
    };
    process.stderr.write = sink as typeof process.stderr.write;
    process.stdout.write = sink as typeof process.stdout.write;
    try {
      return { code: lint(fixtureManifest(manifest), false), text: chunks.join("") };
    } finally {
      process.stderr.write = realErr;
      process.stdout.write = realOut;
    }
  }

  it("rewrite-concern-refused: a concern declaring a rewrite is refused", () => {
    const r = run(withConcern("    rewrites: [input]\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.session-canary: rewrite-concern-refused/);
  });

  it("rewrite-concern-refused: a concern whose script names a host rewrite field is refused", () => {
    const r = run(withConcern("", "tests/hooks/fixtures/concern_names_rewrite_field.ts"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.session-canary: rewrite-concern-refused/);
  });

  it("rewrite-concern-refused: a concern that rewrites nothing is accepted", () => {
    const r = run(VALID);
    expect(r.code).toBe(0);
    expect(r.text).not.toMatch(/rewrite-concern-refused/);
  });

  it("execution-view-not-granted: a concern requesting the execution view off the closed list is refused", () => {
    const r = run(withConcern("    payload_view: execution\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.session-canary: execution-view-not-granted/);
  });

  it("execution-view-not-granted: a granted name bound to another script is refused", () => {
    const borrowed = VALID.replace(
      "    fail_closed: false\n    effect: context\n",
      "    fail_closed: false\n    severity: blocking\n    effect: permission\n",
    ).replaceAll("session-canary", "block-no-verify");
    const r = run(borrowed);
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.block-no-verify: execution-view-not-granted — the grant is bound to/);
  });

  it("execution-view-not-granted: a blocking concern missing from the closed list is refused", () => {
    const r = run(VALID.replace("    fail_closed: false\n    effect: context\n", "    fail_closed: false\n    severity: blocking\n    effect: permission\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/concerns\.session-canary: execution-view-not-granted/);
  });
});

describe("rewrite axis in host_lowering.yaml (placeholders 6.1)", () => {
  const COMMITTED_LOWERING = path.join(REPO_ROOT, "src", "scripts", "hooks", "host_lowering.yaml");
  const TODAY = "2026-10-20";

  const COMMITTED_OUTPUT = /output: \{ mode: replace, answered_at: [^}]*\}/;
  const COMMITTED_INPUT = /input: {2}\{ mode: replace, answered_at: [^}]*\}/;
  /**
   * The committed table with claude's two probed channels set back to the
   * shapes these fixtures mutate: input `offered`, output `none`. The probe
   * records the committed answers cite are real files; a fixture root is not.
   */
  function base(): string {
    const text = fs.readFileSync(COMMITTED_LOWERING, "utf-8");
    if (!COMMITTED_OUTPUT.test(text) || !COMMITTED_INPUT.test(text)) throw new Error("committed claude rewrite answers not found");
    return text
      .replace(COMMITTED_OUTPUT, "output: { mode: none,    answered_at: 2026-10-18 }")
      .replace(COMMITTED_INPUT, "input:  { mode: offered, answered_at: 2026-08-23, docs_url: docs/contracts/hook-architecture-v1.md }");
  }

  /** The committed table with one host row's `any:` surface given extra lines. */
  function lowering(host: string, extra: string): string {
    const text = fs.readFileSync(COMMITTED_LOWERING, "utf-8");
    const anchor = `\n  ${host}:\n    surfaces:\n      any:\n`;
    if (!text.includes(anchor)) throw new Error(`fixture anchor for ${host} not found`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "host-lowering-rewrite-"));
    tmpDirs.push(dir);
    const p = path.join(dir, "host_lowering.yaml");
    fs.writeFileSync(p, text.replace(anchor, `${anchor}${extra}`), "utf-8");
    return p;
  }

  function run(loweringPath: string): { code: number; text: string } {
    const chunks: string[] = [];
    const realErr = process.stderr.write.bind(process.stderr);
    const realOut = process.stdout.write.bind(process.stdout);
    const sink = (c: unknown): boolean => {
      chunks.push(String(c));
      return true;
    };
    process.stderr.write = sink as typeof process.stderr.write;
    process.stdout.write = sink as typeof process.stdout.write;
    try {
      return { code: lint(REAL_MANIFEST, false, loweringPath, TODAY), text: chunks.join("") };
    } finally {
      process.stderr.write = realErr;
      process.stdout.write = realOut;
    }
  }

  it("the committed table passes and states claude's three channels", () => {
    const r = run(COMMITTED_LOWERING);
    expect(r.text).not.toMatch(/rewrite-/);
    expect(r.code).toBe(0);
    const row = parseHostLowering(fs.readFileSync(COMMITTED_LOWERING, "utf-8")).get("claude")?.get("any");
    expect(row).toBeDefined();
    expect(rewriteModeFor(row!, "input")).toBe("replace");
    expect(rewriteModeFor(row!, "prompt")).toBe("gate");
    expect(rewriteModeFor(row!, "output")).toBe("replace");
    const ctx = { today: TODAY, root: REPO_ROOT };
    for (const ch of ["input", "output"] as const) {
      const c = resolveRewriteCapability("claude", row, ch, ctx);
      expect(c.ok && c.capability.mode, ch).toBe("replace");
      expect(c.ok && c.capability.probedVersion, ch).toBe("2.1.304");
    }
    const gate = resolveRewriteCapability("claude", row, "prompt", ctx);
    expect(gate.ok && gate.capability.mode).toBe("gate");
    expect(gate.ok && isRewriteCapability(gate.capability)).toBe(true);
  });

  it("an absent axis is unstated on every channel and authorizes nothing", () => {
    const row = parseHostLowering(fs.readFileSync(COMMITTED_LOWERING, "utf-8")).get("augment")?.get("any");
    for (const ch of REWRITE_CHANNELS) {
      expect(rewriteModeFor(row!, ch)).toBe("unstated");
      expect(resolveRewriteCapability("augment", row, ch, { today: TODAY, root: REPO_ROOT }).ok).toBe(false);
    }
  });

  it("an offered field on a row with no envelope is accepted: it authorizes nothing", () => {
    const r = run(lowering("augment", "        rewrite:\n          input: { mode: offered, answered_at: 2026-10-01, docs_url: https://docs.augmentcode.com/cli/hooks.md }\n"));
    expect(r.text).not.toMatch(/rewrite-/);
  });

  it("rewrite-toward-non-replace-host-refused: replace on a row with no native envelope is refused", () => {
    const r = run(lowering("augment", "        rewrite:\n          input: { mode: replace, answered_at: 2026-10-18 }\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/host_lowering augment\/any\/input: rewrite-toward-non-replace-host-refused/);
  });

  it("rewrite-toward-non-replace-host-refused: replace on the claude row without a live probe is refused", () => {
    const yaml = base().replace("input:  { mode: offered,", "input:  { mode: replace,");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "host-lowering-rewrite-"));
    tmpDirs.push(dir);
    const p = path.join(dir, "host_lowering.yaml");
    fs.writeFileSync(p, yaml, "utf-8");
    const r = run(p);
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — .*names no probed host version.*cites no live substitution probe/);
  });

  it("rewrite-toward-non-replace-host-refused: a replace citing a probe file that does not exist is refused", () => {
    const yaml = base()
      .replace("input:  { mode: offered,", "input:  { mode: replace, host_version: 2.1.301, probe: agents/evidence/analysis/host-input-rewrite-probe-2026-10-18.md,");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "host-lowering-rewrite-"));
    tmpDirs.push(dir);
    const p = path.join(dir, "host_lowering.yaml");
    fs.writeFileSync(p, yaml, "utf-8");
    const r = run(p);
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the cited probe agents\/evidence\/analysis\/host-input-rewrite-probe-2026-10-18\.md does not exist/);
  });

  describe("each prerequisite of an authorizing answer refuses on its own", () => {
    const PROBE = "agents/evidence/analysis/host-input-rewrite-probe-2026-10-18.md";
    const GOOD_PROBE = "host: claude\nhost_version: 2.1.301\nchannel: input\nresult: delivered\n";
    const REPLACE = `input:  { mode: replace, answered_at: 2026-10-18, host_version: 2.1.301, probe: ${PROBE},`;

    function root(probeBody: string | null): string {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rewrite-probe-root-"));
      tmpDirs.push(dir);
      if (probeBody !== null) {
        fs.mkdirSync(path.join(dir, "agents", "evidence", "analysis"), { recursive: true });
        fs.writeFileSync(path.join(dir, PROBE), probeBody, "utf-8");
      }
      return dir;
    }

    /** The committed table, claude input set to `replace` with a probe, then one change applied. */
    function check(mutate: (yaml: string) => string, probeBody: string | null = GOOD_PROBE): string[] {
      const yaml = mutate(
        base().replace("input:  { mode: offered, answered_at: 2026-08-23,", REPLACE),
      );
      const errors: string[] = [];
      _check_rewrite_axis(parseHostLowering(yaml), errors, TODAY, root(probeBody));
      return errors;
    }
    const claudeOnly = (yaml: string, from: string, to: string): string => {
      const i = yaml.indexOf("\n  augment:");
      return yaml.slice(0, i).replace(from, to) + yaml.slice(i);
    };

    it("a replace with a structured probe for this host, version and channel on a capable row is accepted", () => {
      expect(check((y) => y)).toEqual([]);
    });

    it("rewrite-toward-non-replace-host-refused: a non-propagating trampoline alone", () => {
      const e = check((y) => claudeOnly(y, "fail_policy: propagate", "fail_policy: discard"));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the trampoline does not propagate[^;]*\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: an expired row alone", () => {
      const e = check((y) => claudeOnly(y, "expires: 2027-09-06", "expires: 2026-01-01"));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the row expired 2026-01-01\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: no native envelope alone", () => {
      const e = check((y) => claudeOnly(y, "json_shape: hook-specific-output", "json_shape: none"));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the row has no native envelope[^;]*\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: an unbound slot alone", () => {
      const e = check((y) => claudeOnly(y, "          pre_tool_use:       { native: PreToolUse,        block_exit: 2,    answered_at: 2026-09-29 }\n", ""));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — this package binds no native `pre_tool_use` event here\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: no probed host version alone", () => {
      const e = check((y) => y.replace("answered_at: 2026-10-18, host_version: 2.1.301,", "answered_at: 2026-10-18,"));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the answer names no probed host version\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: a probe outside the probe record location", () => {
      const e = check((y) => y.replace(`probe: ${PROBE}`, "probe: docs/contracts/hook-architecture-v1.md"));
      expect(e.join("\n")).toMatch(/rewrite-toward-non-replace-host-refused — the probe docs\/contracts\/hook-architecture-v1\.md is not a record/);
    });

    it("rewrite-toward-non-replace-host-refused: a path that climbs out of the tree", () => {
      const e = check((y) => y.replace(`probe: ${PROBE}`, "probe: agents/evidence/analysis/../../../host-x-probe-2026-10-18.md"));
      expect(e.join("\n")).toMatch(/rewrite-toward-non-replace-host-refused — the probe .* is not a record/);
    });

    it("rewrite-toward-non-replace-host-refused: a probe that does not record delivery for this version and channel", () => {
      const e = check((y) => y, "host: claude\nhost_version: 2.1.241\nchannel: input\nresult: not-observable\n");
      expect(e.join("\n")).toMatch(/does not record `host_version: 2\.1\.301`, `result: delivered`/);
    });

    it("rewrite-gate-without-refusal: a gate on a non-propagating row alone", () => {
      const e = check((y) => claudeOnly(y.replace(REPLACE, "input:  { mode: offered, answered_at: 2026-08-23,"), "fail_policy: propagate", "fail_policy: discard"));
      expect(e.join("\n")).toMatch(/claude\/any\/prompt: rewrite-gate-without-refusal — the trampoline does not propagate[^;]*\.$/m);
    });

    it("rewrite-gate-without-refusal: a gate on a slot with no block_exit alone", () => {
      const e = check((y) =>
        claudeOnly(
          y,
          "user_prompt_submit: { native: UserPromptSubmit,  block_exit: 2,",
          "user_prompt_submit: { native: UserPromptSubmit,  block_exit: null,",
        ),
      );
      expect(e.join("\n")).toMatch(/claude\/any\/prompt: rewrite-gate-without-refusal — `user_prompt_submit` carries no `block_exit`\.$/m);
    });

    it("rewrite-gate-without-refusal: a gate on an expired row alone", () => {
      const e = check((y) => claudeOnly(y.replace(REPLACE, "input:  { mode: offered, answered_at: 2026-08-23,"), "expires: 2027-09-06", "expires: 2026-01-01"));
      expect(e.join("\n")).toMatch(/claude\/any\/prompt: rewrite-gate-without-refusal — the row expired 2026-01-01\.$/m);
    });

    it("rewrite-gate-without-refusal: a gate on an unbound slot alone", () => {
      const e = check((y) => claudeOnly(y, "          user_prompt_submit: { native: UserPromptSubmit,  block_exit: 2,    answered_at: 2026-09-29 }\n", ""));
      expect(e.join("\n")).toMatch(/claude\/any\/prompt: rewrite-gate-without-refusal — this package binds no native `user_prompt_submit` event here\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: an unverified row alone", () => {
      const e = check((y) => {
        const i = y.indexOf("\n  augment:");
        const head = y.slice(0, i).replace(/        verified:\n(?:          .*\n)+/, "        verified: null\n");
        return head + y.slice(i);
      });
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-toward-non-replace-host-refused — the row is unverified\.$/m);
    });

    it("rewrite-toward-non-replace-host-refused: an answer dated on another day than its probe", () => {
      const e = check((y) => y.replace(REPLACE, REPLACE.replace("answered_at: 2026-10-18", "answered_at: 2026-10-17")));
      expect(e.join("\n")).toMatch(/rewrite-toward-non-replace-host-refused — the answer is dated 2026-10-17 and its probe 2026-10-18/);
    });

    it("rewrite-toward-non-replace-host-refused: a later probe that records no delivery revokes the replace", () => {
      const yaml = base().replace("input:  { mode: offered, answered_at: 2026-08-23,", REPLACE);
      const dir = root(GOOD_PROBE);
      fs.writeFileSync(
        path.join(dir, "agents/evidence/analysis/host-input-rewrite-probe-2026-10-19.md"),
        "host: claude\nhost_version: 2.1.304\nchannel: input\nresult: dropped\n",
        "utf-8",
      );
      const errors: string[] = [];
      _check_rewrite_axis(parseHostLowering(yaml), errors, "2026-10-20", dir);
      expect(errors.join("\n")).toMatch(/a later probe agents\/evidence\/analysis\/host-input-rewrite-probe-2026-10-19\.md records `result: dropped`/);
    });

    it("a running host on another minor version revokes a replace; a patch release does not", () => {
      const yaml = base().replace("input:  { mode: offered, answered_at: 2026-08-23,", REPLACE);
      const row = parseHostLowering(yaml).get("claude")?.get("any");
      const dir = root(GOOD_PROBE);
      const patch = resolveRewriteCapability("claude", row, "input", { today: TODAY, root: dir, observedHostVersion: "2.1.309" });
      expect(patch.ok).toBe(true);
      const drift = resolveRewriteCapability("claude", row, "input", { today: TODAY, root: dir, observedHostVersion: "2.2.0" });
      expect(drift.ok).toBe(false);
      expect(!drift.ok && drift.gaps.join(" ")).toMatch(/the running host is 2\.2\.0 and the probe observed 2\.1\.301/);
    });

    it("authority comes only from the resolver: a capability-shaped object is not a capability", () => {
      const forged = { host: "claude", channel: "input", mode: "replace", probedVersion: "2.1.301", expires: "2099-01-01" };
      expect(isRewriteCapability(forged)).toBe(false);
      const yaml = base().replace("input:  { mode: offered, answered_at: 2026-08-23,", REPLACE);
      const row = parseHostLowering(yaml).get("claude")?.get("any");
      const noProbe = resolveRewriteCapability("claude", row, "input", { today: TODAY, root: root(null) });
      expect(noProbe.ok).toBe(false);
      const real = resolveRewriteCapability("claude", row, "input", { today: TODAY, root: root(GOOD_PROBE) });
      expect(real.ok && isRewriteCapability(real.capability)).toBe(true);
      expect(real.ok && Object.isFrozen(real.capability)).toBe(true);
    });

    it("rewrite-axis-malformed: an offered answer resting only on the row's docs_url is refused", () => {
      const e = check((y) => y.replace(REPLACE, "input:  { mode: offered, answered_at: 2026-08-23, probe_note: x,").replace(", docs_url: docs/contracts/hook-architecture-v1.md }", " }"));
      expect(e.join("\n")).toMatch(/claude\/any\/input: rewrite-axis-malformed — 'offered' cites nothing on the answer itself/);
    });

    for (const bad of ["7", "false", "null", "[input]"]) {
      it(`a rewrite value that is not a mapping (${bad}) fails the parse rather than reading as unstated`, () => {
        const r = run(lowering("augment", `        rewrite: ${bad}\n`));
        expect(r.code).toBe(1);
        expect(r.text).toMatch(/augment\/any `rewrite:` is not a mapping/);
      });
    }

    it("a rewrite answer that is not a mapping fails the parse", () => {
      const r = run(lowering("augment", "        rewrite:\n          input: replace\n"));
      expect(r.code).toBe(1);
      expect(r.text).toMatch(/augment\/any\/input rewrite answer is not a mapping/);
    });

    it("rewrite-axis-malformed: a date on no calendar day", () => {
      const e = check((y) => y.replace("output: { mode: none,    answered_at: 2026-10-18 }", "output: { mode: none,    answered_at: 2026-02-31 }"));
      expect(e.join("\n")).toMatch(/claude\/any\/output: rewrite-axis-malformed — no `answered_at` calendar date/);
    });
  });

  it("rewrite-toward-non-replace-host-refused: replace on a channel whose slot this package does not bind is refused", () => {
    const r = run(lowering("codex", "        rewrite:\n          output: { mode: replace, answered_at: 2026-10-18 }\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/host_lowering codex\/any\/output: rewrite-toward-non-replace-host-refused/);
  });

  it("rewrite-gate-without-refusal: gate on a slot that honours no refusal is refused", () => {
    const r = run(lowering("augment", "        rewrite:\n          prompt: { mode: gate, answered_at: 2026-10-18 }\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/host_lowering augment\/any\/prompt: rewrite-gate-without-refusal/);
  });

  it("rewrite-axis-malformed: an undated answer, an unknown channel and an unknown mode are refused", () => {
    const r = run(
      lowering(
        "augment",
        "        rewrite:\n          input: { mode: none }\n          request: { mode: none, answered_at: 2026-10-18 }\n          output: { mode: maybe, answered_at: 2026-10-18 }\n",
      ),
    );
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/augment\/any\/input: rewrite-axis-malformed — no `answered_at` calendar date/);
    expect(r.text).toMatch(/augment\/any\/request: rewrite-axis-malformed — unknown channel/);
    expect(r.text).toMatch(/augment\/any\/output: rewrite-axis-malformed — unknown mode/);
  });

  it("rewrite-axis-malformed: an answer dated after today is refused", () => {
    const r = run(lowering("augment", "        rewrite:\n          input: { mode: none, answered_at: 2099-01-01 }\n"));
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/augment\/any\/input: rewrite-axis-malformed — `answered_at: 2099-01-01` is after/);
  });
});
