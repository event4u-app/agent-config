## Startup contract

- **When:** prompt matches eligible slash command → numbered options + "run as-is" always present, always last, never removed · MEDIUM/LOW always emit block.
- **Must:** suggest through the options block; the user picks.
- **Never:** invoke a command because it matched · block never starts a command flow.
- **Except:** HIGH skips block only if all three hold: unique deterministic signal, no 2nd candidate over floor, routed cmd shows own confirm screen; removes 2nd confirmation, never 1st.
- **Bounds:** acting-on-arrival command never HIGH · 2 candidates over floor or substring hit = MEDIUM · no deterministic unique signal → block · >5% mis-routes over 50 auto-routes → block-always (rate unmeasured, not low); mis-route = reportable defect.
- **Prec:** junior to scope-control (no git-op cmd behind declined gate), ask-when-uncertain (clarification wins), verify-before-complete (never interrupt evidence checks), role-mode-adherence (role contract wins), engine halt (/implement-ticket, /work) · any conflict → stay silent · Hard-Floor action stays gated.
