---
name: non-portable-fixture
description: Declares a runtime semantic the carrier drops.
source: package
model_tier: high
execution:
  mode: assisted
---

# Non-portable fixture

`model_tier` and `execution` decide how this skill runs and the carrier reads
neither, so a byte-equal body proves nothing about how it would execute.
