## Startup contract

- **When:** authoring or editing a skill, rule, command, guideline, context, ADR, doc, roadmap, changelog or script, about to name an external repo/project as learned-from/harvested/compared/copied.
- **Never:** write that this package copied/forked/ported/adapted/was-inspired-by/compared-against a named external source into a tracked artifact · store a retained source link in plaintext · hide a plan in `.harvest-local/` for mentioning a source (dir is for raw evidence that cannot be anonymized).
- **Must:** drop the source name or say "an external reference"; to keep a link, encrypt it via `src/scripts/_lib/link_crypto.ts` · raw named evidence that cannot be understood w/o names stays local-only, gitignored · a harvest/comparison/borrow roadmap is anonymized and tracked in `agents/roadmaps/`: sources as Source A/B/C, never repo/org/author name; real links as `ENC1:` tokens in a Provenance block; borrow items are this package's own features.
- **Except:** recommending or integrating a tool or registry ("wraps the Z CLI") · license-required attribution for genuinely vendored Apache/MIT code · guards new commits only.
