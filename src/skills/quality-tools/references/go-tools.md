# quality-tools — Go quality tools

> Mode body of the [`quality-tools`](../SKILL.md) skill. Load this file when
> the mode table in SKILL.md routes here. The cross-mode material — execution
> policy, environment, output discipline — stays in SKILL.md and is NOT
> repeated here.

# Go Quality Tools

## Detection

`resolve_toolchain` (`work_engine/stack/runner.ts`) keys the Go ecosystem on
`go.mod` and resolves exactly one quality command, `go vet ./...`, plus the
test command `go test ./...`. It does **not** detect `golangci-lint`, so a
repository that uses one will show a `quality` list shorter than what its CI
runs. Read the repository's CI workflow before concluding the resolver's list
is the whole gate.

| Signal | Tool | What it does |
|---|---|---|
| `go.mod` present | **`go vet`** | The toolchain's own correctness checks — printf verbs, struct tags, unreachable code, lost cancel |
| `go.mod` present | **`gofmt`** | Canonical formatting; not resolved as a command because it is not optional in Go |
| `.golangci.yml` / `.golangci.yaml` | **golangci-lint** | Meta-linter; the resolver does not detect it |

## The toolchain's own commands

```bash
gofmt -l .                # list files whose formatting differs — empty is the pass
gofmt -w .                # rewrite them
go vet ./...              # the resolver's quality command
go build ./...            # compiles; the cheapest proof the tree is coherent
go test ./...             # the resolver's test command
go test -run '<regexp>' ./pkg/...   # the targeted probe
go test -race ./...       # the race detector — slow, and the only thing that finds a data race
```

**`gofmt -l .` with empty output is the pass.** It exits 0 whether or not it
listed files, so a pipeline that checks only the exit code never fails on
formatting. Check the output, not the status.

## golangci-lint, where a project has it

```bash
golangci-lint run         # the whole configured set
golangci-lint run ./pkg/...   # scoped to a package
```

It wraps `go vet` among others, so a project with `.golangci.yml` does not
need `go vet` run separately — and running both doubles the report rather than
widening it.

## Workflow sequence

1. `gofmt -l .` — read the output, not the exit code.
2. `go build ./...` — a compile error makes every later step meaningless.
3. `go vet ./...`, or `golangci-lint run` where the project has it.
4. `go test -run '<the thing you changed>' ./pkg/...` — targeted.
5. `go test ./...`, once, at the end; `-race` where concurrency changed.

## Gotchas

- **`./...` from the wrong directory.** The pattern is relative to the working
  directory, not to the module root. Run it from the directory holding
  `go.mod`, or name the module path.
- **A vendored tree.** With `vendor/` present the toolchain defaults to
  `-mod=vendor`; a dependency added to `go.mod` but not vendored fails to build
  with an error that names the package, not the mode. `go mod vendor` after any
  dependency change.
- **Build tags hide packages.** `go vet ./...` and `go test ./...` skip files
  excluded by build constraints, so a green run says nothing about a
  `//go:build integration` file. Name the tag (`-tags integration`) to reach it.
- **No `go` pack exists in this suite yet.** Go artifacts route through
  `engineering-base` and this reference; `src/packs/go/pack.yaml` is created by
  `road-to-stacks-beyond-php` step 2.3, which is blocked on the programme's
  skill-growth question. Until then this file is the whole of the Go quality
  surface, by design rather than by omission.
