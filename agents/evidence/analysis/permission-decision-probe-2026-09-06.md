<!-- evidence-type: analysis -->

# Emitting `permissionDecision: allow` — host probe and threat pass

`road-to-authorization-that-reaches-further` step 1.1. Two things had to be
established before the emission path could be enabled: that the running host
offers the field (Risk Register row 2), and that an allow cannot reach a call
carrying a consequence operation (Risk Register row 1). Both are recorded here.

## 1. The host probe — pinned to a build and a date

| | |
|---|---|
| **Host** | Claude Code |
| **Version** | **2.1.263** (`claude --version`) |
| **Binary probed** | `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` |
| **Probed on** | **2026-09-06** |
| **Platform** | darwin-arm64 |

Method is the one `host-input-rewrite-probe-2026-08-23.md` established —
field-name extraction from the shipped binary, with the surrounding strings as
the evidence rather than the count:

```
$ strings <binary> | grep -c 'permissionDecision'        → 33
$ strings <binary> | grep -c 'permissionDecisionReason'  → 12
$ strings <binary> | grep -c 'hookSpecificOutput'        → 46
```

The host's own lines, verbatim:

```
  - `permissionDecision` - "allow", "deny", or "ask" (PreToolUse only)
  - `permissionDecisionReason` - Reason for the permission decision (PreToolUse only)
  - `decision` - "block" for PostToolUse/Stop/UserPromptSubmit hooks
    (deprecated for PreToolUse, use hookSpecificOutput.permissionDecision instead)
  Unknown hook permissionDecision type:
   permissionDecision=allow ignored: a confined session takes grants only from
   its command line
```

Three facts follow, and the third is the one most likely to be forgotten:

1. The field is **offered** at 2.1.263 — this is an observation, not a
   recollection, and it supersedes nothing about any other host.
2. It is **PreToolUse only**. `emitFor` guards on the event for that reason.
3. **An allow is not a grant.** A confined session ignores it. So the
   step's benefit is the removal of a prompt, never the creation of an
   authorization, and no claim here may be read the other way.

**Scope.** Every statement is scoped to 2.1.263 on this platform. Every other
host stays `unprobed` — absence of a claim, not a claim of absence — and
`VERIFIED_PLATFORMS` still contains only `claude`, so no other host's emission
changes by a byte.

## 2. Threat pass — before the first edit

Run because a field named `permissionDecision` is an authorization surface by
construction (`security-sensitive-stop`). Four abuse cases, each with the
control that answers it and the test that pins the control.

### T1 — an allow reaches a call carrying a consequence operation

The Risk Register's rank-1 item. Since ADR-254 the Hard Floor is the only
carrier left for git, so an allow on a `git push` would hand the host a pass on
exactly what that rule still covers.

**Control:** the classifier is an **allowlist**, so an unrecognised call is not
category A and keeps its prompt. Three layers, any one of which withholds:

- a tool must be in `READ_ONLY_TOOLS`, or be `Bash`;
- a Bash command containing any of `; & | \` $ > < ( ) { } \` or a newline is
  refused **before** its argv is read, so a safe head token cannot carry a
  second command;
- a token naming a consequence operation refuses the command outright, checked
  per token and through `:` `/` `=` `,` separators so `npm run db:seed` is seen.

**Pinned by:** `tests/hooks/permission_decision.test.ts` § "category A over Bash
commands" — the compound-shape block (`ls && rm -rf /`, `cat a.txt; git push`,
`echo $(git push)`) and the consequence block (`git push`, `npm publish`,
`terraform apply`).

**Deliberately excluded, with the reason:** interpreters (`node`, `python`,
`sh`). Their named operation is "run this program", which establishes nothing
about what the program does. A test runner is admitted **by name** because
there the name is the operation.

### T2 — an allow outranks a concern that wanted to stop the call

**Control:** two independent gates, and the redundancy is the design.
`composePermissionDecision` returns `deny` on any deny and `ask` on any ask, so
an allow is only produced when every verdict was an allow; and `_permission_for`
additionally refuses unless the reduced severity is already `allow`. A concern
that blocks therefore withholds the allow twice over.

`ask` is honoured **regardless of exit code**: an advisory concern cannot block
and must not have to in order to be heard. The `{"decision":"ask"}` field has
been written to the feedback file since v1 and read by nothing until now.

**Pinned by, and proven sensitive:** the composition precedence was inverted on
2026-09-06 (`allow` checked before `deny`) and 4 tests went red, among them
"a single deny outranks any number of allows" and "withholds when a concern
denied". The edit was reverted by its exact inverse and the file confirmed
byte-identical to its pre-sabotage state. A test never seen red has unknown
sensitivity.

### T3 — a path argument escapes the working tree

A `Read` of `/etc/passwd` or `../../secrets` is still a read, and still not one
this package should wave through.

**Control:** every path-shaped input key is resolved against the working-tree
root and refused if `path.relative` escapes it. The root is the **host's own
`cwd`**, not the dispatcher's process cwd — in a worktree the latter is the
parent checkout, so confining against it would admit paths outside the tree the
call actually runs in. An unestablished root disqualifies every call: an
unestablished boundary is not a boundary.

**Pinned by:** § "working-tree confinement" and § "the confinement root is the
host cwd".

### T4 — the field is emitted to a host that does not understand it

**Control:** `VERIFIED_PLATFORMS` gates the whole emission path, and an
unverified platform still receives its legacy exit code with empty streams. A
regression test asserts the unverified path is byte-identical, and a second
asserts that calling `emitFor` **without** the new argument reproduces the
pre-change emission exactly.

### What this pass does NOT claim

- No measurement of how many prompts are actually removed. That is Phase 3's
  corpus, and asserting a number here would be the "measured drop attributed to
  the wrong cause" failure the Risk Register's rank-4 row names.
- No statement about any host but `claude` at 2.1.263.
- No gate of this package is added, removed, or weakened. Category A names calls
  nothing here gated; the composition policy can only withhold an allow, never
  produce one that a concern's verdict did not already permit.
