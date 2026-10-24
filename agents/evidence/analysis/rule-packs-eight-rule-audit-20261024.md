<!-- evidence-type: analysis -->

# The eight rules the derived pack axis drops — scoping audit (step 4.9, D14 condition 4)

Taken 2026-10-24 against the real `src/config/discovery/packs.yml` and `src/rules/`: the default
active-pack set (`resolve_rule_pack_scope('auto', root, [])`, 20 packs) leaves out exactly the eight
rules `tests/install/rule_packs_auto.test.ts` pins. The council's reopen condition: a rule among them
that applies regardless of its pack.

| Rule | `packs:` | Consequence class | What it guards, by its own text | Verdict |
|---|---|---|---|---|
| `finance-safety-floor` | finance-basic, finance-advanced | yes | "Auto-activates when `pack-finance-basic` or `pack-finance-advanced` is installed" | scoped correctly |
| `legal-safety-floor` | legal-review-prep | yes | "Auto-activates when `pack-legal-review-prep` is installed" | scoped correctly |
| `strategy-safety-floor` | founder-strategy | yes | "Auto-activates when `pack-founder-strategy` is installed" | scoped correctly |
| `image-likeness-and-rights` | ai-image | yes | the package's image surfaces: `/image:` commands and `scripts/ai-image/adapters/` (its `collision_ok`); every image-generation skill is in `ai-image` | scoped with its surface |
| `media-governance-routing` | ai-image, ai-video | no | AI video/image/voice generation surfaces and their project-local policies | scoped with its surface |
| `media-sync-ground-truth` | ai-video | no | lip-sync / music-video generation (`/video:from-song`) | scoped with its surface |
| `provider-lifecycle-discipline` | ai-image, ai-video | no | `/video:*`, `/image:*`, `/audio:*` and the `scripts/ai-video/adapters/` | scoped with its surface |
| `spreadsheet-source-quality` | finance-basic | no | financial figures in a spreadsheet; its skill `spreadsheet-authoring` is itself `finance-basic` | scoped with its surface |

No rule among the eight applies regardless of its pack: three say so in their own words, five guard
surfaces that ship only with the same pack. **Stated residual:** `image-likeness-and-rights` is a
consequence-class gate on an ethical/legal subject, and an agent asked to generate an image through a
tool this package does not ship (an MCP server, a user script) no longer has the gate standing in a
default install. That is the scoping the rule declared for itself (`packs: [ai-image]`); widening it
would be a separate change to the rule, not to this step.
