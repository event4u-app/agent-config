<!-- evidence-type: analysis -->

# Does opencode expose a plugin API with a deny verdict?

**Yes — and the deny channel is much narrower than the proposal assumed.**

Verified 2026-08-24. Discharges Phase 0.1 of `road-to-opencode-enforcement` and
`b-opencode-plugin-api-unverified`. `surface-matrix.yml`'s opencode row was
**wrong**; the proposal's premise was **right**; and two facts nobody had are the
reason Phase 0.3 cannot be written as specified.

## What was fetched, and the pin honestly stated

The blocker asks for `packages/plugin/src/index.ts` at git revision `6386e67`.
**That is not what was read.** The published packages were fetched from the npm
registry instead:

```bash
npm pack @opencode-ai/plugin@1.18.21   # dist/index.d.ts — the Hooks interface
npm pack @opencode-ai/sdk@1.18.21      # dist/gen/types.gen.d.ts — the Permission type
```

**So the pin recorded here is `1.18.21`, not `6386e67`.** They may or may not be
the same tree; nothing checked. The published type declarations are the stronger
artefact for this question anyway — they are the contract a plugin author
compiles against, whereas a source file at a sha is what happened to be in the
repository that day. But the substitution is stated rather than glossed: a later
reader comparing against `6386e67` is comparing against something this file did
not open.

## All four hook names resolve

| Hook | Present | Output type — i.e. what a plugin may change |
|---|---|---|
| `permission.ask` | ✅ `index.d.ts:225` | `{ status: "ask" \| "deny" \| "allow" }` |
| `tool.execute.before` | ✅ `index.d.ts:235` | `{ args: any }` |
| `shell.env` | ✅ `index.d.ts:242` | `{ env: Record<string, string> }` |
| `experimental.chat.system.transform` | ✅ `index.d.ts:265` | `{ system: string[] }` |

So `surface-matrix.yml`'s `hooks: none` and *"no plugin channel"* are **stale on a
shipped host**, and `hook_manifest.yaml`'s zero opencode entries reflect that
stale row rather than an upstream limitation. The proposal was right and the
committed config was wrong — which is the direction `b-opencode-plugin-api-unverified`
said exactly one of them had to be.

## Finding 1 — there is exactly ONE deny, and it is not on the tool path

`tool.execute.before`'s output is `{ args: any }`. **It can rewrite arguments. It
cannot refuse.** There is no `deny`, no `block`, no boolean.

The only refusal in the interface is `permission.ask` → `status: "deny"`. And
`permission.ask` fires when opencode **asks for a permission**, not on every tool
call. So a concern can only deny *where opencode already stops to ask*.

That is materially narrower than Claude Code's `pre_tool_use`, which this
repository's four-state model describes as the slot that both fires on every tool
call and honours a deny. On opencode a concern gets **one or the other**: fire on
every call (`tool.execute.before`, mutate-only) or be able to refuse
(`permission.ask`, only when asked).

## Finding 2 — the deny channel may not carry what the concerns decide on

`Permission`, from the SDK at the same pin:

```ts
type Permission = {
  id: string; type: string; pattern?: string | Array<string>;
  sessionID: string; messageID: string; callID?: string;
  title: string; metadata: { [key: string]: unknown };
  time: { created: number };
};
```

**No tool name. No tool arguments. No file path**, except whatever `pattern` and
the untyped `metadata` happen to carry.

Four of the six concerns Phase 0.3 wants to pre-register decide on exactly those
things:

| Concern | Decides on | Available in `Permission`? |
|---|---|---|
| `block-kernel-rule-writes` | the **path** being written | only if `pattern`/`metadata` carries it — untyped, unverified |
| `block-config-weakening` | the path **and the diff** | diff certainly not |
| `block-no-verify` | the **command string** | not present as a typed field |
| `git-authorization` | the git **operation** | not present as a typed field |
| `hardenedSpawnEnv` → `shell.env` | env only | ✅ mutate-only, which is all it needs |
| kernel projection → `chat.system.transform` | system prompt only | ✅ mutate-only, which is all it needs |

**The two that need no deny are the two that work.** The four that need a deny
need data the deny channel is not typed to carry.

This is not a verdict that they are impossible — `metadata` is
`Record<string, unknown>` and may in practice carry the tool input; that is a
runtime question this offline read cannot answer. It is a verdict that **Phase 0.3
cannot pre-register six red/green criteria on the strength of the hook names
alone**, which is what the roadmap's own ordering asks it to do.

## What this changes downstream

- **0.2 must correct the matrix**, and the correction is a real one: a shipped
  host was described as having no plugin channel when it has four hooks and a
  deny.
- **0.3's six-concern PREREG is not yet writable.** Two concerns are
  pre-registerable today (`shell.env`, `chat.system.transform` — both mutate-only,
  both matching their hook's shape exactly). Four need a prior runtime
  observation: does `permission.ask`'s `metadata` carry the tool input on this
  host, and does opencode ask for permission on the operations these concerns
  guard?
- **`b-second-carrier-doctrine` gets sharper, not softer.** A plugin that denies
  on `permission.ask` with data the dispatcher never sees would be reaching a
  verdict the dispatcher cannot reach — the "second authority surface" the blocker
  names. But if the deny can only fire where opencode already asks, the plugin is
  closer to a *translator of an existing stop* than a new authority. Which of the
  two it is depends on Finding 2's runtime answer.

## What this does NOT establish

- **Nothing about runtime behaviour.** Every statement above is read off type
  declarations. Whether a `deny` is honoured, whether a thrown error blocks,
  whether `metadata` carries tool input, and when opencode asks at all — all
  unobserved. No plugin was installed and no opencode session was run.
- **Nothing about the git sha the blocker names.** See § the pin, above.
- **Nothing about `permission.ask`'s firing frequency**, which is the single fact
  the four blocked concerns turn on.
