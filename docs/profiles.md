# Six entry paths — by `profile.id`

Each block below is the first-screen for one shipped profile. The
`profile.id` written by `agent-config setup` selects the anchor; the block names
the audience, the first three things the agent does for that role,
and the exact commands and skills wired into the profile YAML at
[`.agent-src.uncompressed/profiles/<id>.yml`](../.agent-src.uncompressed/profiles/).

The summary table at the top of [`README.md`](../README.md) is the
one-page index; the prose below is the deep version.

<a id="profile-developer"></a>
## 👩‍💻 `developer` — IC engineer

Implement a ticket end-to-end, fix CI red, run a self-review before
the PR. `/implement-ticket` refines the ticket, plans, edits, tests,
and verifies; `/work` is the free-form sibling; `/review-changes`
dispatches five judges (bug, security, tests, quality, architecture)
on the local diff. Stack-aware skills cover Laravel · Symfony ·
Next.js · React · Node. **Preset default: `balanced`.**
[Profile YAML](../.agent-src.uncompressed/profiles/developer.yml) ·
[Role guide](getting-started-by-role.md#developer-the-original-audience).

<a id="profile-content_creator"></a>
## ✍️ `content_creator` — writers, ghostwriters, marketers

Draft in someone else's voice, plan a quarter of content, ship a
launch announcement, render a cinematic AI video. `/ghostwriter`
fetches and writes against a public-figure voice profile; `/post-as`
is the same primitive for your own voice (`.agent-user.md`);
`voice-and-tone-design` and `messaging-architecture` lock the brand
frame before any copy ships; `/video:from-script` and `/video:storyboard`
drive the AI video pipeline (script → character-locked image →
motion+audio prompt → provider render → stitched clip), with
`character-consistency` locking identity tokens across scenes and
`AIV_DRYRUN=true` as the cost-safety default.
**Preset default: `balanced`.**
[Profile YAML](../.agent-src.uncompressed/profiles/content_creator.yml) ·
[Role guide](getting-started-by-role.md#creator-writer-marketer-indie-content-shop).

<a id="profile-founder"></a>
## 🚀 `founder` — solo / early-stage founder

Sharpen a fuzzy idea, rank what to build, write the why-now slide.
`/challenge-me` runs a grill-style interview that turns a vague plan
into a copyable pitch; `/council` polls external AIs for a neutral
second opinion; `rice-prioritization` ranks the backlog;
`vision-articulation` and `fundraising-narrative` shape the
internal-vs-external story. **Preset default: `fast`.**
[Profile YAML](../.agent-src.uncompressed/profiles/founder.yml) ·
[Role guide](getting-started-by-role.md#founder-early-stage-operator-wearing-every-hat).

<a id="profile-agency"></a>
## 🏛 `agency` — multi-client delivery shop

Refine a fuzzy client ask into an estimated, AC-tight ticket; turn a
phase into a roadmap; ship per client without losing decision
provenance. `/refine-ticket` rewrites the ticket and surfaces top-5
risks; `estimate-ticket` sizes and splits; `decision-record` anchors
the trade-off in an ADR before code starts. **Preset default:
`strict`.**
[Profile YAML](../.agent-src.uncompressed/profiles/agency.yml) ·
[Role guide](getting-started-by-role.md#consultant-advisory-freelance-fractional).

<a id="profile-finance"></a>
## 💼 `finance` — CFO / fractional finance / FP&A

Build a DCF, stress-test the plan, frame the runway call. `dcf-modeling`
walks the WACC / terminal-value / 5-year-hold reasoning; `forecasting`
reconciles top-down vs bottom-up; `scenario-modeling` produces the
base / upside / downside cuts; `runway-cognition` frames the
fundraise-vs-cut-vs-grow decision. **Preset default: `strict`.**
[Profile YAML](../.agent-src.uncompressed/profiles/finance.yml) ·
[Role guide](getting-started-by-role.md#finance--ops-cfo-controller-ops-lead-founder-finance).

<a id="profile-ops"></a>
## 🛡 `ops` — RevOps, support, SRE-adjacent

Threat-model a change before it ships, command the incident when it
breaks, build the dashboard that catches it next time.
`/threat-model` enumerates abuse cases and trust boundaries before
the first line of code; `incident-commander` frames severity and
post-mortem; `dashboard-design` chooses the right RED / USE / Golden
Signal panel. **Preset default: `strict`.**
[Profile YAML](../.agent-src.uncompressed/profiles/ops.yml) ·
[Role guide](getting-started-by-role.md#finance--ops-cfo-controller-ops-lead-founder-finance).

> **Universal AI Agent OS, not "for developers only".** The same
> orchestration core also drives non-software trades. Worked-example
> user types ship for [galabau](../.agent-src.uncompressed/user-types/galabau-field-crew.md),
> [metalworking](../.agent-src.uncompressed/user-types/metalworking-shop.md),
> [truck driving](../.agent-src.uncompressed/user-types/truck-driver.md) —
> with a [scaffold](../.agent-src.uncompressed/user-types/_template/) for
> contributing your own.

→ [Public catalog](catalog.md) (all rules, skills, commands, guidelines) · [Skills only](skills-catalog.md) · [llms.txt](../llms.txt)
