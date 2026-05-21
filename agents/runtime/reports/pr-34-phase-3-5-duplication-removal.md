# Phase 3.5 — Duplication-Removal Verification for `autonomous-execution`

> **Roadmap step:** [`road-to-pr-34-followups.md`](../roadmaps/road-to-pr-34-followups.md) § Phase 3.5
> **Sibling report:** [`pr-34-phase-2-5-autonomous-execution-obligation-check.md`](pr-34-phase-2-5-autonomous-execution-obligation-check.md) (Phase 2.5 obligation diff)

## Acceptance criterion

From roadmap § 3.5:

> The logic / mechanics moved into the loaded context must be physically removed from the slim rule — diff the pre-/post-rule and assert no overlap.

## Method

Two complementary checks against the slim rule and the three cited
context files:

1. **Distinctive-marker check** — locate sections that were extracted
   (algorithm prose, Cloud Behavior heading, setting-table rows) and
   confirm each marker appears in exactly one place.
2. **Shared-line overlap** — normalize both sources (strip blanks,
   drop ≤ 3-word lines, drop pure punctuation/frontmatter delimiters)
   and compute the set intersection of non-trivial lines.

## Distinctive-marker check

| Marker | Slim rule | Cited context | Expected |
|---|---|---|---|
| Cloud Behavior `##` heading | 0 | `mechanics.md`: 1 | only in mechanics |
| Setting-table rows (\| `on` \| / \| `off` \| / \| `auto` (default) \|) | 0 | `mechanics.md`: 3 | only in mechanics |
| Detection algorithm prose | summary only (3 sentences in § Opt-in detection) | `detection.md`: full algorithm | summary inline, full body in context |
| Anchor language (`DE:` / `EN:`), worked cases, failure-mode list | 0 | `examples.md`: anchor + cases + failures | only in examples |

Every moved marker is present in exactly one location. The slim rule
retains only obligation statements and load-context citations.

## Shared-line overlap

Normalized non-trivial line counts (frontmatter, blanks, ≤ 3-word
lines, pure punctuation removed):

| Source | Non-trivial lines | Overlap with slim rule |
|---|---|---|
| Slim rule | 68 | n/a |
| `autonomy-detection.md` | 35 | **0** |
| `autonomy-mechanics.md` | 18 | **0** |
| `autonomy-examples.md` | 65 | **0** |

✅ **Zero shared non-trivial lines.** The extraction is clean — no
content was duplicated between the rule and any cited context.

## Reproduction

The check is deterministic and trivially re-runnable:

```python
import re
from pathlib import Path

rule_lines = Path('.agent-src.uncompressed/rules/autonomous-execution.md').read_text().splitlines()
ctxs = {
    'detection': '.agent-src.uncompressed/contexts/execution/autonomy-detection.md',
    'mechanics': '.agent-src.uncompressed/contexts/execution/autonomy-mechanics.md',
    'examples':  '.agent-src.uncompressed/contexts/execution/autonomy-examples.md',
}

def keep(line):
    s = line.strip()
    if not s: return False
    if s in {'---', '```yaml', '```'}: return False
    if len(s.split()) <= 3: return False
    if re.fullmatch(r'[#\-|`*\s]+', s): return False
    return True

rule_set = {l.strip() for l in rule_lines if keep(l)}
for name, path in ctxs.items():
    ctx = {l.strip() for l in Path(path).read_text().splitlines() if keep(l)}
    print(name, len(ctx & rule_set))
```

Expected output: `detection 0`, `mechanics 0`, `examples 0`.

## Conclusion

✅ **Duplication confirmed removed.** The slim rule and the three
cited contexts are disjoint at the non-trivial-line level. Every
extracted block lives in exactly one location.

Phase-3 success criterion *"Duplicated logic confirmed removed from
the rule (diff cited in PR description)"* — met.

## Status

- [x] 3.5 Confirm duplication removal — complete.
