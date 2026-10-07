<!-- evidence-type: analysis -->

# Rule triggers and links that hold — dated evidence, moved out

Dated evidence paragraph moved out of `road-to-rule-triggers-and-links-that-hold.md`
by `road-to-signals-that-mean-what-they-say` step 3.1, to bring the lightweight
roadmap back under the 600-line cap. Moved verbatim; nothing summarised or
deleted, and no checkbox, decision, criterion, tag, verify clause, or blocker
field changed or moved. The roadmap keeps a one-line pointer at the entry's
original place.

## Step 1.2 — measurement and the two first-attempt defects

done 2026-10-02 — **measured and decided; the execution is held for the
owner, and that split is the honest outcome rather than a shortfall.**
Step 0.1's report does not exist yet (that roadmap's Phase 0 is open), so
D2's `revisit-if` fired and the measurement was taken directly from the
deploy plan and the rule bodies, which is the same unit.
New `src/install/installedRuleLinks.ts` audits every link in every rule a
host installs and returns a verdict per link (`resolved`,
`directory-not-deployed`, `file-missing`, `outside-install-root`);
`src/scripts/report_installed_rule_links` prints it per host and prices
the rewrite option. It reproduces Context's 160 exactly and splits it:
113 into `contexts/` and `guidelines/`, 45 unreachable by any deploy
entry, 2 one-off. **Deploy is the cheaper repair — 0 standing characters
against 5,198** for rewriting those same 113 links at a 48-character
install prefix. Recorded as D4, the remainder as D5.
**It is not executed here.** The deploy table is part of the frozen
install ABI, and `tests/install/install_layout_contract.test.ts` caught
the first attempt: any change owes an `install_layout_version` bump plus
a deprecation window — old and new shape side by side for a minor cycle,
with in-place migration. That is a release commitment, so it is held as
the `rule-link-targets-change-the-frozen-install-abi` blocker and the
plan is back at its original 18 rows. 34 tests; the per-host ratchet
carries the pre-repair numbers so the blocker's subject stays visible.
**Two defects in this step's own first attempt, both found by review and
fixed here.** (a) `auditLink` looked the first path segment up as a
directory, so for a host that installs rules at the install ROOT
(`cline`, dest `''`) a sibling link resolved to a bare filename and read
as `directory-not-deployed` — 277 of cline's 550, every one of them fine.
cline's reading goes 550 → **273** unresolved, and the old 550 was the
maximum possible value, where no ratchet could ever have fired. (b)
`GLOBAL_DEPLOY_SOURCES` was defined TWICE — `src/scripts/install.ts` for
the CLI, `src/install/wizard-plan.ts` for the wizard — byte-identical
across all 18 host rows, and the first attempt edited only one of them,
so a wizard install would have diverged from a CLI install. `wizard-plan.ts`
is now the only definition; `install.ts` imports and re-exports it, so no
caller changed. That dedup is kept: it takes `install.ts` 5,231 → 5,175
lines and let `check_source_size_budget` go 17,620 → 17,592, and it is
what makes the held ABI change a one-place edit when the owner takes it.
