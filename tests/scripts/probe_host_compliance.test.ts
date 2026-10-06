/**
 * Tests for the host-compliance probe's pure demotion check
 * (`src/scripts/probe_host_compliance.ts`).
 */
import { describe, expect, it } from "vitest";

import { evaluate_demotion } from "../../src/scripts/probe_host_compliance.js";
import { THIN_ENTRY_MARKER } from "../../src/scripts/_lib/thin_rules.js";

const opts = { sentinel: "BODY_SENTINEL", keyword: "kw-probe" };

// Built from the WRITER's constant rather than re-spelled here (step 2.1): a
// literal would keep this fixture passing after the marker changes, which is
// the drift the single-spelling work exists to stop.
const GOOD_POINTER =
  `## Canary\n${THIN_ENTRY_MARKER} Fires on: kw-probe. desc ` +
  "Body: ../../dist/agent-src/rules/host-compliance-canary.md\n";

describe("evaluate_demotion", () => {
  it("passes a well-formed pointer (body gone, hint + link present)", () => {
    const r = evaluate_demotion(GOOD_POINTER, opts);
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({
      pointer_present: true,
      body_removed: true,
      trigger_hint_preserved: true,
      link_present: true,
    });
  });

  it("fails when the body sentinel survives (host would re-inline)", () => {
    const r = evaluate_demotion(GOOD_POINTER + "\nBODY_SENTINEL leaked", opts);
    expect(r.body_removed).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("fails without the routed-rule pointer marker", () => {
    const r = evaluate_demotion("## Canary\nFires on: kw-probe. Body: rules/x.md\n", opts);
    expect(r.pointer_present).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("fails when the trigger hint is dropped (router can't select it)", () => {
    const noHint = GOOD_POINTER.replace("kw-probe", "something-else");
    const r = evaluate_demotion(noHint, opts);
    expect(r.trigger_hint_preserved).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("fails without a `Body: <path>` pointer", () => {
    const noLink = `## Canary\n${THIN_ENTRY_MARKER} Fires on: kw-probe.\n`;
    const r = evaluate_demotion(noLink, opts);
    expect(r.link_present).toBe(false);
    expect(r.ok).toBe(false);
  });
});
