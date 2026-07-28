# Provenance golden corpus

Phase 0 golden corpus for
[`road-to-provenance-and-license-governance`](../../../agents/roadmaps/archive/road-to-provenance-and-license-governance.md)
(step S0.1). This corpus is the fixed input the S0.2 pre-registered
acceptance thresholds and the S0.3 baseline run (jscpd offline, SCANOSS
online) are measured against, and it never ships in the npm package —
`internal/` is not on the `package.json` `files` allowlist.

## Layout — 36 samples

| Category | Count | Location |
|---|---|---|
| Seeded (3 depths × 8) | 24 | `samples/seeded/` |
| Independent (false-positive control) | 12 | `samples/independent/` |

`corpus.json` is the machine index: one entry per sample with `id`,
`lang`, `depth`, `algorithm`, `source_kind`, `license`,
`provenance_note`, `reference_url`, `file`, and `derived_from`.

### Seeded samples — depth definitions

Each of 8 algorithm/language pairs (4 TypeScript + 4 PHP) has exactly
three depth variants, giving 8 samples per depth × 3 depths = 24:

- **`verbatim`** — the canonical seed implementation of the algorithm,
  essentially as it would appear in any textbook/reference writeup of
  the shape. This is the baseline every other depth variant of the
  same algorithm derives from (see `derived_from` below).
- **`rename-only`** — the exact same structure, control flow, and
  statement order as the `verbatim` sibling, with identifiers,
  whitespace, and comments changed. This is the launder-by-rename
  probe (roadmap design principle 6): a detector that normalizes away
  identifiers before fingerprinting should still hit this sample.
- **`structural-rewrite`** — same behaviour, genuinely different
  control flow or decomposition (e.g. iterative → recursive, closure →
  class, full matrix → rolling array, recursion → worklist). This is
  the sample class Phase 5 (`S5.1`) measures residual detector gap
  against.

Every `rename-only` and `structural-rewrite` entry's `derived_from`
field names its `verbatim` sibling's `id`, so the three-way
transformation chain is traceable in `corpus.json` without re-deriving
it from filenames.

Algorithms covered (4 TS + 4 PHP): debounce, LRU cache, Levenshtein
distance, topological sort (Kahn's algorithm) — TypeScript; semver
compare, retry-with-exponential-backoff, deep-merge, binary-search
insertion position — PHP.

### Independent samples — the false-positive control

12 samples, split 6 TypeScript / 6 PHP (documented split — the task
allowed 4/8 or 6/6; 6/6 was chosen to mirror the seeded corpus's even
language balance):

- **8 same-task samples** (`ind-01`..`ind-08`) — the exact same 8
  algorithm/language pairs as the seeded corpus, each **independently
  reimplemented from scratch without looking at the seeded
  `verbatim` source** for that algorithm. This is the LiCoEval-style
  striking-similarity control: two people solving the same well-known
  problem independently produce structurally similar code by
  necessity (same loop shape, same variable roles), and the detector
  must NOT flag that similarity as a copy. A detector with a high
  false-positive rate on this set is unusable regardless of its
  recall on the seeded set.
- **4 extra samples with no seeded counterpart at all**
  (`ind-09`..`ind-12`) — throttle, memoize (TypeScript), UUID v4,
  query-string parsing (PHP). These widen the false-positive probe
  beyond the 8 algorithms that already have a seeded sibling, so the
  8/12 acceptance threshold in `docs/CLAIMS.md` (S0.2) is not measured
  against a set that structurally mirrors the seeded corpus 1:1.

## Sourcing decision — synthetic-canonical, not real-upstream snippets

The roadmap's original S0.1 text calls for "real snippets from
permissive MIT/Apache/BSD and copyleft GPL/AGPL repos" with a source
URL + license recorded per seeded sample. **This corpus does not do
that.** Every sample in `samples/seeded/` and `samples/independent/`
is an **independently written implementation of a widely-known
algorithm shape** (debounce, LRU cache, Levenshtein distance, etc.),
authored directly for this corpus — never fetched, pasted, or adapted
from any specific upstream file, repository, or commit.

**Why:** the task that produced this corpus was executed under a
hard constraint against fetching or pasting real third-party code from
the network. Given that constraint, the only way to build a
verbatim/rename-only/structural-rewrite triad honestly is to write our
own canonical baseline (the `verbatim` sample) and mechanically /
structurally transform it ourselves — which is exactly what the
roadmap's design principle 6 (rename-only is not transformation) asks
the detector to catch, regardless of whether the seed happened to come
from a real repo or from us. Every sample therefore carries
`source_kind: synthetic-canonical` and `license: n/a (synthetic)` in
`corpus.json` — the corpus itself carries **zero third-party license
exposure**, which is the property a provenance-governance project's
own fixtures should have in the first place (the corpus practices what
it enforces).

Each algorithm entry carries a `reference_url` only when the algorithm
has a genuine canonical **public description** (Wikipedia article,
RFC, or spec) — e.g. Levenshtein distance → Wikipedia, semver →
semver.org, UUID v4 → RFC 4122. These links describe the *algorithm*,
never a specific *code file* — no `reference_url` in this corpus ever
points at a repository, gist, or source file. Algorithms with no
formal external description (debounce, deep-merge, throttle) carry
`reference_url: null`.

### Honest limitation this creates for the G0 verdict

A synthetic corpus measures exactly two things well: (1) the
detector's sensitivity to transformation depth — does recall degrade
from `verbatim` → `rename-only` → `structural-rewrite`, and (2) its
false-positive rate on independently-authored code solving the same
task. **It does not, and cannot, measure the detector's recall against
SCANOSS's real-world OSS knowledge base**, because none of these
snippets exist in that KB (SCANOSS matches against a corpus of
*known, previously indexed* OSS — a synthetic snippet nobody has ever
published is definitionally absent from it, by construction). A
SCANOSS run against this corpus's seeded samples can therefore only
ever measure the offline layer (jscpd token-clone matching against the
corpus itself), never the online winnowing-against-known-OSS
capability the roadmap ultimately cares about.

This is a **known Phase-0 limitation**, not an oversight: the S0.2/S0.3
baseline run and the G0 gate verdict this corpus feeds must be read as
"detector sensitivity to transformation depth + false-positive
behaviour on a controlled synthetic set", never as "measured recall
against real-world OSS". Closing that gap requires a second corpus
built from genuine, licensed upstream snippets with real source URLs —
out of scope for this step and not attempted here. Any user-facing
claim that draws on this corpus's numbers (S3.1/S3.3) must carry this
same distinction.

## npm-pack exclusion

`internal/` is not listed in `package.json`'s `files` array (the npm
publish allowlist) — `internal/bench/provenance/` and everything under
it therefore never ships in the published tarball. `tests/scripts/provenance_corpus.test.ts`
asserts this statically against the `files` array rather than by
invoking `npm pack --dry-run` directly, because `npm pack` triggers the
repo's `prepack` script (a full `npm run build` + discovery/manifest
build) — not a cheap, deterministic check to run inside a unit test.
