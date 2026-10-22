# Egress placeholders — the engine against PREREG endpoints (a), (b), (c) and (f), credential half

Pre-registration: `internal/bench/egress-placeholders-PREREG.md`, committed
before this run. Scorer: `internal/bench/egress-engine/run.ts`; raw figures in
the JSON beside this file. The W2 corpus is generated at run time from seed
`20261020` (18 credential rows × 100 values, four carriers: `.env`, YAML, JSON,
shell), so no credential-shaped value is committed; the generator and the seed
are the frozen corpus. Nothing was sent anywhere.

**Falsification, before any reading counted.** The recall scorer, given a
replacer blind to the `github-pat` row, read 0 % for that type; the idempotence
scorer, given a replacer that grows its output, counted 10 of 10 mismatches. Both
planted defects were rejected, so the readings below were taken.

| Endpoint | Bar | Reading | Verdict |
|---|---|---|---|
| (a) recall, every credential row on W2 | ≥ 99 % per row | 17 rows at 100 % (100/100); `generic-assignment` **75 %** (75/100) | **fails for `generic-assignment`**, passes for the 17 vendor-shaped rows |
| (b) precision on W4, credential rows | false positives under 1 % of files | 34 of 11,628 tracked text files carry a vendor-shaped credential span (0.29 %), every one a test, a fixture, a council prompt or a gate manifest quoting a shape | passes |
| (c) idempotence, `replace(replace(x)) == replace(x)` | zero tolerance | 0 mismatches over 1,800 documents | passes |
| (f) engine latency, 64 KiB input | p95 under 20 ms on the CI runner class | p50 7.85 ms, p95 8.78 ms, 200 runs — **on darwin-arm64, Node v26.7.0** (the `node` field of the JSON record), not the CI runner class | passes on this machine; the CI-class reading is not taken |

**The `generic-assignment` miss is one carrier.** Its pattern wants the operator
right after the keyword, so a JSON key (`"api_key": "…"`) — the closing quote
between keyword and colon — is never seen; the `.env`, YAML and shell carriers
are all caught. Per the PREREG null, that row's type cannot leave `uncovered` on
this reading. Widening the row would change what `check_secret_leak` refuses,
so it is not done inside this measurement.

**Not measured here, and why.**

- **(a)/(b) identifier half, (c) identifier round trip:** the table holds no
  identifier row on `main`; the rows are step 2.3 of the roadmap, held for an
  owner-invoked ratification round. Their reading exists on that step's branch
  and is published with it.
- **(d):** published 2026-10-15 (`egress-placeholders-fidelity-2026-10-15.md`).
- **(e) paired task quality:** the treatment whose quality cost the endpoint
  exists to bound is identifier replacement (D8). With credentials only, a
  council bundle or a coding task carries almost nothing to replace, so a paired
  run now would measure an empty treatment; it is taken once 2.3 lands.
- **Precision for e-mail and IBAN on the labelled negative corpus:** needs the
  same identifier rows.

**On ordering.** The PREREG and the first Phase 2–3 code reached `main` in one
squash commit (`7cd7564eb`, #2366); the order the PREREG requires was checked on
that PR's branch history before the squash, and is not recoverable from `main`
alone. The pre-squash commits, as `gh pr view 2366 --json commits` lists them:
the PREREG is `054666bdb` (committed 2026-10-15T05:27:42Z), preceded only by the
contract `f0e2cf21a`, and the first code commit is `eb0320703`
(05:31:04Z). Those are commit timestamps the author's clock set, so this pins
the order the branch recorded, not an independently witnessed one.
