/**
 * THE single trigger-matcher implementation for `dist/router.json`.
 *
 * Parity by construction: every surface that answers "which rules fire on
 * this prompt?" — router replay (`router_telemetry.ts`), trigger-coverage
 * CI (`trigger_coverage.ts`), `agent-config explain route`, and
 * `agent-config route:explain` — MUST import the matchers from this module.
 * A second implementation of these semantics anywhere in the tree is a
 * violation (enforced by `tests/scripts/router_match_parity.test.ts`); the
 * historical divergence this kills was `cmd_explain.ts` shipping unanchored
 * keyword matching while the replay path was anchored.
 *
 * Canonical semantics: `docs/contracts/rule-router.md` § `triggers:` shape
 * (the trigger-semantics table — anchored `keyword`, unanchored `phrase`,
 * `command` prefix, `path_prefix` / `file_pattern` over open files).
 *
 * Extracted verbatim from `router_telemetry.ts` (which re-exports the same
 * names for existing importers). Behaviour is pinned by the routing-matrix
 * and trigger-coverage suites — do not "fix" quirks here.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Trigger = Record<string, JsonValue>;

export interface Rule {
  id?: JsonValue;
  triggers?: JsonValue;
  [key: string]: JsonValue;
}

export interface Router {
  kernel?: JsonValue;
  tier_1?: JsonValue;
  tier_2?: JsonValue;
  [key: string]: JsonValue;
}

// ── fnmatch (Python fnmatch.fnmatch) ─────────────────────────────────────

/**
 * Translate a Unix shell pattern into a RegExp, matching CPython's
 * `fnmatch.translate`. `*` → `.*`, `?` → `.`, `[...]` char classes
 * preserved (with `!` → `^` negation), everything else escaped.
 * Matching is case-sensitive on POSIX (the corpus paths are POSIX).
 */
function _fnmatchToRegExp(pat: string): RegExp {
  let res = "";
  let i = 0;
  const n = pat.length;
  while (i < n) {
    const c = pat[i] as string;
    i += 1;
    if (c === "*") {
      res += ".*";
    } else if (c === "?") {
      res += ".";
    } else if (c === "[") {
      let j = i;
      if (j < n && pat[j] === "!") {
        j += 1;
      }
      if (j < n && pat[j] === "]") {
        j += 1;
      }
      while (j < n && pat[j] !== "]") {
        j += 1;
      }
      if (j >= n) {
        res += "\\[";
      } else {
        let stuff = pat.slice(i, j);
        if (!stuff.includes("-")) {
          stuff = stuff.replace(/\\/g, "\\\\");
        } else {
          // Faithful port of CPython's dash-handling in fnmatch.translate:
          // split the class body on `-` (bounded to [i, j)), escaping each
          // chunk, then re-join with `-` so ranges survive.
          const chunks: string[] = [];
          let k = pat[i] === "!" ? i + 2 : i + 1;
          let start = i;
          while (true) {
            const rel = pat.slice(k, j).indexOf("-");
            if (rel < 0) {
              break;
            }
            const idx = k + rel;
            chunks.push(pat.slice(start, idx));
            start = idx + 1;
            k = idx + 3;
          }
          chunks.push(pat.slice(start, j));
          stuff = chunks
            .map((s) => s.replace(/\\/g, "\\\\").replace(/-/g, "\\-"))
            .join("-");
        }
        // Escape regex set-meta chars except backslash/dash already handled.
        stuff = stuff.replace(/([&~|])/g, "\\$1");
        i = j + 1;
        if (stuff.startsWith("!")) {
          stuff = "^" + stuff.slice(1);
        } else if (stuff.startsWith("^") || stuff.startsWith("[")) {
          stuff = "\\" + stuff;
        }
        res += `[${stuff}]`;
      }
    } else {
      res += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^(?:${res})$`, "s");
}

export function _fnmatch(name: string, pat: string): boolean {
  return _fnmatchToRegExp(pat).test(name);
}

// ── Trigger matching ─────────────────────────────────────────────────────

/** Apply one trigger to a prompt + context; return True on match. */
/** Unicode word character — letters, digits, underscore (incl. umlauts). */
const _WORD_CHAR = /[\p{L}\p{N}_]/u;

function _isWordChar(c: string | undefined): boolean {
  return c !== undefined && _WORD_CHAR.test(c);
}

/**
 * Word-boundary-anchored keyword match (road-to-tested-routing Phase 3).
 *
 * A `keyword` occurrence counts only when its word-character edges sit on
 * word boundaries: `ac` no longer fires inside "black", `plan` no longer
 * fires inside "planet". Two deliberate reliefs:
 *
 * - An edge that is itself a NON-word character (e.g. `__()`, `/image:`,
 *   `trans(`, an emoji) carries no boundary requirement on that side —
 *   punctuation-shaped keywords keep their exact substring semantics.
 * - The right boundary accepts one optional plural `s` ("icons", "options",
 *   "secrets" still fire their singular keyword). Richer inflection (German
 *   verb endings: "implementiere", "committen") is a DOCUMENTED accepted
 *   recall cost of anchoring — the matrices carry standalone-token phrasings
 *   for those languages instead.
 *
 * `phrase` deliberately stays unanchored substring; since this change the
 * two trigger kinds genuinely differ.
 */
export function keyword_matches_anchored(prompt_lower: string, kw_lower: string): boolean {
  if (kw_lower === "") {
    return false;
  }
  const needLeft = _isWordChar(kw_lower[0]);
  const needRight = _isWordChar(kw_lower[kw_lower.length - 1]);
  let idx = prompt_lower.indexOf(kw_lower);
  while (idx !== -1) {
    const leftOk = !needLeft || !_isWordChar(prompt_lower[idx - 1]);
    let rightOk = true;
    if (needRight) {
      let end = idx + kw_lower.length;
      if (prompt_lower[end] === "s") {
        end += 1; // optional plural `s`
      }
      rightOk = !_isWordChar(prompt_lower[end]);
    }
    if (leftOk && rightOk) {
      return true;
    }
    idx = prompt_lower.indexOf(kw_lower, idx + 1);
  }
  return false;
}

export function trigger_matches(
  trigger: Trigger,
  prompt: string,
  open_files?: Iterable<string> | null,
  command?: string | null,
): boolean {
  const prompt_lower = prompt.toLowerCase();
  if ("keyword" in trigger) {
    return keyword_matches_anchored(prompt_lower, String(trigger["keyword"]).toLowerCase());
  }
  if ("phrase" in trigger) {
    return prompt_lower.includes(String(trigger["phrase"]).toLowerCase());
  }
  if ("command" in trigger) {
    if (!command) {
      return false;
    }
    return command.startsWith(String(trigger["command"]));
  }
  if ("path_prefix" in trigger) {
    if (!open_files) {
      return false;
    }
    const pref = String(trigger["path_prefix"]);
    for (const p of open_files) {
      if (String(p).startsWith(pref)) {
        return true;
      }
    }
    return false;
  }
  if ("file_pattern" in trigger) {
    if (!open_files) {
      return false;
    }
    const pat = String(trigger["file_pattern"]);
    for (const p of open_files) {
      if (_fnmatch(String(p), pat)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

export interface MatchedTrigger {
  tier: string;
  rule: JsonValue | undefined;
  trigger: Trigger;
}

export interface ActivatedRule {
  tier: string;
  rule: JsonValue | undefined;
}

export interface MatchResult {
  matched_triggers: MatchedTrigger[];
  activated_rules: ActivatedRule[];
}

export function _asRuleList(value: JsonValue | undefined): Rule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as Rule[];
}

export function _asTriggerList(value: JsonValue | undefined): Trigger[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as Trigger[];
}

/**
 * Return the matched-triggers + activated-rules for one prompt.
 *
 * Kernel rules are always active. tier_1 always considered. tier_2
 * only considered when `profile == 'full'`.
 */
export function match_prompt(
  router: Router,
  prompt: string,
  profile = "full",
  open_files?: Iterable<string> | null,
  command?: string | null,
): MatchResult {
  const tiers: Array<[string, Rule[]]> = [
    ["tier_1", _asRuleList(router["tier_1"])],
  ];
  if (profile === "full") {
    tiers.push(["tier_2", _asRuleList(router["tier_2"])]);
  }

  const matched_triggers: MatchedTrigger[] = [];
  const activated_rules: ActivatedRule[] = [];

  for (const [tier_name, rules] of tiers) {
    for (const rule of rules) {
      const rule_id = rule["id"];
      const rule_triggers = _asTriggerList(rule["triggers"]);
      let rule_hit = false;
      for (const trig of rule_triggers) {
        if (trigger_matches(trig, prompt, open_files, command)) {
          matched_triggers.push({ tier: tier_name, rule: rule_id, trigger: trig });
          rule_hit = true;
        }
      }
      if (rule_hit) {
        activated_rules.push({ tier: tier_name, rule: rule_id });
      }
    }
  }

  // Kernel rules are always active.
  const kernel = Array.isArray(router["kernel"]) ? router["kernel"] : [];
  for (const kid of kernel) {
    activated_rules.push({ tier: "kernel", rule: kid });
  }

  return { matched_triggers, activated_rules };
}
