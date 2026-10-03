/**
 * Vendor-CLI sentinel values that are DATA, carried in a module with no
 * dependencies of its own.
 *
 * WHY THIS FILE EXISTS, measured rather than argued. `OPENAI_CLI_VENDOR_DEFAULT`
 * is a single string, and it used to live in `clients.ts` beside the transport
 * classes that compare against it. `ai_council/config.ts` imports that one
 * string and nothing else from `clients.ts`; `config.ts` is reachable from
 * `council-availability`, which is bound on `session_start`. So every hook
 * dispatch on every slot carried the whole council transport layer —
 * `clients.ts` and its closure, **51,523 bytes** of the composed
 * `dist/hooks/dispatch.js` — to compare one string against another. Breaking
 * that one import edge removes exactly that, with no capability removed
 * anywhere: every entry point that actually talks to a vendor CLI imports
 * `clients.ts` directly and still does.
 *
 * The bytes are not an abstraction. `src/config/hook-bundle-budget.json` caps
 * the composed bundle, the cap is a shrink-only ratchet, and on 2026-10-02 the
 * tree stood 75 bytes under it — a state in which no concern anywhere could add
 * a line. This module is how `road-to-a-rule-carrier-that-works-outside-the-repo`
 * Phase 1 paid for its own runtime code instead of asking for a raise.
 *
 * WHAT BELONGS HERE: a vendor-facing constant that a CONFIGURATION reader needs
 * and a TRANSPORT reader also happens to use. Nothing that imports anything.
 * The moment this file gains an import it stops being the cheap half of the
 * split and the split stops being worth its own file.
 */

/**
 * Sentinel: let the codex CLI pick its own model, by omitting `--model`.
 *
 * This is not a placeholder for a value nobody looked up. Measured
 * 2026-08-15 against `codex exec --json` on a ChatGPT-account (subscription)
 * transport, every explicitly named candidate was refused with
 * `400 invalid_request_error: The '<model>' model is not supported when using
 * Codex with a ChatGPT account.` — `gpt-4o`, `gpt-5` (this constant's previous
 * value) and `gpt-5.1-codex` alike. Omitting the flag answered normally.
 *
 * So the only value known to work on this transport is "whatever the CLI
 * chooses", and pinning ANY name here would re-break the seat the next time
 * the vendor rotates its lineup. The label is carried into records as-is so a
 * reader can see that no model was pinned, rather than a name being implied
 * that nobody verified.
 */
export const OPENAI_CLI_VENDOR_DEFAULT = 'codex-default';
