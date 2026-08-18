/**
 * Payload-body stubs — the opt-in half of D-2
 * (`road-to-per-turn-hook-economy` Phase 2, step 2.1).
 *
 * ## The cost this removes
 *
 * The dispatcher hands each concern the whole envelope as text, once per
 * concern. On claude's `post_tool_use` that is ELEVEN serialisations of the
 * same payload per tool call, and the payload's dominant term is the tool
 * result — routinely hundreds of kilobytes, measured above two megabytes on a
 * large `Read` or `Bash`.
 *
 * Phase 1 tried to remove the repetition by serialising once and sharing the
 * string. It was measured against a pre-registered bar, the two runs disagreed
 * in sign, and the null is published in `_run_concern_inproc`'s header. This
 * is the other lever, and it is orthogonal: it does not change HOW MANY times
 * the envelope is serialised, it changes WHAT IS IN IT. A concern that never
 * reads the result body has no reason to be handed it.
 *
 * ## Two classes, not one flag — the audit forced this
 *
 * The step was drafted as a single boolean ("does this concern need the
 * tool-response body"). The per-concern audit that assigned it refuted the
 * shape: of the eleven concerns on claude's `post_tool_use`, only THREE read
 * no tool payload at all, so a single flag would have bought almost nothing.
 * Six of them read `tool_input` — a path, a command, a range — while reading
 * nothing from the multi-megabyte `tool_response`.
 *
 * So the declaration names CLASSES: `input`, `result`, or both. That is where
 * the saving actually lives — six of eleven post concerns now receive the 2 MB
 * result as a ~120-byte stub while keeping the small input they do read.
 *
 * ## Absent means omitted, and omitted is visible
 *
 * A concern declares `needs_payload_bodies: [input, result]` in
 * `hook_manifest.yaml` for the classes it reads. An undeclared class arrives
 * as a stub carrying the key's NAME, the value's SHAPE, its UTF-8 BYTE LENGTH,
 * and (for an object) its top-level key COUNT. Nothing that could hold file
 * contents, command output, or an API response survives into the stub — no
 * field of `PayloadStub` is able to carry a payload-derived string, which is
 * the same PII-exclusion-by-construction the sibling instruments use rather
 * than a scrubber that could fail.
 *
 * `lint_hook_manifest` derives the requirement from SOURCE, not from trust: a
 * concern bound on a tool slot whose script references a body key must declare
 * that class, or carry a `payload-bodies-waiver:` line saying why it does not.
 * That is the authoring-time half; without it, an added concern that forgets
 * the declaration reads `undefined` in silence.
 *
 * The stub is deliberately a self-describing object rather than `null` or a
 * missing key. A concern that silently depended on a body sees a marked object
 * it can detect, and the dispatcher counts every stub it served, so the
 * failure mode is a NUMBER rather than a bug report — which is step 2.1's own
 * `verify:`.
 *
 * ## Byte-length fidelity is a contract, not a convenience
 *
 * `tool-result-bytes` is an instrument whose entire output is a byte count.
 * Serving it a stub without an exact length would not make it fail — it would
 * make it publish a census of ~120-byte tool results, which is worse than
 * failing. So `bytes` is computed EXACTLY the way that concern computes it
 * (`Buffer.byteLength` of the string, or of `JSON.stringify` for a container,
 * `null` when unserialisable) and the concern reads it back through
 * `stubbedBytes`. That pairing is step 2.2.
 *
 * The absent-vs-empty distinction is preserved on purpose: a payload with no
 * result key under any name produces NO stub, so a concern still sees "absent"
 * rather than "present and zero bytes". Two concerns document that difference
 * as load-bearing (`before_complete_hook`'s `_extract_output`, and
 * `tool_result_bytes_hook`'s `measurable: false`), and a stub that flattened
 * it would turn a known-unknown into wrong-but-plausible data.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * The marker key. Long and namespaced on purpose: it must not collide with a
 * field a host might put inside a real `tool_response`, because a false
 * positive here makes a concern treat live data as an omission.
 */
export const STUB_MARKER = "_agent_config_body_omitted" as const;

/** The two body classes a concern can declare. */
export type BodyClass = "input" | "result";

export const BODY_CLASSES: readonly BodyClass[] = ["input", "result"] as const;

/**
 * Payload keys per class, across every host spelling this tree has observed.
 * `tool_response` / `tool_input` are claude's; the camelCase and `tool_result`
 * variants are the ones `tool_result_bytes_hook`'s own `RESULT_KEYS` reads and
 * are stubbed here for the same reason they are read there.
 *
 * `tool_name` is deliberately ABSENT from both lists: it is an id-shaped enum
 * every concern's `tools:` filter depends on, it cannot carry content, and
 * stubbing it would silently stop `_concern_matches_tool` from filtering.
 * Same for `transcript_path`, `prompt`, `cwd`, `session_id`,
 * `stop_hook_active`, `agent_id` and `payload.source` — all live payload reads
 * in concerns that touch no tool body, and all left untouched because this
 * module stubs the two tool-body classes and nothing else.
 */
export const BODY_KEYS: Readonly<Record<BodyClass, readonly string[]>> = {
  input: ["tool_input", "toolInput"],
  result: ["tool_response", "toolResponse", "tool_result", "toolUseResult"],
};

export interface PayloadStub extends JsonObject {
  [STUB_MARKER]: true;
  /** The payload key this stub stands in for, e.g. `tool_response`. */
  key: string;
  /** `input` | `result` — which class was omitted. */
  body_class: string;
  /** UTF-8 byte length of the omitted value, or `null` if unserialisable. */
  bytes: number | null;
  /** `string` | `object` | `array` | `other` — the omitted value's shape. */
  value_type: string;
  /**
   * Number of top-level keys of an omitted object. Absent for other shapes.
   *
   * A COUNT, not the key names. The names were carried verbatim in the first
   * version of this module and the review caught it against the header's own
   * absolute claim: an object result keyed by ids, filenames or addresses puts
   * payload-derived strings back into the stub, and no concern read the field.
   * A count keeps the shape information the name-and-sizes stub is for while
   * the type again has no field able to hold content.
   */
  key_count?: number;
}

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * UTF-8 byte length of a payload body, measured the way
 * `tool_result_bytes_hook._resultBytes` measures it so a stub and a real body
 * produce the same census number.
 */
export function bodyBytes(value: JsonValue): number | null {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    // Circular or otherwise unserialisable — unmeasurable, never zero.
    return null;
  }
}

/**
 * Measure every body this envelope carries, ONCE.
 *
 * `bodyBytes` serialises the value it measures, so calling it per stub meant
 * re-serialising a 2 MB result once per keep-set — up to four extra full
 * `JSON.stringify` passes per dispatch, on the hot path, in a change whose
 * whole subject is serialisation cost. The review caught it, and noted it may
 * partly explain the published null. The measurement is therefore taken once
 * per dispatch and threaded through, and `stubPayloadBodies` REQUIRES the map
 * rather than accepting an optional one — an optional parameter is how the
 * per-stub re-serialisation would silently come back.
 *
 * `only` narrows it further, to the classes some concern on this slot actually
 * loses. A body every concern declares is never stubbed, so measuring it is
 * pure waste: on claude's `pre_tool_use` all twelve concerns declare `input`,
 * which makes the whole measurement step disappear rather than merely shrink.
 */
export function measureBodies(
  envelope: JsonObject,
  only?: ReadonlySet<BodyClass>,
): Map<string, number | null> {
  const measured = new Map<string, number | null>();
  const payload = envelope["payload"];
  if (!isObject(payload)) return measured;
  for (const cls of BODY_CLASSES) {
    if (only !== undefined && !only.has(cls)) continue;
    for (const key of BODY_KEYS[cls]) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      if (isPayloadStub(v)) continue;
      measured.set(key, bodyBytes(v));
    }
  }
  return measured;
}

/**
 * Build the stub that stands in for `value` under `key`.
 *
 * `bytes` comes from the pre-measured map, never from re-serialising here.
 * A key absent from the map is a caller bug rather than an unmeasurable body,
 * and it degrades to `null` (unmeasurable) rather than to a wrong number.
 */
export function makePayloadStub(
  key: string,
  body_class: BodyClass,
  value: JsonValue,
  measured: ReadonlyMap<string, number | null>,
): PayloadStub {
  const bytes = measured.has(key) ? (measured.get(key) ?? null) : null;
  const stub: PayloadStub = {
    [STUB_MARKER]: true,
    key,
    body_class,
    bytes,
    value_type: Array.isArray(value)
      ? "array"
      : typeof value === "string"
        ? "string"
        : isObject(value)
          ? "object"
          : "other",
  };
  if (isObject(value)) {
    stub.key_count = Object.keys(value).length;
  }
  return stub;
}

/** True when `v` is a dispatcher-served stub rather than a real body. */
export function isPayloadStub(v: unknown): v is PayloadStub {
  return isObject(v) && v[STUB_MARKER] === true;
}

/**
 * The omitted body's byte length when `v` is a stub, `undefined` when it is
 * not — so a caller can distinguish "omitted, and this many bytes" from
 * "present, measure it yourself".
 */
export function stubbedBytes(v: unknown): number | null | undefined {
  if (!isPayloadStub(v)) return undefined;
  return typeof v.bytes === "number" ? v.bytes : null;
}

/** Body classes this envelope actually carries — the stubbable set. */
export function presentBodyClasses(envelope: JsonObject): Set<BodyClass> {
  const found = new Set<BodyClass>();
  const payload = envelope["payload"];
  if (!isObject(payload)) return found;
  for (const cls of BODY_CLASSES) {
    for (const key of BODY_KEYS[cls]) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      if (isPayloadStub(v)) continue;
      found.add(cls);
      break;
    }
  }
  return found;
}

/**
 * Return an envelope whose payload bodies are stubbed for every class NOT in
 * `keep`.
 *
 * Shallow-clones the envelope and its payload; every other value is shared
 * with the caller's object. That is safe because the dispatcher serialises the
 * result immediately and never hands the object itself to a concern — the
 * isolation boundary the Phase 1 null asked to preserve is the SERIALISED
 * STRING, and it is unchanged here.
 *
 * Returns the input unchanged (same reference) when there is nothing to stub,
 * so the common no-body event — `stop`, `session_start`, `user_prompt_submit`
 * — costs one property read and no allocation.
 */
export function stubPayloadBodies(
  envelope: JsonObject,
  keep: ReadonlySet<BodyClass>,
  measured: ReadonlyMap<string, number | null>,
): JsonObject {
  const payload = envelope["payload"];
  if (!isObject(payload)) return envelope;
  const drop = BODY_CLASSES.filter((c) => !keep.has(c));
  if (drop.length === 0) return envelope;
  let hit = false;
  for (const cls of drop) {
    for (const key of BODY_KEYS[cls]) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      if (isPayloadStub(v)) continue;
      hit = true;
      break;
    }
    if (hit) break;
  }
  if (!hit) return envelope;
  const nextPayload: JsonObject = { ...payload };
  for (const cls of drop) {
    for (const key of BODY_KEYS[cls]) {
      const v = nextPayload[key];
      if (v === undefined || v === null) continue;
      if (isPayloadStub(v)) continue;
      nextPayload[key] = makePayloadStub(key, cls, v, measured);
    }
  }
  return { ...envelope, payload: nextPayload };
}

/** How many payload keys `stubPayloadBodies` would replace, given `keep`. */
export function countStubbedKeys(
  envelope: JsonObject,
  keep: ReadonlySet<BodyClass>,
): number {
  const payload = envelope["payload"];
  if (!isObject(payload)) return 0;
  let n = 0;
  for (const cls of BODY_CLASSES) {
    if (keep.has(cls)) continue;
    for (const key of BODY_KEYS[cls]) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      if (isPayloadStub(v)) continue;
      n += 1;
    }
  }
  return n;
}

/**
 * Parse a concern's `needs_payload_bodies` declaration into a keep-set.
 *
 * Unknown entries are IGNORED rather than treated as "keep everything": the
 * lint rejects them at authoring time, and a runtime that widened on a typo
 * would make the lint's job undoable. A malformed value therefore behaves like
 * the absent case, which the guard floor in the dispatcher covers for every
 * concern where that would be unsafe.
 */
export function parseBodyClasses(raw: unknown): Set<BodyClass> {
  const keep = new Set<BodyClass>();
  if (!Array.isArray(raw)) return keep;
  for (const entry of raw) {
    if (entry === "input" || entry === "result") keep.add(entry);
  }
  return keep;
}

/** Every class — the guard floor and the "declared both" case. */
export function allBodyClasses(): Set<BodyClass> {
  return new Set<BodyClass>(BODY_CLASSES);
}

/**
 * The payload-body classes a concern receives in full; every other class
 * arrives as a stub (`road-to-per-turn-hook-economy` Phase 2, step 2.1).
 *
 * The default is EMPTY, deliberately: a concern that reads a body says so,
 * rather than every concern paying for the bodies because one of them might.
 * The audit that assigned the declarations is in the PR that added the field;
 * the dispatcher's stub counter is what catches an assignment that was wrong.
 *
 * ## Why a blocking or fail-closed concern can never be stubbed
 *
 * For an advisory concern a missing declaration costs a finding: it reads
 * `undefined` where it expected a body and stays quiet. For a guard it costs
 * an ALLOW — `block-no-verify` reads `tool_input.command`, and a stub makes
 * that `undefined`, after which the guard has nothing to match and exits 0.
 * That is the identical shape as the measured stdin bypass this same roadmap
 * fixed in Phase 1 (an empty payload silently disarming every guard on the
 * event), and it would be re-introduced by a single omitted YAML line.
 *
 * So the declaration is not the only path to the bodies: `fail_closed` or
 * `severity: blocking` keeps ALL classes, structurally, regardless of what the
 * manifest says. The lint additionally requires those concerns to declare
 * their classes explicitly so a reader of the manifest sees the truth — but
 * the dispatcher does not depend on the lint having run. The cost of the floor
 * is zero on the one blocking concern that reads no body: `turn-end-gate`
 * binds `stop`, which carries no tool bodies to stub.
 */
export function _concern_body_classes(concern: JsonObject): Set<BodyClass> {
  if (concern["fail_closed"] === true || concern["severity"] === "blocking") {
    return allBodyClasses();
  }
  return parseBodyClasses(concern["needs_payload_bodies"]);
}

/** The per-dispatch shaping plan. Built once, read per concern. */
export interface PayloadShapePlan {
  /** The envelope a concern with this keep-set receives. */
  shapeFor(keep: ReadonlySet<BodyClass>): JsonObject;
  /** How many payload keys were omitted for that concern. */
  stubsFor(keep: ReadonlySet<BodyClass>): number;
  /** The classes actually SERVED — declared AND present. Sorted. */
  servedBy(keep: ReadonlySet<BodyClass>): string[];
}

/**
 * Plan every envelope shape this dispatch needs, in one pass.
 *
 * There are at most FOUR distinct shapes per event (keep neither / input /
 * result / both), so they are memoised by keep-set: concerns sharing a
 * declaration share one clone, and building one per concern would re-pay the
 * allocation the stub exists to avoid.
 *
 * The measurement is scoped twice over, because both scopes matter:
 * — to the classes the event actually CARRIES (`present`), so a body-less
 *   event such as `stop` or `user_prompt_submit` costs one property read;
 * — to the classes at least one concern LOSES, because a class every concern
 *   declares is never stubbed and measuring it is pure waste. On claude's
 *   `pre_tool_use` all twelve concerns declare `input`, which makes the
 *   measurement pass vanish rather than merely shrink.
 *
 * Extracted from the dispatcher loop rather than inlined there: the decision
 * has four moving parts that are only correct together, and the source-size
 * ratchet was right to object to a dispatcher carrying them.
 */
export function planPayloadShapes(
  envelope: JsonObject,
  keepSets: Iterable<ReadonlySet<BodyClass>>,
): PayloadShapePlan {
  const present = presentBodyClasses(envelope);
  const stubbedSomewhere = new Set<BodyClass>();
  for (const keep of keepSets) {
    for (const cls of present) {
      if (!keep.has(cls)) stubbedSomewhere.add(cls);
    }
  }
  const measured =
    stubbedSomewhere.size > 0
      ? measureBodies(envelope, stubbedSomewhere)
      : new Map<string, number | null>();
  const shaped = new Map<string, JsonObject>();
  const cacheKey = (keep: ReadonlySet<BodyClass>): string =>
    [...keep].sort().join(",");
  return {
    shapeFor(keep) {
      if (present.size === 0) return envelope;
      const key = cacheKey(keep);
      const hit = shaped.get(key);
      if (hit !== undefined) return hit;
      const built = stubPayloadBodies(envelope, keep, measured);
      shaped.set(key, built);
      return built;
    },
    stubsFor(keep) {
      return countStubbedKeys(envelope, keep);
    },
    servedBy(keep) {
      return [...keep].filter((c) => present.has(c)).sort();
    },
  };
}
