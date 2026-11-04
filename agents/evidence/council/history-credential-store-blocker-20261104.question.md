# Council question — b-history-credential-store-vs-egress-contract

The repository owner delegated this decision to the council on 2026-11-04
("zu dem blocker, entscheide den im ai council"). Pick one option and give the
reason. Name any condition under which your pick should be revisited.

## The step

Roadmap step 3.1, from owner answer OQ-34 (2026-10-29):

> Chat history stores placeholders for credentials; the original values go to a
> separate local, untracked store the agent can resolve while it works, and a
> purge deletes them after 7 days, leaving only the placeholders. Reuse the
> existing egress rules and placeholder view.

## The conflict

`docs/contracts/egress-placeholders-v1.md`, class `credential` (API keys,
tokens, private keys, passwords, connection strings with an inline secret):

> **Never restored, never stored.** The value is not written anywhere — not in a
> mapping, a log, a cache or a record. A local edit that needs the value
> re-derives it from the object it came from.

`TokenScope` (`src/scripts/_lib/egress_token.ts`) implements this: its key is
never persisted and it keeps no credential value, so a credential placeholder
can never be resolved. The reusable part of the egress layer detects and
replaces; a resolvable 7-day copy is what the contract forbids.

## Today

`src/scripts/chat_history.ts` runs no detection. A credential pasted into a
session sits in the local history file in plaintext with no expiry.

## Options

1. **Placeholders only.** History stores egress placeholders; no original is
   kept anywhere. Inside the contract as written. Drops OQ-34's "resolvable for
   7 days".
2. **Placeholders plus the 7-day store** as OQ-34 asks, with a contract
   amendment naming the history store as the single exception: 0600 file, 0700
   directory, user-global and untracked, purge on every read and write, no
   resolve after expiry. Threat model committed before the first line of the
   store.

## Answer format

First line exactly: `VERDICT: option-1` or `VERDICT: option-2`.
Then the reasoning, then a line `REVISIT-IF: <condition>`.
