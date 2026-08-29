/**
 * source_shape — name-list-independent detection of *attribution shape*.
 *
 * The deny list in `external_sources_denylist.json` can only catch a source
 * somebody already wrote down. Every family it misses is invisible until a
 * human notices, which is the gap `road-to-source-silence` Phase 3.2 exists to
 * close: attribution has a recognisable FORM, and the form is checkable without
 * knowing the name.
 *
 * Three classes, deliberately narrow (AI council 2026-08-28, blocker
 * `how-loud-the-slug-heuristic-is`: "the heuristic must be narrowly defined and
 * tested against its likely false positives"):
 *
 * 1. `source-header` — a `> **Source:** …` header whose value is neither an
 *    `ENC1:` token nor an opaque round identifier.
 * 2. `tmp-quote` — a quoted `agents/tmp(.old)?/<name>/` path whose `<name>` is
 *    not an opaque round identifier. The inbox directory name is the root of
 *    the whole leak chain; quoting it republishes it.
 * 3. `repo-slug` — a `github.com/<owner>/<repo>` URL whose owner is not
 *    allowlisted (own org, GitHub's own reserved paths, documentation
 *    placeholders, and the vendors whose tools this suite integrates or
 *    recommends — naming an integrated tool is explicitly allowed by the rule).
 *
 * ## What this is NOT — a floor, not a proof
 *
 * Line-based patterns cannot see a wrapped sentence, an attribution spread over
 * two lines, or a source named without any of the three forms.
 *
 * **A bare `<owner>/<repo>` slug class was built, measured and REMOVED.** The
 * council's requirement was that the heuristic be "narrowly defined and tested
 * against its likely false positives"; the measurement is the answer. Even
 * gated on an attribution cue (`inspired by`, `ported from`, `based on`, …) the
 * bare form produced **3,109 hits across the tracked tree, against 202 for the
 * URL form** — and the top values were `text/markdown` (278), `origin/main`
 * (29), `JS/TS`, `before/after`, `CI/CD`, `request/response`, `403/404`. Those
 * are precisely the filesystem-path, ratio and enumeration shapes the council
 * named, and a class whose signal is 6 % of its output would drive exactly the
 * broad allowlisting the council said is "worse than the gap it closes".
 *
 * The stated recall limit that follows: **a source named as a bare slug, with
 * no `github.com` URL and no deny-list entry, is not detected.** That is a real
 * hole, it is written down rather than papered over with a wider regex, and the
 * deny set plus the Phase 0 census sweep are what cover it.
 *
 * Every predicate is pure and takes a bare string, so it answers for a file
 * that does not exist yet (a diff, a plan, a fixture).
 */

/** The classes, in the order they are reported. */
export const SHAPE_CLASSES = ['source-header', 'tmp-quote', 'repo-slug'] as const;
export type ShapeClass = (typeof SHAPE_CLASSES)[number];

/** One shape finding on one line. */
export interface ShapeHit {
    /** Which class fired. */
    cls: ShapeClass;
    /** The offending value, already truncated for reporting. NEVER logged by the gate. */
    value: string;
}

/**
 * An opaque round identifier — the form Phase 4 mandates for inbox directories.
 *
 * Accepts exactly three shapes, all of which carry no information about the
 * source: `inbox-2026-08-g` (round-dated, optional 1-3 char disambiguator),
 * `round-<hex>` / `set-<hex>` (content-free), and `S17` (a set number). Anything
 * else is speaking by construction — a name that reads is a name that leaks.
 */
const OPAQUE_ROUND_RE =
    /^(?:(?:inbox|round|src-set|source-set)-\d{4}-\d{2}(?:-[a-z0-9]{1,3})?|(?:round|set|src-set|source-set)-[0-9a-f]{6,}|s\d{1,4})$/i;

/** Is `name` an opaque round identifier? */
export function isOpaqueRoundId(name: string): boolean {
    return OPAQUE_ROUND_RE.test(name.trim());
}

/** An `ENC1:` ciphertext token (see `_lib/link_crypto.ts`). */
const ENC_TOKEN_RE = /^ENC1:[A-Za-z0-9+/=]+$/;

/**
 * A `> **Source:**` header line. The `>` and the bold markers are both optional
 * because the convention drifted across the roadmap corpus; matching only the
 * blockquoted form would miss the plain one for no reason.
 *
 * `\b` does not match inside `**bold**`, which is exactly the formatting the
 * lines that matter use — so the markers are consumed explicitly rather than
 * relied upon as boundaries.
 */
const SOURCE_HEADER_RE = /^\s*(?:>\s*)?\*\*Source\*?\*?:?\*{0,2}\s*:?\s*(\S.*)$/;

/** A quoted inbox directory. Terminated by `/`, so a bare mention of the parent is not a hit. */
const TMP_QUOTE_RE = /agents\/tmp(?:\.old)?\/([A-Za-z0-9._-]+)\//g;

/** A GitHub repository URL, scheme-optional. */
const GITHUB_URL_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})/g;

export interface SlugAllowlist {
    /** GitHub owners whose repos may be named openly (own org, integrated tools). */
    owners: readonly string[];
}

/**
 * The allowlist, deliberately small and deliberately IN CODE rather than in a
 * `*allowlist.json`.
 *
 * It is a **precision guard for a URL-host pattern**, not a set of exempted
 * sources: three of its four groups (GitHub's own reserved first path segments,
 * documentation placeholders, this suite's own org) name nothing external at
 * all. The fourth — vendors whose tools this suite integrates or recommends —
 * is legitimate by the rule's own carve-out: "Recommending / integrating a tool
 * or registry … Naming the tool is fine."
 *
 * Kept in code so growth is a reviewed code change with a group comment beside
 * it, which is the control the council asked for when it warned that a loud
 * heuristic "would generate enough noise to drive broad allowlisting". A JSON
 * allowlist would be ratcheted by `check_suppression_hygiene` instead; that is
 * the alternative, and it was not chosen because this list must not read as a
 * register of permitted sources.
 */
const ALLOWED_OWNERS: readonly string[] = [
    // This suite's own organisation.
    'event4u-app',
    // GitHub's own reserved first path segments — not owners at all.
    'sponsors', 'features', 'apps', 'marketplace', 'orgs', 'settings', 'topics',
    'login', 'about', 'pricing', 'security', 'readme', 'collections', 'trending',
    'explore', 'notifications', 'enterprise', 'customer-stories', 'contact',
    // Documentation placeholders.
    'example', 'acme', 'org', 'owner', 'user', 'username', 'myorg', 'your-org',
    'yourorg', 'my-org', 'youruser', 'your-username', 'some-org',
    // Vendors whose tools this suite integrates or recommends (rule carve-out).
    'anthropics', 'anthropic', 'microsoft', 'github', 'modelcontextprotocol',
    'cloudflare', 'openai', 'nodejs', 'vitest-dev', 'vercel', 'tailwindlabs',
    'laravel', 'symfony', 'shadcn-ui', 'playwright-community', 'actions',
    'denoland', 'pnpm', 'npm', 'astral-sh', 'go-task', 'charmbracelet',
];

const DEFAULT_ALLOWLIST: SlugAllowlist = { owners: ALLOWED_OWNERS };

/** Normalise for allowlist comparison. */
function fold(s: string): string {
    return s.trim().toLowerCase();
}

/** `source-header` hits on one line. */
export function sourceHeaderHits(line: string): ShapeHit[] {
    const m = SOURCE_HEADER_RE.exec(line);
    if (!m) return [];
    const raw = (m[1] as string).trim();
    // Strip markdown emphasis, backticks and trailing punctuation before judging.
    const value = raw.replace(/^[`*_[(<"']+/, '').replace(/[`*_\])>"'.,;]+$/, '').trim();
    if (value === '') return [];
    if (ENC_TOKEN_RE.test(value)) return [];
    if (isOpaqueRoundId(value)) return [];
    // A header pointing at an inbox directory is judged on the directory NAME,
    // so the tmp-quote class owns it and this class stays silent — otherwise one
    // line would be counted twice and the two ratchets would move together.
    if (/agents\/tmp(?:\.old)?\//.test(value)) return [];
    return [{ cls: 'source-header', value: value.slice(0, 120) }];
}

/** `tmp-quote` hits on one line. */
export function tmpQuoteHits(line: string): ShapeHit[] {
    const out: ShapeHit[] = [];
    TMP_QUOTE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TMP_QUOTE_RE.exec(line)) !== null) {
        const name = m[1] as string;
        if (isOpaqueRoundId(name)) continue;
        out.push({ cls: 'tmp-quote', value: name.slice(0, 120) });
    }
    return out;
}

/**
 * `repo-slug` hits on one line — the `github.com/<owner>/<repo>` URL form only.
 * See the module docstring for the measured reason the bare-slug form is absent.
 */
export function repoSlugHits(line: string, allow: SlugAllowlist = DEFAULT_ALLOWLIST): ShapeHit[] {
    const out: ShapeHit[] = [];
    const owners = new Set(allow.owners.map(fold));
    GITHUB_URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = GITHUB_URL_RE.exec(line)) !== null) {
        const owner = m[1] as string;
        if (owners.has(fold(owner))) continue;
        out.push({ cls: 'repo-slug', value: `${owner}/${m[2] as string}`.slice(0, 120) });
    }
    return out;
}

/** Every shape hit on one line. */
export function shapeHits(line: string, allow: SlugAllowlist = DEFAULT_ALLOWLIST): ShapeHit[] {
    return [...sourceHeaderHits(line), ...tmpQuoteHits(line), ...repoSlugHits(line, allow)];
}

/**
 * `tmp-quote` and `repo-slug` also apply to a tracked PATH — a filename can
 * carry a round name (`agents/evidence/reviews/<round>.review-input/`) with no
 * content line to match. Path scanning against the deny set is Phase 3.1; this
 * is its shape half.
 */
export function shapePathHits(rel: string, allow: SlugAllowlist = DEFAULT_ALLOWLIST): ShapeHit[] {
    return [...tmpQuoteHits(rel), ...repoSlugHits(rel, allow)];
}

/**
 * The enforcement tier for a hit, per the resolved
 * `how-loud-the-slug-heuristic-is` blocker: block inside `agents/**`, warn
 * everywhere else. Attribution is concentrated in `agents/**`; repository slugs
 * are ordinary content in integration code and docs.
 */
export function tierFor(rel: string): 'block' | 'warn' {
    return rel.startsWith('agents/') ? 'block' : 'warn';
}
