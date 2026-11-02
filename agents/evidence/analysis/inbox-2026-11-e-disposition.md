<!-- evidence-type: analysis -->

# inbox-2026-11-e — disposition

Round of three topic sets on code-rendered motion film (t1, t2, t3), each a
transcript plus two supplied plans. Verified at `03581ff791`. Source mapping is
in the round's encrypted intake note only.

## Coverage

| Topic | Files | Anchors | Where it went |
|---|---:|---:|---|
| t1 | 4 | 131 | `road-to-a-film-built-from-time` Phases 1, 2, 5; `later/road-to-a-film-the-project-can-ground` 1.5, 5.1 |
| t2 | 3 | 242 | `road-to-a-film-built-from-time` Phases 2, 3; `later/road-to-a-film-the-project-can-ground` Phases 1–5 |
| t3 | 3 | 152 | `road-to-a-film-built-from-time` 4.1, 4.3; `later/road-to-a-sound-that-lands-on-its-frame` |

Passes: pass 1 over the supplied `road-to-*` plans and transcripts; pass 2 over
the parallel plan in each topic added 9 rows (the declines below and the
multi-format relayout); pass 3 read the three roadmaps back against the ledger.

## Claims re-verified at the pin

| Claim | Verdict | Witness |
|---|---|---|
| No code-rendered film class (t1 D1, t2 D1) | still-true | grep for `hyperframes`, `remotion`, `__seek`, `photosensitiv` over `src/` → 0 |
| Asset witness runs with JS off (t2 D2) | still-true | `uiRenderAsset.ts:502` |
| Three-instant sampling only (t1 D3, t2 D3) | still-true | `uiRenderAsset.ts:587-598`, `:1487-1489` |
| No loudness measurement (t2 D4, t3 D2) | still-true | grep `loudnorm|ebur128|LUFS` over `src/` → 0 |
| Dead sibling links in the audio contract (t3 D8) | still-true | `audio-adapter-contract.md:5,204` |
| Media policies not shipped to consumers (t2 D8) | still-true | `package.json` `files` carries `agents/templates/` only |
| No roadmap owns the subject | still-true | owner search quoted in each roadmap's `estate_offset_exempt` |

## Reproduction

| Step | Verdict | Corrected step |
|---|---|---|
| t1 2.2 "extend `seekInPage` to call `window.__seek`" | diverged — the asset profile runs with scripts off, so a page-defined hook never exists | a separate film profile with scripts on and the network off (`road-to-a-film-built-from-time` 2.1–2.2) |

## Demands

| Demand | Disposition |
|---|---|
| Owner (t1): analyse the gallery prompts and take them into the package so a skill can use them | **owner-decision** for verbatim import (it would lower `source-confidentiality` and `content-quoting-floor`); adopted as a first-party corpus built on their structure (5.2) |
| Owner (t1): keep the reference searchable, URL stored encrypted | adopted — maintainer lane, ENC1 entry (5.4) |
| Owner (t1–t3): learn, use and adapt from the material | adopted — three roadmaps |

## Declined

- A keychain-backed reference-source CLI (t1 parallel plan) — ENC1 plus `link_crypto` already carries the requirement; a second secret store adds no capability.
- A consumer-side fetcher for the reference — consumers hold no key, and its terms are unknown.
- A React-renderer-first MVP — company-licence threshold; plain HTML plus the seek contract is the default, other renderers detected and routed.
- Four separate motion skills — one skill composes the existing ones.
- A unified video API with hybrid shot routing (t2 parallel plan) — `/video` reachability and editing belong to the parked `road-to-breadth-with-depth`.
- A GPU video-to-audio default — weights under NC or region-excluded licences (parked in the sound roadmap's kill register).
