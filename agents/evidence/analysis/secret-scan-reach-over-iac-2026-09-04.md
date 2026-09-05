<!-- evidence-type: analysis -->
# Does secret scanning see a consumer's IaC diff?

**Measured:** 2026-09-04 · **Tree:** `origin/main` at `bd7dc08d8`
**Asked by:** `road-to-infra-threat-floor.md` step 3.1, which raised this as an
open question rather than a defect. It is one, and the answer splits in two.

## The short answer

Two different questions were folded into one, and they have opposite answers.

1. **Which file extensions does the gate's scope cover?** All of them.
   `check_secret_leak` has no extension allowlist, so `.tf`, `.tfvars`, `.yaml`
   and `.hcl` are in scope on any tree it runs over.
2. **Does it ever run over a consumer's diff?** No. It is a
   package-internal maintainer gate. Nothing installs it, wires it, or exposes
   it as a verb. What a consumer gets is a gitleaks workflow **template** they
   must copy themselves.

So the honest statement is not "IaC diffs are unscanned because of an
extension filter". There is no extension filter. They are unscanned in a
consumer project because **this gate is not a consumer gate at all**, for any
extension.

## 1. Extension scope — a denylist, never an allowlist

`src/scripts/check_secret_leak.ts:48-76` defines `DEFAULT_EXCLUDE` as a list of
path and suffix regexes. It is the only content filter besides a binary sniff.
There is no positive extension list anywhere in the file.

What the denylist actually removes, in the terms of this question:

| Entry | Line | Reaches an IaC file? |
|---|---|---|
| `node_modules`, `dist`, `dist-*`, `.git`, `.claude` | `:49-53` | no |
| `fixtures`, `tests`, `__snapshot__` dirs | `:54-55`, `:68` | no |
| `*.review-input` (R2 review packages) | `:67` | no |
| `\.test\.[a-z]+$`, `\.spec\.[a-z]+$` | `:69-70` | no |
| `\.example$`, `\.sample$`, `\.env\.example` | `:71-73` | **yes** - `main.tf.example` is skipped |
| `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `composer.lock` | `:74` | **yes**, but only those four exact names; a `pnpm-lock.yaml` is skipped, every other `.yaml` is not |
| `\.min\.[a-z]+$` | `:75` | no |

The second filter is `isBinary` at `:142-152` — a NUL byte in the first 8 KiB.
Text IaC never trips it.

So on the tree it does run over, a `.tf`, `.tfvars`, `.hcl`, `.yaml` or `.yml`
file is scanned like any other source file. The only IaC-relevant exclusions
are the `.example` / `.sample` suffixes and the four named lockfiles.

## 2. Reach — the gate is maintainer-only

Three independent facts, each checkable:

- **Not in the agent-visible projection.** `dist/agent-src/scripts/` carries 14
  scripts; `check_secret_leak` is not among them. A consumer's agent cannot see
  it.
- **Not a CLI verb.** `grep -n secret src/cli/registry.ts` returns nothing, so
  there is no `agent-config` command that invokes it. It ships as a file
  (`src/scripts/` is in `package.json` `files[]`) but nothing routes to it.
- **The shipped template says so in its own words.**
  `src/agent-src/templates/github-workflows/secret-scan.yml:62-65`:

  > Maintainers of agent-config itself run the built-in TS detector, which is
  > the same engine the agent-side secret-vcs-guard rule uses

  The consumer-facing job in that same file (`:35-47`) is **gitleaks**, and the
  file's own header (`:3`) says "Copy this file to
  `.github/workflows/secret-scan.yml` in the consumer project" — so even that
  net is opt-in and absent until someone copies it.

The gate does run over this repository's own diffs:
`.github/workflows/rule-backstops.yml:237` invokes it, and `:104` notes it
defaults to the changed set.

## 3. What this does NOT establish

- **gitleaks' own extension behaviour.** The consumer-side net is a third-party
  action. Whether *it* scans `.tf` and `.yaml` was not measured here and is not
  claimed. Reading its default ruleset is a separate question.
- **Whether a consumer copied the template.** Unknowable from this tree.
- **Any coverage for the other four infrastructure threats.** Secret scanning
  decides exactly one of the five `infrastructure` rows in
  `src/skills/threat-modeling/data/threats.csv` — the credential-in-a-file row.
  Ingress CIDR, public storage, absent encryption and wildcard IAM are decided
  by nothing here: no checkov, tfsec, terrascan or trivy step exists in
  `.github/` or in any shipped template, and no HCL or IAM-policy parser ships
  in `src/scripts/`.

## Consequence recorded in the corpus

The five `infrastructure` rows each carry a `Decided by:` clause in their
`Negative Tests` cell. Four read `NO CHECK IN THIS REPOSITORY`. The fifth names
`check_secret_leak` for the repo-internal case and the gitleaks template for
the consumer case, because — per section 2 — those are two different answers
and collapsing them would overstate what a consumer gets.
