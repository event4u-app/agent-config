---
demo_for: verify-before-complete
layer: pattern-memory
prose_delta:
  rule_chars_before: 2196
  rule_chars_after: 2603
  measured_at: phase-3.3-cross-link-landing
  note: "+407 chars from the Examples cross-link block; future prose-pruning rounds (out of scope for Phase 3) will pull pattern prose from the rule into this demo and drive the after-count below the before-count."
---

# verify-before-complete — Pattern Memory

> Wrong / right / why demos for the `verify-before-complete` Iron
> Law (no completion claim without fresh evidence in this message).
> Linked from
> [`verify-before-complete`](../../.agent-src.uncompressed/rules/verify-before-complete.md)
> § Examples. Outcome baseline at
> [`tests/golden/outcomes/verify_before_complete.json`](../../tests/golden/outcomes/verify_before_complete.json).

## Demo 1 — Hedged completion claim

### Wrong shape

```
User: ist der Fix fertig?

Agent: Ja, sollte jetzt durchlaufen — ich habe die fehlende
Bedingung ergänzt und die Tests müssten grün sein.
```

**Failure mode:** "sollte", "müssten" are red-flag hedges (§ Red
flags — STOP immediately). No fresh command output in this message.
The claim rides on inference, not evidence.

### Right shape

```
User: ist der Fix fertig?

Agent: Frisch gerade ausgeführt:

$ python3 -m pytest tests/test_load_context.py -v
============================== 7 passed in 0.07s ===============================

Exit code 0, 7/7 grün. Damit ist der Fix verifiziert.
```

### Why it works

Literal command line, fresh output, exit code, pass count — all in
this message. The user can scroll up and see the same shape that
the test runner produced. No hedging vocabulary.

## Demo 2 — Trusting an earlier run

### Wrong shape

```
[12 messages earlier, agent ran tests — green]

User: also fertig zum committen?

Agent: Ja, die Tests waren ja grün vorhin. Du kannst committen.
```

**Failure mode:** "Trusting a previous run from earlier in the
conversation" — explicit red flag. Code drifted in the meantime;
the earlier run is stale evidence.

### Right shape

```
User: also fertig zum committen?

Agent: Ich verifiziere kurz — Tests laufen jetzt:

$ python3 -m pytest tests/ -q
... 47 passed in 2.31s

Grün. Plus ein quality-tools-Lauf:

$ task ci
... ✅  All checks passed

Jetzt ist der Stand sauber.
```

### Why it works

Re-runs both gates *now*. The `quality-tools` skill handles the
specific commands; the rule only mandates "fresh in this message".
"Stand sauber" is anchored on actual exit codes, not on memory.

## Demo 3 — Partial verification claimed as complete

### Wrong shape

```
User: ready für den PR?

Agent: Tests sind grün, ich öffne den PR.
```

**Failure mode:** "Relying on partial verification (ran tests but
not PHPStan)" — explicit red flag. PR-readiness needs the full
gate, not a single channel.

### Right shape

```
User: ready für den PR?

Agent: Ich check beide Gates:

$ vendor/bin/pest
... 47 passed
$ vendor/bin/phpstan analyse
... [OK] No errors

Beide grün. Soll ich den PR jetzt erstellen?
```

### Why it works

Both gates run fresh, both outputs in the message, exit summaries
visible. The follow-up question is permission-gated per
`scope-control` § Git operations — the verification is done
independently of the user's go-ahead.
