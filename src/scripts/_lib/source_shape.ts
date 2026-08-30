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
 * The write-time redaction marker from `_lib/source_redact.ts`, matched WITHOUT
 * its brackets because the value normaliser below strips `[` and `]`.
 *
 * A redacted header is the compliant END STATE, not a violation: the marker
 * carries no information about any source, which is its entire purpose. Without
 * this the gate flagged its own marker — measured on the first review snapshot
 * taken after shape redaction shipped, where `> **Source:** [REDACTED:src-conf]`
 * counted as a speaking value.
 */
const REDACTION_VALUE_RE = /^REDACTED:src-conf$/;

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
    // Two further placeholders, added on a MEASURED false positive rather than
    // on taste (road-to-source-silence Phase 3.4). `someone/other` in
    // tests/scripts/envelope_grounding.test.ts and `o/r.git` in
    // tests/scripts/unattended_guard.test.ts are literal fixture URLs naming
    // nothing external. They were the only two of 26 review-snapshot findings
    // that survived provenance-aware deduplication — and surviving is what
    // identified them: the AI council's requirement was that unique and
    // unverifiable findings stay at block so a human looks at them. A human
    // looked; this is the answer. Fixing them here rather than by widening the
    // dedup rule is what keeps that rule strict.
    'someone', 'o',
    // Vendors whose tools this suite integrates or recommends (rule carve-out).
    'anthropics', 'anthropic', 'microsoft', 'github', 'modelcontextprotocol',
    'cloudflare', 'openai', 'nodejs', 'vitest-dev', 'vercel', 'tailwindlabs',
    'laravel', 'symfony', 'shadcn-ui', 'playwright-community', 'actions',
    'denoland', 'pnpm', 'npm', 'astral-sh', 'go-task', 'charmbracelet',
];

/**
 * `agents/tmp(.old)/<name>/` directories whose `<name>` names a WORKING SET, not
 * a harvest round.
 *
 * The `tmp-quote` class exists because a harvest round lands in a directory
 * named after its source, so quoting that path republishes the name the deny
 * list hides. A directory named after the *work* leaks nothing — and the
 * distinction is not decorative: `bench-local` was added on a MEASURED false
 * positive, four hits in
 * `agents/evidence/analysis/code-graph-rerun-irrecoverability-2026-08-28.md`,
 * whose probe table quotes the four pinned benchmark input files by path
 * BECAUSE THE PATH IS THE EVIDENCE. The filenames it quotes are already
 * anonymised (`repo-a`, `repo-b`, `repo-c`), so there is no name to protect,
 * and rewriting the table would have destroyed the reading it records.
 *
 * Kept as small as `ALLOWED_OWNERS` and for the same reason: an entry here is a
 * reviewed code change with its evidence beside it. Anything that names a
 * ROUND, a source, or an external project does NOT belong in this list — the
 * fix for those is an opaque round id, per `isOpaqueRoundId`.
 */
const NON_HARVEST_TMP_DIRS: ReadonlySet<string> = new Set([
    // Benchmark inputs. Pinned by SHA-256, filenames already anonymised.
    'bench-local',
]);

/**
 * Is `name` a named WORKING SET rather than a harvest round?
 *
 * Exported so the Phase 4.2 write-time guard
 * (`hooks/block_speaking_inbox_dir.ts`) decides from the same set this module
 * uses. Two copies of "which names are acceptable" is how a guard and its gate
 * drift into disagreeing about the thing they both exist to enforce.
 */
export function isNonHarvestTmpDir(name: string): boolean {
    return NON_HARVEST_TMP_DIRS.has(name.trim().toLowerCase());
}

const DEFAULT_ALLOWLIST: SlugAllowlist = { owners: ALLOWED_OWNERS };

/** Normalise for allowlist comparison. */
function fold(s: string): string {
    return s.trim().toLowerCase();
}

/**
 * Repo-relative prefixes that make a token an INTERNAL reference.
 *
 * A `**Source:**` value pointing at this repository's own tree names nothing
 * external, whatever shape it has. Listed rather than pattern-matched because
 * the set is small, closed, and a reviewer should be able to read it — which is
 * why two INERT entries were removed rather than left in place (R2 finding 13):
 * `'pr #'` could never match, since the tokens tested here come from a path or
 * slug scan and contain no space, and it made a reader believe PR references
 * were handled here when they are handled by carrying no identifier at all.
 * `.agent-src` stays because the token now carries its whole path.
 */
const INTERNAL_PATH_PREFIXES: readonly string[] = [
    'agents/', 'docs/', 'src/', 'tests/', 'scripts/', 'internal/', 'evals/',
    'dist/', 'provenance/', 'templates/', 'packages/', 'node_modules/',
    '.agent-src', '.augment/', '.claude/', '.github/', 'road-to-', 'adr-',
];

/**
 * Hosts a value may name openly — the same carve-out `ALLOWED_OWNERS` encodes.
 *
 * Matched by SUFFIX, so a documentation subdomain of a permitted vendor is
 * permitted too. See {@link firstDomainIn} for why exact matching was wrong.
 */
const ALLOWED_HOSTS: readonly string[] = [
    'example.com', 'example.org', 'example.net', 'localhost',
    'github.com', 'githubusercontent.com', 'anthropic.com', 'openai.com',
    'nodejs.org', 'npmjs.com',
];

/**
 * npm SCOPES a value may name openly.
 *
 * Separate from `ALLOWED_OWNERS` because they are different namespaces (R2
 * finding 6). That list is a GitHub-owner list — its own docstring calls it "a
 * precision guard for a URL-host pattern" — and reusing it meant an integrated
 * vendor whose npm scope differs from its GitHub org was flagged:
 * `@anthropic-ai/claude-code` and `@types/node` both did, though
 * `source-confidentiality` explicitly permits naming an integrated tool.
 * Reusing one list avoided a second allowlist at the cost of applying it to a
 * namespace nobody measured it against.
 */
const ALLOWED_NPM_SCOPES: readonly string[] = [
    'event4u', 'anthropic-ai', 'openai', 'types', 'modelcontextprotocol',
    'preact', 'eslint', 'typescript-eslint', 'vitest',
];

const BARE_SLUG_RE = /\b([A-Za-z][A-Za-z0-9-]{1,38})\/([A-Za-z][A-Za-z0-9._-]{1,99})\b/g;
const DOMAIN_RE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|ai|org|net|sh|app|co))\b/gi;
const SCOPED_PKG_RE = /(^|\s)@([a-z0-9-]+)\/([a-z0-9._-]+)/gi;

function isInternalToken(token: string): boolean {
    const t = fold(token);
    return INTERNAL_PATH_PREFIXES.some((prefix) => t.startsWith(prefix));
}

/**
 * Does this `**Source:**` value carry a READABLE identifier?
 *
 * This is the operational grammar the narrowing rests on, and it is written out
 * rather than left to a reviewer's judgement because a council seat named
 * exactly that risk: *"'readable slug' is still an open question disguised as a
 * decision … without that specification, option (a) merely moves subjective
 * classification into code."*
 *
 * An identifier is one of three shapes, none of which prose produces by
 * accident: an `owner/repo` slug, a domain name, or an `@scope/package`. A
 * value carrying none of them names nothing a reader could look up — it is a
 * description, and a description is what `source-confidentiality` ASKS authors
 * to write.
 *
 * Internal tokens are excluded first: this repository's own paths, its roadmap
 * slugs, ADR ids and PR references are `owner/repo`-shaped and name nothing
 * external.
 */
export function readableIdentifierIn(value: string): string | null {
    const hosts = ALLOWED_HOSTS.map(fold);
    const owners = new Set(ALLOWED_OWNERS.map(fold));
    const scopes = new Set(ALLOWED_NPM_SCOPES.map(fold));

    for (const token of pathLikeTokens(value)) {
        // INTERNAL FIRST, for every branch (R2 finding 4). The domain branch
        // used to run before this check and no branch but the slug one applied
        // it, so any internal path whose extension collides with a TLD was
        // reported as a leak: `agents/tooling/setup.sh` produced `setup.sh`, at
        // block tier, contradicting this function's own docstring.
        if (isInternalToken(token)) continue;

        const domain = firstDomainIn(token, hosts);
        if (domain !== null) return domain;

        const scoped = SCOPED_PKG_RE.exec(token);
        SCOPED_PKG_RE.lastIndex = 0;
        if (scoped !== null && !scopes.has(fold(scoped[2] as string))) {
            return `@${fold(scoped[2] as string)}/${scoped[3] as string}`;
        }

        const slug = firstSlugIn(token, owners);
        if (slug !== null) return slug;
    }
    return null;
}

/**
 * Split a header value into whitespace-delimited tokens, stripped of the
 * punctuation a sentence wraps them in.
 *
 * Tokenising is what closed the recall hole (R2 finding 2). The first version
 * scanned the WHOLE value with a slug regex and then tried to tell a repository
 * from a path by looking at the characters either side of the match — which
 * dropped every slug followed by a further segment. Measured: `somevendor/
 * some-suite/skills/foo.md`, `ported from somevendor/some-suite/README.md` and
 * `./somevendor/some-suite` all returned nothing, and citing a FILE inside an
 * external repository is the most natural Source-header shape there is.
 *
 * With the whole token in hand the question answers itself: an internal path
 * starts with an internal prefix, and anything else that carries an
 * `owner/repo` head is a citation into somewhere else.
 */
export function pathLikeTokens(value: string): string[] {
    return value
        .split(/\s+/)
        .map((t) => t.replace(/^[`*_[(<"'.,;:]+/, '').replace(/[`*_\])>"'.,;:]+$/, ''))
        // Leading path noise AFTER the punctuation strip, not before: the
        // punctuation pass already removes the `.` of `./`, so checking for
        // `./` first never fires — which is how `./somevendor/some-suite`
        // survived the first version of this fix.
        .map((t) => t.replace(/^[/]+/, ''))
        .filter((t) => t.length > 0);
}

/** The first non-allowlisted domain in a token, or null. */
function firstDomainIn(token: string, hosts: readonly string[]): string | null {
    DOMAIN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DOMAIN_RE.exec(token)) !== null) {
        const host = fold(m[1] as string);
        // SUFFIX match, not exact (R2 finding 5). The first version carved out
        // `.example.com` alone, so `docs.anthropic.com` and
        // `platform.openai.com` — vendors the rule explicitly permits naming —
        // were reported as leaks. A subdomain of an allowed host is the same
        // host's documentation, not a different source.
        if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) continue;
        return host;
    }
    return null;
}

/** The first non-allowlisted `owner/repo` head in a token, or null. */
function firstSlugIn(token: string, owners: ReadonlySet<string>): string | null {
    BARE_SLUG_RE.lastIndex = 0;
    const m = BARE_SLUG_RE.exec(token);
    BARE_SLUG_RE.lastIndex = 0;
    if (m === null) return null;
    // Only the HEAD of the token counts: `owner/repo/path/to/file.md` names one
    // repository, and reporting `path/to` from the same token would report a
    // directory as a source.
    if (m.index !== 0) return null;
    const owner = m[1] as string;
    if (owners.has(fold(owner))) return null;
    const repo = m[2] as string;
    // A two-segment token ending in a file extension is a path, not a repo:
    // `results/2026-04-21T08.json`, `road-to-x.md`.
    if (token === `${owner}/${repo}` && /\.(md|json|ts|tsx|js|mjs|yml|yaml|txt|jsonl|patch|png|svg|sh|lock)$/i.test(repo)) {
        return null;
    }
    return `${owner}/${repo}`;
}

/**
 * `source-header` hits on one line.
 *
 * **NARROWED 2026-08-30 by AI-council verdict (2/2 seats present), and the
 * reason is that the previous form measured the opposite of what it was
 * baselined for.** It flagged the VALUE of every `**Source:**` header that was
 * not an `ENC1:` token or an opaque round id — so a correctly anonymised header
 * scored exactly like a leaking one. All 95 findings in the tracked tree were
 * read: not one named an external source in readable form, and six of them were
 * flagging the *anonymisation notice itself* (`**Source:** anonymisation
 * (source-confidentiality). External harvest sources …`). One seat put it
 * plainly: the detector penalised correct behaviour.
 *
 * The class is NARROWED, never deleted — both seats refused (c), removing it,
 * on the grounds that a `**Source:**` header is the location policy directs
 * authors to record attribution and is therefore the highest-value place to
 * keep looking. What it now flags is a value carrying a readable identifier
 * (see {@link readableIdentifierIn}); the reported `value` is that identifier
 * rather than the whole header, so a finding names the thing that leaked.
 */
export function sourceHeaderHits(line: string): ShapeHit[] {
    const value = normalisedHeaderValue(line);
    if (value === null) return [];
    const identifier = readableIdentifierIn(value);
    if (identifier === null) return [];
    return [{ cls: 'source-header', value: identifier.slice(0, 120) }];
}

/**
 * The value of a `**Source:**` header, normalised — or null when the line is
 * not a header, or carries a form that is already opaque.
 *
 * EXTRACTED (R2 finding 9). Both predicates below used to carry this eight-line
 * prefilter as a verbatim copy, so any future edit to it — a new `ENC` form, a
 * different redaction marker, a change to what counts as an opaque round id —
 * would silently change what the "pre-2026-08-30" baseline MEANS, in one copy
 * or in both. A shadow metric whose definition can drift away from the live one
 * measures nothing about the live one.
 */
export function normalisedHeaderValue(line: string): string | null {
    const m = SOURCE_HEADER_RE.exec(line);
    if (!m) return null;
    const raw = (m[1] as string).trim();
    // Strip markdown emphasis, backticks and trailing punctuation before judging.
    const value = raw.replace(/^[`*_[(<"']+/, '').replace(/[`*_\])>"'.,;]+$/, '').trim();
    if (value === '') return null;
    if (ENC_TOKEN_RE.test(value)) return null;
    if (REDACTION_VALUE_RE.test(value)) return null;
    if (isOpaqueRoundId(value)) return null;
    // A header pointing at an inbox directory is judged on the directory NAME,
    // so the tmp-quote class owns it and this class stays silent — otherwise one
    // line would be counted twice and the two ratchets would move together.
    if (/agents\/tmp(?:\.old)?\//.test(value)) return null;
    return value;
}

/**
 * The PRE-narrowing `source-header` predicate, kept as a shadow metric.
 *
 * A council condition, and its purpose is auditability rather than enforcement:
 * *"keep the old detector shadow-reporting until at least one subsequent
 * corpus-changing release passes both detectors"*. It is exported so
 * `check_no_external_sources` can report the legacy count beside the live one,
 * and it gates nothing.
 *
 * It shares {@link normalisedHeaderValue} with the live predicate deliberately:
 * the only difference between the two is the readable-identifier test, and
 * making that the ONLY difference is what keeps the comparison meaningful.
 */
export function legacySourceHeaderHits(line: string): ShapeHit[] {
    const value = normalisedHeaderValue(line);
    if (value === null) return [];
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
        if (NON_HARVEST_TMP_DIRS.has(name.toLowerCase())) continue;
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
