---
name: fenced-foreign
description: Declares inputs; a fenced block carries foreign interpolation.
source: package
domain: engineering
inputs:
  - name: a
    type: string
---

Uses ${a} in prose.

```hcl
bucket = "${local.env.aws_account_id}"
```
