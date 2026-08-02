# Over-build lens — golden set

Five seeded cases for [`overbuild-review-lens`](../../../src/skills/overbuild-review-lens/SKILL.md).
Each directory holds `task.md` (what was asked), the code as submitted, and
`expected.yaml` (the labels a correct review must produce).

The set is deliberately mixed, because a lens that only ever finds things is a
finding generator:

| Case | Must produce | Why it is in the set |
|---|---|---|
| `trap-stdlib` | `stdlib:` | The platform already ships the capability |
| `trap-yagni` | `yagni:` | Configurability nobody asked for |
| `trap-native` | `native:` + a fenced `delete:` | Two rungs in one diff, and a deletion that needs its fence |
| `lean-crud` | **the null** | The gate. A correct lens says "nothing to cut" |
| `flatten-longer` | `flatten:` | The simpler form is one line **longer** — a size-only lens stays silent here |

`expected.yaml` fields:

- `verdict` — `lean` / `trim` / `overbuilt`
- `must_tags` — tags a correct review must emit at least once
- `forbidden_tags` — tags whose presence means the lens invented a finding
- `must_be_null` — true only for `lean-crud`
- `net_sign` — expected sign of the net-lines figure (`negative`, `zero`, `positive`)

`reference.txt` next to each is a hand-written correct review. The contract gate
([`tests/scripts/overbuild_lens_contract.test.ts`](../../scripts/overbuild_lens_contract.test.ts))
scores those references and also feeds the scorer deliberately wrong outputs to
prove it discriminates — a scorer that passes everything is worse than none.

**What this set does and does not gate.** It gates the **output contract**
deterministically, in CI, with no model call: tag grammar, the mandatory fence
line on every `delete:`, the null form, and the sign of the net figure. It does
**not** gate whether a live model finds the plant — that needs a scored eval run,
which is a human-invoked surface here. The fixtures and labels are the input that
run will consume; the honest split is stated rather than papered over.
