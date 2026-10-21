<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-21 (round 3) for the KEV and EPSS sources, committed verbatim beside its verdict. Not edited after the run. -->

# Council question — may the advisory refresh read CISA KEV and FIRST EPSS?

Repository: event4u/agent-config. An earlier council round today (2026-10-21,
2/2, Q4) fixed the advisory sources at: the package managers' native audits,
OSV for public packages only, endoflife.date and the PHP and Node.js vendor
feeds — and no authenticated GitHub access. The refresh runs only from the CLI
(`agent-config audit:deps refresh`) and an opt-in CI schedule; a session start
reads the cache file and never touches the network.

The roadmap's tier step says: T0 includes "known-exploited (KEV) in a runtime
scope", and "EPSS and KEV raise a tier; neither lowers one". A fresh review
found that nothing sets the KEV flag and EPSS is absent, because neither source
is among the ones Q4 named. The tier code has the KEV branch; it is unreachable.

What is proposed. Two read-only enrichments, run by the same CLI refresh, under
the same per-project `advisories.egress` setting (`none` sends nothing):

1. **CISA KEV** — one GET of the public catalog
   (`https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`,
   about 1.5 MB). Nothing about the project leaves the machine: the whole
   catalog is downloaded and matched locally against the CVE IDs of findings.
   Cached per machine for 24 h.
2. **FIRST EPSS** — `https://api.first.org/data/v1/epss?cve=<id,id,…>`, sending
   only the CVE IDs of findings already found (public identifiers, never a
   package name or version), batched, at most 100 per request. A score of 0.1
   or more raises a finding one tier (T2 → T1, T1 → T0 only for a runtime
   scope with a fix), never lowers one.

Both are enrichments, not finding sources: their failure never creates or drops
a finding and never produces an "unknown" finding; it is recorded as a source
report, and the tier simply stays where the other sources put it. Both hosts
join the fixed allowlist the fetcher enforces (`redirect: 'error'`).

The alternative is to leave KEV and EPSS out, correct the roadmap step and the
three texts that promise a known-exploited T0 (the audit command doc, the CI
template header, the issue text), and record the gap.

Questions:
- Q1. Adopt both enrichments as proposed (a), adopt KEV only because it sends
  nothing (b), or adopt neither and correct the texts (c)?
- Q2. Is an EPSS query carrying only CVE IDs of the project's findings an
  acceptable disclosure under the per-project `advisories.egress: query`
  setting, or does it reveal enough about the project (which CVEs it is
  exposed to) to need its own opt-in?
- Q3. Is 0.1 a defensible EPSS threshold for raising a tier, given the step
  forbids lowering? Name a different value if not, with the reason.

Answer each question with a letter or a value and one paragraph of reasons.
