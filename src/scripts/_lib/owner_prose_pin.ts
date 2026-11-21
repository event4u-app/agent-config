/**
 * The owner-prose language pin (road-to-a-language-pin-from-owner-prose, D1/D5),
 * as a library the live hooks do NOT import yet.
 *
 * The owner withdrew the hook-bundle raise this needs (option 2, 2026-11-21):
 * the classifier, the pin-state step and the gate rule are landed here, used by
 * `measure_turn_end_gate --language-split` and the tests, and kept off the
 * dispatch bundle. Wiring them into `language_mirror_hook` and
 * `turn_end_gate_hook` is road-to-a-language-pin-from-owner-prose-live-wiring,
 * which carries the bundle raise with it.
 */
import { MIN_MARKERS, nextState, scoreText, type Classification, type PinState } from "../language_mirror_hook.js";
import { ownerProse } from "./prompt_shape.js";

/** A prompt's classification: it always says how much owner prose stood behind it. */
export type PromptClassification = Classification & { owner_prose_chars: number };

/**
 * Classify a PROMPT for the pin: only text the owner typed decides it (D1).
 * Candidate: `ownerProse(prompt)` — the lead and the paragraph after the last
 * paste — under `MIN_MARKERS` (D5), with NO whole-body fallback; `und` keeps the
 * previous pin. Veto: the candidate becomes `und` whenever the RAW prompt, with
 * nothing removed (a pasted wrapper tag is byte-identical to the host's own),
 * holds `MIN_MARKERS` of the opposing language — so owner text at the floor is
 * never outvoted. Cost: an instruction beside a paste or host wrapper in
 * the other language keeps the previous pin.
 */
export function classifyOwnerProse(prompt: string): PromptClassification {
  const { lead, trailing, text } = ownerProse(prompt);
  const owner = [lead, trailing].filter((s) => s.trim() !== "").join("\n\n");
  const verdict = scoreText(owner);
  const all = scoreText(text);
  // Checked directly, not via the spans being a subset of the raw text (round 15).
  const opposing =
    verdict.language === "de" ? all.en_markers : verdict.language === "en" ? all.de_markers : 0;
  const language = opposing >= MIN_MARKERS ? "und" : verdict.language;
  return { ...verdict, language, owner_prose_chars: owner.length };
}

/**
 * `nextState` with the owner-prose classification, recording
 * `owner_prose_chars` on every pin it writes: the typed characters on a
 * prompt pin, 0 on a locale pin. `null` keeps the previous pin, as there.
 */
export function ownerProseNextState(
  previous: Partial<PinState>,
  classification: PromptClassification,
  prompt_chars: number,
  session_id: string,
  now: string,
  locale: Classification["language"] = "und",
): PinState | null {
  const next = nextState(previous, classification, prompt_chars, session_id, now, locale);
  if (next === null) return null;
  return { ...next, owner_prose_chars: next.source === "prompt" ? classification.owner_prose_chars : 0 };
}
