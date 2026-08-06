// Tests for src/scripts/language_mirror_hook.ts — the deterministic carrier for
// the `language-and-tone` Iron Law.
//
// The regression that matters is the LAST test in this file: a 4 KB English
// skill body arriving in the user role must not overwrite a German pin. That is
// the measured defect (30-session conformance audit, 2026-08-06) — 47 such
// bodies across 21 sessions, and in the worst case one of them was the last
// user-role content before 136 consecutive English replies to a German prompt.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  classify,
  instructionText,
  nextState,
  pinText,
  run,
  STATE_FILE,
  MIN_MARKERS,
} from "../../src/scripts/language_mirror_hook.js";

/** The maintainer's real prompt from the worst-case session (451 chars, de=16/en=0). */
const REAL_GERMAN_PROMPT =
  "Nimm dir die nächste sinnvolle Roadmap vor (die in keiner anderen laufenden " +
  "Session bearbeitet wird). Erstelle einen Branch mit feat/name-der-roadmap und " +
  "arbeite die KOMPLETTE Roadmap eigenständig ab. Stelle mir keine Fragen, " +
  "sondern den AI's. Danach erstelle einen PR, ready for review und fixe die ci " +
  "probleme. Prüfe vorher, ob die Roadmap nicht schon abgearbeitet wurde.";

/** A slash-command / skill body of the kind that arrives in the user role. */
const ENGLISH_SKILL_BODY =
  "Base directory for this skill: /Users/x/projects/agent-config. " +
  (
    "The following instructions describe what you should do with the files that " +
    "are in this directory and how they relate to the rest of the project. " +
    "These are the steps that will be executed when this command is invoked. " +
    "Note that there is a difference between what the user wants and what the " +
    "files say, and you should prefer the files when they disagree. "
  ).repeat(8);

let tmp: string;

function envelope(prompt: string, session_id = "s1"): string {
  return JSON.stringify({
    event: "user_prompt_submit",
    session_id,
    platform: "claude",
    payload: { prompt },
  });
}

function statePath(): string {
  return path.join(tmp, STATE_FILE);
}

function readState(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(statePath(), "utf8")) as Record<string, unknown>;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lang-mirror-"));
});

describe("classify", () => {
  it("classifies the maintainer's real German prompt as de", () => {
    const c = classify(REAL_GERMAN_PROMPT);
    expect(c.language).toBe("de");
    expect(c.de_markers).toBeGreaterThan(c.en_markers);
  });

  it("classifies an English skill body as en", () => {
    const c = classify(ENGLISH_SKILL_BODY);
    expect(c.language).toBe("en");
  });

  it("returns und for a terse continuation below the marker floor", () => {
    for (const terse of ["1", "ok", "weiter", "https://example.com/x"]) {
      expect(classify(terse).language).toBe("und");
    }
    expect(MIN_MARKERS).toBeGreaterThan(1);
  });

  it("resolves a tie to German, per the rule's own mixed/tie clause", () => {
    // Two markers each side: "ich" + "und" vs "the" + "that".
    const c = classify("ich und the that");
    expect(c.de_markers).toBe(c.en_markers);
    expect(c.language).toBe("de");
  });
});

describe("nextState", () => {
  it("keeps a previous pin when this turn is undetermined", () => {
    const kept = nextState({ language: "de" }, classify("1"), 1, "s1", "now");
    expect(kept).toBeNull();
  });

  it("replaces the pin when this turn is determined", () => {
    const next = nextState({ language: "de" }, classify(ENGLISH_SKILL_BODY), 10, "s1", "now");
    expect(next?.language).toBe("en");
  });
});

describe("pinText", () => {
  it("names the target language and denies tool output as a trigger", () => {
    const text = pinText("de");
    expect(text).toContain("German");
    expect(text).toContain("inter-tool");
    expect(text).toMatch(/NOT the trigger/);
  });
});

describe("run", () => {
  it("pins de on a German prompt and emits the context block", () => {
    const rc = run(envelope(REAL_GERMAN_PROMPT), { consumer_root: tmp });
    expect(rc).toBe(2)  // WARN — the only severity the dispatcher delivers;
    expect(readState().language).toBe("de");
  });

  it("pins en on an English prompt", () => {
    const rc = run(envelope("Please refactor the parser and make sure that these tests are green."), {
      consumer_root: tmp,
    });
    expect(rc).toBe(2)  // WARN — the only severity the dispatcher delivers;
    expect(readState().language).toBe("en");
  });

  it("is a clean no-op on a malformed envelope", () => {
    expect(run("{not json", { consumer_root: tmp })).toBe(0);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  it("is a clean no-op when the payload carries no prompt", () => {
    expect(run(JSON.stringify({ event: "user_prompt_submit", payload: {} }), { consumer_root: tmp })).toBe(0);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  it("keeps the German pin across a terse continuation turn", () => {
    run(envelope(REAL_GERMAN_PROMPT), { consumer_root: tmp });
    run(envelope("1"), { consumer_root: tmp });
    expect(readState().language).toBe("de");
  });

  // THE REGRESSION — rewritten in round 2 because the first version was
  // tautological: it called run(german), asserted `de`, called nothing, and
  // asserted `de` again. It proved x === x while its own name claimed to prove
  // the defect was closed. Caught by an adversarial review of the PR that
  // shipped a vacuity guard, which is the joke telling itself.
  //
  // What actually has to hold: the classifier must not let PASTED English decide
  // the language of a German instruction. That is the shape that produced 626
  // wrong-language turns, and it is now testable directly.
  it("a German instruction plus a pasted English log still classifies as German", () => {
    const mixed =
      "mach das:\n" +
      "Error: the test suite is not passing. There are 3 failures that should be\n" +
      "fixed, and these are from the module which was changed and that will need\n" +
      "work before this can be merged into the branch that has these commits.";
    // Without the paste filter this scores en=18 / de=2 and pins ENGLISH.
    expect(classify(mixed).language).toBe("de");
    expect(instructionText(mixed)).not.toMatch(/test suite is not passing/);
  });

  it("a fenced English block does not flip a German prompt", () => {
    const fenced = "hier der fehler, bitte behebe ihn:\n```\n" +
      "TypeError: cannot read the property of undefined and that is what the\n" +
      "handler was doing when these requests were dispatched from the queue\n```";
    expect(classify(fenced).language).toBe("de");
  });

  it("a genuinely English prompt is still classified English", () => {
    expect(
      classify("Please refactor the parser and make sure that these tests are green.").language,
    ).toBe("en");
  });

  it("run() returns WARN so the dispatcher actually delivers the pin", () => {
    // Returning ALLOW was the round-1 defect: severity is taken from the exit
    // code, so the payload was written and then dropped by the dispatcher.
    const rc = run(envelope(REAL_GERMAN_PROMPT), { consumer_root: tmp });
    expect(rc).toBe(2);
    expect(readState().language).toBe("de");
  });

  it("an English skill body classified alone still reads English", () => {
    // Kept as a property of the FIXTURE, not as a claim about the hook: this is
    // the shape that made the defect invisible, and it must stay long enough to
    // dominate a transcript window for the fixture to be honest.
    expect(ENGLISH_SKILL_BODY.length).toBeGreaterThan(2500);
    expect(classify(ENGLISH_SKILL_BODY).language).toBe("en");
  });
});
