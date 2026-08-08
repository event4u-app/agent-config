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
  isSyntheticPrompt,
  nextState,
  noticeText,
  pinText,
  run,
  STATE_FILE,
  MIN_MARKERS,
  systemLocaleVerdict,
} from "../../src/scripts/language_mirror_hook.js";

// Round-5 audit: the live state file read `language: "en", source: "prompt",
// prompt_chars: 6627, de_markers: 0, en_markers: 63` in a German session. Those
// 6,627 characters were a background-task notification, not a human prompt.
describe("isSyntheticPrompt", () => {
  const NOTIFICATION = [
    "[SYSTEM NOTIFICATION - NOT USER INPUT]",
    "This is an automated background-task event, NOT a message from the user.",
    "<task-notification>",
    "<status>completed</status>",
    "</task-notification>",
  ].join("\n");

  it("recognises the harness shapes that reach user_prompt_submit", () => {
    expect(isSyntheticPrompt(NOTIFICATION)).toBe(true);
    expect(isSyntheticPrompt("<task-notification>\n<task-id>x</task-id>")).toBe(true);
    expect(isSyntheticPrompt("<system-reminder>\nsomething\n</system-reminder>")).toBe(true);
    expect(isSyntheticPrompt("<local-command-caveat>\nx\n</local-command-caveat>")).toBe(true);
  });

  it("does not fire on a human prompt, including one that quotes a notification", () => {
    expect(isSyntheticPrompt("analysiere unsere letzten 30 chats im detail")).toBe(false);
    expect(isSyntheticPrompt("why did I get a [SYSTEM NOTIFICATION - NOT USER INPUT] here?")).toBe(
      false,
    );
  });

  // Round 6, Phase 2.2 — the OTHER direction, which had no net on either side.
  // This fired on the session that received the round-6 review: the pin read
  // English because an English draft was pasted below German prose.
  describe("a pasted document does not out-vote the typed lead", () => {
    const ENGLISH_DOC = [
      "# Road to something",
      "",
      "This roadmap describes the work that is to be done and the reasons that we",
      "have for doing it, and it goes on at considerable length about all of them.",
      "The point of this fixture is that it is much longer than the instruction and",
      "it is entirely in English, so a whole-body count would resolve to English.",
    ].join("\n");
    const GERMAN_DOC = [
      "# Fahrplan für etwas",
      "",
      "Dieser Fahrplan beschreibt die Arbeit, die zu erledigen ist, und die Gründe,",
      "die wir dafür haben, und er tut das mit einer ganzen Menge an Worten.",
      "Der Sinn dieser Vorlage ist, dass sie viel länger ist als die Anweisung und",
      "vollständig auf Deutsch, sodass eine Zählung über alles Deutsch ergäbe.",
    ].join("\n");

    it("pins to the German instruction above an English paste", () => {
      const prompt = `Bitte schau dir das mal an und sag mir was du davon hältst:\n\n${ENGLISH_DOC}`;
      expect(classify(prompt).language).toBe("de");
    });

    it("pins to the English instruction above a German paste — same rule, no language named", () => {
      const prompt = `Please take a look at this and tell me what you think of it:\n\n${GERMAN_DOC}`;
      expect(classify(prompt).language).toBe("en");
    });

    it("falls back to the whole body when the lead decides nothing", () => {
      // No document marker and no determinate lead: behaviour is unchanged from
      // before the net existed. That fallback is what keeps this conservative.
      expect(classify("ok").language).toBe("und");
      expect(classify("bitte mach das nochmal und prüfe die Regeln").language).toBe("de");
    });
  });

  it("leaves a German pin untouched when a synthetic English turn arrives", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lang-mirror-synth-"));
    const german = "Bitte prüfe die Roadmap und sage mir, welche Phase als nächste dran ist.";
    run(JSON.stringify({ session_id: "s1", payload: { prompt: german } }), {
      consumer_root: dir,
    });
    const afterHuman = JSON.parse(fs.readFileSync(path.join(dir, STATE_FILE), "utf8"));
    expect(afterHuman.language).toBe("de");

    run(JSON.stringify({ session_id: "s1", payload: { prompt: NOTIFICATION } }), {
      consumer_root: dir,
    });
    const afterSynthetic = JSON.parse(fs.readFileSync(path.join(dir, STATE_FILE), "utf8"));
    expect(afterSynthetic.language).toBe("de");
    expect(afterSynthetic.detected_at).toBe(afterHuman.detected_at);
  });
});

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

// ---------------------------------------------------------------------------
// The system-locale fallback — Phase 4 step 1 of `road-to-zero-ceremony-settings`.
//
// The gap it closes: the keep-previous-pin rule has nothing to keep on the FIRST
// prompt of a session, so a terse opener ("weiter", "1") ran with no pin at all
// — the drift this hook exists to remove, at the point with the least other
// evidence. The tests below are weighted towards the cases where the fallback
// must STAY SILENT, because a fallback that over-fires pins a language the user
// never wrote, which is worse than carrying no pin.
// ---------------------------------------------------------------------------

describe("systemLocaleVerdict", () => {
  it("reads a German locale from LANG", () => {
    expect(systemLocaleVerdict({ LANG: "de_DE.UTF-8" })).toBe("de");
  });

  it("reads an English locale from LANG", () => {
    expect(systemLocaleVerdict({ LANG: "en_US.UTF-8" })).toBe("en");
  });

  it("ignores territory and codeset — de_AT, de-CH and de are one answer", () => {
    expect(systemLocaleVerdict({ LANG: "de_AT.UTF-8@euro" })).toBe("de");
    expect(systemLocaleVerdict({ LANG: "de-CH" })).toBe("de");
    expect(systemLocaleVerdict({ LANG: "de" })).toBe("de");
  });

  it("honours LC_ALL over LC_MESSAGES over LANG", () => {
    expect(systemLocaleVerdict({ LC_ALL: "de_DE", LC_MESSAGES: "en_US", LANG: "en_US" })).toBe("de");
    expect(systemLocaleVerdict({ LC_MESSAGES: "de_DE", LANG: "en_US" })).toBe("de");
  });

  it("takes only the leading entry of a LANGUAGE preference list", () => {
    expect(systemLocaleVerdict({ LANGUAGE: "de:en:fr" })).toBe("de");
  });

  it("returns und for a locale the classifier cannot mirror", () => {
    // The user HAS stated a language and it is neither of the two. Mapping it to
    // English would pin words they never wrote.
    expect(systemLocaleVerdict({ LANG: "fr_FR.UTF-8" })).toBe("und");
    expect(systemLocaleVerdict({ LANG: "ja_JP.UTF-8" })).toBe("und");
  });

  it("returns und for C / POSIX, which name no human language", () => {
    expect(systemLocaleVerdict({ LANG: "C" })).toBe("und");
    expect(systemLocaleVerdict({ LC_ALL: "POSIX" })).toBe("und");
  });

  it("returns und on an empty environment", () => {
    expect(systemLocaleVerdict({})).toBe("und");
  });

  it("skips an empty variable rather than treating it as a statement", () => {
    expect(systemLocaleVerdict({ LC_ALL: "", LANG: "de_DE" })).toBe("de");
  });

  it("does not fall through past a non-mirrorable locale to a weaker variable", () => {
    // `LC_ALL` overrides everything by definition. Reading `LANG` after it said
    // French would answer with a variable the system already overrode.
    expect(systemLocaleVerdict({ LC_ALL: "fr_FR", LANG: "en_US" })).toBe("und");
  });
});

describe("nextState — the locale fallback", () => {
  const und = { language: "und" as const, de_markers: 0, en_markers: 0 };

  it("pins from the locale when the first prompt is undetermined", () => {
    const s = nextState({}, und, 1, "s1", "2026-08-06T00:00:00.000Z", "de");
    expect(s?.language).toBe("de");
    expect(s?.source).toBe("system-locale");
  });

  it("writes no pin when there is nothing to keep and no usable locale", () => {
    expect(nextState({}, und, 1, "s1", "2026-08-06T00:00:00.000Z", "und")).toBeNull();
  });

  it("keeps an existing pin instead of overwriting it with the locale", () => {
    // The locale is a FLOOR for the first turn, not a competitor afterwards.
    const previous = { language: "de" as const, source: "prompt" as const };
    expect(nextState(previous, und, 1, "s1", "2026-08-06T00:00:00.000Z", "en")).toBeNull();
  });

  it("a determined prompt outranks a locale pin — the override needs no second mechanism", () => {
    const previous = { language: "en" as const, source: "system-locale" as const };
    const de = { language: "de" as const, de_markers: 9, en_markers: 0 };
    const s = nextState(previous, de, 80, "s1", "2026-08-06T00:00:00.000Z", "en");
    expect(s?.language).toBe("de");
    expect(s?.source).toBe("prompt");
  });

  it("stamps a prompt reading as source prompt, never as the locale", () => {
    const de = { language: "de" as const, de_markers: 9, en_markers: 0 };
    expect(nextState({}, de, 80, "s1", "2026-08-06T00:00:00.000Z", "en")?.source).toBe("prompt");
  });
});

describe("noticeText / pinText provenance", () => {
  it("keeps the audited wording for a prompt-sourced pin", () => {
    // This line is the instrument the 30-session audit measured. Rewording it
    // silently changes what a future audit is comparing against.
    expect(noticeText("de", "prompt")).toBe("Reply language for this turn: German (Deutsch).");
  });

  it("says it fell back to the locale, and how to override it", () => {
    const notice = noticeText("de", "system-locale");
    expect(notice).toMatch(/system locale/i);
    expect(notice).toMatch(/another language/i);
  });

  it("marks the locale pin as the weaker provenance in the injected block", () => {
    const block = pinText("en", "system-locale");
    expect(block).toMatch(/WEAKER/);
    expect(block).toMatch(/locale/i);
    expect(block).not.toMatch(/The user submitted this turn's prompt/);
  });

  it("defaults to the prompt provenance so existing callers are unchanged", () => {
    expect(pinText("de")).toBe(pinText("de", "prompt"));
  });
});

describe("run — the locale fallback end to end", () => {
  it("pins from the locale on a terse FIRST prompt and says so", () => {
    const rc = run(envelope("weiter"), { consumer_root: tmp, env: { LANG: "de_DE.UTF-8" } });
    expect(rc).toBe(2);
    const state = readState();
    expect(state.language).toBe("de");
    expect(state.source).toBe("system-locale");
  });

  it("stays a clean no-op on a terse first prompt with no usable locale", () => {
    expect(run(envelope("weiter"), { consumer_root: tmp, env: {} })).toBe(0);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  it("a later real prompt replaces the locale pin with a prompt pin", () => {
    run(envelope("ok"), { consumer_root: tmp, env: { LANG: "en_US.UTF-8" } });
    expect(readState().source).toBe("system-locale");
    run(envelope(REAL_GERMAN_PROMPT), { consumer_root: tmp, env: { LANG: "en_US.UTF-8" } });
    const state = readState();
    expect(state.language).toBe("de");
    expect(state.source).toBe("prompt");
  });

  it("treats a pre-existing sourceless pin as prompt-sourced", () => {
    // A state file written before `source` existed can only have come from a
    // prompt reading. Reading it as unknown would reword the audited notice for
    // every session that predates this change.
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(
      statePath(),
      JSON.stringify({ language: "de", detected_at: "2026-08-01T00:00:00.000Z" }),
      "utf8",
    );
    const rc = run(envelope("1"), { consumer_root: tmp, env: { LANG: "en_US.UTF-8" } });
    expect(rc).toBe(2);
    // The pin is kept, not overwritten, and the locale does not leak in.
    expect(readState().language).toBe("de");
  });
});
