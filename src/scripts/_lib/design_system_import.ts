/**
 * Import adapter for the `design-system.json` consumer contract — three lanes,
 * one shape (road-to-design-system-onramp Phase 1).
 *
 * The contract in `design-system-capture/references/design-system-json.md` was
 * written for an ecosystem of external extraction tools and, until this module,
 * nothing in the tree ever fed it: no script under `src/scripts/` read, parsed,
 * or validated a `design-system.json`. The work-engine only ever asked whether
 * the key was *present*. So this is the missing producer-side half, and it is
 * deliberately the smallest thing that can be one: a **pure, no-network file
 * transform**. It never fetches, never crawls, never launches a browser — the
 * 2026-06-28 lock says the package owns the contract and not the crawler, and a
 * transform that reached the network would quietly become the crawler.
 *
 * Three input lanes:
 *
 *   - `native`    — an existing `design-system.json`: validated and passed
 *                   through, so a hand-authored or previously-exported file
 *                   travels the same code path as an extracted one.
 *   - `dtcg`      — a W3C Design Tokens file (`{$value, $type}` leaves). Mapped
 *                   by `$type`, never by path: the type IS the semantic in
 *                   DTCG, and a foreign file will not use this repo's own
 *                   `primitive`/`semantic`/`component` layer names.
 *   - `dembrandt` — the rich extraction lane, mapped by DOCUMENTED top-level
 *                   key name with tolerant inner shapes. See the honesty note
 *                   below; this is the lane most likely to drift.
 *
 * **Why the dembrandt lane is shape-tolerant rather than schema-pinned.** The
 * tool documents its output *categories* (colors, typography, spacing, borders,
 * shadows, motion, components, breakpoints) and names exactly two top-level
 * JSON keys explicitly — `motion` and `wcag`. It publishes no schema for the
 * nested values. Pinning invented field names and coding against them is the
 * precise failure `source-discovery-gate` exists to stop, so this lane matches
 * on the documented key names and then accepts a small set of *shapes* per
 * bucket, routing everything it does not recognise to `_meta.unmapped` with a
 * note. That is the roadmap's own falsifier honoured in code: a value that
 * cannot be mapped without inventing it ships as observation, never as a token.
 *
 * **Provenance is mandatory on every lane.** The contract rejects an artifact
 * with no `source` — you cannot confirm what you cannot trace. A DTCG file
 * never carries provenance by construction, so the caller may supply it; when
 * it does, `source._meta.provenance_origin` records `caller` rather than
 * `input`, so a reader can always tell an extracted provenance from an asserted
 * one. No provenance from either side is a rejection, not a default.
 *
 * Everything this module emits is **observed, not authoritative** (the
 * contract's trust posture). It produces a proposal for per-field human
 * confirmation; it never writes `DESIGN.md` and never resolves a brand conflict.
 */

/** The three documented input lanes. */
export type Lane = 'native' | 'dtcg' | 'dembrandt';

/** Provenance block — mandatory, per the contract's `source` rule. */
export interface SourceBlock {
    kind: 'url' | 'repo' | 'dir';
    ref: string;
    captured_at: string;
    _meta?: { provenance_origin: 'input' | 'caller' };
}

export interface FontFamily {
    role: string;
    name: string;
    bundled_local: boolean;
}

export interface ScaleStep {
    step: string;
    size: string;
    lineHeight?: string;
}

export interface ComponentObservation {
    name: string;
    observed: { classes?: string[]; props?: string[] };
}

/** The contract shape. Only `source` is mandatory; every other key is optional. */
export interface DesignSystem {
    source: SourceBlock;
    colors?: { light?: Record<string, string>; dark?: Record<string, string> };
    typography?: { families?: FontFamily[]; scale?: ScaleStep[] };
    spacing?: { base?: string; scale?: string[] };
    radius?: Record<string, string>;
    shadow?: Record<string, string>;
    motion?: {
        durations?: Record<string, string>;
        easings?: Record<string, string>;
        _meta?: Record<string, unknown>;
    };
    components?: ComponentObservation[];
    _meta?: Record<string, unknown>;
}

export type ImportOutcome =
    | { ok: true; lane: Lane; design_system: DesignSystem; notes: string[] }
    | { ok: false; lane: Lane | null; reason: string };

/** Caller-supplied provenance, used only when the input carries none. */
export interface ProvenanceOverride {
    kind: 'url' | 'repo' | 'dir';
    ref: string;
    captured_at?: string;
}

const SOURCE_KINDS = new Set(['url', 'repo', 'dir']);

/**
 * Top-level keys the extraction tool documents. Matching is by NAME only —
 * the nested shapes are undocumented and are handled tolerantly below.
 */
const DEMBRANDT_KEYS = new Set([
    'colors',
    'typography',
    'spacing',
    'borders',
    'shadows',
    'motion',
    'components',
    'breakpoints',
    'wcag',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A DTCG leaf is `{$value, …}`; the draft-era `{value, type}` spelling counts too. */
function isTokenLeaf(v: unknown): v is Record<string, unknown> {
    if (!isPlainObject(v)) return false;
    return '$value' in v || ('value' in v && 'type' in v);
}

function leafValue(node: Record<string, unknown>): string | null {
    const raw = '$value' in node ? node['$value'] : node['value'];
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number') return String(raw);
    return null;
}

function leafType(node: Record<string, unknown>): string | null {
    const raw = '$type' in node ? node['$type'] : node['type'];
    return typeof raw === 'string' ? raw : null;
}

/**
 * Decide the lane from the input's own shape.
 *
 * Order matters: `native` is checked first because an exported artifact may
 * legitimately contain DTCG-looking sub-objects, and a native file must never
 * be re-mapped through the lossy DTCG path.
 */
export function detectLane(input: unknown): Lane | null {
    if (!isPlainObject(input)) return null;
    // The PRESENCE of a `source` block is the native marker, not its validity.
    // Requiring a well-formed one here would route a native artifact with
    // broken provenance into a token lane, which then rejects it with "this
    // format does not carry provenance" — true of that lane and false of the
    // file the user actually has. A malformed `source` must fail as a malformed
    // `source`.
    if (isPlainObject(input['source'])) return 'native';
    if (hasTokenLeaf(input, 0)) return 'dtcg';
    for (const key of Object.keys(input)) {
        if (DEMBRANDT_KEYS.has(key)) return 'dembrandt';
    }
    return null;
}

/** Depth-bounded search for a DTCG leaf — a token file always has one near the top. */
function hasTokenLeaf(node: unknown, depth: number): boolean {
    if (depth > 6 || !isPlainObject(node)) return false;
    for (const value of Object.values(node)) {
        if (isTokenLeaf(value)) return true;
        if (hasTokenLeaf(value, depth + 1)) return true;
    }
    return false;
}

/** Read the `source` block off a native artifact, or explain why it is unusable. */
function readSource(raw: unknown): { source: SourceBlock } | { error: string } {
    if (!isPlainObject(raw)) return { error: 'source is missing' };
    const kind = raw['kind'];
    const ref = raw['ref'];
    const capturedAt = raw['captured_at'];
    if (typeof kind !== 'string' || !SOURCE_KINDS.has(kind)) {
        return { error: `source.kind must be one of url|repo|dir (got ${JSON.stringify(kind)})` };
    }
    if (typeof ref !== 'string' || ref.trim() === '') {
        return { error: 'source.ref is missing or empty' };
    }
    if (typeof capturedAt !== 'string' || capturedAt.trim() === '') {
        return { error: 'source.captured_at is missing or empty' };
    }
    return {
        source: {
            kind: kind as SourceBlock['kind'],
            ref,
            captured_at: capturedAt,
            _meta: { provenance_origin: 'input' },
        },
    };
}

function sourceFromOverride(p: ProvenanceOverride): SourceBlock {
    return {
        kind: p.kind,
        ref: p.ref,
        // A capture time the caller did not state is not invented: the field is
        // mandatory, so an absent one is recorded as unknown rather than as now.
        captured_at: p.captured_at ?? 'unknown',
        _meta: { provenance_origin: 'caller' },
    };
}

/**
 * String→string maps survive; anything else is reported rather than coerced.
 *
 * `dropped` collects the keys this helper could not take. Without it the helper
 * returned a PARTIAL map and looked like a success: because the result was
 * non-null, the caller's `else` branch — the one that routes an unrecognised
 * value into `_meta` — never ran, so a nested subtree vanished with an empty
 * note list. Reporting the loss is what lets every caller keep the module's own
 * promise that nothing is dropped in silence.
 */
function stringMap(value: unknown, dropped?: string[]): Record<string, string> | null {
    if (!isPlainObject(value)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string') out[k] = v;
        else if (typeof v === 'number') out[k] = String(v);
        else dropped?.push(k);
    }
    return Object.keys(out).length > 0 ? out : null;
}

/** As `stringMap`, for arrays; `dropped` collects the indices that did not fit. */
function stringList(value: unknown, dropped?: string[]): string[] | null {
    if (!Array.isArray(value)) return null;
    const out: string[] = [];
    value.forEach((v, i) => {
        if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
        else dropped?.push(String(i));
    });
    return out.length > 0 ? out : null;
}

// --- lane: native ------------------------------------------------------------

/**
 * Structural expectation per contract key — `object` covers both the role-maps
 * (`radius`, `shadow`) and the nested blocks (`colors`, `typography`, …).
 */
const NATIVE_KEY_SHAPE: Record<string, 'object' | 'array'> = {
    colors: 'object',
    typography: 'object',
    spacing: 'object',
    radius: 'object',
    shadow: 'object',
    motion: 'object',
    components: 'array',
    _meta: 'object',
};

/**
 * Validate against the contract's field rules, then pass through.
 *
 * The lane deliberately does NOT rewrite values: a native artifact has already
 * been through somebody's per-field confirmation, and silently normalising it
 * here would make two runs over the same file disagree.
 *
 * Validation is therefore **report-only** past the mandatory `source`. A key
 * whose shape contradicts the contract is kept and flagged, not dropped: the
 * import is a proposal a human reads, and a value they can see and reject is
 * strictly better than one this module deleted on their behalf. Only missing
 * provenance is fatal, because that is the one rule the contract itself states
 * as a rejection.
 */
function mapNative(input: Record<string, unknown>): ImportOutcome {
    const src = readSource(input['source']);
    if ('error' in src) {
        return { ok: false, lane: 'native', reason: `native lane rejected — ${src.error}` };
    }
    const notes: string[] = [];
    const carried: Record<string, unknown> = {};
    const unmapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
        if (key === 'source') continue;
        const expected = NATIVE_KEY_SHAPE[key];
        if (expected === undefined) {
            notes.push(`unknown top-level key "${key}" is not in the contract — kept under _meta.unmapped`);
            unmapped[key] = value;
            continue;
        }
        const shapeOk = expected === 'array' ? Array.isArray(value) : isPlainObject(value);
        if (!shapeOk) {
            notes.push(`"${key}" should be ${expected === 'array' ? 'an array' : 'an object'} — kept as-is and flagged for the human`);
        }
        carried[key] = value;
    }

    // `bundled_local` is a flag the extractor sets, never an instruction to
    // this package — a non-boolean there means the producer misread the
    // contract, and the human should see that rather than a coerced `false`.
    const typography = carried['typography'];
    if (isPlainObject(typography) && Array.isArray(typography['families'])) {
        for (const fam of typography['families']) {
            if (isPlainObject(fam) && 'bundled_local' in fam && typeof fam['bundled_local'] !== 'boolean') {
                notes.push('typography.families[].bundled_local is not a boolean — the contract makes it a flag, not a value');
                break;
            }
        }
    }

    if (Object.keys(unmapped).length > 0) {
        const existingMeta = isPlainObject(carried['_meta']) ? carried['_meta'] : {};
        // Merge INTO any existing `_meta.unmapped` rather than replacing it.
        // Overwriting the key loses entries a previous pass recorded — reachable
        // by re-importing this adapter's own output — and losing carried values
        // is precisely what the native lane exists not to do.
        const existingUnmapped = isPlainObject(existingMeta['unmapped']) ? existingMeta['unmapped'] : {};
        carried['_meta'] = { ...existingMeta, unmapped: { ...existingUnmapped, ...unmapped } };
    }

    // The cast is the lane's contract with itself: `source` is validated above,
    // every other key is carried verbatim and its shape reported rather than
    // enforced, so the type is an assertion about provenance only.
    const out = { source: src.source, ...carried } as DesignSystem;
    return { ok: true, lane: 'native', design_system: out, notes };
}

// --- lane: dtcg --------------------------------------------------------------

/**
 * Bucket a DTCG leaf by its `$type`.
 *
 * `dimension` is genuinely ambiguous — DTCG uses it for spacing, radius and
 * font size alike — so the PATH breaks the tie, and only for that one type.
 * Everywhere else the type decides, which is what keeps this lane independent
 * of any particular authoring tool's group names.
 */
function dtcgBucket(type: string | null, path: string[]): string | null {
    const joined = path.join('.').toLowerCase();
    switch (type) {
        case 'color':
            return 'color';
        case 'fontFamily':
            return 'fontFamily';
        case 'shadow':
            return 'shadow';
        case 'duration':
            return 'duration';
        case 'cubicBezier':
            return 'easing';
        case 'dimension':
        case 'number':
            if (joined.includes('radius') || joined.includes('rounded')) return 'radius';
            if (joined.includes('fontsize') || joined.includes('font-size')) return 'fontSize';
            if (joined.includes('spacing') || joined.includes('space')) return 'spacing';
            return null;
        default:
            return null;
    }
}

/** Segments that are never a role on their own — they name the bucket, not the value. */
const NON_ROLE_SEGMENTS = new Set([
    'color',
    'colors',
    'spacing',
    'radius',
    'shadow',
    'duration',
    'easing',
    'fontsize',
    'fontfamily',
    'default',
]);

/**
 * Derive a role name from a token's path.
 *
 * The last segment alone is wrong for the two commonest DTCG layouts, and both
 * failures are silent overwrites rather than errors: a palette (`color.gray.50`
 * and `color.blue.50` both reduce to `50`) and a bucket-named leaf
 * (`button.radius` and `card.radius` both reduce to `radius`). So a numeric or
 * bucket-naming final segment takes its parent with it — `gray-50`,
 * `button-radius` — and every other leaf keeps its own name.
 */
export function roleName(path: string[]): string {
    // A `default` leaf names its parent, so it is dropped BEFORE anything is
    // joined. Joining first and stripping the suffix afterwards takes the
    // *bucket* as the parent on a three-segment path, so `button.radius.default`
    // came out as `radius` — a role named after its bucket, which then collided
    // with every other component's radius.
    const withoutDefault =
        path.length > 1 && /^default$/i.test(path[path.length - 1] as string)
            ? path.slice(0, -1)
            : path;
    const last = withoutDefault[withoutDefault.length - 1] ?? 'value';
    if (withoutDefault.length < 2) return last;
    const parent = withoutDefault[withoutDefault.length - 2] as string;
    if (/^\d+$/.test(last) || NON_ROLE_SEGMENTS.has(last.toLowerCase())) {
        return `${parent}-${last}`;
    }
    return last;
}

/**
 * Write a token into a bucket without ever overwriting a different value.
 *
 * `roleName` shortens a path to something a human can read, and any shortening
 * can collide: `semantic.color.background` and `component.card.background` both
 * reduce to `background`. Letting the second write win loses the first token
 * while the import still reports success with an empty note list — the exact
 * "quietly loses a block, looks like a successful run" failure this adapter's
 * own risk register names.
 *
 * So a collision widens the name with more of the token's own path until it is
 * free, and says so. Re-stating the SAME value under a shortened name is not a
 * collision and stays silent — that is one decision expressed twice, not two
 * decisions competing.
 */
function assignRole(
    target: Record<string, string>,
    role: string,
    value: string,
    path: string[],
    notes: string[],
): void {
    if (target[role] === undefined) {
        target[role] = value;
        return;
    }
    if (target[role] === value) return;
    for (let take = 2; take <= path.length; take++) {
        const candidate = path.slice(path.length - take).join('-');
        if (target[candidate] === value) return;
        if (target[candidate] === undefined) {
            target[candidate] = value;
            notes.push(
                `role "${role}" was already held by a different value — ${path.join('.')} is filed as "${candidate}" instead of overwriting it`,
            );
            return;
        }
    }
    // Unreachable for well-formed JSON: the full path is unique per leaf.
    notes.push(`${path.join('.')} could not be given a free role name and was dropped`);
}

/**
 * Resolve a DTCG alias — `{primitive.color.gray.50}` — to the value it points at.
 *
 * Without this the contract receives a literal brace string where a colour
 * belongs, and every consumer downstream (`DESIGN.md`, CSS vars, Tailwind)
 * inherits an unusable token that still *looks* like a successful import. That
 * is the quiet failure the fixtures exist to catch, so it is resolved here
 * rather than left to the reader.
 *
 * Chains are followed, with a depth bound: a token file may legitimately alias
 * an alias, and may also — through an authoring mistake — alias itself. An
 * unresolvable reference is returned unchanged so the human sees the reference
 * that broke, never a silently emptied field.
 */
export function resolveAlias(raw: string, root: Record<string, unknown>, depth = 0): string {
    const match = /^\{([^}]+)\}$/.exec(raw.trim());
    if (match === null) return raw;
    if (depth > 8) return raw;
    let node: unknown = root;
    for (const segment of (match[1] as string).split('.')) {
        if (!isPlainObject(node)) return raw;
        node = node[segment];
    }
    if (!isTokenLeaf(node)) return raw;
    const value = leafValue(node);
    if (value === null) return raw;
    return resolveAlias(value, root, depth + 1);
}

function mapDtcg(input: Record<string, unknown>, source: SourceBlock): ImportOutcome {
    const notes: string[] = [];
    let unresolvedAliases = 0;
    const colorsLight: Record<string, string> = {};
    const colorsDark: Record<string, string> = {};
    const radius: Record<string, string> = {};
    const shadow: Record<string, string> = {};
    const durations: Record<string, string> = {};
    const easings: Record<string, string> = {};
    const spacingScale: string[] = [];
    const families: FontFamily[] = [];
    const fontSizes: ScaleStep[] = [];
    const unmapped: Record<string, string> = {};
    let darkByPath = 0;

    const walk = (node: unknown, path: string[]): void => {
        if (path.length > 8 || !isPlainObject(node)) return;
        for (const [key, value] of Object.entries(node)) {
            if (key.startsWith('$')) continue; // group metadata, never a token
            const next = [...path, key];
            if (isTokenLeaf(value)) {
                const literal = leafValue(value);
                if (literal === null) {
                    unmapped[next.join('.')] = '<non-scalar $value>';
                    continue;
                }
                const raw = resolveAlias(literal, input);
                if (raw === literal && /^\{[^}]+\}$/.test(literal.trim())) {
                    unresolvedAliases += 1;
                }
                const bucket = dtcgBucket(leafType(value), next);
                const role = roleName(next);
                // A path segment named `dark` is read as the dark THEME. That
                // is an inference, and a fallible one — `text.dark` and
                // `neutral.dark` are shades, not themes — so it is counted and
                // surfaced rather than applied invisibly.
                const isDark = next.some((p) => p.toLowerCase() === 'dark');
                switch (bucket) {
                    case 'color':
                        if (isDark) {
                            darkByPath += 1;
                            assignRole(colorsDark, role, raw, next, notes);
                        } else {
                            assignRole(colorsLight, role, raw, next, notes);
                        }
                        break;
                    case 'radius':
                        assignRole(radius, role, raw, next, notes);
                        break;
                    case 'shadow':
                        assignRole(shadow, role, raw, next, notes);
                        break;
                    case 'duration':
                        assignRole(durations, role, raw, next, notes);
                        break;
                    case 'easing':
                        assignRole(easings, role, raw, next, notes);
                        break;
                    case 'spacing':
                        spacingScale.push(raw);
                        break;
                    case 'fontSize':
                        fontSizes.push({ step: role, size: raw });
                        break;
                    case 'fontFamily':
                        families.push({ role, name: raw, bundled_local: false });
                        break;
                    default:
                        unmapped[next.join('.')] = raw;
                }
                continue;
            }
            walk(value, next);
        }
    };
    walk(input, []);

    const out: DesignSystem = { source };
    if (Object.keys(colorsLight).length > 0 || Object.keys(colorsDark).length > 0) {
        out.colors = {};
        if (Object.keys(colorsLight).length > 0) out.colors.light = colorsLight;
        if (Object.keys(colorsDark).length > 0) out.colors.dark = colorsDark;
    }
    if (families.length > 0 || fontSizes.length > 0) {
        out.typography = {};
        if (families.length > 0) out.typography.families = families;
        if (fontSizes.length > 0) out.typography.scale = fontSizes;
    }
    if (spacingScale.length > 0) out.spacing = { scale: spacingScale };
    if (Object.keys(radius).length > 0) out.radius = radius;
    if (Object.keys(shadow).length > 0) out.shadow = shadow;
    if (Object.keys(durations).length > 0 || Object.keys(easings).length > 0) {
        out.motion = {};
        if (Object.keys(durations).length > 0) out.motion.durations = durations;
        if (Object.keys(easings).length > 0) out.motion.easings = easings;
    }
    if (Object.keys(unmapped).length > 0) {
        out._meta = { unmapped };
        notes.push(
            `${Object.keys(unmapped).length} DTCG token(s) had no contract bucket — kept as observation under _meta.unmapped`,
        );
    }
    if (darkByPath > 0) {
        notes.push(
            `${darkByPath} colour(s) were filed under the dark theme because a path segment is named "dark" — the format states no colour scheme, so verify these are theme values and not shades named dark`,
        );
    }
    if (unresolvedAliases > 0) {
        notes.push(
            `${unresolvedAliases} DTCG alias reference(s) point at a token this file does not define — the reference is kept verbatim so the broken pointer is visible, not blanked`,
        );
    }
    // `bundled_local: false` is a reading, not a claim about the source site:
    // DTCG carries no font-hosting information at all, so the flag records
    // "not stated" and the note says so rather than letting a default pass
    // for an observation.
    if (families.length > 0) {
        notes.push(
            'DTCG carries no font-hosting information — typography.families[].bundled_local is false because the format cannot state it, not because the source self-hosts nothing',
        );
    }
    return { ok: true, lane: 'dtcg', design_system: out, notes };
}

// --- lane: dembrandt ---------------------------------------------------------

/**
 * Map the rich extraction lane by documented key name, tolerantly per bucket.
 *
 * Every branch has the same contract with the reader: recognise a shape and map
 * it, or record it under `_meta` and say so in a note. Nothing is coerced into
 * a token, and nothing is dropped in silence.
 */
function mapDembrandt(input: Record<string, unknown>, source: SourceBlock): ImportOutcome {
    const notes: string[] = [];
    const meta: Record<string, unknown> = {};
    const out: DesignSystem = { source };

    /** Route entries a helper could not take into `_meta`, and say so. */
    const reportDropped = (bucket: string, dropped: string[], source_: unknown): void => {
        if (dropped.length === 0) return;
        meta[bucket] = source_;
        notes.push(
            `${bucket}: ${dropped.length} entry/entries (${dropped.slice(0, 5).join(', ')}${dropped.length > 5 ? ', …' : ''}) are not scalar values — the whole block is kept as observation under _meta.${bucket} so nothing is lost`,
        );
    };

    const colors = input['colors'];
    if (colors !== undefined) {
        const nested = isPlainObject(colors) ? colors : undefined;
        // Each candidate gets its OWN dropped list, and only the one actually
        // used is reported. Sharing a list across the probes would count a
        // legitimate nested grouping (`colors.semantic` + `colors.dark`) as a
        // loss, because the flat-map probe necessarily rejects both.
        const flatDropped: string[] = [];
        const lightDropped: string[] = [];
        const semanticDropped: string[] = [];
        const darkDropped: string[] = [];
        const flat = stringMap(colors, flatDropped);
        const explicitLight = flat ?? stringMap(nested?.['light'], lightDropped);
        const semantic =
            explicitLight === null ? stringMap(nested?.['semantic'], semanticDropped) : null;
        const light = explicitLight ?? semantic;
        const dark = stringMap(nested?.['dark'], darkDropped);
        const usedDropped = flat ? flatDropped : semantic ? semanticDropped : lightDropped;
        reportDropped('colors', [...usedDropped, ...darkDropped], colors);
        if (light || dark) {
            out.colors = {};
            if (light) out.colors.light = light;
            if (dark) out.colors.dark = dark;
        } else {
            meta['colors'] = colors;
            notes.push('colors present but not a role→value map — kept as observation under _meta.colors');
        }
        if (semantic !== null) {
            // Naming the semantic role map "light" is an INFERENCE, not a
            // reading: the extractor groups by semantic role and says nothing
            // about colour scheme. It is the right default when a separate
            // dark map exists, and it stays a stated assumption either way —
            // the human confirms these per field.
            notes.push(
                'colors.light was taken from the extractor\'s semantic role map — the source states roles, not colour scheme, so verify this is the light theme',
            );
        }
    }

    const typography = input['typography'];
    if (isPlainObject(typography)) {
        const fams = typography['families'] ?? typography['fonts'];
        const built: FontFamily[] = [];
        if (Array.isArray(fams)) {
            for (const entry of fams) {
                if (typeof entry === 'string') {
                    built.push({ role: 'body', name: entry, bundled_local: false });
                } else if (isPlainObject(entry)) {
                    const name = entry['name'] ?? entry['family'];
                    if (typeof name === 'string') {
                        const role = typeof entry['role'] === 'string' ? entry['role'] : 'body';
                        built.push({ role, name, bundled_local: entry['bundled_local'] === true });
                    }
                }
            }
        }
        if (built.length > 0) out.typography = { families: built };
        const scale = typography['scale'] ?? typography['sizes'];
        if (Array.isArray(scale)) {
            const steps: ScaleStep[] = [];
            for (const entry of scale) {
                if (isPlainObject(entry) && typeof entry['step'] === 'string') {
                    const size = entry['size'];
                    if (typeof size === 'string' || typeof size === 'number') {
                        const step: ScaleStep = { step: entry['step'], size: String(size) };
                        const lh = entry['lineHeight'];
                        if (typeof lh === 'string' || typeof lh === 'number') step.lineHeight = String(lh);
                        steps.push(step);
                    }
                }
            }
            if (steps.length > 0) {
                out.typography = out.typography ?? {};
                out.typography.scale = steps;
            }
        }
        if (out.typography === undefined) {
            meta['typography'] = typography;
            notes.push('typography present in an unrecognised shape — kept as observation under _meta.typography');
        }
    }

    const spacing = input['spacing'];
    if (spacing !== undefined) {
        const spacingDropped: string[] = [];
        const scale =
            stringList(spacing, spacingDropped) ??
            stringList(isPlainObject(spacing) ? spacing['scale'] : undefined, spacingDropped);
        reportDropped('spacing', spacingDropped, spacing);
        const base = isPlainObject(spacing) ? spacing['base'] : undefined;
        if (scale || typeof base === 'string') {
            out.spacing = {};
            if (typeof base === 'string') out.spacing.base = base;
            if (scale) out.spacing.scale = scale;
        } else {
            meta['spacing'] = spacing;
            notes.push('spacing present but neither a scale list nor a base — kept as observation under _meta.spacing');
        }
    }

    // The tool documents "Borders (radius, widths, styles, colors)"; the
    // contract has a `radius` key and no home for the other three, so only the
    // radius half maps and the rest is stated as observation.
    const borders = input['borders'];
    if (borders !== undefined) {
        const bordersObj = isPlainObject(borders) ? borders : undefined;
        const hasRadiusKey = bordersObj !== undefined && 'radius' in bordersObj;
        const borderDropped: string[] = [];
        // The whole-object fallback is reachable ONLY when there is no `radius`
        // key at all. Previously it also fired when `borders.radius` was present
        // but not a string map (a list, say), and then emitted border *widths
        // and styles* as radius tokens while dropping the real radius data —
        // coercion plus silent loss, the two things this lane promises not to do.
        const radius = hasRadiusKey
            ? stringMap(bordersObj['radius'], borderDropped)
            : stringMap(borders, borderDropped);
        if (radius) out.radius = radius;
        else if (hasRadiusKey) {
            meta['borders'] = borders;
            notes.push(
                'borders.radius is present but not a role→value map — the whole borders block is kept as observation under _meta.borders rather than mapping the other border fields as radius',
            );
        }
        if (radius && borderDropped.length > 0) {
            notes.push(
                `borders.radius: ${borderDropped.length} non-scalar entry/entries were not mapped — see _meta.borders`,
            );
            meta['borders'] = borders;
        }
        if (isPlainObject(borders) && meta['borders'] === undefined) {
            const rest: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(borders)) {
                if (k !== 'radius') rest[k] = v;
            }
            if (Object.keys(rest).length > 0) {
                meta['borders'] = rest;
                notes.push(
                    'border widths/styles/colors have no key in the contract — kept as observation under _meta.borders',
                );
            }
        }
    }

    const shadows = input['shadows'];
    if (shadows !== undefined) {
        const shadowDropped: string[] = [];
        const mapped = stringMap(shadows, shadowDropped);
        if (mapped) {
            out.shadow = mapped;
            reportDropped('shadows', shadowDropped, shadows);
        } else {
            const list = stringList(shadows, shadowDropped);
            if (list) {
                const asMap: Record<string, string> = {};
                list.forEach((v, i) => {
                    asMap[`shadow-${i + 1}`] = v;
                });
                out.shadow = asMap;
                notes.push('shadows arrived as an unnamed list — roles are positional (shadow-1, shadow-2, …)');
            } else {
                meta['shadows'] = shadows;
                notes.push('shadows present in an unrecognised shape — kept as observation under _meta.shadows');
            }
        }
    }

    const motion = input['motion'];
    if (isPlainObject(motion)) {
        const durations =
            stringMap(motion['durations']) ??
            (() => {
                const list = stringList(motion['durations'] ?? motion['durationScale']);
                if (!list) return null;
                const asMap: Record<string, string> = {};
                list.forEach((v, i) => {
                    asMap[`step-${i + 1}`] = v;
                });
                return asMap;
            })();
        const easings =
            stringMap(motion['easings']) ??
            (() => {
                const raw = motion['easings'] ?? motion['easing'];
                if (!Array.isArray(raw)) return null;
                const asMap: Record<string, string> = {};
                for (const entry of raw) {
                    if (isPlainObject(entry)) {
                        const name = entry['name'] ?? entry['type'];
                        const value = entry['value'] ?? entry['curve'];
                        if (typeof name === 'string' && typeof value === 'string') asMap[name] = value;
                    }
                }
                return Object.keys(asMap).length > 0 ? asMap : null;
            })();
        if (durations || easings) {
            out.motion = {};
            if (durations) out.motion.durations = durations;
            if (easings) out.motion.easings = easings;
        }
        // Per-context profiles and hover deltas are behaviour observations, not
        // token decisions — the contract's own `motion._meta` is where they go.
        const observed: Record<string, unknown> = {};
        for (const key of ['contexts', 'profiles', 'hover', 'hoverDeltas', 'detected_libs']) {
            if (motion[key] !== undefined) observed[key] = motion[key];
        }
        // Anything else under `motion` is residue: neither a token this lane
        // maps nor a documented observation. It used to vanish, and the
        // unrecognised-shape guard could not catch it because `out.motion` was
        // already defined by whatever DID map. Keep it beside the observations.
        const OBSERVED_KEYS = new Set(['contexts', 'profiles', 'hover', 'hoverDeltas', 'detected_libs']);
        // A key counts as consumed only when ITS OWN bucket mapped. Testing
        // "durations || easings" lets an unreadable `easings` shape disappear
        // whenever `durations` happened to succeed — the same silent loss one
        // level down.
        const consumed = new Set<string>();
        if (durations) {
            consumed.add('durations');
            consumed.add('durationScale');
        }
        if (easings) {
            consumed.add('easings');
            consumed.add('easing');
        }
        const residue: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(motion)) {
            if (OBSERVED_KEYS.has(key) || consumed.has(key)) continue;
            residue[key] = value;
        }
        if (Object.keys(observed).length > 0 || Object.keys(residue).length > 0) {
            out.motion = out.motion ?? {};
            out.motion._meta = { ...observed, ...(Object.keys(residue).length > 0 ? { unmapped: residue } : {}) };
        }
        if (Object.keys(residue).length > 0) {
            notes.push(
                `motion: ${Object.keys(residue).join(', ')} matched no token or observation shape — kept under motion._meta.unmapped`,
            );
        }
        if (out.motion === undefined) {
            meta['motion'] = motion;
            notes.push('motion present in an unrecognised shape — kept as observation under _meta.motion');
        }
    }

    const components = input['components'];
    if (Array.isArray(components)) {
        const built: ComponentObservation[] = [];
        for (const entry of components) {
            if (!isPlainObject(entry)) continue;
            const name = entry['name'] ?? entry['type'];
            if (typeof name !== 'string') continue;
            const observed: ComponentObservation['observed'] = {};
            const classes = stringList(entry['classes'] ?? entry['selectors']);
            const props = stringList(entry['props'] ?? entry['properties']);
            if (classes) observed.classes = classes;
            if (props) observed.props = props;
            built.push({ name, observed });
        }
        if (built.length > 0) out.components = built;
    } else if (isPlainObject(components)) {
        // Mirror the array branch: omit an absent key rather than emitting an
        // empty array, and never discard a scalar observation just because it
        // is not a list.
        const built: ComponentObservation[] = [];
        const componentResidue: Record<string, unknown> = {};
        for (const [name, value] of Object.entries(components)) {
            const observed: ComponentObservation['observed'] = {};
            const props = stringList(value) ?? (isPlainObject(value) ? Object.keys(value) : null);
            if (props && props.length > 0) observed.props = props;
            else if (typeof value === 'string' || typeof value === 'number') {
                componentResidue[name] = value;
            }
            built.push({ name, observed });
        }
        if (built.length > 0) out.components = built;
        if (Object.keys(componentResidue).length > 0) {
            meta['components'] = componentResidue;
            notes.push(
                `components: ${Object.keys(componentResidue).join(', ')} carried a scalar observation rather than a class/prop list — kept under _meta.components`,
            );
        }
    }

    // WCAG results and breakpoints are documented output with no contract key.
    // They are the clearest case of "observation, never a token".
    for (const key of ['wcag', 'breakpoints']) {
        if (input[key] !== undefined) meta[key] = input[key];
    }
    if (input['wcag'] !== undefined) {
        notes.push('wcag results are observation, not tokens — kept under _meta.wcag');
    }

    if (Object.keys(meta).length > 0) out._meta = { ...(out._meta ?? {}), ...meta };

    const mappedKeys = Object.keys(out).filter((k) => k !== 'source' && k !== '_meta');
    if (mappedKeys.length === 0) {
        notes.push(
            'no bucket could be mapped without inventing values — this import is observation only, per the lane falsifier',
        );
    }
    return { ok: true, lane: 'dembrandt', design_system: out, notes };
}

// --- entry point -------------------------------------------------------------

/**
 * Transform any of the three lanes into the contract shape.
 *
 * Never throws on input shape: an unusable input is an `ok: false` outcome
 * carrying the reason, because the caller (a CLI, a skill) has to be able to
 * show the human WHY an artifact was refused. A thrown stack answers "it
 * failed" and not "your file has no `source.ref`".
 */
export function importDesignSystem(
    input: unknown,
    provenance?: ProvenanceOverride,
    forceLane?: Lane,
): ImportOutcome {
    if (!isPlainObject(input)) {
        return { ok: false, lane: null, reason: 'input is not a JSON object' };
    }
    // A forced lane only overrides which mapper runs. The input is never
    // reshaped to fit it, so a file forced to a lane it does not match maps to
    // nothing — the honest answer — instead of being bent into a false success.
    const lane = forceLane ?? detectLane(input);
    if (lane === null) {
        return {
            ok: false,
            lane: null,
            reason:
                'no lane matched — expected a native artifact (with a `source` block), a DTCG token file ({$value,$type} leaves), or an extraction output carrying at least one documented key (colors, typography, spacing, borders, shadows, motion, components, breakpoints, wcag)',
        };
    }
    if (lane === 'native') return mapNative(input);

    const inputSource = isPlainObject(input['source']) ? readSource(input['source']) : null;
    let source: SourceBlock;
    if (inputSource !== null && !('error' in inputSource)) {
        source = inputSource.source;
    } else if (provenance !== undefined) {
        source = sourceFromOverride(provenance);
    } else if (inputSource !== null && 'error' in inputSource) {
        // A present-but-unusable block is a different failure from an absent
        // one, and only reachable through a forced lane. Naming it precisely
        // keeps the message about the user's file rather than about the format.
        return {
            ok: false,
            lane,
            reason: `${lane} lane rejected — the file carries a source block, but ${inputSource.error}`,
        };
    } else {
        return {
            ok: false,
            lane,
            reason:
                `${lane} lane rejected — no provenance. The contract makes \`source\` mandatory (kind + ref + captured_at); ` +
                'this format does not carry it, so supply it explicitly.',
        };
    }
    return lane === 'dtcg' ? mapDtcg(input, source) : mapDembrandt(input, source);
}
